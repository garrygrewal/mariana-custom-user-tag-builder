import { existsSync, readFileSync } from 'node:fs';
import { resolveProjectPath } from './paths';

export interface ServerFont {
  /** Absolute path to the .ttf on disk (for resvg `fontFiles`). */
  path: string;
  /** Font bytes (for opentype.js text outlining). */
  buffer: ArrayBuffer;
}

let cache: ServerFont | null | undefined;

function candidatePaths(): string[] {
  const paths: string[] = [];
  if (process.env.FONT_TTF_PATH) paths.push(process.env.FONT_TTF_PATH);
  paths.push('public/fonts/proxima-nova-extrabold.ttf');
  paths.push('fonts/proxima-nova-extrabold.ttf');
  return paths;
}

/**
 * Load the Proxima Nova ExtraBold TTF from disk if available.
 *
 * Returns null when the font isn't deployed; callers degrade gracefully (text
 * tags fall back to the system sans-serif in the rasterized PNG). The SVG
 * itself still outlines text to vector paths when the buffer is present.
 */
export function loadFontTtf(): ServerFont | null {
  if (cache !== undefined) return cache;

  for (const rel of candidatePaths()) {
    const abs = resolveProjectPath(rel);
    if (!existsSync(abs)) continue;
    const buf = readFileSync(abs);
    cache = {
      path: abs,
      buffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    };
    return cache;
  }

  cache = null;
  return cache;
}
