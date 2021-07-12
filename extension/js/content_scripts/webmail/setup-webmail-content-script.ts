/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg, TabIdRequiredError } from '../../common/browser/browser-msg.js';
import { Env, WebMailName } from '../../common/browser/env.js';
import { WebmailVariantString, XssSafeFactory } from '../../common/xss-safe-factory.js';
import { BrowserMsgCommonHandlers } from '../../common/browser/browser-msg-common-handlers.js';
import { Catch } from '../../common/platform/catch.js';
import { ContentScriptWindow } from '../../common/browser/browser-window.js';
import { Injector } from '../../common/inject.js';
import { Notifications } from '../../common/notifications.js';
import Swal from 'sweetalert2';
import { Ui } from '../../common/browser/ui.js';
import { VERSION } from '../../common/core/const.js';
import { AcctStore } from '../../common/platform/store/acct-store.js';
import { GlobalStore } from '../../common/platform/store/global-store.js';

export type WebmailVariantObject = { newDataLayer: undefined | boolean, newUi: undefined | boolean, email: undefined | string, gmailVariant: WebmailVariantString };
export type IntervalFunction = { interval: number, handler: () => void };
type WebmailSpecificInfo = {
  name: WebMailName;
  variant: WebmailVariantString;
  getUserAccountEmail: () => string | undefined;
  getUserFullName: () => string | undefined;
  getReplacer: () => WebmailElementReplacer;
  start: (acctEmail: string, inject: Injector, notifications: Notifications, factory: XssSafeFactory, notifyMurdered: () => void) => Promise<void>;
};
export interface WebmailElementReplacer {
  getIntervalFunctions: () => Array<IntervalFunction>;
  setReplyBoxEditable: () => Promise<void>;
  reinsertReplyBox: (replyMsgId: string) => void;
  scrollToReplyBox: (replyMsgId: string) => void;
  scrollToCursorInReplyBox: (replyMsgId: string, cursorOffsetTop: number) => void;
}

const win = window as unknown as ContentScriptWindow;

