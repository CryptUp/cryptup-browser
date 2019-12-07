/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, SendAsAlias } from '../../js/common/platform/store.js';
import { Value, Dict, Url } from '../../js/common/core/common.js';
import { Ui } from '../../js/common/browser.js';
import { BrowserMsg, Bm } from '../../js/common/extension.js';
import { Rules } from '../../js/common/rules.js';
import { Lang } from '../../js/common/lang.js';
import { Settings } from '../../js/common/settings.js';
import { Api } from '../../js/common/api/api.js';
import { Pgp, Contact } from '../../js/common/core/pgp.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Google } from '../../js/common/api/google.js';
import { Attester } from '../../js/common/api/attester.js';
import { Assert } from '../../js/common/assert.js';
import { KeyImportUi, UserAlert, KeyCanBeFixed } from '../../js/common/ui/key_import_ui.js';
import { initPassphraseToggle, shouldPassPhraseBeHidden } from '../../js/common/ui/passphrase_ui.js';
import { Xss } from '../../js/common/platform/xss.js';
import { Keyserver } from '../../js/common/api/keyserver.js';
import { View } from '../../js/common/view.js';
import { Scopes } from './../../js/common/platform/store';
import { AccountStore } from './../../js/common/platform/store.js';
import { SetupRecoveryModule } from './setup/setup-recovery.js';

declare const openpgp: typeof OpenPGP;

export interface SetupOptions {
  passphrase: string;
  passphrase_save: boolean;
  submit_main: boolean;
  submit_all: boolean;
  setup_simple: boolean;
  key_backup_prompt: number | false;
  recovered?: boolean;
  is_newly_created_key: boolean;
}

export class SetupView extends View {

  readonly acctEmail: string;
  readonly parentTabId: string | undefined;
  readonly action: 'add_key' | 'finalize' | undefined;

  readonly emailDomainsToSkip = ['yahoo', 'live', 'outlook'];
  readonly keyImportUi = new KeyImportUi({ checkEncryption: true });

  readonly setupRecovery: SetupRecoveryModule;

  tabId: string | undefined;
  scopes: Scopes | undefined;
  storage: AccountStore | undefined;
  rules: Rules | undefined;

