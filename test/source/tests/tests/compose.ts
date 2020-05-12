/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';

import { BrowserHandle, Controllable, ControllablePage, ControllableFrame } from '../../browser';
import { Config, Util } from '../../util';

import { AvaContext } from '..';
import { ComposePageRecipe } from '../page-recipe/compose-page-recipe';
import { Dict } from '../../core/common';
import { GoogleData } from '../../mock/google/google-data';
import { InboxPageRecipe } from '../page-recipe/inbox-page-recipe';
import { OauthPageRecipe } from '../page-recipe/oauth-page-recipe';
import { PageRecipe } from '../page-recipe/abstract-page-recipe';
import { SettingsPageRecipe } from '../page-recipe/settings-page-recipe';
import { TestUrls } from '../../browser/test-urls';
import { TestVariant } from '../../util';
import { TestWithBrowser } from '../../test';
import { expect } from "chai";
import { BrowserRecipe } from '../browser-recipe';
import { SetupPageRecipe } from '../page-recipe/setup-page-recipe';

// tslint:disable:no-blank-lines-func
// tslint:disable:no-unused-expression
/* eslint-disable max-len */

// get s/mime cert for testing: https://extrassl.actalis.it/portal/uapub/freemail?lang=en
const smimeCert = "-----BEGIN CERTIFICATE-----\nMIIE9DCCA9ygAwIBAgIQY/cCXnAPOUUwH7L7pWdPhDANBgkqhkiG9w0BAQsFADCB\njTELMAkGA1UEBhMCSVQxEDAOBgNVBAgMB0JlcmdhbW8xGTAXBgNVBAcMEFBvbnRl\nIFNhbiBQaWV0cm8xIzAhBgNVBAoMGkFjdGFsaXMgUy5wLkEuLzAzMzU4NTIwOTY3\nMSwwKgYDVQQDDCNBY3RhbGlzIENsaWVudCBBdXRoZW50aWNhdGlvbiBDQSBHMjAe\nFw0yMDAzMjMxMzU2NDZaFw0yMTAzMjMxMzU2NDZaMCIxIDAeBgNVBAMMF2FjdGFs\naXNAbWV0YS4zM21haWwuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKC\nAQEArVVpXBkzGvcqib8rDwqHCaKm2EiPslQ8I0G1ZDxrs6Ke2QXNm3yGVwOzkVvK\neEnuzE5M4BBeh+GwcfvoyS/xI6m44WWnqj65cJoSLA1ypE4D4urv/pzG783y2Vdy\nQ96izBdFyevsil89Z2AxZxrFh1RC2XvgXad4yyD4yvVpHskfPexnhLliHl7cpXjw\n5D2n1hBGR8CSDbQAgO58PB7Y2ldrTi+rWBu2Akuk/YyWOOiGA8pdfLBIkOFJTeQc\nm7+vWP2JTN6Xp+JkGvXQBRaqwyGVg8fSc4e7uGCXZaH5/Na2FXY2OL+tYDDb27zS\n3cBrzEbGVjA6raYxcrFWV4PkdwIDAQABo4IBuDCCAbQwDAYDVR0TAQH/BAIwADAf\nBgNVHSMEGDAWgBRr8o2eaMElBB9RNFf2FlyU6k1pGjB+BggrBgEFBQcBAQRyMHAw\nOwYIKwYBBQUHMAKGL2h0dHA6Ly9jYWNlcnQuYWN0YWxpcy5pdC9jZXJ0cy9hY3Rh\nbGlzLWF1dGNsaWcyMDEGCCsGAQUFBzABhiVodHRwOi8vb2NzcDA5LmFjdGFsaXMu\naXQvVkEvQVVUSENMLUcyMCIGA1UdEQQbMBmBF2FjdGFsaXNAbWV0YS4zM21haWwu\nY29tMEcGA1UdIARAMD4wPAYGK4EfARgBMDIwMAYIKwYBBQUHAgEWJGh0dHBzOi8v\nd3d3LmFjdGFsaXMuaXQvYXJlYS1kb3dubG9hZDAdBgNVHSUEFjAUBggrBgEFBQcD\nAgYIKwYBBQUHAwQwSAYDVR0fBEEwPzA9oDugOYY3aHR0cDovL2NybDA5LmFjdGFs\naXMuaXQvUmVwb3NpdG9yeS9BVVRIQ0wtRzIvZ2V0TGFzdENSTDAdBgNVHQ4EFgQU\nFrtAdAOjrcVeHg5K+T7sj7GHySMwDgYDVR0PAQH/BAQDAgWgMA0GCSqGSIb3DQEB\nCwUAA4IBAQAa9lXKDmV9874ojmIZEBL1S8mKaSNBWP+n0vp5FO0Yh5oL9lspYTPs\n8s6alWUSpVHV8if4uZ2EfcNpNkm9dAajj2n/F/Jyfkp8URu4uvBfm1QColl/zM/D\nx4B7FaD2dw0jTF/k5ulDmzUOc4k+j3LtZNbDOZMF/2g05hSKde/he1njlY3oKa9g\nVW8ftc2NwiSMthxyEIM+ALbNQVML2oN50gArBn5GeI22/aIBZxjtbEdmSTZIf82H\nsOwAnhJ+pD5iIPaF2oa0yN3PvI6IGxLpEv16tQO1N6e5bdP6ZDwqTQJyK+oNTNda\nyPLCqVTFJQWaCR5ZTekRQPTDZkjxjxbs\n-----END CERTIFICATE-----";