// tslint:disable:no-blank-lines-func
export const contentScriptSetupIfVacant = async (webmailSpecific: WebmailSpecificInfo) => {

  const setUpNotification = `
    <a href="#" class="action_open_settings" data-test="notification-setup-action-open-settings">Set up FlowCrypt</a> to send and receive secure email on this account.
    <a href="#" class="notification_setup_needed_dismiss" data-test="notification-setup-action-dismiss">dismiss</a>
    <a href="#" class="close" data-test="notification-setup-action-close">remind me later</a>
  `;
  let wasDestroyed = false;
  class DestroyTrigger extends Error { }

  const waitForAcctEmail = async (): Promise<string> => {
    let acctEmailInterval = 1000;
    const webmails = await Env.webmails();
    while (true) {
      const acctEmail = webmailSpecific.getUserAccountEmail();
      if (typeof acctEmail !== 'undefined') {
        win.account_email_global = acctEmail;
        if (webmails.includes(webmailSpecific.name)) {
          console.info(`Loading FlowCrypt ${VERSION} for ${acctEmail}`);
          return acctEmail;
        } else {
          console.info(`FlowCrypt disabled: ${webmailSpecific.name} integration currently for development only`);
          throw new DestroyTrigger();
        }
      }
      if (acctEmailInterval > 6000) {
        console.info(`Cannot load FlowCrypt yet. Page: ${window.location} (${document.title})`);
      }
      await Ui.time.sleep(acctEmailInterval, win.TrySetDestroyableTimeout);
      acctEmailInterval += 1000;
      if (wasDestroyed) {
        throw new DestroyTrigger(); // maybe not necessary, but don't want to take chances
      }
    }
  };

  const initInternalVars = async (acctEmail: string) => {
    const tabId = await BrowserMsg.requiredTabId(30, 1000); // keep trying for 30 seconds
    const notifications = new Notifications();
    const factory = new XssSafeFactory(acctEmail, tabId, win.reloadable_class, win.destroyable_class);
    const inject = new Injector(webmailSpecific.name, webmailSpecific.variant, factory);
    inject.meta();
    await GlobalStore.acctEmailsAdd(acctEmail);
    saveAcctEmailFullNameIfNeeded(acctEmail).catch(Catch.reportErr); // may take a long time, thus async
    return { tabId, notifications, factory, inject };
  };

  const showNotificationsAndWaitTilAcctSetUp = async (acctEmail: string, notifications: Notifications) => {
    let showSetupNeededNotificationIfSetupNotDone = true;
    while (true) {
      const storage = await AcctStore.get(acctEmail, ['setup_done', 'cryptup_enabled', 'notification_setup_needed_dismissed']);
      if (storage.setup_done === true && storage.cryptup_enabled !== false) { // "not false" is due to cryptup_enabled unfedined in previous versions, which means "true"
        notifications.clear();
        return;
      } else if (!$("div.webmail_notification").length && !storage.notification_setup_needed_dismissed && showSetupNeededNotificationIfSetupNotDone && storage.cryptup_enabled !== false) {
        notifications.show(setUpNotification, {
          notification_setup_needed_dismiss: () => AcctStore.set(acctEmail, { notification_setup_needed_dismissed: true }).then(() => notifications.clear()).catch(Catch.reportErr),
          action_open_settings: () => BrowserMsg.send.bg.settings({ acctEmail }),
          close: () => {
            showSetupNeededNotificationIfSetupNotDone = false;
          },
        });
      }
      await Ui.time.sleep(3000, win.TrySetDestroyableTimeout);
      if (wasDestroyed) {
        throw new DestroyTrigger(); // maybe not necessary, but don't want to take chances
      }
    }
  };

  const browserMsgListen = (acctEmail: string, tabId: string, inject: Injector, factory: XssSafeFactory, notifications: Notifications) => {
    BrowserMsg.addListener('open_new_message', async () => inject.openComposeWin());
    BrowserMsg.addListener('close_new_message', async () => {
      $('div.new_message').remove();
    });
    BrowserMsg.addListener('focus_body', async () => {
      if (document.activeElement instanceof HTMLElement) { // iframe have to be blurred before focusing body
        document.activeElement.blur();
      }
      $('body').focus();
    });
    BrowserMsg.addListener('focus_frame', async ({ frameId }: Bm.FocusFrame) => {
      $(`iframe#${frameId}`).focus();
    });
    BrowserMsg.addListener('close_reply_message', async ({ frameId }: Bm.CloseReplyMessage) => {
      $(`iframe#${frameId}`).remove();
    });
    BrowserMsg.addListener('reinsert_reply_box', async ({ replyMsgId }: Bm.ReinsertReplyBox) => {
      webmailSpecific.getReplacer().reinsertReplyBox(replyMsgId);
    });
    BrowserMsg.addListener('render_public_keys', async ({ traverseUp, afterFrameId, publicKeys }: Bm.RenderPublicKeys) => {
      const traverseUpLevels = traverseUp as number || 0;
      let appendAfter = $(`iframe#${afterFrameId}`);
      for (let i = 0; i < traverseUpLevels; i++) {
        appendAfter = appendAfter.parent();
      }
      for (const armoredPubkey of publicKeys) {
        appendAfter.after(factory.embeddedPubkey(armoredPubkey, false));
      }
    });
    BrowserMsg.addListener('close_dialog', async () => {
      Swal.close();
    });
    BrowserMsg.addListener('scroll_to_reply_box', async ({ replyMsgId }: Bm.ScrollToReplyBox) => {
      webmailSpecific.getReplacer().scrollToReplyBox(replyMsgId);
    });
    BrowserMsg.addListener('scroll_to_cursor_in_reply_box', async ({ replyMsgId, cursorOffsetTop }: Bm.ScrollToCursorInReplyBox) => {
      webmailSpecific.getReplacer().scrollToCursorInReplyBox(replyMsgId, cursorOffsetTop);
    });
    BrowserMsg.addListener('passphrase_dialog', async ({ longids, type, initiatorFrameId }: Bm.PassphraseDialog) => {
      await factory.showPassphraseDialog(longids, type, initiatorFrameId);
    });
    BrowserMsg.addListener('add_pubkey_dialog', async ({ emails }: Bm.AddPubkeyDialog) => {
      await factory.showAddPubkeyDialog(emails);
    });
    BrowserMsg.addListener('notification_show', async ({ notification, callbacks }: Bm.NotificationShow) => {
      notifications.show(notification, callbacks);
      $('body').one('click', Catch.try(notifications.clear));
    });
    BrowserMsg.addListener('notification_show_auth_popup_needed', async ({ acctEmail }: Bm.NotificationShowAuthPopupNeeded) => {
      notifications.showAuthPopupNeeded(acctEmail);
    });
    BrowserMsg.addListener('reply_pubkey_mismatch', BrowserMsgCommonHandlers.replyPubkeyMismatch);
    BrowserMsg.addListener('add_end_session_btn', () => inject.insertEndSessionBtn(acctEmail));
    BrowserMsg.addListener('show_attachment_preview', async ({ iframeUrl }: Bm.ShowAttachmentPreview) => {
      await Ui.modal.attachmentPreview(iframeUrl);
    });

    console.log(`➕ added test_action listener in setup-webmail-content-script.ts, tabId: ${tabId}`);
    BrowserMsg.addListener('test_action', async () => {
      console.log('✔️ caught in setup-webmail-content-script.ts');
    });

    BrowserMsg.listen(tabId);
  };

  const saveAcctEmailFullNameIfNeeded = async (acctEmail: string) => {
    const storage = await AcctStore.get(acctEmail, ['full_name']);
    let timeout = 1000;
    if (typeof storage.full_name === 'undefined') {
      while (true) {
        const fullName = webmailSpecific.getUserFullName();
        if (fullName) {
          await AcctStore.set(acctEmail, { full_name: fullName });
          return;
        }
        await Ui.time.sleep(timeout, win.TrySetDestroyableTimeout);
        timeout += 1000;
        if (wasDestroyed) {
          return;
        }
      }
    }
  };

  const notifyMurdered = () => {
    const notifEl = document.getElementsByClassName('webmail_notifications')[0];
    const div = document.createElement('div');
    div.innerText = 'FlowCrypt has updated, please reload the tab. ';
    div.classList.add('webmail_notification');
    const a = document.createElement('a');
    a.href = '#';
    a.onclick = function () {
      const parent = (this as HTMLAnchorElement).parentNode as HTMLElement | undefined;
      parent?.remove();
    };
    a.textContent = 'close';
    div.appendChild(a);
    notifEl.textContent = '';
    notifEl.appendChild(div);
  };

  const entrypoint = async () => {
    try {
      const acctEmail = await waitForAcctEmail();
      const { tabId, notifications, factory, inject } = await initInternalVars(acctEmail);
      await showNotificationsAndWaitTilAcctSetUp(acctEmail, notifications);
      browserMsgListen(acctEmail, tabId, inject, factory, notifications);
      await webmailSpecific.start(acctEmail, inject, notifications, factory, notifyMurdered);
    } catch (e) {
      if (e instanceof TabIdRequiredError) {
        console.error(`FlowCrypt cannot start: ${String(e)}`);
      } else if (e instanceof Error && e.message === 'Extension context invalidated.') {
        console.info(`FlowCrypt cannot start: extension context invalidated. Destroying.`);
        win.destroy();
      } else if (!(e instanceof DestroyTrigger)) {
        Catch.reportErr(e);
      }
    }
  };

  if (!win.injected) {

    /**
     * This tries to deal with initial environment setup and plugin updtates in a running tab.
     * - vacant: no influence of previous script is apparent in the DOM
     * - destroy: script from old world will receive destroy event from new script (DOM event) and tear itself down. Should cause tab to be vacant.
     * - murdered: what Firefox does to detached scripts. Will NOT cause tab to be vacant.
     */

    win.injected = true; // background script will use this to test if scripts were already injected, and inject if not
    win.account_email_global = undefined; // used by background script
    win.same_world_global = true; // used by background_script

    win.destruction_event = Env.runtimeId() + '_destroy';
    win.destroyable_class = Env.runtimeId() + '_destroyable';
    win.reloadable_class = Env.runtimeId() + '_reloadable';
    win.destroyable_intervals = [];
    win.destroyable_timeouts = [];

    win.destroy = () => {
      Catch.try(() => {
        console.info('Updating FlowCrypt');
        document.removeEventListener(win.destruction_event, win.destroy);
        for (const id of win.destroyable_intervals) {
          clearInterval(id);
        }
        for (const id of win.destroyable_timeouts) {
          clearTimeout(id);
        }
        $('.' + win.destroyable_class).remove();
        $('.' + win.reloadable_class).each((i, reloadableEl) => {
          $(reloadableEl).replaceWith($(reloadableEl)[0].outerHTML); // xss-reinsert - inserting code that was already present should not be dangerous
        });
        wasDestroyed = true;
      })();
    };

    win.vacant = () => {
      return !$('.' + win.destroyable_class).length;
    };

    win.TrySetDestroyableInterval = (code, ms) => {
      const id = Catch.setHandledInterval(code, ms);
      win.destroyable_intervals.push(id);
      return id;
    };

    win.TrySetDestroyableTimeout = (code, ms) => {
      const id = Catch.setHandledTimeout(code, ms);
      win.destroyable_timeouts.push(id);
      return id;
    };

    document.dispatchEvent(new CustomEvent(win.destruction_event));
    document.addEventListener(win.destruction_event, win.destroy);

    if (win.vacant()) {
      await entrypoint();
    } else if (Catch.browser().name === 'firefox') {
      notifyMurdered();
    }

  }

};
