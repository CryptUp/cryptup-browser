
/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Xss } from './platform/xss.js';
import { Ui, BrowserEventErrHandler, PreventableEventName } from './browser/ui.js';
import { ApiErr } from './api/error/api-error.js';

export abstract class View {
  private initialized = false;
  abstract async render(): Promise<void>;
  abstract setHandlers(): void;
  getChildViews?(): View[];
  async whenRendered?(): Promise<void>;

  async init(): Promise<void> {
    if (!this.initialized) {
      return;
    }
    this.initialized = true;
  }

  public static run<VIEW extends View>(viewClass: new () => VIEW) {
    try {
      const view = new viewClass();
      View.runInstanceAsync(view).catch(View.reportAndRenderErr);
    } catch (e) {
      View.reportAndRenderErr(e);
    }
  }

  public static async runInstanceAsync(view: View) {
    await view.init();
    await view.render();
    view.setHandlers();
    if (view.getChildViews) {
      const childVeiws = view.getChildViews();
      await Promise.all(childVeiws.map(view => view.init()));
      await Promise.all(childVeiws.map(view => View.runInstanceAsync(view)));
    }
    if (view.whenRendered) {
      await view.whenRendered();
    }
  }

  private static reportAndRenderErr = (e: any) => {
    ApiErr.reportIfSignificant(e);
    Xss.sanitizeRender('body', `${ApiErr.eli5(e)}<br>${String(e)}<br><br>${Ui.retryLink()}`);
  }

  public setHandler = (cb: (e: HTMLElement, event: JQuery.Event<HTMLElement, null>) => void | Promise<void>, errHandlers?: BrowserEventErrHandler) => {
    return Ui.event.handle(cb, errHandlers, this);
  }

  public setHandlerPrevent = <THIS extends HTMLElement | void>(
    evName: PreventableEventName, cb: (el: HTMLElement, resetTimer: () => void) => void | Promise<void>, errHandlers?: BrowserEventErrHandler
  ) => {
    return Ui.event.prevent(evName, cb, errHandlers, this);
  }

  public setEnterHandlerThatClicks = (selector: string) => {
    return (event: JQuery.Event<HTMLElement, null>) => {
      if (event.which === 13) {
        $(selector).click();
      }
    };
  }

}
