import type { TagConfig } from '../types';
import {
  EXPORT_SIZE,
  TAG_RADIUS,
  FONT_FAMILY,
  FONT_WEIGHT,
  FONT_SIZE_MIN,
  FONT_SIZE_1_CHAR,
  FONT_SIZE_2_CHAR,
  FONT_SIZE_3_CHAR,
  FONT_FALLBACK_STACK,
  ICON_FIT_RATIO,
} from '../constants';
import { ICON_REGISTRY } from './icons';

const PAINT_ATTR_RE = /\b(fill|stroke)\s*=\s*(["'])([^"']+)\2/gi;
const PAINT_STYLE_RE = /\b(fill|stroke)\s*:\s*([^;]+)/gi;

interface MeasureContext {
  font: string;
  measureText(text: string): { width: number };
}

/**
 * Get a 2D context for text measurement.
 * Prefers OffscreenCanvas; falls back to document.createElement('canvas').
 */
function getMeasureContext(): MeasureContext {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(1, 1);
    const ctx = c.getContext('2d');
    if (ctx) return ctx;
  }
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    if (ctx) return ctx;
  }
  return {
    font: '',
    measureText(text: string) {
      const sizeMatch = this.font.match(/(\d+(?:\.\d+)?)px/);
      const fontSize = sizeMatch ? Number(sizeMatch[1]) : FONT_SIZE_3_CHAR;
      return { width: text.length * fontSize * 0.65 };
    },
  };
}

function measureTextWidth(
  text: string,
  fontSize: number,
  ctx: MeasureContext,
): number {
  ctx.font = `${FONT_WEIGHT} ${fontSize}px "${FONT_FAMILY}", Arial, sans-serif`;
  return ctx.measureText(text).width;
}

function preferredTextSize(text: string): number {
  const len = text.trim().length;
  if (len <= 1) return FONT_SIZE_1_CHAR;
  if (len === 2) return FONT_SIZE_2_CHAR;
  return FONT_SIZE_3_CHAR;
}

function maxTextWidth(text: string): number {
  const len = text.trim().length;
  if (len <= 1) return TAG_RADIUS * 1.62;
  if (len === 2) return TAG_RADIUS * 1.56;
  return TAG_RADIUS * 1.5;
}

/**
 * Use size targets by text length (1->18.5, 2->16.5, 3->12.5),
 * then fit down as needed to avoid clipping.
 */
export function fitFontSize(text: string): number {
  const maxWidth = maxTextWidth(text);
  const ctx = getMeasureContext();
  const targetSize = preferredTextSize(text);

  for (let size = targetSize; size >= FONT_SIZE_MIN; size -= 0.5) {
    if (measureTextWidth(text, size, ctx) <= maxWidth) return size;
  }
  return FONT_SIZE_MIN;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Extract the inner content (paths, groups) from a raw SVG string,
 * stripping the outer `<svg ...>` wrapper.
 */
function extractSvgInner(raw: string): string {
  return raw.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
}

function shouldPreservePaint(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    v === '' ||
    v === 'none' ||
    v === 'inherit' ||
    v === 'currentcolor' ||
    v === 'context-fill' ||
    v === 'context-stroke' ||
    v.startsWith('url(') ||
    v.startsWith('var(')
  );
}

function recolorIconPaint(raw: string, fgHex: string): string {
  return raw
    .replace(
      PAINT_ATTR_RE,
      (match: string, attr: string, quote: string, value: string) => (
        shouldPreservePaint(value) ? match : `${attr}=${quote}${fgHex}${quote}`
      ),
    )
    .replace(
      PAINT_STYLE_RE,
      (match: string, attr: string, value: string) => (
        shouldPreservePaint(value) ? match : `${attr}:${fgHex}`
      ),
    );
}

function resolveIcon(config: TagConfig) {
  if (config.uploadedIcon?.id === config.iconId) {
    return config.uploadedIcon;
  }
  return ICON_REGISTRY.find((i) => i.id === config.iconId) ?? null;
}

interface BuildOptions {
  config: TagConfig;
  fgHex: string;
  /** Base64-encoded font data for portable .svg export */
  fontBase64?: string;
}

/**
 * Build a complete SVG string for the tag.
 */
export function buildTagSvg({ config, fgHex, fontBase64 }: BuildOptions): string {
  const { mode, text, bgHex } = config;
  const size = EXPORT_SIZE;
  const r = TAG_RADIUS;

  let fontStyle = '';
  if (fontBase64) {
    fontStyle = `
    <defs><style>
      @font-face {
        font-family: "${FONT_FAMILY}";
        src: url("data:font/truetype;base64,${fontBase64}") format("truetype");
        font-weight: ${FONT_WEIGHT};
      }
    </style></defs>`;
  }

  let content = '';

  if (mode === 'text') {
    const fontSize = fitFontSize(text);
    const fontFamilyAttr = `'${FONT_FALLBACK_STACK}'`;
    content = `<text
      x="${r}" y="${r}"
      text-anchor="middle" dominant-baseline="central"
      font-family=${fontFamilyAttr}
      font-weight="${FONT_WEIGHT}" font-size="${fontSize}"
      fill="${fgHex}">${escapeXml(text)}</text>`;
  } else {
    const icon = resolveIcon(config);
    if (icon) {
      const vbParts = icon.viewBox.split(/\s+/).map(Number);
      const [, , vbW, vbH] = vbParts;
      const iconFit = size * ICON_FIT_RATIO;
      const scale = iconFit / Math.max(vbW, vbH);
      const scaledW = vbW * scale;
      const scaledH = vbH * scale;
      const tx = (size - scaledW) / 2;
      const ty = (size - scaledH) / 2;
      const inner = recolorIconPaint(extractSvgInner(icon.svgContent), fgHex);

      content = `<g transform="translate(${tx},${ty}) scale(${scale})">${inner}</g>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${fontStyle}<circle cx="${r}" cy="${r}" r="${r}" fill="${bgHex}" />
  ${content}
</svg>`;
}
