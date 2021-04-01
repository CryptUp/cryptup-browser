/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { AbstractStore } from './abstract-store.js';
import { Catch } from '../catch.js';
import { opgp } from '../../core/crypto/pgp/openpgpjs-custom.js';
import { BrowserMsg } from '../../browser/browser-msg.js';
import { DateUtility, Str } from '../../core/common.js';
import { Key, Contact, KeyUtil } from '../../core/crypto/key.js';
import { OpenPGPKey } from '../../core/crypto/pgp/openpgp-key.js';

// tslint:disable:no-null-keyword

type DbContactObjArg = {
  email: string,
  name?: string | null,
  pubkey?: string | null,
  lastUse?: number | null, // when was this contact last used to send an email
  lastCheck?: number | null; // when was the local copy of the pubkey last updated (or checked against Attester)
};

type Email = {
  email: string;
  name: string | null;
  searchable: string[];
  fingerprints: string[];
  lastUse: number | null;
};

type Pubkey = {
  fingerprint: string;
  armoredKey: string;
  longids: string[];
  lastCheck: number | null,
  expiresOn: number | null;
};

type PubkeyAttributes = {
  fingerprint: string | null;
  expiresOn: number | null;
};

export type ContactV4 = {
  info: Email,
  pubkeys: Pubkey[]
}

export type ContactPreview = {
  email: string;
  name: string | null;
  has_pgp: 0 | 1;
  last_use: number | null;
};

export type ContactUpdate = {
  name?: string | null;
  last_use?: number | null;
  pubkey?: Key;
  pubkey_last_check?: number | null; // when non-null, `pubkey` must be supplied
};

type DbContactFilter = { has_pgp?: boolean, substring?: string, limit?: number };

/**
 * Store of contacts and their public keys
 * This includes an index of email and name substrings for easier search when user is typing
 * Db is initialized in the background page and accessed through BrowserMsg
 */
export class ContactStore extends AbstractStore {

  // static [f: string]: Function; // https://github.com/Microsoft/TypeScript/issues/6480

  private static dbQueryKeys = ['limit', 'substring', 'has_pgp'];

  public static dbOpen = async (): Promise<IDBDatabase> => {
    return await new Promise((resolve, reject) => {
      const openDbReq = indexedDB.open('cryptup', 4);
      openDbReq.onupgradeneeded = (event) => {
        const db = openDbReq.result;
        if (event.oldVersion < 4) {
          const emails = db.createObjectStore('emails', { keyPath: 'email' });
          const pubkeys = db.createObjectStore('pubkeys', { keyPath: 'fingerprint' });
          emails.createIndex('search', 'searchable', { multiEntry: true });
          emails.createIndex('index_fingerprints', 'fingerprints', { multiEntry: true }); // fingerprints of all connected pubkeys
          pubkeys.createIndex('index_longids', 'longids', { multiEntry: true }); // longids of all public key packets in armored pubkey
        }
        if (db.objectStoreNames.contains('contacts')) {
          const countRequest = openDbReq.transaction!.objectStore('contacts').count();
          ContactStore.setReqPipe(countRequest, (count: number) => {
            if (count === 0) {
              console.info('contacts store is now empty, deleting it...');
              db.deleteObjectStore('contacts');
            }
          });
        }
      };
      openDbReq.onsuccess = () => resolve(openDbReq.result as IDBDatabase);
      openDbReq.onblocked = () => reject(ContactStore.errCategorize(openDbReq.error));
      openDbReq.onerror = () => reject(ContactStore.errCategorize(openDbReq.error));
    });
  }

  public static previewObj = ({ email, name }: { email: string, name?: string | null }): ContactPreview => {
    const validEmail = Str.parseEmail(email).email;
    if (!validEmail) {
      throw new Error(`Cannot handle the contact because email is not valid: ${email}`);
    }
    return { email: validEmail, name: name || null, has_pgp: 0, last_use: null };
  }

