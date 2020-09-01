/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api } from '../../../js/common/api/api.js';
import { Att } from '../../../js/common/core/att.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { PgpBlockView } from '../pgp_block';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';

declare const filesize: Function; // tslint:disable-line:ban-types

export class PgpBlockViewAttachmentsModule {

  public includedAtts: Att[] = [];

  constructor(private view: PgpBlockView) {
  }

  public renderInnerAtts = (atts: Att[]) => {
    Xss.sanitizeAppend('#pgp_block', '<div id="attachments"></div>');
    this.includedAtts = atts;
    for (const i of atts.keys()) {
      const name = (atts[i].name ? atts[i].name : 'noname').replace(/\.(pgp|gpg)$/, '');
      const nameVisible = name.length > 100 ? name.slice(0, 100) + '…' : name;
      const size = filesize(atts[i].length);
      const htmlContent = `<b>${Xss.escape(nameVisible)}</b>&nbsp;&nbsp;&nbsp;${size}<span class="progress"><span class="percent"></span></span>`;
      Xss.sanitizeAppend('#attachments', `<button class="attachment" title="${Xss.escape(name)}" index="${Number(i)}">${htmlContent}</button>`);
    }
    this.view.renderModule.resizePgpBlockFrame();
    $('#attachments .attachment').click(this.view.setHandlerPrevent('double', async target => {
      const att = this.includedAtts[Number($(target).attr('index'))];
      if (att.hasData()) {
        Browser.saveToDownloads(att);
        this.view.renderModule.resizePgpBlockFrame();
      } else {
        Xss.sanitizePrepend($(target).find('.progress'), Ui.spinner('green'));
        att.setData(await Api.download(att.url!, (perc, load, total) => this.renderProgress($(target).find('.progress .percent'), perc, load, total || att.length)));
        await Ui.delay(100); // give browser time to render
        $(target).find('.progress').text('');
        await this.decryptAndSaveAttToDownloads(att);
      }
    }));
  }

  private decryptAndSaveAttToDownloads = async (encrypted: Att) => {
    const kisWithPp = await KeyStore.getAllWithPp(this.view.acctEmail);
    const decrypted = await BrowserMsg.send.bg.await.pgpMsgDecrypt({ kisWithPp, encryptedData: encrypted.getData() });
    if (decrypted.success) {
      const att = new Att({ name: encrypted.name.replace(/\.(pgp|gpg)$/, ''), type: encrypted.type, data: decrypted.content });
      Browser.saveToDownloads(att);
      this.view.renderModule.resizePgpBlockFrame();
    } else {
      delete decrypted.message;
      console.info(decrypted);
      await Ui.modal.error(`There was a problem decrypting this file (${decrypted.error.type}: ${decrypted.error.message}). Downloading encrypted original.`);
      Browser.saveToDownloads(encrypted);
      this.view.renderModule.resizePgpBlockFrame();
    }
  }

  private renderProgress = (element: JQuery<HTMLElement>, percent: number | undefined, received: number | undefined, size: number) => {
    if (percent) {
      element.text(percent + '%');
    } else if (size && received) {
      element.text(Math.floor(((received * 0.75) / size) * 100) + '%');
    }
  }

}