export const defineComposeTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {

  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {

    ava.default('compose - toggle minimized state by clicking compose window header', testWithBrowser('compatibility', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('flowcrypt.compatibility@gmail.com'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      const initialComposeFrameHeight = await inboxPage.getOuterHeight('iframe');
      await composeFrame.waitAll('#section_header');
      const composeFrameHeaderHeight = await composeFrame.getOuterHeight('#section_header');
      await Util.sleep(4); // todo - should be fixed, caused by `$('body').attr('data-test-state', 'ready');` baing called in two differing situations
      // mimimize compose frame
      await composeFrame.waitAndClick('@header-title');
      expect(await inboxPage.getOuterHeight('iframe')).to.eq(composeFrameHeaderHeight, 'compose box height failed to collapse');
      // restore compose frame
      await composeFrame.waitAndClick('@header-title');
      expect(await inboxPage.getOuterHeight('iframe')).to.eq(initialComposeFrameHeight);
    }));

    ava.default('compose - signed with entered pass phrase + will remember pass phrase in session', testWithBrowser('compose', async (t, browser) => {
      const k = Config.key('test.ci.compose');
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('test.ci.compose@org.flowcrypt.com'));
      await SettingsPageRecipe.forgetAllPassPhrasesInStorage(settingsPage, k.passphrase);
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('test.ci.compose@org.flowcrypt.com'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'human@flowcrypt.com' }, 'sign with entered pass phrase', { encrypt: false });
      await composeFrame.waitAndClick('@action-send');
      await inboxPage.waitAll('@dialog-passphrase');
      const passphraseDialog = await inboxPage.getFrame(['passphrase.htm']);
      await passphraseDialog.waitAndType('@input-pass-phrase', k.passphrase);
      await passphraseDialog.waitAndClick('@action-confirm-pass-phrase-entry');
      await inboxPage.waitTillGone('@dialog-passphrase');
      await inboxPage.waitTillGone('@container-new-message'); // confirming pass phrase will auto-send the message
      // signed - done, now try to see if it remembered pp in session
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'signed message pp in session', { encrypt: false });
      await ComposePageRecipe.sendAndClose(composePage);
      await settingsPage.close();
      await inboxPage.close();
    }));

    ava.default('compose - can load contact based on name', testWithBrowser('compose', async (t, browser) => {
      // works on first search
      const composePage1 = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage1.type('@input-to', 'human'); // test guessing of contacts
      await composePage1.waitAll(['@container-contacts', '@action-select-contact-name(Human at FlowCrypt)']);
      await composePage1.waitAll(['@container-contacts', '@action-select-contact-email(human@flowcrypt.com)']);
      // works on subsequent search
      const composePage2 = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage2.type('@input-to', 'human'); // test guessing of contacts
      await composePage2.waitAll(['@container-contacts', '@action-select-contact-name(Human at FlowCrypt)']);
      await composePage2.waitAll(['@container-contacts', '@action-select-contact-email(human@flowcrypt.com)']);
    }));

    ava.default('compose - can load contact based on name different from email', testWithBrowser('compose', async (t, browser) => {
      // works on the first search
      const composePage1 = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage1.type('@input-to', 'FirstName'); // test guessing of contacts when the name is not included in email address
      await composePage1.waitAll(['@container-contacts', '@action-select-contact-email(therecipient@theirdomain.com)']);
      // works on subsequent search
      const composePage2 = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage2.type('@input-to', 'FirstName'); // test guessing of contacts when the name is not included in email address
      await composePage2.waitAll(['@container-contacts', '@action-select-contact-email(therecipient@theirdomain.com)']);
    }));

    ava.default(`compose - can choose found contact`, testWithBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      // composePage.enable_debugging('choose-contact');
      await composePage.type('@input-to', 'human'); // test loading of contacts
      await composePage.waitAll(['@container-contacts', '@action-select-contact-email(human@flowcrypt.com)'], { timeout: 30 });
      await composePage.waitAndClick('@action-select-contact-email(human@flowcrypt.com)', { retryErrs: true, confirmGone: true, delay: 0 });
      // todo - verify that the contact/pubkey is showing in green once clicked
      await composePage.waitAndClick('@input-subject');
      await composePage.type('@input-subject', `Automated puppeteer test: pubkey chosen by clicking found contact`);
      await composePage.type('@input-body', `This is an automated puppeteer test: pubkey chosen by clicking found contact`);
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default(`compose - freshly loaded pubkey`, testWithBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'freshly loaded pubkey');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - recipient pasted including name', testWithBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'Human at Flowcrypt <Human@FlowCrypt.com>' }, 'recipient pasted including name');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - nopgp', testWithBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human+nopgp@flowcrypt.com' }, 'unknown pubkey');
      await ComposePageRecipe.sendAndClose(composePage, { password: 'test-pass' });
    }));

    ava.default('compose - from alias', testWithBrowser('compatibility', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      await composePage.selectOption('@input-from', 'flowcryptcompatibility@gmail.com');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'from alias');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - with attachments + nopgp', testWithBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human+nopgp@flowcrypt.com' }, 'with files + nonppg');
      const fileInput = await composePage.target.$('input[type=file]');
      await fileInput!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
      await ComposePageRecipe.sendAndClose(composePage, { password: 'test-pass', timeout: 90 });
    }));

    ava.default('compose - signed message', testWithBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'signed message', { encrypt: false });
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - settings - manually copied pubkey', testWithBrowser('compose', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('test.ci.compose@org.flowcrypt.com'));
      let composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'human@flowcrypt.com' }, 'just to load - will close this page');
      await Util.sleep(2); // todo: should wait until actually loaded
      await composeFrame.waitAndClick('@action-close-new-message');
      await inboxPage.waitTillGone('@container-new-message');
      composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'human+manualcopypgp@flowcrypt.com' }, 'manual copied key');
      await composeFrame.waitAndClick('@action-open-add-pubkey-dialog', { delay: 1 });
      await inboxPage.waitAll('@dialog-add-pubkey');
      const addPubkeyDialog = await inboxPage.getFrame(['add_pubkey.htm']);
      await addPubkeyDialog.waitAll('@input-select-copy-from');
      await Util.sleep(1);
      await addPubkeyDialog.selectOption('@input-select-copy-from', 'human@flowcrypt.com');
      await Util.sleep(1);
      await addPubkeyDialog.waitAndClick('@action-add-pubkey');
      await inboxPage.waitTillGone('@dialog-add-pubkey');
      await composeFrame.waitAndClick('@action-send', { delay: 2 });
      await inboxPage.waitTillGone('@container-new-message');
    }));

    ava.default('compose - keyboard - Ctrl+Enter sends message', testWithBrowser('compose', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('test.ci.compose@org.flowcrypt.com'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await composeFrame.target.evaluateHandle(() => document.body.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', ctrlKey: true })));
      await composeFrame.waitAndRespondToModal('error', 'confirm', 'Please add a recipient first');
    }));

    ava.default('compose - keyboard - Opening & changing composer send btn popover using keyboard', testWithBrowser('compose', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('test.ci.compose@org.flowcrypt.com'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await composeFrame.waitAndFocus('@action-show-options-popover');
      await inboxPage.press('Enter', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter'); // more arrow downs to ensure that active element selection loops
      expect(await composeFrame.read('@action-send')).to.eq('Sign and Send');
    }));

    ava.default('compose - keyboard - Attaching file using keyboard', testWithBrowser('compose', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('test.ci.compose@org.flowcrypt.com'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await composeFrame.waitAndFocus('@action-attach-files');
      await Promise.all([
        inboxPage.page.waitForFileChooser(), // must be called before the file chooser is launched
        inboxPage.press('Enter')
      ]);
    }));

    ava.default('compose - reply - old gmail threadId fmt', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadId=16841ce0ce5cb74d&replyMsgId=16841ce0ce5cb74d';
      const replyFrame = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, skipValidation: true });
      await replyFrame.waitAll(['#new_message', '@action-retry-by-reloading']);
      expect(await replyFrame.read('#new_message')).to.include('Cannot get reply data for the message you are replying to');
      await replyFrame.notPresent('@action-accept-reply-prompt');
    }));

    ava.default('compose - reply - thread id does not exist', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadId=16804894591b3a4b&replyMsgId=16804894591b3a4b';
      const replyFrame = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, skipValidation: true, });
      await replyFrame.waitAll(['#new_message', '@action-retry-by-reloading']);
      expect(await replyFrame.read('#new_message')).to.include('Cannot get reply data for the message you are replying to');
      await replyFrame.notPresent('@action-accept-reply-prompt');
    }));

    ava.default('compose - quote - can load quote from encrypted/text email', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=16b584ed95837510&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=16b584ed95837510';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-prompt', { delay: 5 });
      await clickTripleDotAndExpectQuoteToLoad(composePage, [
        'On 2019-06-14 at 23:24, flowcrypt.compatibility@gmail.com wrote:',
        '> This is some message',
        '>',
        '> and below is the quote',
        '>',
        '> > this is the quote',
        '> > still the quote',
        '> > third line',
        '> >> double quote',
        '> >> again double quote'
      ].join('\n'));
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - quote - can load quote from plain/text email', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=16402d6dc4342e7f&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___' +
        '&replyMsgId=16402d6dc4342e7f';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-prompt', { delay: 1 });
      await clickTripleDotAndExpectQuoteToLoad(composePage, [
        'On 2018-06-15 at 09:46, info@nvimp.com wrote:',
        '> cropping all except for the image below'
      ].join('\n'));
    }));

    ava.default('compose - reply - can load quote from plain/html email', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=16b36861a890bb26&skipClickPrompt=___cu_false___' +
        '&ignoreDraft=___cu_false___&replyMsgId=16b36861a890bb26';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-prompt', { delay: 1 });
      expect(await composePage.read('@input-body')).to.not.include('flowcrypt.compatibility test footer with an img');
      await clickTripleDotAndExpectQuoteToLoad(composePage, [
        'On 2019-06-08 at 09:57, human@flowcrypt.com wrote:',
        '> Used to fail on Android app',
        '>',
        '> ---------- Forwarded message ---------',
        '> From: Mozilla <Mozilla@e.mozilla.org>',
        '> Date: Thu, 6 Jun 2019, 17:22',
        '> Subject: Your misinformation questions ... answered.',
        '> To: <tom@cryptup.org>'
      ].join('\n'));
    }));

    ava.default('compose - reply - can load quote from encrypted/html email', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=1663a65bbd73ce1a&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=1663a65bbd73ce1a';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-prompt', { delay: 1 });
      await clickTripleDotAndExpectQuoteToLoad(composePage, [
        'On 2018-10-03 at 14:47, henry.electrum@gmail.com wrote:',
        '> The following text is bold: this is bold',
        '>',
        '> The following text is red: this text is red'
      ].join('\n'));
    }));

    for (const inputMethod of ['mouse', 'keyboard']) {
      ava.default(`compose - reply - pass phrase dialog - dialog ok (${inputMethod})`, testWithBrowser('compatibility', async (t, browser) => {
        const pp = Config.key('flowcrypt.compatibility.1pp1').passphrase;
        const { inboxPage, replyFrame } = await setRequirePassPhraseAndOpenRepliedMessage(t, browser, pp);
        // Get Passphrase dialog and write confirm passphrase
        await inboxPage.waitAll('@dialog-passphrase');
        const passPhraseFrame = await inboxPage.getFrame(['passphrase.htm']);
        await passPhraseFrame.waitAndType('@input-pass-phrase', pp);
        if (inputMethod === 'mouse') {
          await passPhraseFrame.waitAndClick('@action-confirm-pass-phrase-entry');
        } else if (inputMethod === 'keyboard') {
          await inboxPage.press('Enter');
        }
        await inboxPage.waitTillGone('@dialog');
        // Then we can try to run base test
        await clickTripleDotAndExpectQuoteToLoad(replyFrame, [
          'On 2019-06-14 at 23:24, flowcrypt.compatibility@gmail.com wrote:',
          '> This is some message',
          '>',
          '> and below is the quote',
          '>',
          '> > this is the quote',
          '> > still the quote',
          '> > third line',
          '> >> double quote',
          '> >> again double quote'
        ].join('\n'));
      }));

      ava.default(`compose - reply - pass phrase dialog - dialog cancel (${inputMethod})`, testWithBrowser('compatibility', async (t, browser) => {
        const pp = Config.key('flowcrypt.compatibility.1pp1').passphrase;
        const { inboxPage, replyFrame } = await setRequirePassPhraseAndOpenRepliedMessage(t, browser, pp);
        // Get Passphrase dialog and cancel confirm passphrase
        await inboxPage.waitAll('@dialog-passphrase');
        const passPhraseFrame = await inboxPage.getFrame(['passphrase.htm']);
        if (inputMethod === 'mouse') {
          await passPhraseFrame.waitAndClick('@action-cancel-pass-phrase-entry');
        } else if (inputMethod === 'keyboard') {
          await inboxPage.press('Escape');
        }
        await inboxPage.waitTillGone('@dialog');
        await replyFrame.waitAll(['@action-expand-quoted-text']);
        const inputBody = await replyFrame.read('@input-body');
        expect(inputBody.trim()).to.be.empty;
        await clickTripleDotAndExpectQuoteToLoad(replyFrame, [
          'On 2019-06-14 at 23:24, flowcrypt.compatibility@gmail.com wrote:',
          '> (Skipping previous message quote)'
        ].join('\n'));
      }));
    }

    ava.default('compose - reply - signed message', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=15f7f5face7101db&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=15f7f5face7101db';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-prompt', { delay: 1 });
      await composePage.waitAll('@action-send');
      await Util.sleep(0.5);
      expect(await composePage.read('@action-send')).to.eq('Sign and Send');
      await composePage.waitAndClick('@action-show-options-popover');
      await composePage.waitAll(['@action-toggle-sign', '@action-toggle-encrypt', '@icon-toggle-sign-tick']);
      await composePage.notPresent(['@icon-toggle-encrypt-tick']); // response to signed message should not be auto-encrypted
      await ComposePageRecipe.fillMsg(composePage, {}, undefined, {}, 'reply');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - forward - pgp/mime signed-only', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=15f7fc2919788f03&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=15f7fc2919788f03';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-forward');
      await ComposePageRecipe.fillRecipients(composePage, { to: 'human@flowcrypt.com' }, 'reply');
      expect(await composePage.read('@input-body')).to.include('> This message will contain a separately attached file + signature.');
      await composePage.waitAny('.qq-file-id-0');
    }));

    ava.default('compose - standalone- hide/show btns after signing', testWithBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'test.no.pgp@test.com' }, 'Signed Message', { encrypt: false });
      expect(await composePage.isElementPresent('@add-intro')).to.be.true;
      expect(await composePage.isElementPresent('@password-or-pubkey-container')).to.be.true;
      await composePage.notPresent('@add-intro');
      await composePage.notPresent('@password-or-pubkey-container');
    }));

    ava.default('compose - CC&BCC new message', testWithBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com', cc: 'human@flowcrypt.com', bcc: 'human@flowcrypt.com' }, 'Testing CC And BCC');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - reply - CC&BCC test reply', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=16ce2c965c75e5a6&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=16ce2c965c75e5a6';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-all-prompt', { delay: 2 });
      await ComposePageRecipe.fillMsg(composePage, { bcc: "test@email.com" }, undefined, undefined, 'reply');
      await expectRecipientElements(composePage, { to: ['censored@email.com'], cc: ['censored@email.com'], bcc: ['test@email.com'] });
      await Util.sleep(3);
      await ComposePageRecipe.sendAndClose(composePage, { password: 'test-pass' });
    }));

    ava.default('compose - reply - CC&BCC test forward', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=16ce2c965c75e5a6&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=16ce2c965c75e5a6';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-forward', { delay: 2 });
      await composePage.waitAny('@input-to'); // if this element is present then the elemenent should be focused
      await expectRecipientElements(composePage, { to: [], cc: [], bcc: [] });
    }));

    ava.default('compose - expired can still send', testWithBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'expired.on.attester@domain.com' }, 'Test Expired Email');
      const expandContainer = await composePage.waitAny('@action-show-container-cc-bcc-buttons');
      const recipient = await expandContainer.$('.email_preview span');
      expect(await PageRecipe.getElementPropertyJson(recipient!, 'className')).to.include('expired');
      await composePage.waitAndClick('@action-send');
      await PageRecipe.waitForModalAndRespond(composePage, 'confirm', { contentToCheck: 'The public key of one of your recipients is expired.', clickOn: 'confirm', timeout: 40 });
      await composePage.waitForSelTestState('closed', 20); // succesfully sent
      await composePage.close();
    }));

    ava.default('compose - loading drafts - new message, rendering cc/bcc and check if cc/bcc btns are hidden',
      testWithBrowser('compatibility', async (t, browser) => {
        const appendUrl = 'draftId=draft-1';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl });
        await expectRecipientElements(composePage, { to: ['flowcryptcompatibility@gmail.com'], cc: ['flowcrypt.compatibility@gmail.com'], bcc: ['human@flowcrypt.com'] });
        const subjectElem = await composePage.waitAny('@input-subject');
        expect(await (await subjectElem.getProperty('value')).jsonValue()).to.equal('Test Draft - New Message');
        expect((await composePage.read('@input-body')).trim()).to.equal('Testing Drafts (Do not delete)');
        for (const elem of await composePage.target.$$('.container-cc-bcc-buttons > span')) {
          expect(await PageRecipe.getElementPropertyJson(elem, 'offsetHeight')).to.equal(0); // CC/BCC btn isn't visible
        }
      }));

    ava.default('compose - loading drafts - reply', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=16cfa9001baaac0a&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=16cfa9001baaac0a';
      const initialScript = () => {
        chrome.storage.local.set({ 'cryptup_flowcryptcompatibilitygmailcom_drafts_reply': { '16cfa9001baaac0a': 'draft-3' } });
      };
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true, skipClickPropt: true, initialScript });
      await composePage.waitAndClick('@action-show-container-cc-bcc-buttons');
      await expectRecipientElements(composePage, { to: ['flowcryptcompatibility@gmail.com'] });
      expect(await composePage.read('@input-body')).to.include('Test Draft Reply (Do not delete, tests is using this draft)');
    }));

    ava.default('compose - key-mismatch - standalone - key mismatch loading', testWithBrowser('compatibility', async (t, browser) => {
      const params = 'threadId=15f7f5630573be2d&skipClickPrompt=___cu_true___&ignoreDraft=___cu_true___&replyMsgId=15f7f5630573be2d&disableDraftSaving=___cu_true___&replyPubkeyMismatch=___cu_true___';
      const replyMismatchPage = await browser.newPage(t, 'chrome/elements/compose.htm?account_email=flowcrypt.compatibility%40gmail.com&parent_tab_id=0&debug=___cu_true___&frameId=none&' + params);
      await replyMismatchPage.waitForSelTestState('ready');
      await Util.sleep(3);
      await expectRecipientElements(replyMismatchPage, { to: ['censored@email.com'], cc: [], bcc: [] });
      expect(await replyMismatchPage.read('@input-body')).to.include('I was not able to read your encrypted message because it was encrypted for a wrong key.');
      await replyMismatchPage.waitAll('.qq-upload-file');
      await ComposePageRecipe.sendAndClose(replyMismatchPage);
    }));

    ava.default('compose - reply all - TO/CC/BCC when replying all', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = `threadId=16d6a6c2d6ae618f&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=16d6a6c2d6ae618f`;
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-all-prompt');
      await composePage.waitForSelTestState('ready'); // continue when all recipients get evaluated
      await composePage.waitAndClick('@action-show-container-cc-bcc-buttons');
      for (const type of ['to', 'cc', 'bcc']) {
        const container = (await composePage.waitAny(`@container-${type}`))!;
        const recipients = await container.$$('.recipients > span');
        expect(recipients.length).to.equal(2);
        for (const recipient of recipients) {
          const textContent = await PageRecipe.getElementPropertyJson(recipient, 'textContent');
          expect(textContent.trim()).to.include('@flowcrypt.com');
        }
      }
    }));

    ava.default('compose - send new plain message', testWithBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'New Plain Message', { encrypt: false, sign: false });
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - send btn should be disabled while encrypting/sending', testWithBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, '');
      await composePage.waitAndClick('@action-send', { delay: 1 });
      expect(await composePage.isDisabled('#send_btn')).to.be.true;
      await composePage.waitAndRespondToModal('confirm', 'cancel', 'Send without a subject?');
      expect(await composePage.isDisabled('#send_btn')).to.be.false;
    }));

    ava.default('compose - load contacts through API', testWithBrowser('compose', async (t, browser) => {
      let composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage.waitAndClick('@action-show-container-cc-bcc-buttons');
      await composePage.type('@input-to', 'contact');
      if (testVariant === 'CONSUMER-MOCK') {
        // consumer does not get Contacts scope automatically (may scare users when they install)
        // first search, did not yet receive contacts scope - should find no contacts
        await expectFirstContactResultEqual(composePage, 'No Contacts Found');
        // allow contacts scope, and expect that it will find a contact
        const oauthPopup = await browser.newPageTriggeredBy(t, () => composePage.waitAndClick('@action-auth-with-contacts-scope'), 'test.ci.compose@org.flowcrypt.com');
        await OauthPageRecipe.google(t, oauthPopup, 'test.ci.compose@org.flowcrypt.com', 'approve');
      }
      await expectFirstContactResultEqual(composePage, 'contact.test@flowcrypt.com');
      // re-load the compose window, expect that it remembers scope was connected, and remembers the contact
      composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage.waitAndClick('@action-show-container-cc-bcc-buttons');
      await composePage.type('@input-to', 'contact');
      await expectFirstContactResultEqual(composePage, 'contact.test@flowcrypt.com');
      await composePage.notPresent('@action-auth-with-contacts-scope');
    }));

    ava.default('compose - new message, open footer', testWithBrowser('compatibility', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      await ComposePageRecipe.fillRecipients(composePage, { to: 'human@flowcrypt.com' }, 'new');
      await composePage.waitAndClick(`@action-send`);
      expect(await composePage.read('#swal2-content')).to.include('Send without a subject?');
      await composePage.waitAndClick('.swal2-cancel');
      await composePage.waitAndType('@input-subject', 'Testing new message with footer', { delay: 1 });
      await composePage.waitAndClick(`@action-send`);
      expect(await composePage.read('#swal2-content')).to.include('Send empty message?');
      await composePage.waitAndClick('.swal2-cancel');
      await composePage.waitAndClick('@action-expand-quoted-text', { delay: 1 });
      const footer = await composePage.read('@input-body');
      expect(footer).to.eq('\n\n\n--\nflowcrypt.compatibility test footer with an img');
      await composePage.waitAndClick(`@action-send`);
      expect(await composePage.read('#swal2-content')).to.include('Send empty message?');
      await composePage.waitAndClick('.swal2-cancel');
      await composePage.waitAndType('@input-body', 'New message\n' + footer, { delay: 1 });
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - new message, Footer Mock Test', testWithBrowser('compatibility', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'Test Footer (Mock Test)', {}, 'new');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - loading drafts - test tags in draft', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'draftId=draft-0';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl });
      expect(await composePage.read('@input-body')).to.include('hello<draft>here');
    }));

    ava.default('compose - compose - test minimizing/maximizing', testWithBrowser('compose', async (t, browser) => {
      const inboxPage = await browser.newPage(t, 'chrome/settings/inbox/inbox.htm?acctEmail=test.ci.compose%40org.flowcrypt.com');
      await inboxPage.waitAndClick('@action-open-secure-compose-window');
      await inboxPage.waitAll(['@container-new-message']);
      const composeFrame = await inboxPage.getFrame(['compose.htm']);
      await composeFrame.waitForSelTestState('ready');
      const composeBody = await composeFrame.waitAny('body');
      const initialWidth = Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetWidth'));
      const initialHeight = Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetHeight'));
      await composeFrame.waitAndClick('.popout', { sleepWhenDone: 1 });
      expect(Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetWidth'))).to.be.greaterThan(initialWidth, 'popout width greater than initial');
      expect(Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetHeight'))).to.be.greaterThan(initialHeight, 'popout weight greater than initial');
      await composeFrame.waitAndClick('.popout', { sleepWhenDone: 1 });
      expect(Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetWidth'))).to.equal(initialWidth, 'width back to initial');
      expect(Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetHeight'))).to.equal(initialHeight, 'height back to initial');
      await composeFrame.waitAndClick('.minimize_new_message', { sleepWhenDone: 1 });
      expect(Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetHeight'))).to.be.lessThan(initialHeight, 'minimized lower than initial');
      await composeFrame.waitAndClick('.minimize_new_message', { sleepWhenDone: 1 });
      expect(Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetHeight'))).to.equal(initialHeight, 'back to initial after un-minimizing');
    }));

    ava.default('compose - saving and rendering a draft with image', testWithBrowser('compatibility', async (t, browser) => {
      const imgBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAnElEQVR42u3RAQ0AAAgDIE1u9FvDOahAVzLFGS1ECEKEIEQIQoQgRIgQIQgRghAhCBGCECEIQYgQhAhBiBCECEEIQoQgRAhChCBECEIQIgQhQhAiBCFCEIIQIQgRghAhCBGCEIQIQYgQhAhBiBCEIEQIQoQgRAhChCAEIUIQIgQhQhAiBCEIEYIQIQgRghAhCBEiRAhChCBECEK+W3uw+TnWoJc/AAAAAElFTkSuQmCC';
      let composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      const subject = `saving and rendering a draft with image ${Util.lousyRandom()}`;
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, subject, { 'richtext': true });
      await composePage.page.evaluate((src: string) => { $('[data-test=action-insert-image]').val(src).click(); }, imgBase64);
      await ComposePageRecipe.waitWhenDraftIsSaved(composePage);
      await composePage.close();
      composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl: 'draftId=draft_with_image' });
      const body = await composePage.waitAny('@input-body');
      await composePage.waitAll('#input_text img');
      expect(await body.$eval('#input_text img', el => el.getAttribute('src'))).to.eq(imgBase64);
    }));

    ava.default('compose - RTL subject', testWithBrowser('compatibility', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      await composePage.type('@input-subject', 'ش');
      expect(await composePage.attr('@input-subject', 'dir')).to.eq('rtl');
      await composePage.press('Backspace');
      expect(await composePage.attr('@input-subject', 'dir')).to.be.null;
      await composePage.type('@input-subject', 'a');
      expect(await composePage.attr('@input-subject', 'dir')).to.be.null;
    }));

    ava.default('compose - saving and rendering a draft with RTL text (plain text)', testWithBrowser('compatibility', async (t, browser) => {
      let composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      const subject = `مرحبا RTL plain text`;
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, subject, { richtext: false });
      await ComposePageRecipe.waitWhenDraftIsSaved(composePage);
      await composePage.close();
      composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl: 'draftId=draft_with_rtl_text' });
      expect(await composePage.attr('@input-subject', 'dir')).to.eq('rtl');
      expect(await composePage.readHtml('@input-body')).to.include('<div dir="rtl">مرحبا<br></div>');
    }));

    ava.default('compose - saving and rendering a draft with RTL text (rich text)', testWithBrowser('compatibility', async (t, browser) => {
      let composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      const subject = `مرحبا RTL rich text`;
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, subject, { richtext: true });
      await ComposePageRecipe.waitWhenDraftIsSaved(composePage);
      await composePage.close();
      composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl: 'draftId=draft_with_rtl_text' });
      expect(await composePage.readHtml('@input-body')).to.include('<div dir="rtl">مرحبا<br></div>');
    }));

    ava.default('compose - sending and rendering encrypted message with image ', testWithBrowser('compatibility', async (t, browser) => {
      await sendImgAndVerifyPresentInSentMsg(t, browser, 'encrypt');
    }));

    ava.default('compose - sending and rendering signed message with image ', testWithBrowser('compatibility', async (t, browser) => {
      await sendImgAndVerifyPresentInSentMsg(t, browser, 'sign');
    }));

    ava.default('oversize attachment does not get errorneously added', testWithBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      // big file will get canceled
      const fileInput = await composePage.target.$('input[type=file]');
      await fileInput!.uploadFile('test/samples/large.jpg');
      await composePage.waitAndRespondToModal('confirm', 'cancel', 'The files are over 5 MB');
      await Util.sleep(1);
      await composePage.notPresent('.qq-upload-file-selector');
      // small file will get accepted
      await fileInput!.uploadFile('test/samples/small.png');
      await composePage.waitForContent('.qq-upload-file-selector', 'small.png');
    }));

    ava.default('can lookup public key from FlowCrypt Email Key Manager', testWithBrowser(undefined, async (t, browser) => {
      const acct = 'get.key@key-manager-autogen.flowcrypt.com';
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
      await SetupPageRecipe.autoKeygen(settingsPage);
      const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
      await ComposePageRecipe.fillMsg(composePage, { to: 'find.public.key@key-manager-autogen.flowcrypt.com' }, 'should find pubkey from key manager');
      await composePage.waitForContent('.email_address.has_pgp', 'find.public.key@key-manager-autogen.flowcrypt.com');
      expect(await composePage.attr('.email_address.has_pgp', 'title')).to.contain('00B0 1158 0796 9D75');
    }));

    ava.default('can lookup public key from WKD directly', testWithBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'test-wkd@metacode.biz' }, 'should find pubkey from WKD directly');
      await composePage.waitForContent('.email_address.has_pgp', 'test-wkd@metacode.biz');
      expect(await composePage.attr('.email_address.has_pgp', 'title')).to.contain('92C4 E784 1B3A FF74');
    }));

    ava.default('timeouts when searching WKD - used to never time out', testWithBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'somewhere@mac.com' }, 'should show no pubkey within a few seconds');
      await composePage.waitForContent('.email_address.no_pgp', 'somewhere@mac.com');
      await composePage.waitAll('@input-password');
    }));

    ava.todo('compose - reply - new gmail threadId fmt');

    ava.todo('compose - reply - skip click prompt');

    ava.default('send with single S/MIME cert', testWithBrowser('compose', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('test.ci.compose@org.flowcrypt.com'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime@recipient.com' }, t.title);
      await pastePublicKeyManually(composeFrame, inboxPage, 'smime@recipient.com', smimeCert);
      await composeFrame.waitAndClick('@action-send', { delay: 2 });
      await inboxPage.waitTillGone('@container-new-message');
    }));

    ava.default('send with several S/MIME certs', testWithBrowser('compose', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('test.ci.compose@org.flowcrypt.com'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime1@recipient.com', cc: 'smime2@recipient.com' }, t.title);
      await pastePublicKeyManually(composeFrame, inboxPage, 'smime1@recipient.com', smimeCert);
      await pastePublicKeyManually(composeFrame, inboxPage, 'smime2@recipient.com', smimeCert);
      await composeFrame.waitAndClick('@action-send', { delay: 2 });
      await inboxPage.waitTillGone('@container-new-message');
    }));

    ava.default('send with S/MIME attachment', testWithBrowser('compose', async (t, browser) => {
      // todo - this is not yet looking for actual attachment in the result, just checks that it's s/mime message
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('test.ci.compose@org.flowcrypt.com'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime.att@recipient.com' }, t.title);
      await pastePublicKeyManually(composeFrame, inboxPage, 'smime.att@recipient.com', smimeCert);
      const fileInput = await composeFrame.target.$('input[type=file]');
      await fileInput!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
      await composeFrame.waitAndClick('@action-send', { delay: 2 });
      await PageRecipe.waitForModalAndRespond(composeFrame, 'error', {
        contentToCheck: 'Attachments are not yet supported when sending to recipients using S/MIME x509 certificates.',
        timeout: 40
      });
    }));

    ava.default('send with mixed S/MIME and PGP recipients - should show err', testWithBrowser('compose', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('test.ci.compose@org.flowcrypt.com'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime@recipient.com', cc: 'human@flowcrypt.com' }, t.title);
      await pastePublicKeyManually(composeFrame, inboxPage, 'smime@recipient.com', smimeCert);
      await composeFrame.waitAndClick('@action-send', { delay: 2 });
      await PageRecipe.waitForModalAndRespond(composeFrame, 'error', {
        contentToCheck: 'Failed to send message due to: Error: Cannot use mixed OpenPGP (human@flowcrypt.com) and S/MIME (smime@recipient.com) public keys yet.If you need to email S/MIME recipient, do not add any OpenPGP recipient at the same time.',
        timeout: 40
      });
    }));

    ava.default('send with broken S/MIME cert - err', testWithBrowser('compose', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('test.ci.compose@org.flowcrypt.com'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime@recipient.com' }, t.title);
      const brokenCert = smimeCert.split('\n');
      brokenCert.splice(5, 5); // remove 5th to 10th line from cert - make it useless
      await pastePublicKeyManually(composeFrame, inboxPage, 'smime@recipient.com', brokenCert.join('\n'));
      await composeFrame.waitAndClick('@action-send', { delay: 2 });
      await PageRecipe.waitForModalAndRespond(composeFrame, 'error', { contentToCheck: 'Too few bytes to read ASN.1 value.', timeout: 40 });
    }));

    // todo - unexpectedly works
    // ava.default.only('send non-S/MIME cert - err', testWithBrowser('compose', async (t, browser) => {
    //   const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('test.ci.compose@org.flowcrypt.com'));
    //   let composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
    //   await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime@recipient.com' }, t.title);
    //   const httpsCert = '-----BEGIN CERTIFICATE-----\nMIIFZTCCBE2gAwIBAgISA/LOLnFAcrNSDjMi+PvkSbX1MA0GCSqGSIb3DQEBCwUA\nMEoxCzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBFbmNyeXB0MSMwIQYDVQQD\nExpMZXQncyBFbmNyeXB0IEF1dGhvcml0eSBYMzAeFw0yMDAzMTQxNTQ0NTVaFw0y\nMDA2MTIxNTQ0NTVaMBgxFjAUBgNVBAMTDWZsb3djcnlwdC5jb20wggEiMA0GCSqG\nSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDBYeT+zyJK4VrAtpBoxnzNrgPMkeJ3WBw3\nlZrO7GXsPUUQL/2uL3NfMwQ4qWqsiJStShaTQ0UX1MQCBgdOY/Ajr5xgyCz4aE0+\nQeReGy+qFyoGE9okVdF+/uJhFTOkK8goA4rDRN3MrSuWsivc/5/8Htd/M01JFAcU\nEblrPkSBtJp8IAtr+QD8etmMd05N0oQFNFT/T7QNrEdItCKSS6jMpprR4phr792K\niQh9MzhZ3O+QEM+UKpsL0dM9C6PD9jNFjFz3EDch/VFPbBlcBfWGvYnjBlqKjhYA\nLPUVPgIF4CVQ60EoOHk1ewyoAyydYyFXppUz1eDvemUhLMWuBJ2tAgMBAAGjggJ1\nMIICcTAOBgNVHQ8BAf8EBAMCBaAwHQYDVR0lBBYwFAYIKwYBBQUHAwEGCCsGAQUF\nBwMCMAwGA1UdEwEB/wQCMAAwHQYDVR0OBBYEFMr4ERxBRtKNI67oIkJHN2QSBptE\nMB8GA1UdIwQYMBaAFKhKamMEfd265tE5t6ZFZe/zqOyhMG8GCCsGAQUFBwEBBGMw\nYTAuBggrBgEFBQcwAYYiaHR0cDovL29jc3AuaW50LXgzLmxldHNlbmNyeXB0Lm9y\nZzAvBggrBgEFBQcwAoYjaHR0cDovL2NlcnQuaW50LXgzLmxldHNlbmNyeXB0Lm9y\nZy8wKQYDVR0RBCIwIIIPKi5mbG93Y3J5cHQuY29tgg1mbG93Y3J5cHQuY29tMEwG\nA1UdIARFMEMwCAYGZ4EMAQIBMDcGCysGAQQBgt8TAQEBMCgwJgYIKwYBBQUHAgEW\nGmh0dHA6Ly9jcHMubGV0c2VuY3J5cHQub3JnMIIBBgYKKwYBBAHWeQIEAgSB9wSB\n9ADyAHcAb1N2rDHwMRnYmQCkURX/dxUcEdkCwQApBo2yCJo32RMAAAFw2e8sLwAA\nBAMASDBGAiEA7Omcf4+uFphcbEq19r4GoWi7E1qvsJTykvgH342x1d4CIQDSCJZK\n3zsVSw8I1GVfnIr/drVhgn4TJgacXx6+gBzfXQB3ALIeBcyLos2KIE6HZvkruYol\nIGdr2vpw57JJUy3vi5BeAAABcNnvK/kAAAQDAEgwRgIhAP7BbIkG/mNclZAVqgA0\nomAB/6xMwbu1ZUsHNBMkZG+QAiEAmZWCVdUfmFs3b+zDEaAF7eFDnz7qbDa5q6M0\n98r8In0wDQYJKoZIhvcNAQELBQADggEBAFaUhUkxGkHc3lxozCbozM7ffAOcK5De\nJGoTtsXw/XmMACBIIqn2Aan+zvQdK/cWV9+dYu5tA/PHZwVbfKAU2x+Fizs7uDgs\nslg16un1/DP7bmi4Ih3KDVyznzgTwWPq9CmPMIeCXBSGvGN4xdfyIf7mKPSmsEB3\ngkM8HyE27e2u8B4f/R4W+sbqx0h5Y/Kv6NFqgQlatEY2HdAQDYYL21xO1ZjaUozP\nyfHQSJwGHp3/1Xdq5mIkV7w9xxhOn64FXp4S0spVCxT3er1EEUurq+lXjyeX4Dog\n1gy3r417NPqQWuBJcA/InSaS/GUyGghp+kuGfIDqVYfQqU1297nThEA=\n-----END CERTIFICATE-----\n';
    //   await pastePublicKeyManually(composeFrame, inboxPage, 'smime@recipient.com', httpsCert);
    //   await composeFrame.waitAndClick('@action-send', { delay: 2 });
    //   await PageRecipe.waitForModalAndRespond(composeFrame, 'error', { contentToCheck: 'dunno', timeout: 40 });
    // }));

  }

};

