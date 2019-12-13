import { Buf } from './buf.js';
import { KeyDetails, PgpKey } from './pgp-key.js';
import { AttMeta } from './att.js';
import { DecryptError, VerifyRes, PgpMsg } from './pgp-msg.js';
import { Catch } from '../platform/catch.js';
import { Str } from './common.js';
import { PgpArmor } from './pgp-armor.js';
import { Mime } from './mime.js';
import { Xss } from '../platform/xss.js';

export type KeyBlockType = 'publicKey' | 'privateKey';
export type ReplaceableMsgBlockType = KeyBlockType | 'signedMsg' | 'encryptedMsg' | 'encryptedMsgLink';
export type MsgBlockType = ReplaceableMsgBlockType | 'plainText' | 'decryptedText' | 'plainHtml' | 'decryptedHtml' | 'plainAtt' | 'encryptedAtt'
  | 'decryptedAtt' | 'encryptedAttLink' | 'decryptErr' | 'verifiedMsg' | 'signedHtml';

export class MsgBlock {

  private constructor(
    public type: MsgBlockType,
    public content: string | Buf,
    public complete: boolean,
    public signature?: string,
    public keyDetails?: KeyDetails, // only in publicKey when returned to Android (could eventually be made mandatory, done straight in detectBlocks?)
    public attMeta?: AttMeta, // only in plainAtt, encryptedAtt, decryptedAtt, encryptedAttLink (not sure if always)
    public decryptErr?: DecryptError, // only in decryptErr block, always
    public verifyRes?: VerifyRes,
  ) {
  }

  static fromContent = (type: MsgBlockType, content: string | Buf, missingEnd = false): MsgBlock => {
    return new MsgBlock(type, content, !missingEnd);
  }

  static fromKeyDetails = (type: MsgBlockType, content: string, keyDetails: KeyDetails): MsgBlock => {
    return new MsgBlock(type, content, true, undefined, keyDetails);
  }

  static fromAtt = (type: MsgBlockType, content: string, attMeta: AttMeta): MsgBlock => {
    return new MsgBlock(type, content, true, undefined, undefined, attMeta);
  }

}

export class MsgBlockParser {

  private static ARMOR_HEADER_MAX_LENGTH = 50;

  static detectBlocks = (origText: string) => {
    const blocks: MsgBlock[] = [];
    const normalized = Str.normalize(origText);
    let startAt = 0;
    while (true) { // eslint-disable-line no-constant-condition
      const r = MsgBlockParser.detectBlockNext(normalized, startAt);
      if (r.found) {
        blocks.push(...r.found);
      }
      if (typeof r.continueAt === 'undefined') {
        return { blocks, normalized };
      } else {
        if (r.continueAt <= startAt) {
          Catch.report(`PgpArmordetect_blocks likely infinite loop: r.continue_at(${r.continueAt}) <= start_at(${startAt})`);
          return { blocks, normalized }; // prevent infinite loop
        }
        startAt = r.continueAt;
      }
    }
  }

  static fmtDecryptedAsSanitizedHtmlBlocks = async (decryptedContent: Uint8Array): Promise<{ blocks: MsgBlock[], subject: string | undefined }> => {
    const blocks: MsgBlock[] = [];
    if (!Mime.resemblesMsg(decryptedContent)) {
      let utf = Buf.fromUint8(decryptedContent).toUtfStr();
      utf = PgpMsg.extractFcAtts(utf, blocks);
      utf = PgpMsg.stripFcTeplyToken(utf);
      const armoredPubKeys: string[] = [];
      utf = PgpMsg.stripPublicKeys(utf, armoredPubKeys);
      blocks.push(MsgBlock.fromContent('decryptedHtml', Str.asEscapedHtml(utf))); // escaped text as html
      await MsgBlockParser.pushArmoredPubkeysToBlocks(armoredPubKeys, blocks);
      return { blocks, subject: undefined };
    }
    const decoded = await Mime.decode(decryptedContent);
    if (typeof decoded.html !== 'undefined') {
      blocks.push(MsgBlock.fromContent('decryptedHtml', Xss.htmlSanitizeKeepBasicTags(decoded.html))); // sanitized html
    } else if (typeof decoded.text !== 'undefined') {
      blocks.push(MsgBlock.fromContent('decryptedHtml', Str.asEscapedHtml(decoded.text))); // escaped text as html
    } else {
      blocks.push(MsgBlock.fromContent('decryptedHtml', Str.asEscapedHtml(Buf.with(decryptedContent).toUtfStr()))); // escaped mime text as html
    }
    for (const att of decoded.atts) {
      if (att.treatAs() === 'publicKey') {
        await MsgBlockParser.pushArmoredPubkeysToBlocks([att.getData().toUtfStr()], blocks);
      } else {
        blocks.push(MsgBlock.fromAtt('decryptedAtt', '', { name: att.name, data: att.getData(), length: att.length, type: att.type }));
      }
    }
    return { blocks, subject: decoded.subject };
  }

