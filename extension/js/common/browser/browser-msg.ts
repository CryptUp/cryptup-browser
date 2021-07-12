/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { DecryptResult, DiagnoseMsgPubkeysResult, PgpMsgMethod, VerifyRes, PgpMsgTypeResult } from '../core/crypto/pgp/msg-util.js';
import { Dict, Str, UrlParams } from '../core/common.js';
import { AjaxErr } from '../api/shared/api-error.js';
import { AuthRes } from '../api/email-provider/gmail/google-auth.js';
import { Browser } from './browser.js';
import { BrowserMsgCommonHandlers } from './browser-msg-common-handlers.js';
import { Buf } from '../core/buf.js';
import { Catch } from '../platform/catch.js';
import { Env } from './env.js';
import { PassphraseDialogType } from '../xss-safe-factory.js';
import { PgpHash } from '../core/crypto/pgp/pgp-hash.js';
import { MsgUtil } from '../core/crypto/pgp/msg-util.js';
import { Ui } from './ui.js';
import { GlobalStoreDict, GlobalIndex } from '../platform/store/global-store.js';
import { AcctStoreDict, AccountIndex } from '../platform/store/acct-store.js';
import { Contact, Key, KeyUtil } from '../core/crypto/key.js';
import { OpenPGPKey } from '../core/crypto/pgp/openpgp-key.js';

export type GoogleAuthWindowResult$result = 'Success' | 'Denied' | 'Error' | 'Closed';

export namespace Bm {
  export type Dest = string;
  export type Sender = chrome.runtime.MessageSender | 'background';
  export type Response = any;
  export type RawResponse = { result: any, objUrls: { [name: string]: string }, exception?: Bm.ErrAsJson };
  export type Raw = { name: string; data: { bm: AnyRequest | {}, objUrls: Dict<string> }; to: Dest | null; uid: string; stack: string };

  export type SetCss = { css: Dict<string>, traverseUp?: number, selector: string; };
  export type AddOrRemoveClass = { class: string, selector: string; };
  export type Settings = { path?: string, page?: string, acctEmail?: string, pageUrlParams?: UrlParams, addNewAcct?: boolean };
  export type PassphraseDialog = { type: PassphraseDialogType, longids: string[], initiatorFrameId?: string };
  export type ScrollToReplyBox = { replyMsgId: string };
  export type ScrollToCursorInReplyBox = { replyMsgId: string, cursorOffsetTop: number };
  export type NotificationShow = { notification: string, callbacks?: Dict<() => void> };
  export type NotificationShowAuthPopupNeeded = { acctEmail: string };
  export type RenderPublicKeys = { afterFrameId: string, publicKeys: string[], traverseUp?: number };
  export type SubscribeDialog = { isAuthErr?: boolean };
  export type FocusFrame = { frameId: string };
  export type CloseReplyMessage = { frameId: string };
  export type ReinsertReplyBox = { replyMsgId: string };
  export type AddPubkeyDialog = { emails: string[] };
  export type Reload = { advanced?: boolean };
  export type Redirect = { location: string };
  export type OpenGoogleAuthDialog = { acctEmail?: string, scopes?: string[] };
  export type OpenPage = { page: string, addUrlText?: string | UrlParams };
  export type StripeResult = { token: string };
  export type PassphraseEntry = { entered: boolean, initiatorFrameId?: string };
  export type Db = { f: string, args: any[] };
  export type StoreSessionSet = { acctEmail: string, key: string, value: string | undefined };
  export type StoreSessionGet = { acctEmail: string, key: string };
  export type StoreGlobalGet = { keys: GlobalIndex[]; };
  export type StoreGlobalSet = { values: GlobalStoreDict; };
  export type StoreAcctGet = { acctEmail: string, keys: AccountIndex[]; };
  export type StoreAcctSet = { acctEmail: string, values: AcctStoreDict; };
  export type ReconnectAcctAuthPopup = { acctEmail: string, scopes?: string[] };
  export type PgpMsgDecrypt = PgpMsgMethod.Arg.Decrypt;
  export type PgpMsgDiagnoseMsgPubkeys = PgpMsgMethod.Arg.DiagnosePubkeys;
  export type PgpMsgVerifyDetached = PgpMsgMethod.Arg.VerifyDetached;
  export type PgpHashChallengeAnswer = { answer: string };
  export type PgpMsgType = PgpMsgMethod.Arg.Type;
  export type KeyParse = { armored: string };
  export type KeyMatch = { pubkeys: string[], longid: string };
  export type Ajax = { req: JQueryAjaxSettings, stack: string };
  export type AjaxGmailAttachmentGetChunk = { acctEmail: string, msgId: string, attachmentId: string };
  export type ShowAttachmentPreview = { iframeUrl: string };
  export type ReRenderRecipient = { contact: Contact };

