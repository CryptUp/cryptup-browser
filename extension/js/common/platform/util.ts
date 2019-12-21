/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Buf } from '../core/buf';

/**
 * Functions which must be written differently to run in NodeJS versus in web browsers.
 *
 * If the code would be the same on both platforms, it does not belong here (or anywhere in platform/ directory)
 */

export const secureRandomBytes = (length: number): Uint8Array => {
  const secureRandomArray = new Uint8Array(length);
  window.crypto.getRandomValues(secureRandomArray);
  return secureRandomArray;
};

export const base64encode = (binary: string): string => {
  return btoa(binary);
};

export const base64decode = (b64tr: string): string => {
  return atob(b64tr);
};

export const moveElementInArray = <T>(arr: Array<T>, oldIndex: number, newIndex: number) => {
  while (oldIndex < 0) {
    oldIndex += arr.length;
  }
  while (newIndex < 0) {
    newIndex += arr.length;
  }
  arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0]);
  return arr;
};

export const iso2022jpToUtf = (content: Buf) => {
  const decoder = new TextDecoder();
  return decoder.decode(content);
};
