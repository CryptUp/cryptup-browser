/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:oneliner-object-literal

'use strict';

import { Dict, Str } from '../../core/common.js';
import { Store } from '../../platform/store.js';
import { Att } from '../../core/att.js';
import { SendableMsgBody } from '../../core/mime.js';
import { Api, ProgressCb, ChunkedCb } from '../api.js';
import { GmailResponseFormat } from './gmail/gmail.js';
import { GmailRes } from './gmail/gmail-parser.js';
import { Contact } from '../../core/pgp.js';

export type Recipients = { to?: string[], cc?: string[], bcc?: string[] };
export type ProviderContactsQuery = { substring: string };
export type SendableMsg = {
  headers: Dict<string>;
  from: string;
  recipients: Recipients;
  subject: string;
  body: SendableMsgBody;
  atts: Att[];
  thread?: string;
  mimeRootType: string,
  sign?: (signable: string) => Promise<string>,
};
export type ReplyParams = {
  to: string[];
  cc: string[];
  bcc: string[];
  from: string;
  subject: string;
};

/**
 * todo - remove Gmail specific formats, and make this universal interface for both Gmail and Outlook
 */
export interface EmailProviderInterface {
  draftGet(id: string, format: GmailResponseFormat): Promise<GmailRes.GmailDraftGet>;
  draftCreate(mimeMsg: string, threadId: string): Promise<GmailRes.GmailDraftCreate>;
  draftUpdate(id: string, mimeMsg: string): Promise<GmailRes.GmailDraftUpdate>;
  draftDelete(id: string): Promise<GmailRes.GmailDraftDelete>;
  msgSend(message: SendableMsg, progressCb?: ProgressCb): Promise<GmailRes.GmailMsgSend>;
  guessContactsFromSentEmails(userQuery: string, knownContacts: Contact[], chunkedCb: ChunkedCb): Promise<void>;
  createMsgObj(from: string, recipients: Recipients, subject: string, body: SendableMsgBody, atts?: Att[], threadRef?: string,
    mimeRootType?: string, sign?: (content: string) => Promise<string>): Promise<SendableMsg>;
  msgGet(msgId: string, format: GmailResponseFormat, progressCb?: ProgressCb): Promise<GmailRes.GmailMsg>;
  msgList(q: string, includeDeleted?: boolean, pageToken?: string): Promise<GmailRes.GmailMsgList>;
}

export class EmailProviderApi extends Api {

  constructor(protected acctEmail: string) {
    super();
  }

  public createMsgObj = async (
    from: string = '', recipients: Recipients, subject: string = '', body: SendableMsgBody, atts?: Att[], threadRef?: string,
    mimeRootType?: string, sign?: (content: string) => Promise<string>,
  ): Promise<SendableMsg> => {
    const allEmails = [...recipients.to || [], ...recipients.cc || [], ...recipients.bcc || []];
    const [primaryKi] = await Store.keysGet(this.acctEmail, ['primary']);
    if (!allEmails.length) {
      throw new Error('The To: field is empty. Please add recipients and try again');
    }
    const invalidEmails = allEmails.filter(email => !Str.isEmailValid(email));
    if (invalidEmails.length) {
      throw new Error(`The To: field contains invalid emails: ${invalidEmails.join(', ')}\n\nPlease check recipients and try again.`);
    }
    return {
      headers: primaryKi ? { OpenPGP: `id=${primaryKi.fingerprint}` } : {},
      from,
      recipients,
      subject,
      body: typeof body === 'object' ? body : { 'text/plain': body },
      atts: atts || [],
      thread: threadRef,
      mimeRootType: mimeRootType || 'multipart/mixed',
      sign,
    };
  }

}
