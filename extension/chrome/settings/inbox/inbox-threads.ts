import { View } from '../../../js/common/view.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Lang } from '../../../js/common/lang.js';
import { GmailParser } from '../../../js/common/api/email_provider/gmail/gmail-parser.js';
import { Str } from '../../../js/common/core/common.js';
import { InboxThreadView } from './inbox-thread.js';
import { InboxView } from './inbox.js';

export class InboxThreadsView extends View {
  private readonly inboxView: InboxView;
  private readonly labelId: string;

  constructor(inboxView: InboxView, labelId: string) {
    super();
    this.inboxView = inboxView;
    this.labelId = labelId;
  }

  async render() {
    this.inboxView.displayBlock('inbox', `Messages in ${this.inboxView.inboxMenuView.getLabelName(this.labelId)}`);
    try {
      const { threads } = await this.inboxView.gmail.threadList(this.labelId);
      if ((threads || []).length) {
        await Promise.all(threads.map(t => this.renderInboxItem(t.id)));
      } else {
        Xss.sanitizeRender('.threads', `<p>No encrypted messages in ${this.labelId} yet. ${Ui.retryLink()}</p>`);
      }
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        this.inboxView.showNotification(`Connection error trying to get list of messages ${Ui.retryLink()}`);
      } else if (ApiErr.isAuthPopupNeeded(e)) {
        this.inboxView.renderAndHandleAuthPopupNotification();
      } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
        this.inboxView.showNotification(Lang.account.googleAcctDisabledOrPolicy);
      } else if (ApiErr.isInsufficientPermission(e)) {
        this.inboxView.renderAndHandleAuthPopupNotification(true);
      } else {
        Catch.reportErr(e);
        await Ui.modal.error(`Error trying to get list of folders: ${ApiErr.eli5(e)}\n\n${String(e)}`);
        window.location.reload();
      }
    }
  }

  setHandlers() {
    // No need yet. TODO;
  }

  private renderInboxItem = async (threadId: string) => {
    this.inboxThreadItemAdd(threadId);
    const threadItem = $('.threads #' + this.threadListItemId(threadId));
    try {
      const thread = await this.inboxView.gmail.threadGet(threadId, 'metadata');
      const firstMsg = thread.messages[0];
      const lastMsg = thread.messages[thread.messages.length - 1];
      threadItem.find('.subject').text(GmailParser.findHeader(firstMsg, 'subject') || '(no subject)');
      Xss.sanitizeAppend(threadItem.find('.subject'), this.inboxView.inboxMenuView.renderableLabels(firstMsg.labelIds || [], 'messages'));
      const fromHeaderVal = GmailParser.findHeader(firstMsg, 'from');
      if (fromHeaderVal) {
        const from = Str.parseEmail(fromHeaderVal);
        threadItem.find('.from').text(from.name || from.email || from.full);
      }
      threadItem.find('.loading').text('');
      threadItem.find('.date').text(this.formatDate(lastMsg.internalDate));
      threadItem.addClass('loaded').click(this.setHandler(() => View.runInstanceAsync(new InboxThreadView(this.inboxView, threadId, thread))));
      if (lastMsg.labelIds?.includes(this.inboxView.inboxMenuView.LABEL.UNREAD)) {
        threadItem.css({ 'font-weight': 'bold', 'background': 'white' });
      }
      if (thread.messages.length > 1) {
        threadItem.find('.msg_count').text(`(${thread.messages.length})`);
      }
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        Xss.sanitizeRender(threadItem.find('.loading'), 'Failed to load (network) <a href="#">retry</a>')
          .find('a').click(this.setHandler(() => this.renderInboxItem(threadId)));
      } else if (ApiErr.isAuthPopupNeeded(e)) {
        this.inboxView.renderAndHandleAuthPopupNotification();
      } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
        this.inboxView.showNotification(Lang.account.googleAcctDisabledOrPolicy);
      } else {
        Catch.reportErr(e);
        threadItem.find('.loading').text('Failed to load');
      }
    }
  }

  private inboxThreadItemAdd = (threadId: string) => {
    const content = `
      <span class="from_container">
        <span class="from"></span>
        <span class="msg_count"></span></span>
      <span class="subject" data-test="container-subject"></span>
      <span class="date"></span>
    `;
    Xss.sanitizeAppend(this.inboxView.S.cached('threads'), Ui.e('div', {
      class: 'line',
      id: this.threadListItemId(threadId),
      html: `<span class="loading">${Ui.spinner('green')}loading..</span>${content}`,
    }));
  }

  private threadListItemId = (threadId: string) => {
    return 'list_thread_id_' + threadId;
  }

  private formatDate = (dateFromApi: string | number | undefined): string => {
    const date = new Date(Number(dateFromApi));
    if (date.toLocaleDateString() === new Date().toLocaleDateString()) {
      return date.toLocaleTimeString();
    }
    return date.toLocaleDateString();
  }
}
