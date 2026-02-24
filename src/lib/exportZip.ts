import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { TagConfig } from '../types';
import { buildFileName } from './slugify';
import { buildTagSvg } from './svgBuilder';
import { svgToPngBlob } from './rasterize';
import { ensureFontLoaded, getFontBase64 } from './fontLoader';
import { pickForeground } from './contrast';

/**
 * Build the SVG + PNG, bundle into a ZIP, and trigger a browser download.
 *
 * Font embedding is best-effort: if the font file cannot be fetched or
 * encoded, the SVG is exported without an embedded font (using the
 * fallback font-family stack instead). Export never fails solely because
 * of a font-loading issue.
 *
 * The PNG is rasterized from the *same* font-embedded SVG to ensure the
 * Canvas Image element can resolve the font from the inline data URI,
 * producing deterministic text rendering regardless of system fonts.
 */
export async function exportTagZip(config: TagConfig): Promise<void> {
  const fgHex = pickForeground(config.bgHex);
  const fileLabel =
    config.label.trim() ||
    (config.mode === 'text' ? config.text.trim() : config.iconId.trim());

  // Best-effort: pre-load font into the document for Canvas fallback
  try {
    await ensureFontLoaded();
  } catch {
    // non-critical
  }

  let fontBase64: string | undefined;
  try {
    fontBase64 = await getFontBase64();
  } catch {
    // Font embed failed -- continue with fallback stack only
  }

  const svgString = buildTagSvg({ config, fgHex, fontBase64 });
  const pngBlob = await svgToPngBlob(svgString);

  const svgFileName = buildFileName(fileLabel, config.mode, config.bgHex, 'svg');
  const pngFileName = buildFileName(fileLabel, config.mode, config.bgHex, 'png');
  const zipFileName = buildFileName(fileLabel, config.mode, config.bgHex, 'zip');

  const zip = new JSZip();
  zip.file(svgFileName, svgString);
  zip.file(pngFileName, pngBlob);

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, zipFileName);
}