  public static obj = async ({ email, name, pubkey, lastUse, lastCheck }: DbContactObjArg): Promise<Contact> => {
    if (typeof opgp === 'undefined') {
      return await BrowserMsg.send.bg.await.db({ f: 'obj', args: [{ email, name, pubkey, lastUse, lastCheck }] }) as Contact;
    } else {
      const validEmail = Str.parseEmail(email).email;
      if (!validEmail) {
        throw new Error(`Cannot save contact because email is not valid: ${email}`);
      }
      if (!pubkey) {
        return {
          email: validEmail,
          name: name || null,
          pubkey: undefined,
          has_pgp: 0, // number because we use it for sorting
          fingerprint: null,
          last_use: lastUse || null,
          pubkey_last_check: null,
          expiresOn: null
        };
      }
      const pk = await KeyUtil.parse(pubkey);
      return {
        email: validEmail,
        name: name || null,
        pubkey: pk,
        has_pgp: 1, // number because we use it for sorting
        last_use: lastUse || null,
        pubkey_last_check: lastCheck || null,
        ...ContactStore.getKeyAttributes(pk)
      };
    }
  }

  /**
   * Used to save a contact that does not yet exist
   */
  public static save = async (db: IDBDatabase | undefined, contact: Contact | Contact[]): Promise<void> => {
    if (!db) { // relay op through background process
      await BrowserMsg.send.bg.await.db({ f: 'save', args: [contact] });
      return;
    }
    if (Array.isArray(contact)) {
      await Promise.all(contact.map(oneContact => ContactStore.save(db, oneContact)));
      return;
    }
    await ContactStore.update(db, contact.email, contact);
  }

  /**
   * used to update existing contact
   */
  public static update = async (db: IDBDatabase | undefined, email: string | string[], update: ContactUpdate): Promise<void> => {
    if (!db) { // relay op through background process
      await BrowserMsg.send.bg.await.db({ f: 'update', args: [email, update] });
      return;
    }
    if (Array.isArray(email)) {
      await Promise.all(email.map(oneEmail => ContactStore.update(db, oneEmail, update)));
      return;
    }
    const validEmail = Str.parseEmail(email).email;
    if (!validEmail) {
      throw Error(`Cannot update contact because email is not valid: ${email}`);
    }
    if (update.pubkey?.isPrivate) {
      Catch.report(`Wrongly updating prv ${update.pubkey.id} as contact - converting to pubkey`);
      update.pubkey = await KeyUtil.asPublicKey(update.pubkey);
    }
    const tx = db.transaction(['emails', 'pubkeys'], 'readwrite');
    await new Promise((resolve, reject) => {
      ContactStore.setTxHandlers(tx, resolve, reject);
      ContactStore.updateTx(tx, validEmail, update);
    });
  }

  public static get = async (db: undefined | IDBDatabase, emailOrLongid: string[]): Promise<(Contact | undefined)[]> => {
    if (!db) { // relay op through background process
      return await BrowserMsg.send.bg.await.db({ f: 'get', args: [emailOrLongid] }) as (Contact | undefined)[];
    }
    if (emailOrLongid.length === 1) {
      const contact = await ContactStore.dbContactInternalGetOne(db, emailOrLongid[0]);
      return [contact];
    } else {
      const results: (Contact | undefined)[] = [];
      for (const singleEmailOrLongid of emailOrLongid) {
        const [contact] = await ContactStore.get(db, [singleEmailOrLongid]);
        results.push(contact);
      }
      return results;
    }
  }

  public static search = async (db: IDBDatabase | undefined, query: DbContactFilter): Promise<ContactPreview[]> => {
    return (await ContactStore.rawSearch(db, query)).filter(Boolean).map(ContactStore.toContactPreview);
  }

  public static searchPubkeys = async (db: IDBDatabase | undefined, query: DbContactFilter): Promise<string[]> => {
    const fingerprints = (await ContactStore.rawSearch(db, query)).filter(Boolean).map(email => email.fingerprints).reduce((a, b) => a.concat(b));
    return (await ContactStore.extractPubkeys(db, fingerprints)).map(pubkey => pubkey?.armoredKey).filter(Boolean);
  }

