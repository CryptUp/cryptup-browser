
/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

export class Xss {

  /**
   * used whenever untrusted remote content (eg html email) is rendered, but we still want to preserve html
   */
  public static htmlSanitizeKeepBasicTags = (dirtyHtml: string, imgHandling: 'IMG-DEL' | 'IMG-KEEP' | 'IMG-TO-LINK'): string => {
    throw new Error('not implemented / not needed by tests yet');
  }

  public static htmlSanitizeAndStripAllTags = (dirtyHtml: string, outputNl: string): string => {
    throw new Error('not implemented / not needed by tests yet');
  }

  public static escape = (str: string) => {
    throw new Error('not implemented / not needed by tests yet');
  }

  public static escapeTextAsRenderableHtml = (text: string) => {
    throw new Error('not implemented / not needed by tests yet');
  }

  public static htmlUnescape = (str: string) => {
    throw new Error('not implemented / not needed by tests yet');
  }

}
