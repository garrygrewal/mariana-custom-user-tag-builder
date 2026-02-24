import { parse } from 'opentype.js';

export interface OutlinedTextPath {
  d: string;
  translateX: number;
  translateY: number;
}

interface BuildOutlinedTextPathOptions {
  text: string;
  fontSize: number;
  centerX: number;
  centerY: number;
  fontBuffer: ArrayBuffer;
}

/**
 * Convert short tag text into vector path data for deterministic SVG rendering.
 * Returns null if parsing/path extraction fails so callers can fall back to <text>.
 */
export function buildOutlinedTextPath({
  text,
  fontSize,
  centerX,
  centerY,
  fontBuffer,
}: BuildOutlinedTextPathOptions): OutlinedTextPath | null {
  const label = text.trim();
  if (!label) return null;

  try {
    const font = parse(fontBuffer.slice(0));
    const path = font.getPath(label, 0, 0, fontSize);
    const box = path.getBoundingBox();

    const width = box.x2 - box.x1;
    const height = box.y2 - box.y1;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }

    const translateX = centerX - (box.x1 + width / 2);
    const translateY = centerY - (box.y1 + height / 2);
    const d = path.toPathData(3);
    if (!d) return null;

    return { d, translateX, translateY };
  } catch {
    return null;
  }
}
