import { FONT_FAMILY, FONT_WEIGHT, FONT_ASSET_PATH } from '../constants';

let fontPromise: Promise<void> | null = null;

/**
 * Ensure the Proxima Nova ExtraBold font is loaded and ready for
 * Canvas text measurement and rendering. Resolves immediately on
 * subsequent calls.
 */
export function ensureFontLoaded(): Promise<void> {
  if (fontPromise) return fontPromise;

  fontPromise = document.fonts
    .load(`${FONT_WEIGHT} 12px "${FONT_FAMILY}"`)
    .then(() => undefined)
    .catch(() => {
      fontPromise = null;
    });

  return fontPromise;
}

/**
 * Read the font file as an ArrayBuffer and return a base64-encoded string
 * suitable for embedding inside an SVG `<style>` block.
 *
 * Throws with a descriptive message if the fetch fails or returns non-OK.
 */
export async function getFontBase64(): Promise<string> {
  const resp = await fetch(FONT_ASSET_PATH);
  if (!resp.ok) {
    throw new Error(
      `Font fetch failed: ${resp.status} ${resp.statusText} (${FONT_ASSET_PATH})`,
    );
  }
  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
