/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';

import { TestVariant, Util } from '../../util';

import { BrowserRecipe } from '../browser-recipe';
import { SetupPageRecipe } from '../page-recipe/setup-page-recipe';
import { TestWithBrowser } from '../../test';
import { expect } from 'chai';
import { SettingsPageRecipe } from '../page-recipe/settings-page-recipe';
import { ComposePageRecipe } from '../page-recipe/compose-page-recipe';
import { TestUrls } from '../../browser/test-urls';
import { Str } from '../../core/common';
import { MOCK_KM_LAST_INSERTED_KEY } from '../../mock/key-manager/key-manager-endpoints';

// tslint:disable:no-blank-lines-func
// tslint:disable:no-unused-expressions
/* eslint-disable no-unused-expressions */

export const defineSetupTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {

  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {

    ava.todo('setup - no connection when pulling backup - retry prompt shows and works');

    ava.todo('setup - simple - no connection when making a backup - retry prompt shows');

    ava.todo('setup - advanced - no connection when making a backup - retry prompt shows');

    ava.todo('setup - no connection when submitting public key - retry prompt shows and works');

    ava.default('settings > login > close oauth window > close popup', testWithBrowser(undefined, async (t, browser) => {
      await BrowserRecipe.openSettingsLoginButCloseOauthWindowBeforeGrantingPermission(t, browser, 'flowcrypt.test.key.imported@gmail.com');
    }));

    ava.default('setup - import key - do not submit - did not use before', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.imported@gmail.com');
      await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.used.pgp', { submitPubkey: false, usedPgpBefore: false });
    }));

    ava.default('setup - import key - submit - used before', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.used.pgp@gmail.com');
      await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.used.pgp', { submitPubkey: true, usedPgpBefore: true });
    }));

    ava.default('setup - import key - naked - choose my own pass phrase', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.import.naked@gmail.com');
      await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.naked', { submitPubkey: false, usedPgpBefore: false, naked: true });
    }));

    ava.default('setup - import key - naked - auto-generate a pass phrase', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.import.naked@gmail.com');
      await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.naked', { submitPubkey: false, usedPgpBefore: false, naked: true, genPp: true });
    }));

    ava.todo('setup - import key - naked - do not supply pass phrase gets error');

    ava.default('setup - import key - fix key self signatures', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.imported@gmail.com');
      await SetupPageRecipe.manualEnter(settingsPage, 'missing.self.signatures', { submitPubkey: false, fixKey: true });
    }));

    ava.default('setup - import key - fix key self signatures - skip invalid uid', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.imported@gmail.com');
      await SetupPageRecipe.manualEnter(settingsPage, 'missing.self.signatures.invalid.uid', { submitPubkey: false, fixKey: true });
    }));

    ava.todo('setup - create key advanced - do not remember pass phrase');

    ava.todo('setup - create key advanced - backup as a file');

    ava.todo('setup - create key simple');

    ava.default('setup - recover with a pass phrase - skip remaining', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp1', { hasRecoverMore: true, clickRecoverMore: false });
    }));

    ava.default('setup - recover with a pass phrase - 1pp1 then 2pp1', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp1', { hasRecoverMore: true, clickRecoverMore: true });
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.2pp1');
    }));

    ava.default('setup - recover with a pass phrase - 1pp2 then 2pp1', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp2', { hasRecoverMore: true, clickRecoverMore: true });
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.2pp1');
    }));

    ava.default('setup - recover with a pass phrase - 2pp1 then 1pp1', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.2pp1', { hasRecoverMore: true, clickRecoverMore: true });
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp1');
    }));

    ava.default('setup - recover with a pass phrase - 2pp1 then 1pp2', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.2pp1', { hasRecoverMore: true, clickRecoverMore: true });
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp2');
    }));

    ava.default('setup - recover with a pass phrase - 1pp1 then 1pp2 (shows already recovered), then 2pp1', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp1', { hasRecoverMore: true, clickRecoverMore: true });
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp2', { alreadyRecovered: true });
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.2pp1', {});
    }));

    ava.todo('setup - recover with a pass phrase - 1pp1 then wrong, then skip');
    // ava.default('setup - recover with a pass phrase - 1pp1 then wrong, then skip', test_with_browser(async (t, browser) => {
    //   const settingsPage = await BrowserRecipe.open_settings_login_approve(t, browser,'flowcrypt.compatibility@gmail.com');
    //   await SetupPageRecipe.setup_recover(settingsPage, 'flowcrypt.compatibility.1pp1', {has_recover_more: true, click_recover_more: true});
    //   await SetupPageRecipe.setup_recover(settingsPage, 'flowcrypt.wrong.passphrase', {wrong_passphrase: true});
    //   await Util.sleep(200);
    // }));

    ava.default('setup - recover with a pass phrase - no remaining', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.recovered@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.test.key.recovered', { hasRecoverMore: false });
    }));

    ava.default('setup - fail to recover with a wrong pass phrase', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.recovered@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.wrong.passphrase', { hasRecoverMore: false, wrongPp: true });
    }));

    ava.default('setup - fail to recover with a wrong pass phrase at first, then recover with good pass phrase', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.recovered@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.wrong.passphrase', { wrongPp: true });
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.test.key.recovered');
    }));

    ava.default('setup - import key - submit - offline - retry', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.used.pgp@gmail.com');
      await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.used.pgp', { submitPubkey: true, usedPgpBefore: true, simulateRetryOffline: true });
    }));

    ava.default('has.pub@org-rules-test - no backup, no keygen', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'has.pub@org-rules-test.flowcrypt.com');
      await SetupPageRecipe.manualEnter(settingsPage, 'has.pub.orgrulestest', { noPrvCreateOrgRule: true, enforceAttesterSubmitOrgRule: true });
      await settingsPage.waitAll(['@action-show-encrypted-inbox', '@action-open-security-page']);
      await Util.sleep(1);
      await settingsPage.notPresent(['@action-open-backup-page']);
    }));

    ava.default('no.pub@org-rules-test - no backup, no keygen, enforce attester submit with submit err', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'no.pub@org-rules-test.flowcrypt.com');
      await SetupPageRecipe.manualEnter(settingsPage, 'no.pub.orgrulestest', { noPrvCreateOrgRule: true, enforceAttesterSubmitOrgRule: true, fillOnly: true });
      await settingsPage.waitAndClick('@input-step2bmanualenter-save');
      await settingsPage.waitAll(['@container-overlay-prompt-text', '@action-overlay-retry']);
      const renderedErr = await settingsPage.read('@container-overlay-prompt-text');
      expect(renderedErr).to.contain(`Failed to submit to Attester`);
      expect(renderedErr).to.contain(`Could not find LDAP pubkey on a LDAP-only domain for email no.pub@org-rules-test.flowcrypt.com on server keys.flowcrypt.com`);
    }));

    ava.default('user@no-submit-org-rule.flowcrypt.com - do not submit to attester', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'user@no-submit-org-rule.flowcrypt.com');
      await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.used.pgp', { noPubSubmitRule: true });
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      const attesterFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-attester-page', ['keyserver.htm']);
      await attesterFrame.waitAndClick('@action-submit-pub');
      await attesterFrame.waitAndRespondToModal('error', 'confirm', 'Disallowed by your organisation rules');
    }));

    ava.default('user@no-search-domains-org-rule.flowcrypt.com - do not search attester for recipients on particular domains', testWithBrowser(undefined, async (t, browser) => {
      // disallowed searching attester for pubkeys on "flowcrypt.com" domain
      // below we search for human@flowcrypt.com which normally has pubkey on attester, but none should be found due to the rule
      const acct = 'user@no-search-domains-org-rule.flowcrypt.com';
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
      await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.used.pgp');
      const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'normally has pubkey but should show none');
      await composePage.waitForContent('.email_address.no_pgp', 'human@flowcrypt.com');
      await composePage.waitAll('@input-password');
    }));

    ava.default('get.key@key-manager-autogen.flowcrypt.com - automatic setup with key found on key manager', testWithBrowser(undefined, async (t, browser) => {
      const acct = 'get.key@key-manager-autogen.flowcrypt.com';
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
      await SetupPageRecipe.autoKeygen(settingsPage);
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      // check imported key
      const myKeyFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, `@action-show-key-0`, ['my_key.htm', 'placement=settings']);
      await Util.sleep(1);
      await myKeyFrame.waitAll('@content-longid');
      expect(await myKeyFrame.read('@content-longid')).to.equal('00B0 1158 0796 9D75');
      await SettingsPageRecipe.closeDialog(settingsPage);
      await Util.sleep(2);
      // check that it does not offer any pass phrase options
      await SettingsPageRecipe.toggleScreen(settingsPage, 'basic');
      const securityFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-security-page', ['security.htm', 'placement=settings']);
      await Util.sleep(1);
      await securityFrame.notPresent(['@action-change-passphrase-begin', '@action-test-passphrase-begin', '@action-forget-pp']);
    }));

    ava.default('put.key@key-manager-autogen.flowcrypt.com - automatic setup with key not found on key manager, then generated', testWithBrowser(undefined, async (t, browser) => {
      const acct = 'put.key@key-manager-autogen.flowcrypt.com';
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
      await SetupPageRecipe.autoKeygen(settingsPage);
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      // check imported key
      const myKeyFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, `@action-show-key-0`, ['my_key.htm', 'placement=settings']);
      await Util.sleep(1);
      await myKeyFrame.waitAll('@content-longid');
      const fromKm = MOCK_KM_LAST_INSERTED_KEY[acct];
      expect(fromKm).to.exist;
      expect(await myKeyFrame.read('@content-longid')).to.equal(Str.spaced(fromKm.longid));
      await SettingsPageRecipe.closeDialog(settingsPage);
      await Util.sleep(2);
      // check that it does not offer any pass phrase options
      await SettingsPageRecipe.toggleScreen(settingsPage, 'basic');
      const securityFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-security-page', ['security.htm', 'placement=settings']);
      await Util.sleep(1);
      await securityFrame.notPresent(['@action-change-passphrase-begin', '@action-test-passphrase-begin', '@action-forget-pp']);
    }));

  }

};