  acctEmailAttesterFingerprint: string | undefined;
  fetchedKeyBackups: OpenPGP.key.Key[] = [];
  fetchedKeyBackupsUniqueLongids: string[] = [];
  importedKeysUniqueLongids: string[] = [];
  mathingPassphrases: string[] = [];
  submitKeyForAddrs: string[];

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'action', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.action = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'action', ['add_key', 'finalize', undefined]) as 'add_key' | 'finalize' | undefined;
    if (this.action === 'add_key') {
      this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    }
    if (this.acctEmail) {
      BrowserMsg.send.bg.updateUninstallUrl();
    } else {
      window.location.href = 'index.htm';
    }
    this.submitKeyForAddrs = [this.acctEmail];
    this.keyImportUi.initPrvImportSrcForm(this.acctEmail, this.parentTabId); // for step_2b_manual_enter, if user chooses so
    this.keyImportUi.onBadPassphrase = () => $('#step_2b_manual_enter .input_passphrase').val('').focus();
    this.keyImportUi.renderPassPhraseStrengthValidationInput($('.input_password'), $('.action_create_private'));
    this.setupRecovery = new SetupRecoveryModule(this);
  }

  async render() {
    await initPassphraseToggle(['step_2b_manual_enter_passphrase'], 'hide');
    await initPassphraseToggle(['step_2a_manual_create_input_password', 'step_2a_manual_create_input_password2', 'recovery_pasword']);
    this.storage = await Store.getAcct(this.acctEmail, ['setup_done', 'key_backup_prompt', 'email_provider', 'sendAs']);
    this.scopes = await Store.getScopes(this.acctEmail);
    this.storage.email_provider = this.storage.email_provider || 'gmail';
    this.rules = await Rules.newInstance(this.acctEmail);
    if (!this.rules.canCreateKeys()) {
      const forbidden = `${Lang.setup.creatingKeysNotAllowedPleaseImport} <a href="${Xss.escape(window.location.href)}">Back</a>`;
      Xss.sanitizeRender('#step_2a_manual_create, #step_2_easy_generating', `<div class="aligncenter"><div class="line">${forbidden}</div></div>`);
      $('.back').remove(); // back button would allow users to choose other options (eg create - not allowed)
    }
    if (this.rules.mustSubmitToAttester()) {
      $('.remove_if_enforce_submit_to_attester').remove();
    }
    this.tabId = await BrowserMsg.requiredTabId();
    await this.renderInitial();
  }

  setHandlers() {
    BrowserMsg.addListener('close_page', async () => {
      $('.featherlight-close').click();
    });
    BrowserMsg.addListener('notification_show', async ({ notification }: Bm.NotificationShow) => {
      await Ui.modal.info(notification);
    });
    BrowserMsg.listen(this.tabId!);
    $('.action_send').attr('href', Google.webmailUrl(this.acctEmail));
    $('.action_show_help').click(Ui.event.handle(() => Settings.renderSubPage(this.acctEmail, this.tabId!, '/chrome/settings/modules/help.htm')));
    $('.back').off().click(Ui.event.handle(() => {
      $('h1').text('Set Up');
      this.displayBlock('step_1_easy_or_manual');
    }));
    $("#recovery_pasword").on('keydown', event => {
      if (event.which === 13) {
        $('#step_2_recovery .action_recover_account').click();
      }
    });
    $('#step_2_recovery .action_recover_account').click(this.setHandlerPrevent('double', () => this.setupRecovery.actionRecoverAccountHandler()));
    $('#step_4_more_to_recover .action_recover_remaining').click(Ui.event.handle(async () => {
      this.displayBlock('step_2_recovery');
      $('#recovery_pasword').val('');
      const nImported = (await Store.keysGet(this.acctEmail)).length;
      const nFetched = this.fetchedKeyBackupsUniqueLongids.length;
      const txtKeysTeft = (nFetched - nImported > 1) ? `are ${nFetched - nImported} backups` : 'is one backup';
      if (this.action !== 'add_key') {
        Xss.sanitizeRender('#step_2_recovery .recovery_status', Lang.setup.nBackupsAlreadyRecoveredOrLeft(nImported, nFetched, txtKeysTeft));
        Xss.sanitizeReplace('#step_2_recovery .line_skip_recovery', Ui.e('div', { class: 'line', html: Ui.e('a', { href: '#', class: 'skip_recover_remaining', html: 'Skip this step' }) }));
        $('#step_2_recovery .skip_recover_remaining').click(Ui.event.handle(() => {
          window.location.href = Url.create('index.htm', { acctEmail: this.acctEmail });
        }));
      } else {
        Xss.sanitizeRender('#step_2_recovery .recovery_status', `There ${txtKeysTeft} left to recover.<br><br>Try different pass phrases to unlock all backups.`);
        $('#step_2_recovery .line_skip_recovery').css('display', 'none');
      }
    }));
    $('.action_skip_recovery').click(Ui.event.handle(async target => {
      if (await Ui.modal.confirm(Lang.setup.confirmSkipRecovery)) {
        this.fetchedKeyBackups = [];
        this.fetchedKeyBackupsUniqueLongids = [];
        this.mathingPassphrases = [];
        this.importedKeysUniqueLongids = [];
        this.displayBlock('step_1_easy_or_manual');
      }
    }));
    $('.action_account_settings').click(Ui.event.handle(() => {
      window.location.href = Url.create('index.htm', { acctEmail: this.acctEmail });
    }));
    $('.action_go_auth_denied').click(Ui.event.handle(() => {
      window.location.href = Url.create('index.htm', { acctEmail: this.acctEmail, page: '/chrome/settings/modules/auth_denied.htm' });
    }));
    $('.input_submit_key').click(Ui.event.handle(target => {
      // will be hidden / ignored / forced true when rules.mustSubmitToAttester() === true (for certain orgs)
      const inputSubmitAll = $(target).closest('.manual').find('.input_submit_all').first();
      if ($(target).prop('checked')) {
        if (inputSubmitAll.closest('div.line').css('visibility') === 'visible') {
          inputSubmitAll.prop({ checked: true, disabled: false });
        }
      } else {
        inputSubmitAll.prop({ checked: false, disabled: true });
      }
    }));
    $('#step_0_found_key .action_manual_create_key, #step_1_easy_or_manual .action_manual_create_key').click(Ui.event.handle(() => this.displayBlock('step_2a_manual_create')));
    $('#step_0_found_key .action_manual_enter_key, #step_1_easy_or_manual .action_manual_enter_key').click(Ui.event.handle(() => this.displayBlock('step_2b_manual_enter')));
    $('#step_2b_manual_enter .action_add_private_key').click(Ui.event.handle(async (e) => {
      if (e.className.includes('gray')) {
        await Ui.modal.warning('Please double check the pass phrase input field for any issues.');
        return;
      }
      const options: SetupOptions = {
        passphrase: String($('#step_2b_manual_enter .input_passphrase').val()),
        key_backup_prompt: false,
        submit_main: Boolean($('#step_2b_manual_enter .input_submit_key').prop('checked') || this.rules!.mustSubmitToAttester()),
        submit_all: Boolean($('#step_2b_manual_enter .input_submit_all').prop('checked') || this.rules!.mustSubmitToAttester()),
        passphrase_save: Boolean($('#step_2b_manual_enter .input_passphrase_save').prop('checked')),
        is_newly_created_key: false,
        recovered: false,
        setup_simple: false,
      };
      try {
        const checked = await this.keyImportUi.checkPrv(this.acctEmail, String($('#step_2b_manual_enter .input_private_key').val()), options.passphrase);
        Xss.sanitizeRender('#step_2b_manual_enter .action_add_private_key', Ui.spinner('white'));
        await this.saveKeys([checked.encrypted], options);
        await this.preFinalizeSetup(options);
        await this.finalizeSetup(options);
        await this.renderSetupDone();
      } catch (e) {
        if (e instanceof UserAlert) {
          return await Ui.modal.warning(e.message);
        } else if (e instanceof KeyCanBeFixed) {
          return await this.renderCompatibilityFixBlockAndFinalizeSetup(e.encrypted, options);
        } else {
          Catch.reportErr(e);
          return await Ui.modal.error(`An error happened when processing the key: ${String(e)}\nPlease write at human@flowcrypt.com`);
        }
      }
    }));
    $('#step_2a_manual_create .action_create_private').click(Ui.event.prevent('double', async () => {
      await Settings.forbidAndRefreshPageIfCannot('CREATE_KEYS', this.rules!);
      if (! await this.isCreatePrivateFormInputCorrect()) {
        return;
      }
      try {
        $('#step_2a_manual_create input').prop('disabled', true);
        Xss.sanitizeRender('#step_2a_manual_create .action_create_private', Ui.spinner('white') + 'just a minute');
        const options: SetupOptions = {
          passphrase: String($('#step_2a_manual_create .input_password').val()),
          passphrase_save: Boolean($('#step_2a_manual_create .input_passphrase_save').prop('checked')),
          submit_main: Boolean($('#step_2a_manual_create .input_submit_key').prop('checked') || this.rules!.mustSubmitToAttester()),
          submit_all: Boolean($('#step_2a_manual_create .input_submit_all').prop('checked') || this.rules!.mustSubmitToAttester()),
          key_backup_prompt: this.rules!.canBackupKeys() ? Date.now() : false,
          recovered: false,
          setup_simple: Boolean($('#step_2a_manual_create .input_backup_inbox').prop('checked')),
          is_newly_created_key: true,
        };
        await this.createSaveKeyPair(options);
        await this.preFinalizeSetup(options);
        // only finalize after backup is done. backup.htm will redirect back to this page with ?action=finalize
        window.location.href = Url.create('modules/backup.htm', { action: 'setup', acctEmail: this.acctEmail });
      } catch (e) {
        Catch.reportErr(e);
        await Ui.modal.error(`There was an error, please try again.\n\n(${String(e)})`);
        $('#step_2a_manual_create .action_create_private').text('CREATE AND SAVE');
      }
    }));
    $('#step_2a_manual_create .action_show_advanced_create_settings').click(Ui.event.handle(target => {
      const advancedCreateSettings = $('#step_2a_manual_create .advanced_create_settings');
      const container = $('#step_2a_manual_create .advanced_create_settings_container');
      if (advancedCreateSettings.is(':visible')) {
        advancedCreateSettings.hide('fast');
        $(target).find('span').text('Show Advanced Settings');
        container.css('width', '360px');
      } else {
        advancedCreateSettings.show('fast');
        $(target).find('span').text('Hide Advanced Settings');
        container.css('width', 'auto');
      }
    }));
    $('#step_4_close .action_close').click(Ui.event.handle(() => { // only rendered if action=add_key which means parentTabId was used
      if (this.parentTabId) {
        BrowserMsg.send.redirect(this.parentTabId, { location: Url.create('index.htm', { acctEmail: this.acctEmail, advanced: true }) });
      } else {
        Catch.report('setup.ts missing parentTabId');
      }
    }));
    $('.input_password').on('keydown', event => {
      if (event.which === 13) {
        $('#step_2a_manual_create .action_create_private').click();
      }
    });
    $('.input_password2').on('keydown', event => {
      if (event.which === 13) {
        $('#step_2a_manual_create .action_create_private').click();
      }
    });
  }

  private async renderInitial() {
    $('h1').text('Set Up FlowCrypt');
    $('.email-address').text(this.acctEmail);
    $('.back').css('visibility', 'hidden');
    if (this.storage!.email_provider === 'gmail') { // show alternative account addresses in setup form + save them for later
      if (!(this.scopes!.read || this.scopes!.modify)) {
        $('.auth_denied_warning').css('display', 'block');
      }
      if (this.scopes!.read || this.scopes!.modify) {
        Settings.fetchAcctAliasesFromGmail(this.acctEmail).then(this.saveAndFillSubmitOption).catch(Catch.reportErr);
      } else { // cannot read emails, don't fetch alternative addresses
        this.saveAndFillSubmitOption({}).catch(Catch.reportErr);
      }
    }
    if (this.storage!.setup_done) {
      if (this.action !== 'add_key') {
        await this.renderSetupDone();
      } else {
        await this.renderAddKeyFromBackup();
      }
    } else if (this.action === 'finalize') {
      const { tmp_submit_all, tmp_submit_main, key_backup_method } = await Store.getAcct(this.acctEmail, ['tmp_submit_all', 'tmp_submit_main', 'key_backup_method']);
      if (typeof tmp_submit_all === 'undefined' || typeof tmp_submit_main === 'undefined') {
        $('#content').text(`Setup session expired. To set up FlowCrypt, please click the FlowCrypt icon on top right.`);
        return;
      }
      if (typeof key_backup_method !== 'string') {
        await Ui.modal.error('Backup has not successfully finished, will retry');
        window.location.href = Url.create('modules/backup.htm', { action: 'setup', acctEmail: this.acctEmail });
        return;
      }
      await this.finalizeSetup({ submit_all: tmp_submit_all, submit_main: tmp_submit_main });
      await this.renderSetupDone();
    } else {
      await this.renderSetupDialog();
    }
  }

  async renderSetupDone() {
    const storedKeys = await Store.keysGet(this.acctEmail);
    if (this.fetchedKeyBackupsUniqueLongids.length > storedKeys.length) { // recovery where not all keys were processed: some may have other pass phrase
      this.displayBlock('step_4_more_to_recover');
      $('h1').text('More keys to recover');
      $('.email').text(this.acctEmail);
      $('.private_key_count').text(storedKeys.length);
      $('.backups_count').text(this.fetchedKeyBackupsUniqueLongids.length);
    } else { // successful and complete setup
      this.displayBlock(this.action !== 'add_key' ? 'step_4_done' : 'step_4_close');
      $('h1').text(this.action !== 'add_key' ? 'You\'re all set!' : 'Recovered all keys!');
      $('.email').text(this.acctEmail);
    }
  }

  async preFinalizeSetup(options: SetupOptions): Promise<void> {
    await Store.setAcct(this.acctEmail, {
      tmp_submit_main: options.submit_main,
      tmp_submit_all: options.submit_all,
      setup_simple: options.setup_simple,
      key_backup_prompt: options.key_backup_prompt,
      is_newly_created_key: options.is_newly_created_key,
    });
  }

  async finalizeSetup({ submit_main, submit_all }: { submit_main: boolean, submit_all: boolean }): Promise<void> {
    const [primaryKi] = await Store.keysGet(this.acctEmail, ['primary']);
    Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
    try {
      await this.submitPublicKeyIfNeeded(primaryKi.public, { submit_main, submit_all });
    } catch (e) {
      return await Settings.promptToRetry('REQUIRED', e, Lang.setup.failedToSubmitToAttester, () => this.finalizeSetup({ submit_main, submit_all }));
    }
    await Store.setAcct(this.acctEmail, { setup_date: Date.now(), setup_done: true, cryptup_enabled: true });
    await Store.remove(this.acctEmail, ['tmp_submit_main', 'tmp_submit_all']);
  }

  async saveKeys(prvs: OpenPGP.key.Key[], options: SetupOptions) {
    for (const prv of prvs) {
      const longid = await Pgp.key.longid(prv);
      if (!longid) {
        await Ui.modal.error('Cannot save keys to storage because at least one of them is not valid.');
        return;
      }
      await Store.keysAdd(this.acctEmail, prv.armor());
      await Store.passphraseSave(options.passphrase_save ? 'local' : 'session', this.acctEmail, longid, options.passphrase);
    }
    const myOwnEmailAddrsAsContacts: Contact[] = [];
    const { full_name: name } = await Store.getAcct(this.acctEmail, ['full_name']);
    for (const email of this.submitKeyForAddrs) {
      myOwnEmailAddrsAsContacts.push(await Store.dbContactObj({
        email, name, client: 'cryptup', pubkey: prvs[0].toPublic().armor(), lastUse: Date.now(),
        lastSig: await Pgp.key.lastSig(prvs[0].toPublic()), expiresOn: await Pgp.key.dateBeforeExpiration(prvs[0])
      }));
    }
    await Store.dbContactSave(undefined, myOwnEmailAddrsAsContacts);
  }

  async createSaveKeyPair(options: SetupOptions) {
    await Settings.forbidAndRefreshPageIfCannot('CREATE_KEYS', this.rules!);
    const { full_name } = await Store.getAcct(this.acctEmail, ['full_name']);
    try {
      const key = await Pgp.key.create([{ name: full_name || '', email: this.acctEmail }], 'rsa4096', options.passphrase); // todo - add all addresses?
      options.is_newly_created_key = true;
      const { keys: [prv] } = await openpgp.key.readArmored(key.private);
      await this.saveKeys([prv], options);
    } catch (e) {
      Catch.reportErr(e);
      Xss.sanitizeRender('#step_2_easy_generating, #step_2a_manual_create', Lang.setup.fcDidntSetUpProperly);
    }
  }

  async saveAndFillSubmitOption(sendAsAliases: Dict<SendAsAlias>) {
    this.submitKeyForAddrs = this.filterAddressesForSubmittingKeys(Object.keys(sendAsAliases));
    await Store.setAcct(this.acctEmail, { sendAs: sendAsAliases });
    this.showSubmitAddrsOption(this.submitKeyForAddrs);
  }

  displayBlock(name: string) {
    const blocks = [
      'loading',
      'step_0_found_key',
      'step_1_easy_or_manual',
      'step_2a_manual_create', 'step_2b_manual_enter', 'step_2_easy_generating', 'step_2_recovery',
      'step_3_compatibility_fix',
      'step_4_more_to_recover',
      'step_4_done',
      'step_4_close',
    ];
    if (name) {
      $('#' + blocks.join(', #')).css('display', 'none');
      $('#' + name).css('display', 'block');
      $('.back').css('visibility', ['step_2b_manual_enter', 'step_2a_manual_create'].includes(name) ? 'visible' : 'hidden');
      if (name === 'step_2_recovery') {
        $('.backups_count_words').text(this.fetchedKeyBackupsUniqueLongids.length > 1 ? `${this.fetchedKeyBackupsUniqueLongids.length} backups` : 'a backup');
      }
    }
  }

  async getUniqueLongids(keys: OpenPGP.key.Key[]): Promise<string[]> {
    return Value.arr.unique(await Promise.all(keys.map(Pgp.key.longid))).filter(Boolean) as string[];
  }

  showSubmitAddrsOption(addrs: string[]) {
    if (addrs && addrs.length > 1) {
      $('.addresses').text(Value.arr.withoutVal(addrs, this.acctEmail).join(', '));
      $('.manual .input_submit_all').prop({ checked: true, disabled: false }).closest('div.line').css('display', 'block');
    }
  }

  async renderSetupDialog(): Promise<void> {
    let keyserverRes;
    try {
      keyserverRes = await Keyserver.lookupEmail(this.acctEmail, this.acctEmail);
    } catch (e) {
      return await Settings.promptToRetry('REQUIRED', e, Lang.setup.failedToCheckIfAcctUsesEncryption, () => this.renderSetupDialog());
    }
    if (keyserverRes.pubkey) {
      this.acctEmailAttesterFingerprint = await Pgp.key.fingerprint(keyserverRes.pubkey);
      if (!this.rules!.canBackupKeys()) {
        // they already have a key recorded on attester, but no backups allowed on the domain. They should enter their prv manually
        this.displayBlock('step_2b_manual_enter');
      } else if (this.storage!.email_provider === 'gmail' && (this.scopes!.read || this.scopes!.modify)) {
        try {
          this.fetchedKeyBackups = await Google.gmail.fetchKeyBackups(this.acctEmail);
          this.fetchedKeyBackupsUniqueLongids = await this.getUniqueLongids(this.fetchedKeyBackups);
        } catch (e) {
          return await Settings.promptToRetry('REQUIRED', e, Lang.setup.failedToCheckAccountBackups, () => this.renderSetupDialog());
        }
        if (this.fetchedKeyBackupsUniqueLongids.length) {
          this.displayBlock('step_2_recovery');
        } else {
          this.displayBlock('step_0_found_key');
        }
      } else { // cannot read gmail to find a backup, or this is outlook
        if (keyserverRes.pgpClient === 'flowcrypt') {
          // a key has been created, and the user has used cryptup in the past - this suggest they likely have a backup available, but we cannot fetch it. Enter it manually
          this.displayBlock('step_2b_manual_enter');
          Xss.sanitizePrepend('#step_2b_manual_enter', `<div class="line red">${Lang.setup.cannotLocateBackupPasteManually}<br/><br/></div>`);
        } else if (this.rules!.canCreateKeys()) {
          // has a key registered, key creating allowed on the domain. This may be old key from PKS, let them choose
          this.displayBlock('step_1_easy_or_manual');
        } else {
          // has a key registered, no key creating allowed on the domain
          this.displayBlock('step_2b_manual_enter');
        }
      }
    } else { // no indication that the person used pgp before
      if (this.rules!.canCreateKeys()) {
        this.displayBlock('step_1_easy_or_manual');
      } else {
        this.displayBlock('step_2b_manual_enter');
      }
    }
  }

  async renderAddKeyFromBackup() { // at this point, account is already set up, and this page is showing in a lightbox after selecting "from backup" in add_key.htm
    $('.profile-row, .skip_recover_remaining, .action_send, .action_account_settings, .action_skip_recovery').css({ display: 'none', visibility: 'hidden', opacity: 0 });
    Xss.sanitizeRender($('h1').parent(), '<h1>Recover key from backup</h1>');
    $('.action_recover_account').text('load key from backup');
    try {
      this.fetchedKeyBackups = await Google.gmail.fetchKeyBackups(this.acctEmail);
      this.fetchedKeyBackupsUniqueLongids = await this.getUniqueLongids(this.fetchedKeyBackups);
    } catch (e) {
      window.location.href = Url.create('modules/add_key.htm', { acctEmail: this.acctEmail, parentTabId: this.parentTabId });
      return;
    }
    if (this.fetchedKeyBackupsUniqueLongids.length) {
      const storedKeys = await Store.keysGet(this.acctEmail);
      this.importedKeysUniqueLongids = storedKeys.map(ki => ki.longid);
      await this.renderSetupDone();
      $('#step_4_more_to_recover .action_recover_remaining').click();
    } else {
      window.location.href = Url.create('modules/add_key.htm', { acctEmail: this.acctEmail, parentTabId: this.parentTabId });
    }
  }

  async submitPublicKeyIfNeeded(armoredPubkey: string, options: { submit_main: boolean, submit_all: boolean }) {
    if (!options.submit_main) {
      return;
    }
    Attester.testWelcome(this.acctEmail, armoredPubkey).catch(e => {
      if (Api.err.isSignificant(e)) {
        Catch.report('Attester.test_welcome: failed', e);
      }
    });
    let addresses;
    if (this.submitKeyForAddrs.length && options.submit_all) {
      addresses = [...this.submitKeyForAddrs];
    } else {
      addresses = [this.acctEmail];
    }
    if (this.acctEmailAttesterFingerprint && this.acctEmailAttesterFingerprint !== await Pgp.key.fingerprint(armoredPubkey)) {
      // already submitted another pubkey for this email
      // todo - offer user to fix it up
      return;
    }
    await Settings.submitPubkeys(this.acctEmail, addresses, armoredPubkey);
  }

  async renderCompatibilityFixBlockAndFinalizeSetup(origPrv: OpenPGP.key.Key, options: SetupOptions) {
    this.displayBlock('step_3_compatibility_fix');
    let fixedPrv;
    try {
      fixedPrv = await Settings.renderPrvCompatFixUiAndWaitTilSubmittedByUser(
        this.acctEmail, '#step_3_compatibility_fix', origPrv, options.passphrase, window.location.href.replace(/#$/, ''));
    } catch (e) {
      Catch.reportErr(e);
      await Ui.modal.error(`Failed to fix key (${String(e)}). Please write us at human@flowcrypt.com, we are very prompt to fix similar issues.`);
      this.displayBlock('step_2b_manual_enter');
      return;
    }
    await this.saveKeys([fixedPrv], options);
    await this.preFinalizeSetup(options);
    await this.finalizeSetup(options);
    await this.renderSetupDone();
  }

  async isCreatePrivateFormInputCorrect() {
    const password1 = $('#step_2a_manual_create .input_password');
    const password2 = $('#step_2a_manual_create .input_password2');
    if (!password1.val()) {
      await Ui.modal.warning('Pass phrase is needed to protect your private email. Please enter a pass phrase.');
      password1.focus();
      return false;
    }
    if ($('#step_2a_manual_create .action_create_private').hasClass('gray')) {
      await Ui.modal.warning('Pass phrase is not strong enough. Please make it stronger, by adding a few words.');
      password1.focus();
      return false;
    }
    if (password1.val() !== password2.val()) {
      await Ui.modal.warning('The pass phrases do not match. Please try again.');
      password2.val('').focus();
      return false;
    }
    let notePp = String(password1.val());
    if (await shouldPassPhraseBeHidden()) {
      notePp = notePp.substring(0, 2) + notePp.substring(2, notePp.length - 2).replace(/[^ ]/g, '*') + notePp.substring(notePp.length - 2, notePp.length);
    }
    const paperPassPhraseStickyNote = `
      <div style="font-size: 1.2em">
        Please write down your pass phrase and store it in safe place or even two.
        It is needed in order to access your FlowCrypt account.
      </div>
      <div class="passphrase-sticky-note">${notePp}</div>
    `;
    return await Ui.modal.confirmWithCheckbox('Yes, I wrote it down', paperPassPhraseStickyNote);
  }

  filterAddressesForSubmittingKeys(addresses: string[]): string[] {
    const filterAddrRegEx = new RegExp(`@(${this.emailDomainsToSkip.join('|')})`);
    return addresses.filter(e => !filterAddrRegEx.test(e));
  }

}

View.run(SetupView);