  public static getOneWithAllPubkeys = async (db: IDBDatabase, email: string): Promise<ContactV4 | undefined> => {
    const tx = db.transaction(['emails', 'pubkeys'], 'readonly');
    const pubkeys: Pubkey[] = [];
    const emailEntity: Email | undefined = await new Promise((resolve, reject) => {
      const req = tx.objectStore('emails').get(email);
      ContactStore.setReqPipe(req,
        (email: Email) => {
          if (!email) {
            resolve(undefined);
            return;
          }
          if (!email.fingerprints || email.fingerprints.length === 0) {
            resolve(email);
            return;
          }
          let countdown = email.fingerprints.length;
          // request all pubkeys by fingerprints
          for (const fp of email.fingerprints) {
            const req2 = tx.objectStore('pubkeys').get(fp);
            ContactStore.setReqPipe(req2,
              (pubkey: Pubkey) => {
                if (pubkey) {
                  pubkeys.push(pubkey);
                }
                if (!--countdown) {
                  resolve(email);
                }
              },
              reject);
          }
        },
        reject);
    });
    return emailEntity ? { info: emailEntity, pubkeys } : undefined;
  }

  public static updateTx = (tx: IDBTransaction, email: string, update: ContactUpdate) => {
    if (update.pubkey && !update.pubkey_last_check) {
      const req = tx.objectStore('pubkeys').get(update.pubkey.id);
      ContactStore.setReqPipe(req, (pubkey: Pubkey) => ContactStore.updateTxPhase2(tx, email, update, pubkey));
    } else {
      ContactStore.updateTxPhase2(tx, email, update, undefined);
    }
  }

  public static setReqPipe<T>(req: IDBRequest, pipe: (value?: T) => void, reject?: ((reason?: any) => void) | undefined) {
    req.onsuccess = () => {
      try {
        pipe(req.result as T);
      } catch (codeErr) {
        req.transaction!.dispatchEvent(new ErrorEvent('error'));
        if (reject) {
          reject(codeErr);
        }
        Catch.reportErr(codeErr);
      }
    };
    if (reject) {
      this.setReqOnError(req, reject);
    }
  }

  private static updateTxPhase2 = (tx: IDBTransaction, email: string, update: ContactUpdate, existingPubkey: Pubkey | undefined) => {
    let pubkeyEntity: Pubkey | undefined;
    if (update.pubkey) {
      const keyAttrs = ContactStore.getKeyAttributes(update.pubkey);
      // todo: will we benefit anything when not saving pubkey if it isn't modified?
      pubkeyEntity = {
        fingerprint: update.pubkey.id,
        lastCheck: DateUtility.asNumber(update.pubkey_last_check ?? existingPubkey?.lastCheck),
        expiresOn: keyAttrs.expiresOn,
        longids: update.pubkey.allIds.map(id => OpenPGPKey.fingerprintToLongid(id)),
        armoredKey: KeyUtil.armor(update.pubkey)
      } as Pubkey;
    } else if (update.pubkey_last_check) {
      Catch.report(`Wrongly updating pubkey_last_check without specifying pubkey for ${email} - ignoring`);
    }
    const req = tx.objectStore('emails').get(email);
    ContactStore.setReqPipe(req, (emailEntity: Email) => {
      if (!emailEntity) {
        emailEntity = { email, name: null, searchable: [], fingerprints: [], lastUse: null };
      }
      if (pubkeyEntity) {
        if (!emailEntity.fingerprints.includes(pubkeyEntity.fingerprint)) {
          emailEntity.fingerprints.push(pubkeyEntity.fingerprint);
        }
      }
      if (Object.keys(update).includes('name')) {
        emailEntity.name = update.name ?? null;
      }
      if (Object.keys(update).includes('last_use')) {
        emailEntity.lastUse = DateUtility.asNumber(update.last_use);
      }
      ContactStore.updateSearchable(emailEntity);
      tx.objectStore('emails').put(emailEntity);
      if (pubkeyEntity) {
        tx.objectStore('pubkeys').put(pubkeyEntity);
      }
    });
  }

  private static extractPubkeys = async (db: IDBDatabase | undefined, fingerprints: string[]): Promise<Pubkey[]> => {
    if (!db) { // relay op through background process
      return await BrowserMsg.send.bg.await.db({ f: 'extractPubkeys', args: [fingerprints] }) as Pubkey[];
    }
    const tx = db.transaction(['pubkeys'], 'readonly');
    const raw: Pubkey[] = await new Promise((resolve, reject) => {
      const search = tx.objectStore('pubkeys').openCursor(fingerprints);
      const found: Pubkey[] = [];
      ContactStore.setReqPipe(search,
        (cursor: IDBCursorWithValue) => {
          if (!cursor) {
            resolve(found);
          } else {
            found.push(cursor.value); // tslint:disable-line:no-unsafe-any
            cursor.continue();
          }
        },
        reject);
    });
    return raw;
  }

