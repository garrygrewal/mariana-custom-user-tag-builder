import { contrastRatio } from '../src/lib/contrast.js';
import {
  CONTRAST_THRESHOLD_TEXT,
  CONTRAST_THRESHOLD_BG_WHITE,
} from '../src/constants';

export interface SvgValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const FORBIDDEN: { re: RegExp; message: string }[] = [
  { re: /<script\b/i, message: 'contains <script>' },
  { re: /\son[a-z]+\s*=/i, message: 'contains an inline event handler (on*=)' },
  { re: /<image\b/i, message: 'contains <image> (raster not allowed)' },
  { re: /<foreignObject\b/i, message: 'contains <foreignObject>' },
  { re: /(?:xlink:)?href\s*=/i, message: 'contains an external href reference' },
  { re: /<text\b/i, message: 'contains <text> (letters are handled as text tags)' },
];

/**
 * Validate an LLM-authored complex tag SVG against the design contract:
 * single 30x30 svg, edge-to-edge background circle of the requested color,
 * monochrome foreground, and no unsafe/disallowed nodes.
 *
 * `bgHex`/`fgHex` are expected as `#RRGGBB` uppercase.
 */
export function validateComplexSvg(
  svg: string,
  bgHex: string,
  fgHex: string,
): SvgValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const s = svg.trim();

  const svgOpenCount = (s.match(/<svg\b/gi) ?? []).length;
  if (svgOpenCount !== 1) {
    errors.push(`expected exactly one <svg> element (found ${svgOpenCount})`);
  }
  if (!/^<svg[\s>]/i.test(s) || !/<\/svg>\s*$/i.test(s)) {
    errors.push('must start with <svg> and end with </svg> (no surrounding prose)');
  }

  const rootMatch = s.match(/<svg\b([^>]*)>/i);
  const rootAttrs = rootMatch ? rootMatch[1] : '';
  if (!/viewBox\s*=\s*["']\s*0\s+0\s+30\s+30\s*["']/i.test(rootAttrs)) {
    errors.push('root viewBox must be "0 0 30 30"');
  }
  if (!/\bwidth\s*=\s*["']\s*30\s*["']/i.test(rootAttrs)) {
    errors.push('root width must be "30"');
  }
  if (!/\bheight\s*=\s*["']\s*30\s*["']/i.test(rootAttrs)) {
    errors.push('root height must be "30"');
  }

  if (!/<circle\b[^>]*\br\s*=\s*["']\s*15\s*["']/i.test(s)) {
    errors.push('missing edge-to-edge background <circle ... r="15">');
  }

  const bg = bgHex.replace(/^#/, '').toLowerCase();
  if (!new RegExp(`#${bg}\\b`, 'i').test(s)) {
    errors.push(`background color ${bgHex} not found in the SVG`);
  }

  for (const rule of FORBIDDEN) {
    if (rule.re.test(s)) errors.push(rule.message);
  }

  const fgBg = contrastRatio(fgHex, bgHex);
  if (fgBg < CONTRAST_THRESHOLD_TEXT) {
    warnings.push(`low foreground/background contrast (${fgBg.toFixed(1)}:1)`);
  }
  const bgWhite = contrastRatio(bgHex, '#FFFFFF');
  if (bgWhite < CONTRAST_THRESHOLD_BG_WHITE) {
    warnings.push(`tag may be hard to see on white (${bgWhite.toFixed(1)}:1)`);
  }

  return { ok: errors.length === 0, errors, warnings };
}
