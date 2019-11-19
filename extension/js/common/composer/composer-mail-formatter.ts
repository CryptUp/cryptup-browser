/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { NewMsgData } from "./interfaces/composer-types.js";
import { KeyInfo } from "../core/pgp.js";
import { Composer } from "./composer.js";
import { MailFormatterInterface } from './formatters/base-mail-formatter.js';
import { PlainMsgMailFormatter } from './formatters/plain-mail-msg-formatter.js';
import { SignedMsgMailFormatter } from './formatters/signed-msg-mail-formatter.js';
import { EncryptedMsgMailFormatter } from './formatters/encrypted-mail-msg-formatter.js';

export class GeneralMailFormatter {

  static async processNewMsg(composer: Composer, newMsgData: NewMsgData, senderKi: KeyInfo, signingPrv?: OpenPGP.key.Key) {
    const choices = composer.composerSendBtn.popover.choices;
    const recipientsEmails = Array.prototype.concat.apply([], Object.values(newMsgData.recipients).filter(arr => !!arr)) as string[];
    let mailFormatter: MailFormatterInterface;
    if (!choices.encrypt && !choices.sign) {
      mailFormatter = new PlainMsgMailFormatter(composer, newMsgData);
    } else if (!choices.encrypt && choices.sign) {
      composer.S.now('send_btn_text').text('Signing');
      mailFormatter = new SignedMsgMailFormatter(composer, newMsgData, signingPrv!);
    } else {
      const { armoredPubkeys, emailsWithoutPubkeys } = await composer.app.collectAllAvailablePublicKeys(newMsgData.sender, senderKi, recipientsEmails);
      if (emailsWithoutPubkeys.length) {
        await composer.composerSendBtn.throwIfEncryptionPasswordInvalid(senderKi, newMsgData);
      }
      composer.S.now('send_btn_text').text('Encrypting');
      mailFormatter = new EncryptedMsgMailFormatter(composer, newMsgData, armoredPubkeys, signingPrv);
    }
    return await mailFormatter.createMsgObject();
  }

}