  private static rawSearch = async (db: IDBDatabase | undefined, query: DbContactFilter): Promise<Email[]> => {
    if (!db) { // relay op through background process
      return await BrowserMsg.send.bg.await.db({ f: 'rawSearch', args: [query] }) as Email[];
    }
    for (const key of Object.keys(query)) {
      if (!ContactStore.dbQueryKeys.includes(key)) {
        throw new Error('ContactStore.rawSearch: unknown key: ' + key);
      }
    }
    query.substring = ContactStore.normalizeString(query.substring || '');
    if (typeof query.has_pgp === 'undefined' && query.substring) {
      const resultsWithPgp = await ContactStore.rawSearch(db, { substring: query.substring, limit: query.limit, has_pgp: true });
      if (query.limit && resultsWithPgp.length === query.limit) {
        return resultsWithPgp;
      } else {
        const limit = query.limit ? query.limit - resultsWithPgp.length : undefined;
        const resultsWithoutPgp = await ContactStore.rawSearch(db, { substring: query.substring, limit, has_pgp: false });
        return resultsWithPgp.concat(resultsWithoutPgp);
      }
    }
    const emails = db.transaction(['emails'], 'readonly').objectStore('emails');
    const raw: Email[] = await new Promise((resolve, reject) => {
      let search: IDBRequest;
      if (typeof query.has_pgp === 'undefined') { // any query.has_pgp value
        search = emails.openCursor(); // no substring, already covered in `typeof query.has_pgp === 'undefined' && query.substring` above
      } else { // specific query.has_pgp value
        const indexRange = ContactStore.dbIndexRange(query.has_pgp, query.substring ?? '');
        // To find all the index keys starting with a certain sequence of characters (e.g. 'abc')
        // we use a range with inclusive lower boundary and exclusive upper boundary 
        // ['t:abc', 't:abd) or ['f:abc', 'f:abd'), so that any key having an arbitrary tail of
        // characters beyond 'abc' falls into this range, and none of the non-matching keys do.
        // Thus we only have to keep complete keywords in the 'search' index.
        const range = IDBKeyRange.bound(indexRange.lowerBound, indexRange.upperBound, false, true);
        search = emails.index('search').openCursor(range);
      }
      const found: Email[] = [];
      ContactStore.setReqPipe(search,
        (cursor: IDBCursorWithValue) => {
          if (!cursor) {
            resolve(found);
          } else {
            found.push(cursor.value); // tslint:disable-line:no-unsafe-any
            if (query.limit && found.length >= query.limit) {
              resolve(found);
            } else {
              cursor.continue();
            }
          }
        },
        reject);
    });
    return raw;
  }

  private static normalizeString = (str: string) => {
    return str.normalize('NFKD').replace(/[\u0300-\u036F]/g, '').toLowerCase();
  }

  private static dbIndex = (hasPgp: boolean, substring: string): string => {
    return (hasPgp ? 't:' : 'f:') + substring;
  }

  private static dbIndexRange = (hasPgp: boolean, substring: string): { lowerBound: string, upperBound: string } => {
    // to find all the keys starting with 'abc', we need to use a range search with exlcusive upper boundary
    // ['t:abc', 't:abd'), that is, we "replace" the last char ('c') with the char having subsequent code ('d')
    // The edge case is when the search string terminates with a certain char X having the max allowed code (65535)
    // or with a sequence of these, e.g. 'abcXXXXX'. In this case, we have to remove the tail of X characters
    // and increase the preceding non-X char, hence, the range would be ['t:abcXXXXX', 't:abd')
    // If the search sequence consists entirely of such symbols, the search range will have
    // the upper boundary of 'f;' or 't;', so this algorithm always works
    const lowerBound = ContactStore.dbIndex(hasPgp, substring);
    let copyLength = lowerBound.length - 1;
    let lastChar = lowerBound.charCodeAt(copyLength);
    while (lastChar >= 65535) {
      lastChar = lowerBound.charCodeAt(--copyLength);
    }
    const upperBound = lowerBound.substring(0, copyLength) + String.fromCharCode(lastChar + 1);
    return { lowerBound, upperBound };
  }