const pastePublicKeyManually = async (composeFrame: ControllableFrame, inboxPage: ControllablePage, recipient: string, pub: string) => {
  await Util.sleep(1); // todo: should wait until recipient actually loaded
  await composeFrame.waitForContent('.email_address.no_pgp', recipient);
  await composeFrame.waitAndClick('@action-open-add-pubkey-dialog', { delay: 1 });
  await inboxPage.waitAll('@dialog-add-pubkey');
  const addPubkeyDialog = await inboxPage.getFrame(['add_pubkey.htm']);
  await addPubkeyDialog.waitAndType('@input-pubkey', pub);
  await Util.sleep(1);
  await addPubkeyDialog.waitAndClick('@action-add-pubkey');
  await inboxPage.waitTillGone('@dialog-add-pubkey');
};

const sendImgAndVerifyPresentInSentMsg = async (t: AvaContext, browser: BrowserHandle, sendingType: 'encrypt' | 'sign') => {
  // send a message with image in it
  const imgBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAnElEQVR42u3RAQ0AAAgDIE1u9FvDOahAVzLFGS1ECEKEIEQIQoQgRIgQIQgRghAhCBGCECEIQYgQhAhBiBCECEEIQoQgRAhChCBECEIQIgQhQhAiBCFCEIIQIQgRghAhCBGCEIQIQYgQhAhBiBCEIEQIQoQgRAhChCAEIUIQIgQhQhAiBCEIEYIQIQgRghAhCBEiRAhChCBECEK+W3uw+TnWoJc/AAAAAElFTkSuQmCC';
  const subject = `Test Sending ${sendingType === 'sign' ? 'Signed' : 'Encrypted'} Message With Image ${Util.lousyRandom()}`;
  const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
  await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, subject, { richtext: true, sign: sendingType === 'sign', encrypt: sendingType === 'encrypt' });
  // the following is a temporary hack - currently not able to directly paste an image with puppeteer
  // instead we should find a way to load the image into clipboard, and paste it into textbox
  await composePage.page.evaluate((src: string) => { $('[data-test=action-insert-image]').val(src).click(); }, imgBase64);
  await ComposePageRecipe.sendAndClose(composePage);
  // get sent msg id from mock
  const sentMsg = new GoogleData('flowcrypt.compatibility@gmail.com').getMessageBySubject(subject)!;
  let url = `chrome/dev/ci_pgp_host_page.htm?frameId=none&msgId=${encodeURIComponent(sentMsg.id)}&senderEmail=flowcrypt.compatibility%40gmail.com&isOutgoing=___cu_false___&acctEmail=flowcrypt.compatibility%40gmail.com`;
  if (sendingType === 'sign') {
    url += '&signature=___cu_true___';
  }
  // open a page with the sent msg, investigate img
  const pgpHostPage = await browser.newPage(t, url);
  const pgpBlockPage = await pgpHostPage.getFrame(['pgp_block.htm']);
  await pgpBlockPage.waitAll('.image_src_link');
  expect(await pgpBlockPage.read('.image_src_link')).to.contain('show image');
  await pgpBlockPage.waitAndClick('.image_src_link');
  await pgpBlockPage.waitTillGone('.image_src_link');
  const img = await pgpBlockPage.waitAny('body img');
  expect(await PageRecipe.getElementPropertyJson(img, 'src')).to.eq(imgBase64);
};