  private static detectBlockNext = (origText: string, startAt: number) => {
    const result: { found: MsgBlock[], continueAt?: number } = { found: [] as MsgBlock[] };
    const begin = origText.indexOf(PgpArmor.headers('null').begin, startAt);
    if (begin !== -1) { // found
      const potentialBeginHeader = origText.substr(begin, MsgBlockParser.ARMOR_HEADER_MAX_LENGTH);
      for (const xType of Object.keys(PgpArmor.ARMOR_HEADER_DICT)) {
        const type = xType as ReplaceableMsgBlockType;
        const blockHeaderDef = PgpArmor.ARMOR_HEADER_DICT[type];
        if (blockHeaderDef.replace) {
          const indexOfConfirmedBegin = potentialBeginHeader.indexOf(blockHeaderDef.begin);
          if (indexOfConfirmedBegin === 0 || (type === 'encryptedMsgLink' && indexOfConfirmedBegin >= 0 && indexOfConfirmedBegin < 15)) { // identified beginning of a specific block
            if (begin > startAt) {
              const potentialTextBeforeBlockBegun = origText.substring(startAt, begin).trim();
              if (potentialTextBeforeBlockBegun) {
                result.found.push(MsgBlock.fromContent('plainText', potentialTextBeforeBlockBegun));
              }
            }
            let endIndex: number = -1;
            let foundBlockEndHeaderLength = 0;
            if (typeof blockHeaderDef.end === 'string') {
              endIndex = origText.indexOf(blockHeaderDef.end, begin + blockHeaderDef.begin.length);
              foundBlockEndHeaderLength = blockHeaderDef.end.length;
            } else { // regexp
              const origTextAfterBeginIndex = origText.substring(begin);
              const matchEnd = origTextAfterBeginIndex.match(blockHeaderDef.end);
              if (matchEnd) {
                endIndex = matchEnd.index ? begin + matchEnd.index : -1;
                foundBlockEndHeaderLength = matchEnd[0].length;
              }
            }
            if (endIndex !== -1) { // identified end of the same block
              if (type !== 'encryptedMsgLink') {
                result.found.push(MsgBlock.fromContent(type, origText.substring(begin, endIndex + foundBlockEndHeaderLength).trim()));
              } else {
                const pwdMsgFullText = origText.substring(begin, endIndex + foundBlockEndHeaderLength).trim();
                const pwdMsgShortIdMatch = pwdMsgFullText.match(/[a-zA-Z0-9]{10}$/);
                if (pwdMsgShortIdMatch) {
                  result.found.push(MsgBlock.fromContent(type, pwdMsgShortIdMatch[0]));
                } else {
                  result.found.push(MsgBlock.fromContent('plainText', pwdMsgFullText));
                }
              }
              result.continueAt = endIndex + foundBlockEndHeaderLength;
            } else { // corresponding end not found
              result.found.push(MsgBlock.fromContent(type, origText.substr(begin), true));
            }
            break;
          }
        }
      }
    }
    if (origText && !result.found.length) { // didn't find any blocks, but input is non-empty
      const potentialText = origText.substr(startAt).trim();
      if (potentialText) {
        result.found.push(MsgBlock.fromContent('plainText', potentialText));
      }
    }
    return result;
  }

  private static pushArmoredPubkeysToBlocks = async (armoredPubkeys: string[], blocks: MsgBlock[]): Promise<void> => {
    for (const armoredPubkey of armoredPubkeys) {
      const { keys } = await PgpKey.parse(armoredPubkey);
      for (const keyDetails of keys) {
        blocks.push(MsgBlock.fromKeyDetails('publicKey', keyDetails.public, keyDetails));
      }
    }
  }

}
