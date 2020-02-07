/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { MsgBlock, ReplaceableMsgBlockType } from './msg-block.js';
import { SanitizeImgHandling, Xss } from '../platform/xss.js';

import { Buf } from './buf.js';
import { Catch } from '../platform/catch.js';
import { Mime } from './mime.js';
import { PgpArmor } from './pgp-armor.js';
import { PgpKey } from './pgp-key.js';
import { Str } from './common.js';
import { FcAttLinkData } from './att.js';

type SanitizedBlocks = { blocks: MsgBlock[], subject: string | undefined, isRichText: boolean };

export class MsgBlockParser {

  private static ARMOR_HEADER_MAX_LENGTH = 50;

  public static detectBlocks = (origText: string) => {
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

  public static fmtDecryptedAsSanitizedHtmlBlocks = async (decryptedContent: Uint8Array, imgHandling: SanitizeImgHandling = 'IMG-TO-LINK'): Promise<SanitizedBlocks> => {
    const blocks: MsgBlock[] = [];
    let isRichText = false;
    if (!Mime.resemblesMsg(decryptedContent)) {
      let utf = Buf.fromUint8(decryptedContent).toUtfStr();
      utf = MsgBlockParser.extractFcAtts(utf, blocks);
      utf = MsgBlockParser.stripFcTeplyToken(utf);
      const armoredPubKeys: string[] = [];
      utf = MsgBlockParser.stripPublicKeys(utf, armoredPubKeys);
      blocks.push(MsgBlock.fromContent('decryptedHtml', Str.asEscapedHtml(utf))); // escaped text as html
      await MsgBlockParser.pushArmoredPubkeysToBlocks(armoredPubKeys, blocks);
      return { blocks, subject: undefined, isRichText };
    }
    const decoded = await Mime.decode(decryptedContent);
    if (typeof decoded.html !== 'undefined') {
      blocks.push(MsgBlock.fromContent('decryptedHtml', Xss.htmlSanitizeKeepBasicTags(decoded.html, imgHandling))); // sanitized html
      isRichText = true;
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
    return { blocks, subject: decoded.subject, isRichText };
  }

  public static extractFcAtts = (decryptedContent: string, blocks: MsgBlock[]) => {
    // these tags were created by FlowCrypt exclusively, so the structure is fairly rigid
    // `<a href="${att.url}" class="cryptup_file" cryptup-data="${fcData}">${linkText}</a>\n`
    // thus we use RegEx so that it works on both browser and node
    if (decryptedContent.includes('class="cryptup_file"')) {
      decryptedContent = decryptedContent.replace(/<a\s+href="([^"]+)"\s+class="cryptup_file"\s+cryptup-data="([^"]+)"\s*>[^<]+<\/a>\n?/gm, (_, url, fcData) => {
        const a = Str.htmlAttrDecode(String(fcData));
        if (MsgBlockParser.isFcAttLinkData(a)) {
          blocks.push(MsgBlock.fromAtt('encryptedAttLink', '', { type: a.type, name: a.name, length: a.size, url: String(url) }));
        }
        return '';
      });
    }
    return decryptedContent;
  }

  public static stripPublicKeys = (decryptedContent: string, foundPublicKeys: string[]) => {
    let { blocks, normalized } = MsgBlockParser.detectBlocks(decryptedContent); // tslint:disable-line:prefer-const
    for (const block of blocks) {
      if (block.type === 'publicKey') {
        const armored = block.content.toString();
        foundPublicKeys.push(armored);
        normalized = normalized.replace(armored, '');
      }
    }
    return normalized;
  }

  // public static extractFcReplyToken =  (decryptedContent: string) => { // todo - used exclusively on the web - move to a web package
  //   const fcTokenElement = $(`<div>${decryptedContent}</div>`).find('.cryptup_reply');
  //   if (fcTokenElement.length) {
  //     const fcData = fcTokenElement.attr('cryptup-data');
  //     if (fcData) {
  //       return Str.htmlAttrDecode(fcData);
  //     }
  //   }
  // }

  public static stripFcTeplyToken = (decryptedContent: string) => {
    return decryptedContent.replace(/<div[^>]+class="cryptup_reply"[^>]+><\/div>/, '');
  }

  private static isFcAttLinkData = (o: any): o is FcAttLinkData => {
    return o && typeof o === 'object' && typeof (o as FcAttLinkData).name !== 'undefined'
      && typeof (o as FcAttLinkData).size !== 'undefined' && typeof (o as FcAttLinkData).type !== 'undefined';
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
      const { keys } = await PgpKey.parseDetails(armoredPubkey);
      for (const keyDetails of keys) {
        blocks.push(MsgBlock.fromKeyDetails('publicKey', keyDetails.public, keyDetails));
      }
    }
  }

}
