/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { EmailProvider, Store, KeyBackupMethod } from '../../../js/common/platform/store.js';
import { Url } from '../../../js/common/core/common.js';
import { Assert } from '../../../js/common/assert.js';
import { Gmail } from '../../../js/common/api/email-provider/gmail/gmail.js';
import { Rules } from '../../../js/common/rules.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { BackupChangePpModule as BackupChangePpModule } from './backup-change-pp-module.js';
import { BackupStatusModule } from './backup-status-module.js';
import { BackupManualActionModule as BackupManualModule } from './backup-manual-module.js';
import { BackupAutomaticModule } from './backup-automatic-module.js';
import { Lang } from '../../../js/common/lang.js';

export class BackupView extends View {

  public readonly statusModule: BackupStatusModule;
  public readonly changePpModule: BackupChangePpModule;
  public readonly manualModule: BackupManualModule;
  public readonly automaticModule: BackupAutomaticModule;

  public readonly acctEmail: string;
  public emailProvider: EmailProvider = 'gmail';
  public rules!: Rules;
  public readonly action: 'setup' | 'passphrase_change_gmail_backup' | 'options' | undefined;
  public readonly gmail: Gmail;
  public readonly parentTabId: string | undefined;
  public tabId!: string;

  private blocks = ['loading', 'module_status', 'module_manual'];

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'action']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.action = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'action', ['setup', 'passphrase_change_gmail_backup', 'options', undefined]);
    if (this.action !== 'setup') {
      this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    }
    this.gmail = new Gmail(this.acctEmail);
    this.changePpModule = new BackupChangePpModule(this);
    this.statusModule = new BackupStatusModule(this);
    this.manualModule = new BackupManualModule(this);
    this.automaticModule = new BackupAutomaticModule(this);
  }

  public render = async () => {
    this.tabId = await BrowserMsg.requiredTabId();
    this.rules = await Rules.newInstance(this.acctEmail);
    const storage = await Store.getAcct(this.acctEmail, ['setup_simple', 'email_provider']);
    this.emailProvider = storage.email_provider || 'gmail';
    if (!this.rules.canBackupKeys()) {
      Xss.sanitizeRender('body', `<div class="line" style="margin-top: 100px;">${Lang.setup.keyBackupsNotAllowed}</div>`);
      return;
    }
    if (this.action === 'setup') {
      $('.back').css('display', 'none');
      if (storage.setup_simple) {
        await this.automaticModule.simpleSetupAutoBackupRetryUntilSuccessful();
      } else {
        this.displayBlock('module_manual');
        $('h1').text('Back up your private key');
      }
    } else if (this.action === 'passphrase_change_gmail_backup') {
      await this.changePpModule.renderChangedPassPhraseGmailBackup(storage.setup_simple);
    } else if (this.action === 'options') {
      this.displayBlock('module_manual');
      $('h1').text('Back up your private key');
    } else {
      $('.hide_if_backup_done').css('display', 'none');
      $('h1').text('Key Backups');
      this.displayBlock('loading');
      await this.statusModule.checkAndRenderBackupStatus();
    }
  }

  public writeBackupDoneAndRender = async (prompt: number | false, method: KeyBackupMethod) => {
    await Store.setAcct(this.acctEmail, { key_backup_prompt: prompt, key_backup_method: method });
    if (this.action === 'setup') {
      window.location.href = Url.create('/chrome/settings/setup.htm', { acctEmail: this.acctEmail, action: 'finalize' });
    } else {
      window.location.reload();
    }
  }

  public displayBlock = (showBlockName: string) => {
    for (const block of this.blocks) {
      $(`#${block}`).css('display', 'none');
    }
    $(`#${showBlockName}`).css('display', 'block');
  }

  public setHandlers = () => {
    this.statusModule.setHandlers();
    this.manualModule.setHandlers();
    this.changePpModule.setHandlers();
  }

}

View.run(BackupView);
