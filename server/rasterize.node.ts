import { Resvg } from '@resvg/resvg-js';
import { EXPORT_SIZE, FONT_FAMILY } from '../src/constants.js';
import { loadFontTtf } from './fonts.node.js';

/**
 * Rasterize an SVG string to a 30x30 PNG Buffer using resvg (Node-native).
 *
 * Text tags are outlined to vector paths upstream, so fonts are typically not
 * required. When the Proxima Nova TTF is deployed we still pass it to resvg so
 * any `<text>` fallback renders in the correct face.
 */
export function svgToPng(svg: string): Buffer {
  const font = loadFontTtf();

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: EXPORT_SIZE },
    background: 'rgba(0,0,0,0)',
    font: font
      ? {
          loadSystemFonts: false,
          fontFiles: [font.path],
          defaultFontFamily: FONT_FAMILY,
        }
      : { loadSystemFonts: true, defaultFontFamily: FONT_FAMILY },
  });

  return resvg.render().asPng();
}
