/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Xss } from '../../js/common/platform/xss.js';
import { Env } from '../../js/common/browser/env.js';

/* eslint-disable max-len */

Catch.try(async () => {
  const tabId = await BrowserMsg.requiredTabId();

  BrowserMsg.addPgpListeners();
  BrowserMsg.listen(tabId);

  let src = Env.getBaseUrl();
  src += `/chrome/elements/pgp_block.htm${location.search}`;
  src += `&parentTabId=${encodeURIComponent(tabId)}`;
  $('body').append(`<iframe width="100%" src="${Xss.escape(src)}" frameborder="0"></iframe>`); // xss-escaped
})();
