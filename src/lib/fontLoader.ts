import {
  FONT_FAMILY,
  FONT_WEIGHT,
  FONT_ASSET_SOURCES,
  type FontAssetSource,
} from '../constants';

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

export interface EmbeddedFontData {
  base64: string;
  path: string;
  mime: FontAssetSource['mime'];
  format: FontAssetSource['format'];
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function fetchFont(path: string): Promise<ArrayBuffer> {
  const resp = await fetch(path);
  if (!resp.ok) {
    throw new Error(`Font fetch failed: ${resp.status} ${resp.statusText} (${path})`);
  }
  return resp.arrayBuffer();
}

export interface PreferredFontData {
  buffer: ArrayBuffer;
  path: string;
  mime: FontAssetSource['mime'];
  format: FontAssetSource['format'];
}

/**
 * Fetch the preferred font binary.
 * Tries WOFF2 first, then falls back to TTF.
 */
export async function getPreferredFontData(): Promise<PreferredFontData> {
  let lastError: Error | null = null;

  for (const source of FONT_ASSET_SOURCES) {
    try {
      const buffer = await fetchFont(source.path);
      return {
        buffer,
        path: source.path,
        mime: source.mime,
        format: source.format,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw (
    lastError ??
    new Error('Font fetch failed: no font sources configured for export.')
  );
}

/**
 * Fetch a TTF source, required by some font-path parsers.
 */
export async function getTrueTypeFontData(): Promise<PreferredFontData> {
  const ttfSource =
    FONT_ASSET_SOURCES.find((source) => source.format === 'truetype') ??
    FONT_ASSET_SOURCES[0];

  if (!ttfSource) {
    throw new Error('Font fetch failed: no font sources configured for export.');
  }

  const buffer = await fetchFont(ttfSource.path);
  return {
    buffer,
    path: ttfSource.path,
    mime: ttfSource.mime,
    format: ttfSource.format,
  };
}

/**
 * Fetch preferred font asset for embedding.
 * Tries WOFF2 first, then falls back to TTF.
 */
export async function getEmbeddedFontData(): Promise<EmbeddedFontData> {
  const preferred = await getPreferredFontData();
  return {
    base64: toBase64(preferred.buffer),
    path: preferred.path,
    mime: preferred.mime,
    format: preferred.format,
  };
}

/**
 * Backwards-compatible helper returning only base64.
 */
export async function getFontBase64(): Promise<string> {
  const data = await getEmbeddedFontData();
  return data.base64;
}