  export namespace Res {
    export type GetActiveTabInfo = { provider: 'gmail' | undefined, acctEmail: string | undefined, sameWorld: boolean | undefined };
    export type StoreSessionGet = string | null;
    export type StoreSessionSet = void;
    export type StoreGlobalGet = GlobalStoreDict;
    export type StoreGlobalSet = void;
    export type StoreAcctGet = AcctStoreDict;
    export type StoreAcctSet = void;
    export type ReconnectAcctAuthPopup = AuthRes;
    export type PgpMsgDecrypt = DecryptResult;
    export type PgpMsgDiagnoseMsgPubkeys = DiagnoseMsgPubkeysResult;
    export type PgpMsgVerify = VerifyRes;
    export type PgpMsgType = PgpMsgTypeResult;
    export type PgpHashChallengeAnswer = { hashed: string };
    export type KeyParse = { key: Key };
    export type KeyMatch = { key: Key | undefined };
    export type AjaxGmailAttachmentGetChunk = { chunk: Buf };
    export type _tab_ = { tabId: string | null | undefined };
    export type Db = any; // not included in Any below
    export type Ajax = any; // not included in Any below

    export type Any = GetActiveTabInfo | _tab_ | ReconnectAcctAuthPopup
      | PgpMsgDecrypt | PgpMsgDiagnoseMsgPubkeys | PgpMsgVerify | PgpHashChallengeAnswer | PgpMsgType | KeyParse
      | StoreSessionGet | StoreSessionSet | StoreAcctGet | StoreAcctSet | StoreGlobalGet | StoreGlobalSet
      | AjaxGmailAttachmentGetChunk | KeyMatch;
  }

  export type AnyRequest = PassphraseEntry | StripeResult | OpenPage | OpenGoogleAuthDialog | Redirect | Reload |
    AddPubkeyDialog | ReinsertReplyBox | CloseReplyMessage | ScrollToReplyBox | ScrollToCursorInReplyBox | SubscribeDialog |
    RenderPublicKeys | NotificationShowAuthPopupNeeded |
    NotificationShow | PassphraseDialog | PassphraseDialog | Settings | SetCss | AddOrRemoveClass | ReconnectAcctAuthPopup |
    Db | StoreSessionSet | StoreSessionGet | StoreGlobalGet | StoreGlobalSet | StoreAcctGet | StoreAcctSet | KeyParse |
    PgpMsgDecrypt | PgpMsgDiagnoseMsgPubkeys | PgpMsgVerifyDetached | PgpHashChallengeAnswer | PgpMsgType | Ajax | FocusFrame |
    ShowAttachmentPreview | ReRenderRecipient | KeyMatch;

  // export type RawResponselessHandler = (req: AnyRequest) => Promise<void>;
  // export type RawRespoHandler = (req: AnyRequest) => Promise<void>;
  export type RawBrowserMsgHandler = (req: AnyRequest, sender: Sender, respond: (r: RawResponse) => void) => void;
  export type AsyncRespondingHandler = (req: AnyRequest, sender: Sender) => Promise<Res.Any>;
  export type AsyncResponselessHandler = (req: AnyRequest, sender: Sender) => Promise<void>;

  type StandardErrAsJson = { stack?: string; message: string, errorConstructor: 'Error' };
  type AjaxErrDetails = { status: number, url: string, responseText: string, statusText: string, resMsg?: string, resDetails?: string };
  type AjaxErrAsJson = { stack?: string; message: string, errorConstructor: 'AjaxErr', ajaxErrorDetails: AjaxErrDetails };
  export type ErrAsJson = StandardErrAsJson | AjaxErrAsJson;
}

type Handler = Bm.AsyncRespondingHandler | Bm.AsyncResponselessHandler;
type Handlers = Dict<Handler>;

export class BgNotReadyErr extends Error { }
// ts-prune-ignore-next
export class TabIdRequiredError extends Error { }

export class BrowserMsg {

  public static MAX_SIZE = 1024 * 1024; // 1MB

