import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { TagConfig } from '../types';
import { TAG_RADIUS } from '../constants';
import { buildFileName } from './slugify';
import { buildTagSvg, fitFontSize } from './svgBuilder';
import { svgToPngBlob } from './rasterize';
import { ensureFontLoaded, getTrueTypeFontData } from './fontLoader';
import { pickForeground } from './contrast';
import type { OutlinedTextPath } from './textToPath';

/**
 * Build the SVG + PNG, bundle into a ZIP, and trigger a browser download.
 *
 * SVG exports are intentionally size-optimized and do not embed font bytes.
 * For text mode, we convert text to vector paths when possible so rendering
 * stays consistent in tools like Figma even when the font is unavailable.
 *
 * For text mode, we still best-effort preload the app font before
 * rasterization so PNG output remains consistent in the browser session.
 */
export async function exportTagZip(config: TagConfig): Promise<void> {
  const fgHex = pickForeground(config.bgHex);
  const fileLabel =
    config.label.trim() ||
    (config.mode === 'text' ? config.text.trim() : config.iconId.trim());

  let outlinedTextPath: OutlinedTextPath | null = null;

  // Text mode only: best-effort preload for canvas rasterization.
  if (config.mode === 'text') {
    try {
      await ensureFontLoaded();
    } catch {
      // non-critical
    }

    try {
      const { buffer } = await getTrueTypeFontData();
      const { buildOutlinedTextPath } = await import('./textToPath');
      outlinedTextPath = buildOutlinedTextPath({
        text: config.text,
        fontSize: fitFontSize(config.text),
        centerX: TAG_RADIUS,
        centerY: TAG_RADIUS,
        fontBuffer: buffer,
      });
    } catch {
      // Outline generation failed -- fall back to regular <text>
    }
  }

  const svgString = buildTagSvg({ config, fgHex, outlinedTextPath });
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
