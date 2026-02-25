import type { TagConfig, IconDef } from '../types';
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
  ICON_FIT_MAX_WIDTH_RATIO,
  ICON_FIT_MAX_HEIGHT_RATIO,
  ICON_OPTICAL_OFFSET_PX,
} from '../constants';
import { ICON_REGISTRY } from './icons';
import type { OutlinedTextPath } from './textToPath';

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

const ROOT_PRESENTATION_ATTRS = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'fill-opacity',
  'opacity',
];

function escapeAttrValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/**
 * Preserve inheritable presentation attributes from the source <svg> root.
 * This avoids losing semantics like `fill="none"` when we strip the wrapper.
 */
function extractRootPresentationAttrs(raw: string): string {
  const rootMatch = raw.match(/<svg\b([^>]*)>/i);
  if (!rootMatch) return '';

  const rootAttrs = rootMatch[1];
  const attrs: string[] = [];
  for (const attr of ROOT_PRESENTATION_ATTRS) {
    const re = new RegExp(`\\b${attr}\\s*=\\s*(["'])(.*?)\\1`, 'i');
    const match = rootAttrs.match(re);
    if (!match) continue;
    attrs.push(`${attr}="${escapeAttrValue(match[2])}"`);
  }

  return attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
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
  if (config.uploadedIcon) return config.uploadedIcon;
  return ICON_REGISTRY.find((i) => i.id === config.iconId) ?? null;
}

interface IconBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const iconBoundsCache = new Map<string, IconBounds | null>();

function isValidBounds(bounds: IconBounds | null): bounds is IconBounds {
  if (!bounds) return false;
  return (
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.width > 0 &&
    bounds.height > 0
  );
}

/**
 * Best-effort measurement of rendered icon content bounds.
 * In non-browser/test environments where SVG getBBox is unavailable,
 * returns null and callers fall back to viewBox centering.
 */
function measureIconContentBounds(icon: IconDef): IconBounds | null {
  if (iconBoundsCache.has(icon.id)) {
    return iconBoundsCache.get(icon.id) ?? null;
  }
  if (typeof document === 'undefined' || !document.body) {
    iconBoundsCache.set(icon.id, null);
    return null;
  }

  let host: HTMLDivElement | null = null;
  try {
    host = document.createElement('div');
    host.style.position = 'absolute';
    host.style.left = '-99999px';
    host.style.top = '-99999px';
    host.style.width = '0';
    host.style.height = '0';
    host.style.overflow = 'hidden';
    host.style.pointerEvents = 'none';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', icon.viewBox);
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = extractSvgInner(icon.svgContent);
    svg.appendChild(g);
    host.appendChild(svg);
    document.body.appendChild(host);

    const graphics = g as unknown as SVGGraphicsElement;
    if (!graphics.getBBox) {
      iconBoundsCache.set(icon.id, null);
      return null;
    }

    const box = graphics.getBBox();
    const measured: IconBounds = {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    };
    const result = isValidBounds(measured) ? measured : null;
    iconBoundsCache.set(icon.id, result);
    return result;
  } catch {
    iconBoundsCache.set(icon.id, null);
    return null;
  } finally {
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
  }
}

function computeIconScale(size: number, vbW: number, vbH: number): number {
  if (!Number.isFinite(vbW) || !Number.isFinite(vbH) || vbW <= 0 || vbH <= 0) {
    return 1;
  }

  const maxW = size * ICON_FIT_MAX_WIDTH_RATIO;
  const maxH = size * ICON_FIT_MAX_HEIGHT_RATIO;
  return Math.min(maxW / vbW, maxH / vbH);
}

interface BuildOptions {
  config: TagConfig;
  fgHex: string;
  /** Base64-encoded font data for portable .svg export */
  fontBase64?: string;
  fontMime?: 'font/woff2' | 'font/truetype';
  fontFormat?: 'woff2' | 'truetype';
  outlinedTextPath?: OutlinedTextPath | null;
}

/**
 * Build a complete SVG string for the tag.
 */
export function buildTagSvg({
  config,
  fgHex,
  fontBase64,
  fontMime = 'font/truetype',
  fontFormat = 'truetype',
  outlinedTextPath,
}: BuildOptions): string {
  const { mode, text, bgHex } = config;
  const size = EXPORT_SIZE;
  const r = TAG_RADIUS;

  let fontStyle = '';
  if (fontBase64) {
    fontStyle = `
    <defs><style>
      @font-face {
        font-family: "${FONT_FAMILY}";
        src: url("data:${fontMime};base64,${fontBase64}") format("${fontFormat}");
        font-weight: ${FONT_WEIGHT};
      }
    </style></defs>`;
  }

  let content = '';

  if (mode === 'text') {
    if (outlinedTextPath) {
      content = `<path d="${outlinedTextPath.d}" transform="translate(${outlinedTextPath.translateX},${outlinedTextPath.translateY})" fill="${fgHex}" />`;
    } else {
      const fontSize = fitFontSize(text);
      const fontFamilyAttr = `'${FONT_FALLBACK_STACK}'`;
      content = `<text
        x="${r}" y="${r}"
        text-anchor="middle" dominant-baseline="central"
        font-family=${fontFamilyAttr}
        font-weight="${FONT_WEIGHT}" font-size="${fontSize}"
        fill="${fgHex}">${escapeXml(text)}</text>`;
    }
  } else {
    const icon = resolveIcon(config);
    if (icon) {
      const vbParts = icon.viewBox.split(/\s+/).map(Number);
      const [vbMinX = 0, vbMinY = 0, vbW = 0, vbH = 0] = vbParts;
      const scale = computeIconScale(size, vbW, vbH);
      const contentBounds = measureIconContentBounds(icon);

      let tx = (size - vbW * scale) / 2 - vbMinX * scale;
      let ty = (size - vbH * scale) / 2 - vbMinY * scale;

      if (isValidBounds(contentBounds)) {
        const contentCenterX = contentBounds.x + contentBounds.width / 2;
        const contentCenterY = contentBounds.y + contentBounds.height / 2;
        tx = size / 2 - contentCenterX * scale;
        ty = size / 2 - contentCenterY * scale;
      }

      const opticalOffset = ICON_OPTICAL_OFFSET_PX[icon.id];
      if (opticalOffset) {
        tx += opticalOffset.x;
        ty += opticalOffset.y;
      }

      const inner = recolorIconPaint(extractSvgInner(icon.svgContent), fgHex);
      const inheritedRootAttrs = extractRootPresentationAttrs(icon.svgContent);

      content = `<g transform="translate(${tx},${ty}) scale(${scale})"${inheritedRootAttrs}>${inner}</g>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${fontStyle}<circle cx="${r}" cy="${r}" r="${r}" fill="${bgHex}" />
  ${content}
</svg>`;
}
