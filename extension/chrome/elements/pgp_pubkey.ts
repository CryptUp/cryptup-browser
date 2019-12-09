/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Store } from '../../js/common/platform/store.js';
import { Str } from '../../js/common/core/common.js';
import { Ui } from '../../js/common/browser/ui.js';
import { mnemonic } from '../../js/common/core/mnemonic.js';
import { Pgp, Contact } from '../../js/common/core/pgp.js';
import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Assert } from '../../js/common/assert.js';
import { Xss } from '../../js/common/platform/xss.js';
import { Url } from '../../js/common/core/common.js';
import { View } from '../../js/common/view.js';

declare const openpgp: typeof OpenPGP;

// todo - this should use KeyImportUI for consistency.
View.run(class PgpPubkeyView extends View {
  private readonly acctEmail: string;
  private readonly parentTabId: string;
  private readonly armoredPubkey: string;
  private readonly frameId: string;
  private readonly compact: boolean; // means the details take up very little space.
  private readonly minimized: boolean; // means I have to click to see details.
  private publicKeys: OpenPGP.key.Key[] | undefined;
  private isExpired: boolean | undefined;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'armoredPubkey', 'parentTabId', 'minimized', 'compact', 'frameId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.armoredPubkey = Pgp.armor.normalize(Assert.urlParamRequire.string(uncheckedUrlParams, 'armoredPubkey'), 'publicKey');
    this.frameId = Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId');
    this.compact = uncheckedUrlParams.compact === true;
    this.minimized = uncheckedUrlParams.minimized === true;
  }

  async render() {
    Ui.event.protect();
    this.publicKeys = (await openpgp.key.readArmored(this.armoredPubkey)).keys;
    this.isExpired = await Pgp.key.expired(this.publicKeys[0]);
    $('.pubkey').text(this.armoredPubkey);
    if (this.compact) {
      $('.hide_if_compact').remove();
      $('body').css({ border: 'none', padding: 0 });
      $('.line').removeClass('line');
    }
    $('.line.fingerprints, .line.add_contact').css('display', this.minimized ? 'none' : 'block');
    if (this.publicKeys.length === 1) {
      $('.line.fingerprints .fingerprint').text(await Pgp.key.fingerprint(this.publicKeys[0], 'spaced') || '(fingerprint error)');
      $('.line.fingerprints .keywords').text(mnemonic(await Pgp.key.longid(this.publicKeys[0]) || '') || '(mnemonic error)');
    } else {
      $('.line.fingerprints').css({ display: 'none' });
    }
    if (this.publicKeys[0]) {
      const isUsableButExpired = await Pgp.key.usableButExpired(this.publicKeys[0]);
      if (!isUsableButExpired && ! await this.publicKeys[0].getEncryptionKey() && ! await this.publicKeys[0].getSigningKey()) {
        this.showKeyNotUsableError();
      } else {
        if (this.compact) {
          $('.hide_if_compact_and_not_error').remove();
        }
        let emailText = '';
        if (this.publicKeys.length === 1) {
          const email = Str.parseEmail(this.publicKeys[0].users[0].userId?.userid || '').email;
          if (email) {
            emailText = email;
            $('.input_email').val(email); // checked above
          }
        } else {
          emailText = 'more than one person';
          $('.input_email').css({ display: 'none' });
          const pubToEmail = (pubkey: OpenPGP.key.Key) => Str.parseEmail(pubkey.users[0].userId ? pubkey.users[0].userId!.userid : '').email;
          Xss.sanitizeAppend('.add_contact', Xss.escape(' for ' + this.publicKeys.map(pubToEmail).filter(e => !!e).join(', ')));
        }
        Xss.sanitizePrepend('#pgp_block.pgp_pubkey .result', `<span>This message includes a Public Key for <span class= "email">${Xss.escape(emailText)}</span>.</span>`);
        $('.pubkey').addClass('good');
        this.setBtnText().catch(Catch.reportErr);
      }
    } else {
      let fixed = this.armoredPubkey;
      while (/\n> |\n>\n/.test(fixed)) {
        fixed = fixed.replace(/\n> /g, '\n').replace(/\n>\n/g, '\n\n');
      }
      if (fixed !== this.armoredPubkey) { // try to re-render it after un-quoting, (minimized because it is probably their own pubkey quoted by the other guy)
        window.location.href = Url.create('pgp_pubkey.htm', {
          armoredPubkey: fixed, minimized: true,
          acctEmail: this.acctEmail, parentTabId: this.parentTabId, frameId: this.frameId
        });
      } else {
        this.showKeyNotUsableError();
      }
    }
    this.sendResizeMsg();
  }

  setHandlers() {
    $('.action_add_contact').click(this.setHandler(btn => this.addContactHandler(btn)));
    $('.input_email').keyup(this.setHandler(() => this.setBtnText()));
    $('.action_show_full').click(this.setHandler(btn => this.showFullKeyHandler(btn)));
  }

  private sendResizeMsg() {
    const desiredHeight = $('#pgp_block').height()! + (this.compact ? 10 : 30); // #pgp_block is defined in template
    BrowserMsg.send.setCss(this.parentTabId, { selector: `iframe#${this.frameId}`, css: { height: `${desiredHeight}px` } });
  }

  private async setBtnText() {
    if (this.publicKeys!.length > 1) {
      $('.action_add_contact').text('import ' + this.publicKeys!.length + ' public keys');
    } else {
      const [contact] = await Store.dbContactGet(undefined, [String($('.input_email').val())]);
      $('.action_add_contact')
        .text(contact?.has_pgp ? 'update key' : `import ${this.isExpired ? 'expired ' : ''}key`)
        .css('background-color', this.isExpired ? '#989898' : '');
    }
  }

  private showKeyNotUsableError() {
    $('.fingerprints, .add_contact').remove();
    $('#pgp_block.pgp_pubkey .result')
      .prepend('<span class="bad">This OpenPGP key is not usable.</span>'); // xss-direct
    $('.pubkey').addClass('bad');
  }

  private async addContactHandler(addContactBtn: HTMLElement) {
    if (this.publicKeys!.length > 1) {
      const contacts: Contact[] = [];
      for (const pubkey of this.publicKeys!) {
        const email = Str.parseEmail(pubkey.users[0].userId?.userid || '').email;
        if (email) {
          contacts.push(await Store.dbContactObj({
            email, client: 'pgp', pubkey: pubkey.armor(), lastUse: Date.now(), lastSig: await Pgp.key.lastSig(pubkey),
            expiresOn: await Pgp.key.dateBeforeExpiration(pubkey)
          }));
        }
      }
      await Store.dbContactSave(undefined, contacts);
      Xss.sanitizeReplace(addContactBtn, '<span class="good">added public keys</span>');
      BrowserMsg.send.addToContacts(this.parentTabId);
      $('.input_email').remove();
    } else if (this.publicKeys!.length) {
      if (Str.isEmailValid(String($('.input_email').val()))) {
        const contact = await Store.dbContactObj({
          email: String($('.input_email').val()), client: 'pgp', pubkey: this.publicKeys![0].armor(), lastUse: Date.now(),
          lastSig: await Pgp.key.lastSig(this.publicKeys![0]), expiresOn: await Pgp.key.dateBeforeExpiration(this.publicKeys![0])
        });
        await Store.dbContactSave(undefined, contact);
        BrowserMsg.send.addToContacts(this.parentTabId);
        Xss.sanitizeReplace(addContactBtn, `<span class="good">${Xss.escape(String($('.input_email').val()))} added</span>`);
        $('.input_email').remove();
      } else {
        await Ui.modal.error('This email is invalid, please check for typos. Not added.');
        $('.input_email').focus();
      }
    }
  }

  private showFullKeyHandler(showFullBtn: HTMLElement) {
    $(showFullBtn).css('display', 'none');
    $('pre.pubkey, .line.fingerprints, .line.add_contact').css('display', 'block');
    this.sendResizeMsg();
  }
});