  private static updateSearchable = (emailEntity: Email) => {
    const email = emailEntity.email.toLowerCase();
    const name = emailEntity.name ? emailEntity.name.toLowerCase() : '';
    // we only need the longest word if it starts with a shorter one,
    // e.g. we don't need "flowcrypt" if we have "flowcryptcompatibility"
    const sortedNormalized = [...email.split(/[^a-z0-9]/), ...name.split(/[^a-z0-9]/)].filter(p => !!p)
      .map(ContactStore.normalizeString).sort((a, b) => b.length - a.length);
    emailEntity.searchable = sortedNormalized.filter((value, index, self) => !self.slice(0, index).find((el) => el.startsWith(value)))
      .map(normalized => ContactStore.dbIndex(emailEntity.fingerprints.length > 0, normalized));
  }

  private static dbContactInternalGetOne = async (db: IDBDatabase, emailOrLongid: string): Promise<Contact | undefined> => {
    if (!/^[A-F0-9]{16}$/.test(emailOrLongid)) { // email
      const contactWithAllPubkeys = await ContactStore.getOneWithAllPubkeys(db, emailOrLongid);
      if (!contactWithAllPubkeys) {
        return contactWithAllPubkeys;
      }
      if (!contactWithAllPubkeys.pubkeys.length) {
        return await ContactStore.toContact(contactWithAllPubkeys.info, undefined);
      }
      // parse the keys
      const parsed = await Promise.all(contactWithAllPubkeys.pubkeys.map(async (pubkey) => { return { lastCheck: pubkey.lastCheck, pubkey: await KeyUtil.parse(pubkey.armoredKey) }; }));
      // sort non-expired first, pick first usableForEncryption
      const sorted = parsed.sort((a, b) => (typeof b.pubkey.expiration === 'undefined') ? Infinity : b.pubkey.expiration!
        - ((typeof a.pubkey.expiration === 'undefined') ? Infinity : a.pubkey.expiration!));
      let selected = sorted.find(entry => entry.pubkey.usableForEncryption);
      if (!selected) {
        selected = sorted.find(entry => entry.pubkey.usableForEncryptionButExpired);
      }
      if (!selected) {
        selected = sorted[0];
      }
      return ContactStore.toContactFromKey(contactWithAllPubkeys.info, selected.pubkey, selected.lastCheck);
    }
    // search all longids
    const tx = db.transaction(['emails', 'pubkeys'], 'readonly');
    return await new Promise((resolve, reject) => {
      const req = tx.objectStore('pubkeys').index('index_longids').get(emailOrLongid);
      ContactStore.setReqPipe(req,
        (pubkey: Pubkey) => {
          if (!pubkey) {
            resolve(undefined);
            return;
          }
          const req2 = tx.objectStore('emails').index('index_fingerprints').get(pubkey.fingerprint!);
          ContactStore.setReqPipe(req2,
            (email: Email) => {
              if (!email) {
                resolve(undefined);
              } else {
                resolve(ContactStore.toContact(email, pubkey));
              }
            },
            reject);
        },
        reject);
    });
  }

  private static getKeyAttributes = (key: Key | undefined): PubkeyAttributes => {
    return { fingerprint: key?.id ?? null, expiresOn: DateUtility.asNumber(key?.expiration) };
  }

  private static toContact = async (email: Email, pubkey: Pubkey | undefined): Promise<Contact | undefined> => {
    if (!email) {
      return;
    }
    const parsed = pubkey ? await KeyUtil.parse(pubkey.armoredKey) : undefined;
    return ContactStore.toContactFromKey(email, parsed, parsed ? pubkey!.lastCheck : null);
  }

  private static toContactFromKey = (email: Email, key: Key | undefined, lastCheck: number | null): Contact | undefined => {
    if (!email) {
      return;
    }
    return {
      email: email.email,
      name: email.name,
      pubkey: key,
      has_pgp: key ? 1 : 0,
      last_use: email.lastUse,
      pubkey_last_check: lastCheck,
      ...ContactStore.getKeyAttributes(key)
    };
  }

  private static toContactPreview = (result: Email): ContactPreview => {
    return { email: result.email, name: result.name, has_pgp: result.fingerprints.length > 0 ? 1 : 0, last_use: result.lastUse };
  }
}
