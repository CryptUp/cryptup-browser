/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Store } from '../../../js/common/platform/store.js';
import { Att } from '../../../js/common/core/att.js';
import { Ui, Browser } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Pgp } from '../../../js/common/core/pgp.js';
import { Buf } from '../../../js/common/core/buf.js';
import { AttUI } from '../../../js/common/ui/att_ui.js';
import { KeyImportUi } from '../../../js/common/ui/key_import_ui.js';
import { XssSafeFactory } from '../../../js/common/xss_safe_factory.js';
import { Assert } from '../../../js/common/assert.js';
import { Api } from '../../../js/common/api/api.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { Rules } from '../../../js/common/rules.js';
import { Keyserver } from '../../../js/common/api/keyserver.js';
import { Str, Url } from '../../../js/common/core/common.js';
import { FetchKeyUI } from '../../../js/common/ui/fetch_key_ui.js';
import { View } from '../../../js/common/view.js';
import { Contact } from './../../../js/common/core/pgp';

View.run(class ContactsView extends View {

  private acctEmail: string;

  private contacts: Contact[] = [];
  private factory: XssSafeFactory | undefined; // set in render()
  private attUI = new AttUI(() => Promise.resolve({ sizeMb: 5, size: 5 * 1024 * 1024, count: 1 }));
  private rules: Rules | undefined; // set in render()
  private backBtn = '<a href="#" id="page_back_button" data-test="action-back-to-contact-list">back</a>';
  private space = '&nbsp;&nbsp;&nbsp;&nbsp;';

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  }

  async render() {
    const tabId = await BrowserMsg.requiredTabId();
    BrowserMsg.listen(tabId); // set_css
    this.factory = new XssSafeFactory(this.acctEmail, tabId, undefined, undefined, { compact: true });
    this.rules = await Rules.newInstance(this.acctEmail);
    this.attUI.initAttDialog('fineuploader', 'fineuploader_button', { attAdded: this.fileAddedHandler });
    const fetchKeyUI = new FetchKeyUI();
    fetchKeyUI.handleOnPaste($('.input_pubkey'));
    await this.loadAndRenderContactList();
  }

  setHandlers() {
    $('a.action_show').off().click(this.setHandlerPrevent('double', this.actionRenderViewPublicKeyHandler));
    $('a.action_change').off().click(this.setHandlerPrevent('double', this.actionRenderChangePublicKeyHandler));
    $('#edit_contact .action_save_edited_pubkey').off().click(this.setHandlerPrevent('double', this.actionSaveEditedPublicKeyHandler));
    $('#bulk_import .action_process').off().click(this.setHandlerPrevent('double', this.actionProcessBulkImportTextInput));
    $('a.action_remove').off().click(this.setHandlerPrevent('double', this.actionRemovePublicKey));
    $('.action_export_all').off().click(this.setHandlerPrevent('double', this.actionExportAllKeysHandler));
    $('.action_view_bulk_import').off().click(this.setHandlerPrevent('double', this.actionRenderBulkImportPageHandler));
  }

  // --- PRIVATE

  private async loadAndRenderContactList() {
    this.contacts = await Store.dbContactSearch(undefined, { has_pgp: true });
    let lineActionsHtml = '&nbsp;&nbsp;<a href="#" class="action_export_all">export all</a>&nbsp;&nbsp;' +
      '&nbsp;&nbsp;<a href="#" class="action_view_bulk_import">import public keys</a>&nbsp;&nbsp;';
    if (this.rules!.canUseCustomKeyserver() && this.rules!.getCustomKeyserver()) {
      lineActionsHtml += `&nbsp;&nbsp;<br><br><b class="bad">using custom keyserver: ${Xss.escape(this.rules!.getCustomKeyserver()!)}</b>`;
    } else {
      lineActionsHtml += '&nbsp;&nbsp;<a href="https://flowcrypt.com/docs/technical/keyserver-integration.html" target="_blank">use custom keyserver</a>&nbsp;&nbsp;';
    }
    Xss.sanitizeRender('.line.actions', lineActionsHtml);
    $('table#emails').text('');
    $('div.hide_when_rendering_subpage').css('display', 'block');
    $('table.hide_when_rendering_subpage').css('display', 'table');
    $('h1').text('Contacts and their Public Keys');
    $('#view_contact, #edit_contact, #bulk_import').css('display', 'none');
    let tableContents = '';
    for (const contact of this.contacts) {
      const e = Xss.escape(contact.email);
      const show = `<a href="#" class="action_show" data-test="action-show-pubkey"></a>`;
      const change = `<a href="#" class="action_change" data-test="action-change-pubkey"></a>`;
      const remove = `<a href="#" class="action_remove" data-test="action-remove-pubkey"></a>`;
      tableContents += `<tr email="${e}"><td>${e}</td><td>${show}</td><td>${change}</td><td>${remove}</td></tr>`;
    }
    Xss.sanitizeReplace('table#emails', `<table id="emails" class="hide_when_rendering_subpage">${tableContents}</table>`);
    this.setHandlers();
  }

  private async fileAddedHandler(file: Att) {
    this.attUI.clearAllAtts();
    const { keys, errs } = await Pgp.key.readMany(file.getData());
    if (keys.length) {
      if (errs.length) {
        await Ui.modal.warning(`some keys could not be processed due to errors:\n${errs.map(e => `-> ${e.message}\n`).join('')}`);
      }
      $('#bulk_import .input_pubkey').val(keys.map(key => key.armor()).join('\n\n'));
      $('#bulk_import .action_process').trigger('click');
      $('#file_import').hide();
    } else if (errs.length) {
      await Ui.modal.error(`error processing public keys:\n${errs.map(e => `-> ${e.message}\n`).join('')}`);
    }
  }

  private actionExportAllKeysHandler() {
    const allArmoredPublicKeys = this.contacts.map(c => (c.pubkey || '').trim()).join('\n');
    const exportFile = new Att({ name: 'public-keys-export.asc', type: 'application/pgp-keys', data: Buf.fromUtfStr(allArmoredPublicKeys) });
    Browser.saveToDownloads(exportFile, Catch.browser().name === 'firefox' ? $('.line.actions') : undefined);
  }

  private async actionRenderViewPublicKeyHandler(viewPubkeyButton: HTMLElement) {
    const [contact] = await Store.dbContactGet(undefined, [$(viewPubkeyButton).closest('tr').attr('email')!]); // defined above
    $('.hide_when_rendering_subpage').css('display', 'none');
    Xss.sanitizeRender('h1', `${this.backBtn}${this.space}${contact!.email}`); // should exist - from list of contacts
    if (contact!.client === 'cryptup') {
      Xss.sanitizeAppend('h1', '&nbsp;&nbsp;&nbsp;&nbsp;<img src="/img/logo/flowcrypt-logo-19-19.png" />');
    } else {
      Xss.sanitizeAppend('h1', '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
    }
    $('#view_contact .key_dump').text(contact!.pubkey!); // should exist - from list of contacts && should have pgp - filtered
    $('#view_contact .key_fingerprint').text(contact!.fingerprint!); // should exist - from list of contacts && should have pgp - filtered
    $('#view_contact .key_words').text(contact!.keywords!); // should exist - from list of contacts && should have pgp - filtered
    $('#view_contact').css('display', 'block');
    $('#page_back_button').click(this.setHandler(el => this.loadAndRenderContactList()));
  }

  private actionRenderChangePublicKeyHandler(changePubkeyButton: HTMLElement) {
    $('.hide_when_rendering_subpage').css('display', 'none');
    const email = $(changePubkeyButton).closest('tr').attr('email')!;
    Xss.sanitizeRender('h1', `${this.backBtn}${this.space}${Xss.escape(email)}${this.space}(edit)`);
    $('#edit_contact').css('display', 'block');
    $('#edit_contact .input_pubkey').val('').attr('email', email);
    $('#page_back_button').click(this.setHandler(el => this.loadAndRenderContactList()));
  }

  private async actionSaveEditedPublicKeyHandler() {
    const armoredPubkey = String($('#edit_contact .input_pubkey').val());
    const email = $('#edit_contact .input_pubkey').attr('email');
    if (!armoredPubkey || !email) {
      await Ui.modal.warning('No public key entered');
    } else if (await Pgp.key.fingerprint(armoredPubkey)) {
      await Store.dbContactSave(undefined, await Store.dbContactObj({
        email, client: 'pgp', pubkey: armoredPubkey, lastUse: Date.now(), expiresOn: await Pgp.key.dateBeforeExpiration(armoredPubkey)
      }));
      await this.loadAndRenderContactList();
    } else {
      await Ui.modal.warning('Cannot recognize a valid public key, please try again. Let us know at human@flowcrypt.com if you need help.');
      $('#edit_contact .input_pubkey').val('').focus();
    }
  }

  private async actionRemovePublicKey(rmPubkeyButton: HTMLElement) {
    await Store.dbContactSave(undefined, await Store.dbContactObj({ email: $(rmPubkeyButton).closest('tr').attr('email')! }));
    await this.loadAndRenderContactList();
  }

  private actionRenderBulkImportPageHandler() {
    $('.hide_when_rendering_subpage').css('display', 'none');
    Xss.sanitizeRender('h1', `${this.backBtn}${this.space}Bulk Public Key Import${this.space}`);
    $('#bulk_import').css('display', 'block');
    $('#bulk_import .input_pubkey').val('').css('display', 'inline-block');
    $('#bulk_import .action_process').css('display', 'inline-block');
    $('#bulk_import #processed').text('').css('display', 'none');
    $('#file_import').show();
    $('#file_import #fineuploader_button').css('display', 'inline-block');
    $('#page_back_button').click(this.setHandler(el => this.loadAndRenderContactList()));
  }

  private async actionProcessBulkImportTextInput() {
    try {
      const value = Str.normalize(String($('#bulk_import .input_pubkey').val())).trim();
      if (!value) {
        await Ui.modal.warning('Please paste public key(s).');
        return;
      }
      const normalizedLongid = KeyImportUi.normalizeLongId(value);
      let pub: string;
      if (normalizedLongid) {
        const data = await Keyserver.lookupLongid(this.acctEmail, normalizedLongid);
        if (data.pubkey) {
          pub = data.pubkey;
        } else {
          await Ui.modal.warning('Could not find any Public Key in our public records that matches this fingerprint or longid');
          return;
        }
      } else {
        pub = value;
      }
      let { blocks } = Pgp.armor.detectBlocks(pub);
      blocks = blocks.filter((b, i) => blocks.findIndex(f => f.content === b.content) === i); // remove duplicates
      if (!blocks.length) {
        await Ui.modal.warning('Could not find any new public keys.');
      } else if (blocks.length === 1 && blocks[0].type === 'plainText') { // Show modal because users could make a mistake
        await Ui.modal.warning('Incorrect public key. Please check and try again.');
      } else { // Render Results
        const container = $('#bulk_import #processed');
        for (const block of blocks) {
          if (block.type === 'publicKey') {
            const replacedHtmlSafe = XssSafeFactory.replaceRenderableMsgBlocks(this.factory!, block.content.toString());
            if (replacedHtmlSafe && replacedHtmlSafe !== value) {
              container.append(replacedHtmlSafe); // xss-safe-factory
            }
          } else {
            Xss.sanitizeAppend(container, `<div class="bad">Skipping found '${Pgp.friendlyMsgBlockTypeName(block.type)}'</div>`);
          }
        }
        container.css('display', 'block');
        $('#bulk_import .input_pubkey, #bulk_import .action_process, #file_import #fineuploader_button').css('display', 'none');
      }
    } catch (e) {
      if (Api.err.isSignificant(e)) {
        Catch.reportErr(e);
      }
      await Ui.modal.error(`There was an error trying to find this public key.\n\n${Api.err.eli5(e)}`);
    }
  }

});
