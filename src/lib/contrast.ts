/**
 * Linearize an 8-bit sRGB channel value (0-255) to linear-light per WCAG 2.1.
 */
function linearize(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Parse a 6-digit hex color string (with or without leading #) into [R, G, B].
 */
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * WCAG 2.1 relative luminance of a hex color.
 * Returns a value between 0 (black) and 1 (white).
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * WCAG 2.1 contrast ratio between two hex colors.
 * Result ranges from 1 (identical) to 21 (black vs white).
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pick the foreground color (black or white) that provides
 * the highest contrast against the given background.
 */
export function pickForeground(bgHex: string): '#000000' | '#FFFFFF' {
  const withBlack = contrastRatio(bgHex, '#000000');
  const withWhite = contrastRatio(bgHex, '#FFFFFF');
  return withBlack >= withWhite ? '#000000' : '#FFFFFF';
}
