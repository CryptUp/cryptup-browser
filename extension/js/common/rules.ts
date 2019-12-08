/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Dict } from './core/common.js';
import { Buf } from './core/buf.js';
import { Store } from './platform/store.js';

type DomainRules$flag = 'NO_PRV_CREATE' | 'NO_PRV_BACKUP' | 'ALLOW_CUSTOM_KEYSERVER' | 'ENFORCE_ATTESTER_SUBMIT';
export type DomainRules = {
  flags: DomainRules$flag[],
  custom_keyserver_url?: string,
};

export class Rules {

  public static async newInstance(acctEmail: string): Promise<Rules> {
    const storage = await Store.getAcct(acctEmail, ['rules']);
    if (storage.rules) {
      return new Rules(storage.rules);
    } else {
      const legacyHardCoded = await Rules.legacyHardCodedRules(acctEmail);
      await Store.setAcct(acctEmail, { rules: legacyHardCoded });
      return new Rules(legacyHardCoded);
    }
  }

  protected constructor(private domainRules: DomainRules) { }

  public static isPublicEmailProviderDomain(emailAddr: string) {
    return ['gmail.com', 'yahoo.com', 'outlook.com', 'live.com'].includes(emailAddr.split('@')[1] || 'NONE');
  }

  canCreateKeys() {
    return !this.domainRules.flags.includes('NO_PRV_CREATE');
  }

  canBackupKeys() {
    return !this.domainRules.flags.includes('NO_PRV_BACKUP');
  }

  mustSubmitToAttester() {
    return this.domainRules.flags.includes('ENFORCE_ATTESTER_SUBMIT');
  }

  canUseCustomKeyserver() {
    return this.domainRules.flags.includes('ALLOW_CUSTOM_KEYSERVER');
  }

  getCustomKeyserver(): string | undefined {
    return this.canUseCustomKeyserver() ? this.domainRules.custom_keyserver_url : undefined;
  }

  private static async legacyHardCodedRules(acctEmail: string): Promise<DomainRules> {
    const hardCodedRules: Dict<DomainRules> = {
      'dFEm3KyalKGTGjpeA/Ar44IPUdE=': { // n
        flags: ['NO_PRV_CREATE', 'NO_PRV_BACKUP', 'ENFORCE_ATTESTER_SUBMIT']
      },
      'd3VLGOyz8vfFm/IM/gavrCpkWOw=': { // v
        flags: ['NO_PRV_CREATE', 'NO_PRV_BACKUP', 'ENFORCE_ATTESTER_SUBMIT']
      },
      'xKzI/nSDX4g2Wfgih9y0sYIguRU=': { // h
        flags: ['NO_PRV_BACKUP', 'ALLOW_CUSTOM_KEYSERVER'],
        custom_keyserver_url: Buf.fromBase64Str('aHR0cHM6Ly9za3MucG9kMDEuZmxlZXRzdHJlZXRvcHMuY29tLw==').toUtfStr()
      },
    };
    const domain = acctEmail.split('@')[1];
    const sha1 = Buf.fromUint8(new Uint8Array(await crypto.subtle.digest('SHA-1', Buf.fromUtfStr(domain)))).toBase64Str();
    const foundHardCoded = hardCodedRules[sha1];
    if (foundHardCoded) {
      return foundHardCoded;
    }
    return { flags: [] };
  }

}
