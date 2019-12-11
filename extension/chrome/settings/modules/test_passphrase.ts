/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/platform/store.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Settings } from '../../../js/common/settings.js';
import { Pgp } from '../../../js/common/core/pgp.js';
import { Lang } from '../../../js/common/lang.js';
import { Assert } from '../../../js/common/assert.js';
import { initPassphraseToggle } from '../../../js/common/ui/passphrase_ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { Url } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';

View.run(class TestPassphrase extends View {
  private readonly acctEmail: string;
  private readonly parentTabId: string;
  private primaryKey: OpenPGP.key.Key | undefined;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  }

  render = async () => {
    const [keyInfo] = await Store.keysGet(this.acctEmail, ['primary']);
    Assert.abortAndRenderErrorIfKeyinfoEmpty(keyInfo);
    await initPassphraseToggle(['password']);
    this.primaryKey = await Pgp.key.read(keyInfo.private);
    if (!this.primaryKey.isFullyEncrypted()) {
      const setUpPpUrl = Url.create('change_passphrase.htm', { acctEmail: this.acctEmail, parentTabId: this.parentTabId });
      Xss.sanitizeRender('#content', `<div class="line">No pass phrase set up yet: <a href="${setUpPpUrl}">set up pass phrase</a></div>`);
      return;
    }
  }

  setHandlers = () => {
    $('.action_verify').click(this.setHandler(() => this.verifyHandler()));
    $('#password').keydown(this.setEnterHandlerThatClicks('.action_verify'));
    $('.action_change_passphrase').click(this.setHandler(() => Settings.redirectSubPage(this.acctEmail, this.parentTabId, '/chrome/settings/modules/change_passphrase.htm')));
  }

  private verifyHandler = async () => {
    if (await Pgp.key.decrypt(this.primaryKey!, String($('#password').val())) === true) {
      Xss.sanitizeRender('#content', `
        <div class="line">${Lang.setup.ppMatchAllSet}</div>
        <div class="line"><div class="button green close" data-test="action-test-passphrase-successful-close">close</div></div>
      `);
      $('.close').click(Ui.event.handle(() => BrowserMsg.send.closePage(this.parentTabId)));
    } else {
      await Ui.modal.warning('Pass phrase did not match. Please try again. If you forgot your pass phrase, please change it, so that you don\'t get locked out of your encrypted messages.');
    }
  }
});
