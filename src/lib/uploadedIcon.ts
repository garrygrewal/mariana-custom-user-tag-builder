import type { IconDef } from '../types';

const SVG_TAG_RE = /<svg\b[^>]*>[\s\S]*<\/svg>/i;
const VIEWBOX_RE = /viewBox=["']([^"']+)["']/i;
const WIDTH_RE = /\bwidth\s*=\s*["']\s*([0-9]+(?:\.[0-9]+)?)\s*(?:px)?\s*["']/i;
const HEIGHT_RE = /\bheight\s*=\s*["']\s*([0-9]+(?:\.[0-9]+)?)\s*(?:px)?\s*["']/i;
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function fileNameToIconId(name: string): string {
  const base = name
    .replace(/\.(svg|png)$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'uploaded-icon';
}

function labelFromId(id: string): string {
  return id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function isPngSignature(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_SIGNATURE.length) return false;
  return PNG_SIGNATURE.every((value, i) => bytes[i] === value);
}

function parsePngDimensions(bytes: Uint8Array): { width: number; height: number } {
  // PNG layout starts with signature (8), then IHDR chunk where width/height
  // are 4-byte big-endian ints at offsets 16 and 20.
  if (!isPngSignature(bytes) || bytes.length < 24) {
    throw new Error('Invalid PNG file.');
  }

  const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (chunkType !== 'IHDR') {
    throw new Error('Invalid PNG header.');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (!width || !height) {
    throw new Error('Invalid PNG dimensions.');
  }

  return { width, height };
}

type BufferLike = {
  from(input: Uint8Array): { toString(encoding: 'base64'): string };
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  if (typeof btoa === 'function') {
    return btoa(binary);
  }

  const bufferCtor = (globalThis as { Buffer?: BufferLike }).Buffer;
  if (bufferCtor) {
    return bufferCtor.from(bytes).toString('base64');
  }

  throw new Error('Unable to process PNG file.');
}

function parseViewBox(svgText: string): string {
  const explicit = svgText.match(VIEWBOX_RE)?.[1];
  if (explicit) return explicit;

  const width = Number(svgText.match(WIDTH_RE)?.[1] ?? NaN);
  const height = Number(svgText.match(HEIGHT_RE)?.[1] ?? NaN);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return `0 0 ${width} ${height}`;
  }

  return '0 0 24 24';
}

function sanitizeSvg(svgText: string): string {
  return svgText
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s(xlink:)?href\s*=\s*["']\s*javascript:[^"']*["']/gi, '');
}

export function parseUploadedSvg(svgText: string, fileName: string): IconDef {
  const trimmed = svgText.trim();
  if (!SVG_TAG_RE.test(trimmed)) {
    throw new Error('Invalid file. Upload a valid SVG file.');
  }

  const id = fileNameToIconId(fileName);
  const sanitized = sanitizeSvg(trimmed);
  const viewBox = parseViewBox(sanitized);

  return {
    id,
    label: labelFromId(id),
    svgContent: sanitized,
    viewBox,
  };
}

export function parseUploadedPng(fileName: string, bytes: Uint8Array): IconDef {
  const { width, height } = parsePngDimensions(bytes);
  const id = fileNameToIconId(fileName);
  const base64 = bytesToBase64(bytes);

  return {
    id,
    label: labelFromId(id),
    viewBox: `0 0 ${width} ${height}`,
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><image x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${base64}" /></svg>`,
  };
}

export async function parseUploadedIconFile(file: File): Promise<IconDef> {
  const isSvg = /\.svg$/i.test(file.name) || file.type === 'image/svg+xml';
  const isPng = /\.png$/i.test(file.name) || file.type === 'image/png';

  if (!isSvg && !isPng) {
    throw new Error('Only .svg or .png files are supported.');
  }

  if (isPng) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return parseUploadedPng(file.name, bytes);
  }

  const svgText = await file.text();
  return parseUploadedSvg(svgText, file.name);
}