const setRequirePassPhraseAndOpenRepliedMessage = async (t: AvaContext, browser: BrowserHandle, passpharase: string) => {
  const settingsPage = await browser.newPage(t, TestUrls.extensionSettings());
  await SettingsPageRecipe.forgetAllPassPhrasesInStorage(settingsPage, passpharase);
  // Open Message Page
  const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=flowcrypt.compatibility@gmail.com&threadId=16b584ed95837510`));
  await inboxPage.waitAll('iframe');
  // Get Reply Window (Composer) and click on reply button.
  const replyFrame = await inboxPage.getFrame(['compose.htm']);
  await replyFrame.waitAndClick('@action-accept-reply-prompt');

  return { inboxPage, replyFrame };
};

const clickTripleDotAndExpectQuoteToLoad = async (composePage: Controllable, textToInclude: string) => {
  await composePage.waitAll(['@action-expand-quoted-text']);
  await Util.sleep(2); // wait for quote to be loaded and button activated
  expect(await composePage.read('@input-body')).to.not.include(textToInclude);
  await composePage.waitAndClick('@action-expand-quoted-text');
  await composePage.waitTillGone(['@action-expand-quoted-text']);
  expect(await composePage.read('@input-body')).to.include(textToInclude);
};

const expectRecipientElements = async (controllable: ControllablePage, expected: { to?: string[], cc?: string[], bcc?: string[] }) => {
  for (const type of ['to', 'cc', 'bcc']) {
    const expectedEmails: string[] | undefined = (expected as Dict<string[]>)[type] || undefined; // tslint:disable-line:no-unsafe-any
    if (expectedEmails) {
      const container = await controllable.waitAny(`@container-${type}`, { visible: false });
      const recipientElements = await container.$$('.recipients > span');
      expect(recipientElements.length).to.equal(expectedEmails.length);
      for (const recipientElement of recipientElements) {
        const textContent = await (await recipientElement.getProperty('textContent')).jsonValue() as string;
        expect(expectedEmails).to.include(textContent.trim());
      }
    }
  }
};

const expectFirstContactResultEqual = async (composePage: ControllablePage, string: string) => {
  await composePage.waitAny('@container-contacts');
  await Util.sleep(0.5);
  await composePage.waitTillGone('@container-contacts-loading');
  await Util.sleep(0.5);
  const contacts = await composePage.waitAny('@container-contacts');
  expect(await PageRecipe.getElementPropertyJson((await contacts.$('ul li:first-child'))!, 'textContent')).to.eq(string);
};
