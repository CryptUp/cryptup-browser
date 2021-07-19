/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api, ReqMethod } from './../shared/api.js';
import { Dict, Str } from '../../core/common.js';
import { PubkeySearchResult } from './../pub-lookup.js';
import { ApiErr } from '../shared/api-error.js';
import { OrgRules } from '../../org-rules.js';
import { ATTESTER_API_HOST } from '../../core/const.js';

type PubCallRes = { responseText: string, getResponseHeader: (n: string) => string | null };

export class Attester extends Api {

  constructor(
    private orgRules: OrgRules
  ) {
    super();
  }

  public lookupEmail = async (email: string): Promise<PubkeySearchResult> => {
    if (!this.orgRules.canLookupThisRecipientOnAttester(email)) {
      console.info(`Skipping attester lookup of ${email} because attester search on this domain is disabled.`);
      return { pubkey: null }; // tslint:disable-line:no-null-keyword
    }
    return await this.doLookup(email);
  }

  public lookupEmails = async (emails: string[]): Promise<Dict<PubkeySearchResult>> => {
    const results: Dict<PubkeySearchResult> = {};
    await Promise.all(emails.map(async (email: string) => {
      results[email] = await this.lookupEmail(email);
    }));
    return results;
  }

  /**
   * the actual api accepts either email, fingerprint or longid
   */
  public lookupFingerprint = async (fingerprintOrLongid: string) => {
    if (fingerprintOrLongid.includes('@')) {
      throw new Error('Expected fingerprint or longid, got email');
    }
    if (this.orgRules.disallowLookupOnAttester()) {
      console.info(`Skipping attester lookup because it is disabled for all domains.`);
      return { pubkey: null }; // tslint:disable-line:no-null-keyword
    }
    return await this.doLookup(fingerprintOrLongid);
    // todo: check returned email to respect disallow_attester_search domain rule?
  }

  /**
   * Set or replace public key with idToken as an auth mechanism
   * Used during setup
   * Can only be used for primary email because idToken does not contain info about aliases
   */
  public submitPrimaryEmailPubkey = async (email: string, pubkey: string, idToken: string): Promise<void> => {
    if (!this.orgRules.canSubmitPubToAttester()) {
      throw new Error('Cannot replace pubkey at attester because your organisation rules forbid it');
    }
    await this.pubCall(`pub/${email}`, 'POST', pubkey, { authorization: `Bearer ${idToken}` });
  }

  /**
   * Request to replace pubkey that will be verified by clicking email
   * Used when user manually chooses to replace key
   * Can also be used for aliases
   */
  public replacePubkey = async (email: string, pubkey: string): Promise<string> => {
    if (!this.orgRules.canSubmitPubToAttester()) {
      throw new Error('Cannot replace pubkey at attester because your organisation rules forbid it');
    }
    const r = await this.pubCall(`pub/${email}`, 'POST', pubkey);
    return r.responseText;
  }

  /**
   * Update pubkey with a newer version of the same pubkey
   * Does not need email verification, fingerprints compared, last signatures compared
   */
  public updatePubkey = async (longid: string, pubkey: string): Promise<string> => {
    if (!this.orgRules.canSubmitPubToAttester()) {
      throw new Error('Cannot update pubkey at attester because your organisation rules forbid it');
    }
    const r = await this.pubCall(`pub/${longid}`, 'PUT', pubkey);
    return r.responseText;
  }

  /**
   * Looking to deprecate this, but still used for some customers
   */
  public initialLegacySubmit = async (email: string, pubkey: string): Promise<{ saved: boolean }> => {
    if (!this.orgRules.canSubmitPubToAttester()) {
      throw new Error('Cannot submit pubkey to attester because your organisation rules forbid it');
    }
    return await this.jsonCall<{ saved: boolean }>('initial/legacy_submit', { email: Str.parseEmail(email).email, pubkey: pubkey.trim() });
  }

  public testWelcome = async (email: string, pubkey: string): Promise<{ sent: boolean }> => {
    return await this.jsonCall<{ sent: boolean }>('test/welcome', { email, pubkey });
  }

  private jsonCall = async <RT>(path: string, values?: Dict<any>, method: ReqMethod = 'POST'): Promise<RT> => {
    return await Api.apiCall(ATTESTER_API_HOST, path, values, 'JSON', undefined, { 'api-version': '3' }, 'json', method) as RT;
  }

  private pubCall = async (resource: string, method: ReqMethod = 'GET', data?: string | undefined, hdrs?: Dict<string>): Promise<PubCallRes> => {
    return await Api.apiCall(ATTESTER_API_HOST, resource, data, typeof data === 'string' ? 'TEXT' : undefined, undefined, hdrs, 'xhr', method);
  }

  private doLookup = async (emailOrFingerprint: string): Promise<PubkeySearchResult> => {
    try {
      const r = await this.pubCall(`pub/${emailOrFingerprint}`);
      // when requested from the content script, `getResponseHeader` will be missing because it's not a real XMLHttpRequest we are getting back
      // because it had to go through background scripts, and objects are serialized when this happens
      // the proper fix would be to send back headers from bg along with response text, and parse it here
      if (!r.getResponseHeader) {
        return { pubkey: r.responseText };
      }
      return { pubkey: r.responseText };
    } catch (e) {
      if (ApiErr.isNotFound(e)) {
        return { pubkey: null }; // tslint:disable-line:no-null-keyword
      }
      throw e;
    }
  }

}
