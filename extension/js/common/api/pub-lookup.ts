/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Attester } from './key-server/attester.js';
import { KeyManager } from './key-server/key-manager.js';
import { Sks } from './key-server/sks.js';
import { Wkd } from './key-server/wkd.js';
import { OrgRules } from '../org-rules.js';

export type PubkeySearchResult = { pubkey: string | null };
export type PubkeysSearchResult = { pubkeys: string[] };

/**
 * Look up public keys.
 *
 * Some orgs may have a preference to use their own keyserver.
 * In such cases, results from their own keyserver will be preferred.
 */
export class PubLookup {

  public attester: Attester; // attester is a publicly available public key server
  public wkd: Wkd;
  public keyManager: KeyManager | undefined; // key manager is a flowcrypt-provided internal company private and public key server
  public internalSks: Sks | undefined; // this is an internal company pubkey server that has SKS-like interface

  constructor(
    private orgRules: OrgRules
  ) {
    const privateKeyManagerUrl = orgRules.getKeyManagerUrlForPublicKeys();
    const internalSksUrl = this.orgRules.getCustomSksPubkeyServer();
    this.attester = new Attester(orgRules);
    this.wkd = new Wkd();
    if (privateKeyManagerUrl) {
      this.keyManager = new KeyManager(privateKeyManagerUrl);
    }
    if (internalSksUrl) {
      this.internalSks = new Sks(internalSksUrl);
    }
  }

  public lookupEmail = async (email: string): Promise<PubkeysSearchResult> => {
    if (this.keyManager) {
      const res = await this.keyManager.lookupPublicKey(email);
      if (res.publicKeys.length) {
        return { pubkeys: res.publicKeys.map(x => x.publicKey) };
      }
    }
    const wkdRes = await this.wkd.lookupEmail(email);
    if (wkdRes.pubkeys.length) {
      return wkdRes;
    }
    if (this.internalSks) {
      const res = await this.internalSks.lookupEmail(email);
      if (res.pubkey) {
        return { pubkeys: [res.pubkey] };
      }
    }
    const attRes = await this.attester.lookupEmail(email);
    if (attRes.pubkey) {
      return { pubkeys: [attRes.pubkey] };
    }
    return { pubkeys: [] };
  }

  public lookupFingerprint = async (fingerprintOrLongid: string): Promise<PubkeySearchResult> => {
    if (fingerprintOrLongid.includes('@')) {
      throw new Error('Expected fingerprint or longid, got email');
    }
    if (this.keyManager) {
      const res = await this.keyManager.lookupPublicKey(fingerprintOrLongid);
      if (res.publicKeys.length) {
        return { pubkey: res.publicKeys[0].publicKey };
      }
    }
    if (this.internalSks) {
      const res = await this.internalSks.lookupFingerprint(fingerprintOrLongid);
      if (res.pubkey) {
        return res;
      }
    }
    return await this.attester.lookupFingerprint(fingerprintOrLongid);
  }

}
