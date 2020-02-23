/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Injector } from './inject.js';
import { Store } from './platform/store/abstract-store.js';

export class WebmailCommon {
  private acctEmail: string;
  private injector: Injector;

  constructor(acctEmail: string, injector: Injector) {
    this.acctEmail = acctEmail;
    this.injector = injector;
  }

  public addOrRemoveEndSessionBtnIfNeeded = async () => {
    const finishSessionBtn = $('.action_finish_session');
    if ((await Store.getKeysCurrentlyInSession(this.acctEmail)).length) {
      if (!finishSessionBtn.length) {
        await this.injector.insertEndSessionBtn(this.acctEmail);
      }
    } else {
      if (finishSessionBtn.length) {
        finishSessionBtn.remove();
      }
    }
  }
}
