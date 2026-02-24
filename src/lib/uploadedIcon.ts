import type { IconDef } from '../types';

const SVG_TAG_RE = /<svg[\s>]/i;
const VIEWBOX_RE = /viewBox=["']([^"']+)["']/i;
const SIZE_ATTR_RE = /\b(width|height)\s*=\s*["']\s*([0-9]*\.?[0-9]+)(?:px)?\s*["']/gi;
const SCRIPT_TAG_RE = /<script[\s\S]*?<\/script>/gi;
const EVENT_HANDLER_ATTR_RE = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi;

function sanitizeSvg(rawSvg: string): string {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return rawSvg
      .replace(SCRIPT_TAG_RE, '')
      .replace(EVENT_HANDLER_ATTR_RE, '')
      .trim();
  }

  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) {
    throw new Error('The uploaded file is not a valid SVG.');
  }

  svg.querySelectorAll('script,foreignObject,iframe,object,embed').forEach((node) => {
    node.remove();
  });

  svg.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
      if ((name === 'href' || name === 'xlink:href') && value.startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    }
  });

  return new XMLSerializer().serializeToString(svg).trim();
}

function sanitizeBaseName(fileName: string): string {
  const base = fileName.replace(/\.svg$/i, '').trim().toLowerCase();
  const cleaned = base
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'custom-icon';
}

function inferViewBox(svgContent: string): string {
  const viewBox = svgContent.match(VIEWBOX_RE)?.[1];
  if (viewBox) return viewBox;

  let width: number | null = null;
  let height: number | null = null;
  for (const match of svgContent.matchAll(SIZE_ATTR_RE)) {
    const dim = match[1];
    const value = Number(match[2]);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (dim === 'width') width = value;
    if (dim === 'height') height = value;
  }

  if (width && height) {
    return `0 0 ${width} ${height}`;
  }

  return '0 0 24 24';
}

export function createUploadedIcon(fileName: string, rawSvg: string): IconDef {
  const svgContent = sanitizeSvg(rawSvg);
  if (!SVG_TAG_RE.test(svgContent)) {
    throw new Error('The uploaded file is not a valid SVG.');
  }

  const baseName = sanitizeBaseName(fileName);
  const displayName = fileName.replace(/\.svg$/i, '').trim() || baseName;
  return {
    id: `uploaded-${baseName}`,
    label: displayName,
    svgContent,
    viewBox: inferViewBox(svgContent),
  };
}
