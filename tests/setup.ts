import '@testing-library/jest-dom/vitest';

/**
 * Minimal OffscreenCanvas polyfill for jsdom.
 * Provides just enough for fitFontSize's measureText calls.
 */
if (typeof globalThis.OffscreenCanvas === 'undefined') {
  class OffscreenCanvasMock {
    width: number;
    height: number;
    constructor(w: number, h: number) {
      this.width = w;
      this.height = h;
    }
    getContext() {
      let currentFont = '';
      return {
        set font(f: string) {
          currentFont = f;
        },
        get font() {
          return currentFont;
        },
        measureText(text: string) {
          const sizeMatch = currentFont.match(/(\d+(?:\.\d+)?)px/);
          const fontSize = sizeMatch ? parseFloat(sizeMatch[1]) : 12;
          return { width: text.length * fontSize * 0.65 };
        },
      };
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.OffscreenCanvas = OffscreenCanvasMock as any;
}