  public static send = { // todo - may want to organise this differently, seems to always confuse me when sending a message
    bg: {
      settings: (bm: Bm.Settings) => BrowserMsg.sendCatch(undefined, 'settings', bm),
      updateUninstallUrl: () => BrowserMsg.sendCatch(undefined, 'update_uninstall_url', {}),
      await: {
        reconnectAcctAuthPopup: (bm: Bm.ReconnectAcctAuthPopup) => BrowserMsg.sendAwait(undefined, 'reconnect_acct_auth_popup', bm, true) as Promise<Bm.Res.ReconnectAcctAuthPopup>,
        getActiveTabInfo: () => BrowserMsg.sendAwait(undefined, 'get_active_tab_info', undefined, true) as Promise<Bm.Res.GetActiveTabInfo>,
        storeSessionGet: (bm: Bm.StoreSessionGet) => BrowserMsg.sendAwait(undefined, 'session_get', bm, true) as Promise<Bm.Res.StoreSessionGet>,
        storeSessionSet: (bm: Bm.StoreSessionSet) => BrowserMsg.sendAwait(undefined, 'session_set', bm, true) as Promise<Bm.Res.StoreSessionSet>,
        storeSessionPassphraseGet: (bm: Bm.StoreSessionGet) => BrowserMsg.sendAwait(undefined, 'session_passphrase_get', bm, true) as Promise<Bm.Res.StoreSessionGet>,
        storeSessionPassphraseSet: (bm: Bm.StoreSessionSet) => BrowserMsg.sendAwait(undefined, 'session_passphrase_set', bm, true) as Promise<Bm.Res.StoreSessionSet>,
        storeGlobalGet: (bm: Bm.StoreGlobalGet) => BrowserMsg.sendAwait(undefined, 'storeGlobalGet', bm, true) as Promise<Bm.Res.StoreGlobalGet>,
        storeGlobalSet: (bm: Bm.StoreGlobalSet) => BrowserMsg.sendAwait(undefined, 'storeGlobalSet', bm, true) as Promise<Bm.Res.StoreGlobalSet>,
        storeAcctGet: (bm: Bm.StoreAcctGet) => BrowserMsg.sendAwait(undefined, 'storeAcctGet', bm, true) as Promise<Bm.Res.StoreAcctGet>,
        storeAcctSet: (bm: Bm.StoreAcctSet) => BrowserMsg.sendAwait(undefined, 'storeAcctSet', bm, true) as Promise<Bm.Res.StoreAcctSet>,
        db: (bm: Bm.Db): Promise<Bm.Res.Db> => BrowserMsg.sendAwait(undefined, 'db', bm, true) as Promise<Bm.Res.Db>,
        ajax: (bm: Bm.Ajax): Promise<Bm.Res.Ajax> => BrowserMsg.sendAwait(undefined, 'ajax', bm, true) as Promise<Bm.Res.Ajax>,
        ajaxGmailAttachmentGetChunk: (bm: Bm.AjaxGmailAttachmentGetChunk) => BrowserMsg.sendAwait(undefined, 'ajaxGmailAttachmentGetChunk',
          bm, true) as Promise<Bm.Res.AjaxGmailAttachmentGetChunk>,
        pgpMsgDiagnosePubkeys: (bm: Bm.PgpMsgDiagnoseMsgPubkeys) => BrowserMsg.sendAwait(undefined, 'pgpMsgDiagnosePubkeys', bm, true) as Promise<Bm.Res.PgpMsgDiagnoseMsgPubkeys>,
        pgpHashChallengeAnswer: (bm: Bm.PgpHashChallengeAnswer) => BrowserMsg.sendAwait(undefined, 'pgpHashChallengeAnswer', bm, true) as Promise<Bm.Res.PgpHashChallengeAnswer>,
        pgpMsgDecrypt: (bm: Bm.PgpMsgDecrypt) => BrowserMsg.sendAwait(undefined, 'pgpMsgDecrypt', bm, true) as Promise<Bm.Res.PgpMsgDecrypt>,
        pgpMsgVerifyDetached: (bm: Bm.PgpMsgVerifyDetached) => BrowserMsg.sendAwait(undefined, 'pgpMsgVerifyDetached', bm, true) as Promise<Bm.Res.PgpMsgVerify>,
        keyParse: (bm: Bm.KeyParse) => BrowserMsg.sendAwait(undefined, 'keyParse', bm, true) as Promise<Bm.Res.KeyParse>,
        keyMatch: (bm: Bm.KeyMatch) => BrowserMsg.sendAwait(undefined, 'keyMatch', bm, true) as Promise<Bm.Res.KeyMatch>,
        pgpMsgType: (bm: Bm.PgpMsgType) => BrowserMsg.sendAwait(undefined, 'pgpMsgType', bm, true) as Promise<Bm.Res.PgpMsgType>,
      },
    },
    passphraseEntry: (dest: Bm.Dest, bm: Bm.PassphraseEntry) => BrowserMsg.sendCatch(dest, 'passphrase_entry', bm),
    addEndSessionBtn: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'add_end_session_btn', {}),
    stripeResult: (dest: Bm.Dest, bm: Bm.StripeResult) => BrowserMsg.sendCatch(dest, 'stripe_result', bm),
    openPage: (dest: Bm.Dest, bm: Bm.OpenPage) => BrowserMsg.sendCatch(dest, 'open_page', bm),
    setCss: (dest: Bm.Dest, bm: Bm.SetCss) => BrowserMsg.sendCatch(dest, 'set_css', bm),
    addClass: (dest: Bm.Dest, bm: Bm.AddOrRemoveClass) => BrowserMsg.sendCatch(dest, 'add_class', bm),
    removeClass: (dest: Bm.Dest, bm: Bm.AddOrRemoveClass) => BrowserMsg.sendCatch(dest, 'remove_class', bm),
    closeDialog: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'close_dialog', {}),
    closePage: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'close_page', {}),
    closeNewMessage: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'close_new_message', {}),
    focusBody: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'focus_body', {}),
    focusFrame: (dest: Bm.Dest, bm: Bm.FocusFrame) => BrowserMsg.sendCatch(dest, 'focus_frame', bm),
    closeReplyMessage: (dest: Bm.Dest, bm: Bm.CloseReplyMessage) => BrowserMsg.sendCatch(dest, 'close_reply_message', bm),
    openNewMessage: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'open_new_message', {}),
    scrollToReplyBox: (dest: Bm.Dest, bm: Bm.ScrollToReplyBox) => BrowserMsg.sendCatch(dest, 'scroll_to_reply_box', bm),
    scrollToCursorInReplyBox: (dest: Bm.Dest, bm: Bm.ScrollToCursorInReplyBox) => BrowserMsg.sendCatch(dest, 'scroll_to_cursor_in_reply_box', bm),
    reinsertReplyBox: (dest: Bm.Dest, bm: Bm.ReinsertReplyBox) => BrowserMsg.sendCatch(dest, 'reinsert_reply_box', bm),
    passphraseDialog: (dest: Bm.Dest, bm: Bm.PassphraseDialog) => BrowserMsg.sendCatch(dest, 'passphrase_dialog', bm),
    notificationShow: (dest: Bm.Dest, bm: Bm.NotificationShow) => BrowserMsg.sendCatch(dest, 'notification_show', bm),
    notificationShowAuthPopupNeeded: (dest: Bm.Dest, bm: Bm.NotificationShowAuthPopupNeeded) => BrowserMsg.sendCatch(dest, 'notification_show_auth_popup_needed', bm),
    renderPublicKeys: (dest: Bm.Dest, bm: Bm.RenderPublicKeys) => BrowserMsg.sendCatch(dest, 'render_public_keys', bm),
    replyPubkeyMismatch: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'reply_pubkey_mismatch', {}),
    addPubkeyDialog: (dest: Bm.Dest, bm: Bm.AddPubkeyDialog) => BrowserMsg.sendCatch(dest, 'add_pubkey_dialog', bm),
    reload: (dest: Bm.Dest, bm: Bm.Reload) => BrowserMsg.sendCatch(dest, 'reload', bm),
    redirect: (dest: Bm.Dest, bm: Bm.Redirect) => BrowserMsg.sendCatch(dest, 'redirect', bm),
    openGoogleAuthDialog: (dest: Bm.Dest, bm: Bm.OpenGoogleAuthDialog) => BrowserMsg.sendCatch(dest, 'open_google_auth_dialog', bm),
    addToContacts: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'addToContacts', {}),
    reRenderRecipient: (dest: Bm.Dest, bm: Bm.ReRenderRecipient) => BrowserMsg.sendCatch(dest, 'reRenderRecipient', bm),
    showAttachmentPreview: (dest: Bm.Dest, bm: Bm.ShowAttachmentPreview) => BrowserMsg.sendCatch(dest, 'show_attachment_preview', bm),
    testAction: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'test_action', {}),
  };
  private static HANDLERS_REGISTERED_BACKGROUND: Handlers = {};
  private static HANDLERS_REGISTERED_FRAME: Handlers = {
    set_css: BrowserMsgCommonHandlers.setCss,
    add_class: BrowserMsgCommonHandlers.addClass,
    remove_class: BrowserMsgCommonHandlers.removeClass,
  };

  public static renderFatalErrCorner = (message: string, style: 'GREEN-NOTIFICATION' | 'RED-RELOAD-PROMPT') => {
    const div = document.createElement('div');
    div.textContent = message;
    div.style.position = 'fixed';
    div.style.bottom = '0';
    div.style.right = '0';
    div.style.fontSize = '12px';
    div.style.backgroundColor = '#31a217';
    div.style.color = 'white';
    div.style.padding = '1px 3px';
    div.style.zIndex = '1000';
    if (style === 'RED-RELOAD-PROMPT') {
      div.style.fontSize = '14px';
      div.style.backgroundColor = '#a44';
      div.style.padding = '4px 6px';
      const a = document.createElement('a');
      a.href = window.location.href.split('#')[0];
      a.textContent = 'RELOAD';
      a.style.color = 'white';
      a.style.fontWeight = 'bold';
      a.style.marginLeft = '12px';
      div.appendChild(a);
    }
    window.document.body.appendChild(div);
  }

  public static tabId = async (): Promise<string | null | undefined> => {
    try {
      const { tabId } = await BrowserMsg.sendAwait(undefined, '_tab_', undefined, true) as Bm.Res._tab_;
      return tabId;
    } catch (e) {
      if (e instanceof BgNotReadyErr) {
        return undefined;
      }
      throw e;
    }
  }

  public static requiredTabId = async (attempts = 10, delay = 200): Promise<string> => {
    let tabId;
    for (let i = 0; i < attempts; i++) { // sometimes returns undefined right after browser start due to BgNotReadyErr
      tabId = await BrowserMsg.tabId();
      if (tabId) {
        return tabId;
      }
      await Ui.time.sleep(delay);
    }
    throw new TabIdRequiredError(`tabId is required, but received '${String(tabId)}' after ${attempts} attempts`);
  }

  public static addPgpListeners = () => {
    BrowserMsg.bgAddListener('pgpHashChallengeAnswer', async (r: Bm.PgpHashChallengeAnswer) => ({ hashed: await PgpHash.challengeAnswer(r.answer) }));
    BrowserMsg.bgAddListener('pgpMsgDiagnosePubkeys', MsgUtil.diagnosePubkeys);
    BrowserMsg.bgAddListener('pgpMsgDecrypt', MsgUtil.decryptMessage);
    BrowserMsg.bgAddListener('pgpMsgVerifyDetached', MsgUtil.verifyDetached);
    BrowserMsg.bgAddListener('pgpMsgType', MsgUtil.type);
    BrowserMsg.bgAddListener('keyParse', async (r: Bm.KeyParse) => ({ key: await KeyUtil.parse(r.armored) }));
    BrowserMsg.bgAddListener('keyMatch', async (r: Bm.KeyMatch) => ({
      key:
        (await Promise.all(r.pubkeys.map(async (pub) => await KeyUtil.parse(pub)))).
          find(k => k.allIds.map(id => OpenPGPKey.fingerprintToLongid(id).includes(r.longid)))
    }));
  }

  public static addListener = (name: string, handler: Handler) => {
    BrowserMsg.HANDLERS_REGISTERED_FRAME[name] = handler;
  }

  public static listen = (listenForTabId: string) => {
    const processed: string[] = [];
    chrome.runtime.onMessage.addListener((msg: Bm.Raw, sender, rawRespond: (rawResponse: Bm.RawResponse) => void) => {
      // console.debug(`listener(${listenForTabId}) new message: ${msg.name} to ${msg.to} with id ${msg.uid} from`, sender);
      try {
        if (msg.to === listenForTabId || msg.to === 'broadcast') {
          if (!processed.includes(msg.uid)) {
            processed.push(msg.uid);
            if (typeof BrowserMsg.HANDLERS_REGISTERED_FRAME[msg.name] !== 'undefined') {
              const handler: Bm.AsyncRespondingHandler = BrowserMsg.HANDLERS_REGISTERED_FRAME[msg.name];
              BrowserMsg.replaceObjUrlWithBuf(msg.data.bm, msg.data.objUrls)
                .then(bm => BrowserMsg.sendRawResponse(handler(bm, sender), rawRespond))
                .catch(e => BrowserMsg.sendRawResponse(Promise.reject(e), rawRespond));
              return true; // will respond
            } else if (msg.name !== '_tab_' && msg.to !== 'broadcast') {
              BrowserMsg.sendRawResponse(Promise.reject(new Error(`BrowserMsg.listen error: handler "${msg.name}" not set`)), rawRespond);
              return true; // will respond
            }
          } else {
            // sometimes received events get duplicated
            // while first event is being processed, second even will arrive
            // that's why we generate a unique id of each request (uid) and filter them above to identify truly unique requests
            // if we got here, that means we are handing a duplicate request
            // we'll indicate will respond = true, so that the processing of the actual request is not negatively affected
            // leaving it at "false" would respond with null, which would throw an error back to the original BrowserMsg sender:
            // "Error: BrowserMsg.sendAwait(pgpMsgDiagnosePubkeys) returned(null) with lastError: (no lastError)"
            // the duplication is likely caused by our routing mechanism. Sometimes browser will deliver the message directly as well as through bg
            return true;
          }
        }
      } catch (e) {
        BrowserMsg.sendRawResponse(Promise.reject(e), rawRespond);
        return true; // will respond
      }
      return false; // will not respond
    });
  }

  public static bgAddListener = (name: string, handler: Handler) => {
    BrowserMsg.HANDLERS_REGISTERED_BACKGROUND[name] = handler;
  }

  public static bgListen = () => {
    chrome.runtime.onMessage.addListener((msg: Bm.Raw, sender, rawRespond: (rawRes: Bm.RawResponse) => void) => {
      const respondIfPageStillOpen = (response: Bm.RawResponse) => {
        try { // avoiding unnecessary errors when target tab gets closed
          rawRespond(response);
        } catch (cannotRespondErr) {
          if (cannotRespondErr instanceof Error && cannotRespondErr.message === 'Attempting to use a disconnected port object') {
            // the page we're responding to is closed - ec when closing secure compose
          } else {
            if (cannotRespondErr instanceof Error) {
              cannotRespondErr.stack += `\n\nOriginal msg sender stack: ${msg.stack}`;
            }
            Catch.reportErr(Catch.rewrapErr(cannotRespondErr, `BrowserMsg.bgListen.respondIfPageStillOpen:${msg.name}`));
          }
        }
      };
      try {
        // console.debug(`bgListen: ${msg.name} from ${sender.tab?.id}:${sender.tab?.index} to ${msg.to}`);
        if (BrowserMsg.shouldRelayMsgToOtherPage(sender, msg.to)) { // message that has to be relayed through bg
          const { tab, frame } = BrowserMsg.browserMsgDestParse(msg.to);
          if (!tab) {
            BrowserMsg.sendRawResponse(Promise.reject(new Error(`BrowserMsg.bgListen:${msg.name}:cannot parse destination tab in ${msg.to}`)), respondIfPageStillOpen);
          } else {
            chrome.tabs.sendMessage(tab, msg, { frameId: frame }, respondIfPageStillOpen);
          }
          return true; // will respond
        } else if (Object.keys(BrowserMsg.HANDLERS_REGISTERED_BACKGROUND).includes(msg.name)) { // standard or broadcast message
          const handler: Bm.AsyncRespondingHandler = BrowserMsg.HANDLERS_REGISTERED_BACKGROUND[msg.name];
          BrowserMsg.replaceObjUrlWithBuf(msg.data.bm, msg.data.objUrls)
            .then(bm => BrowserMsg.sendRawResponse(handler(bm, sender), respondIfPageStillOpen))
            .catch(e => BrowserMsg.sendRawResponse(Promise.reject(e), respondIfPageStillOpen));
          return true; // will respond
        } else if (!msg.to) { // message meant for bg that we don't have a handler for
          BrowserMsg.sendRawResponse(Promise.reject(new Error(`BrowserMsg.bgListen:${msg.name}:no such handler`)), respondIfPageStillOpen);
          return true; // will respond
        } else { // broadcast message that backend does not have a handler for - ignored
          return false; // no plans to respond
        }
      } catch (exception) {
        BrowserMsg.sendRawResponse(Promise.reject(exception), respondIfPageStillOpen);
        return true; // will respond
      }
    });
  }

  /**
   * When sending message from iframe within extension page, the browser will deliver the message to BOTH
   *    the parent frame as well as the background (when we ment to just send to parent).
   *    In such situations, we don't have to relay this message from bg to that frame, it already got it.
   * When sending message from iframe within content script page (mail.google.com), the parent will NOT get such message
   *    directly, and it will only be delivered to background page, from where we have to relay it around.
   */
  private static shouldRelayMsgToOtherPage = (sender: chrome.runtime.MessageSender, destination: string | null) => {
    if (!sender.tab || !destination) {
      return false; // messages meant to bg, or from unknown sender, should not be relayed
    }
    if (Catch.browser().name !== 'chrome') {
      return true; // only chrome sends messages directly to extension frame parent (in addition to sending to bg)
    }
    if (destination !== `${sender.tab.id}:0`) { // zero mains the main frame in a tab, the parent frame
      return true; // not sending to a parent (must relay, browser does not send directly)
    }
    if (sender.url?.includes(chrome.runtime.id) && sender.tab.url?.startsWith('https://')) {
      return true; // sending to a parent content script (must relay, browser does not send directly)
    }
    return false; // sending to a parent that is an extension frame (do not relay, browser does send directly)
  }

  private static sendCatch = (dest: Bm.Dest | undefined, name: string, bm: Dict<any>) => {
    BrowserMsg.sendAwait(dest, name, bm).catch(Catch.reportErr);
  }

  private static sendAwait = async (destString: string | undefined, name: string, bm?: Dict<unknown>, awaitRes = false): Promise<Bm.Response> => {
    bm = bm || {};
    // console.debug(`sendAwait ${name} to ${destString || 'bg'}`, bm);
    const isBackgroundPage = Env.isBackgroundPage();
    if (isBackgroundPage && BrowserMsg.HANDLERS_REGISTERED_BACKGROUND && typeof destString === 'undefined') { // calling from bg script to bg script: skip messaging
      const handler: Bm.AsyncRespondingHandler = BrowserMsg.HANDLERS_REGISTERED_BACKGROUND[name];
      return await handler(bm, 'background');
    }
    return await new Promise((resolve, reject) => { // here browser messaging is used - msg has to be serializable - Buf instances need to be converted to object urls, and back upon receipt
      const objUrls = BrowserMsg.replaceBufWithObjUrlInplace(bm);
      const msg: Bm.Raw = { name, data: { bm: bm!, objUrls }, to: destString || null, uid: Str.sloppyRandom(10), stack: Catch.stackTrace() }; // tslint:disable-line:no-null-keyword
      const processRawMsgResponse = (r: Bm.RawResponse) => {
        if (!awaitRes) {
          resolve(undefined);
        } else if (!r || typeof r !== 'object') { // r can be null if we sent a message to a non-existent window id
          const lastError = chrome.runtime.lastError ? chrome.runtime.lastError.message || '(empty lastError)' : '(no lastError)';
          let e: Error;
          if (typeof destString === 'undefined' && typeof r === 'undefined') {
            if (lastError === 'The object could not be cloned.') {
              e = new Error(`BrowserMsg.sendAwait(${name}) failed with lastError: ${lastError}`);
            } else if (lastError === 'Could not establish connection. Receiving end does not exist.' || lastError === 'The message port closed before a response was received.') {
              // "The message port closed before a response was received." could also happen for otherwise working extension, if bg script
              //    did not return `true` (indicating async response). That would be our own coding error in BrowserMsg.
              e = new BgNotReadyErr(`BgNotReadyErr: BrowserMsg.sendAwait(${name}) failed with lastError: ${lastError}`);
            } else {
              e = new Error(`BrowserMsg.sendAwait(${name}) failed with unknown lastError: ${lastError}`);
            }
          } else {
            e = new Error(`BrowserMsg.sendAwait(${name}) returned(${String(r)}) with lastError: ${lastError}`);
          }
          e.stack = `${msg.stack}\n\n${e.stack}`;
          reject(e);
        } else if (typeof r === 'object' && r.exception) {
          reject(BrowserMsg.jsonToErr(r.exception, msg));
        } else if (!r.result || typeof r.result !== 'object') {
          resolve(r.result as Bm.Response);
        } else {
          BrowserMsg.replaceObjUrlWithBuf(r.result, r.objUrls).then(resolve).catch(reject);
        }
      };
      try {
        if (isBackgroundPage) {
          const { tab, frame } = BrowserMsg.browserMsgDestParse(msg.to);
          if (!tab) {
            throw new Error(`Cannot parse tab in ${msg.to}: ${tab} when sending ${msg.name}`);
          }
          chrome.tabs.sendMessage(tab, msg, { frameId: frame }, processRawMsgResponse);
        } else if (chrome.runtime) {
          chrome.runtime.sendMessage(msg, processRawMsgResponse);
        } else {
          BrowserMsg.renderFatalErrCorner('Error: missing chrome.runtime', 'RED-RELOAD-PROMPT');
        }
      } catch (e) {
        if (e instanceof Error && e.message === 'Extension context invalidated.') {
          BrowserMsg.renderFatalErrCorner('Restart browser to re-enable FlowCrypt', 'GREEN-NOTIFICATION');
        } else {
          throw e;
        }
      }
    });
  }

  /**
   * Browser messages cannot send a lot of data per message. This will replace Buf objects (which can be large) with an ObjectURL
   * Be careful when editting - the type system won't help you here and you'll likely make mistakes
   * The requestOrResponse object will get directly updated in this function
   */
  private static replaceBufWithObjUrlInplace = (requestOrResponse: unknown): Dict<string> => {
    const objUrls: Dict<string> = {};
    if (requestOrResponse && typeof requestOrResponse === 'object' && requestOrResponse !== null) { // lgtm [js/comparison-between-incompatible-types]
      for (const possibleBufName of Object.keys(requestOrResponse)) {
        const possibleBufs = (requestOrResponse as any)[possibleBufName];
        if (possibleBufs instanceof Uint8Array) {
          objUrls[possibleBufName] = Browser.objUrlCreate(possibleBufs);
          (requestOrResponse as any)[possibleBufName] = undefined;
        }
      }
    }
    return objUrls;
  }

  /**
   * This method does the opposite of replaceBufWithObjUrlInplace so we end up with original message (or response) containing possibly a large Buf
   * Be careful when editting - the type system won't help you here and you'll likely make mistakes
   */
  private static replaceObjUrlWithBuf = async <T>(requestOrResponse: T, objUrls: Dict<string>): Promise<T> => {
    if (requestOrResponse && typeof requestOrResponse === 'object' && requestOrResponse !== null && objUrls) { // lgtm [js/comparison-between-incompatible-types]
      for (const consumableObjUrlName of Object.keys(objUrls)) {
        (requestOrResponse as any)[consumableObjUrlName] = await Browser.objUrlConsume(objUrls[consumableObjUrlName]);
      }
    }
    return requestOrResponse;
  }

  private static errToJson = (e: any): Bm.ErrAsJson => {
    if (e instanceof AjaxErr) {
      const { message, stack, status, url, responseText, statusText, resMsg, resDetails } = e;
      return { stack, message, errorConstructor: 'AjaxErr', ajaxErrorDetails: { status, url, responseText, statusText, resMsg, resDetails } };
    }
    const { stack, message } = Catch.rewrapErr(e, 'sendRawResponse');
    return { stack, message, errorConstructor: 'Error' };
  }

  private static jsonToErr = (errAsJson: Bm.ErrAsJson, msg: Bm.Raw) => {
    const stackInfo = `\n\n[callerStack]\n${msg.stack}\n[/callerStack]\n\n[responderStack]\n${errAsJson.stack}\n[/responderStack]\n`;
    if (errAsJson.errorConstructor === 'AjaxErr') {
      const { status, url, responseText, statusText, resMsg, resDetails } = errAsJson.ajaxErrorDetails;
      return new AjaxErr(`BrowserMsg(${msg.name}) ${errAsJson.message}`, stackInfo, status, url, responseText, statusText, resMsg, resDetails);
    }
    const e = new Error(`BrowserMsg(${msg.name}) ${errAsJson.message}`);
    e.stack += stackInfo;
    return e;
  }

  private static sendRawResponse = (handlerPromise: Promise<Bm.Res.Any>, rawRespond: (rawResponse: Bm.RawResponse) => void) => {
    try {
      handlerPromise.then(result => {
        const objUrls = BrowserMsg.replaceBufWithObjUrlInplace(result); // this actually changes the result object
        rawRespond({ result, exception: undefined, objUrls });
      }).catch(e => {
        rawRespond({ result: undefined, exception: BrowserMsg.errToJson(e), objUrls: {} });
      });
    } catch (e) {
      rawRespond({ result: undefined, exception: BrowserMsg.errToJson(e), objUrls: {} });
    }
  }

  private static browserMsgDestParse = (destString: string | null) => {
    const parsed = { tab: undefined as undefined | number, frame: undefined as undefined | number };
    if (destString) {
      parsed.tab = Number(destString.split(':')[0]);
      const parsedFrame = Number(destString.split(':')[1]);
      parsed.frame = !isNaN(parsedFrame) ? parsedFrame : undefined;
    }
    return parsed;
  }

}
