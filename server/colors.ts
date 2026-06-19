/** Multi-word color phrases checked before single-word names (longest first). */
const COMPOUND_COLOR_NAMES: [string, string][] = [
  ['sage green', '#9CAF88'],
];

/** Common color words a studio might type, mapped to 6-digit hex. */
const NAMED_COLORS: Record<string, string> = {
  sage: '#9CAF88',
  black: '#000000',
  white: '#FFFFFF',
  gray: '#808080',
  grey: '#808080',
  silver: '#C0C0C0',
  red: '#E1251B',
  crimson: '#DC143C',
  maroon: '#800000',
  orange: '#F26722',
  amber: '#FFBF00',
  gold: '#D4AF37',
  yellow: '#FFD200',
  lime: '#A4D233',
  green: '#3DAE2B',
  emerald: '#2ECC71',
  teal: '#008080',
  cyan: '#00BCD4',
  blue: '#2D6CDF',
  navy: '#001F5B',
  royal: '#1F3FBF',
  sky: '#4FA8E0',
  indigo: '#4B0082',
  purple: '#6923F4',
  violet: '#7B2FF7',
  magenta: '#D6249F',
  pink: '#EC4899',
  rose: '#F43F5E',
  brown: '#8B5E3C',
  tan: '#D2B48C',
  beige: '#E8DCC0',
};

/** App default; used only when a request omits any recognizable color. */
export const DEFAULT_BG_HEX = '#6923F4';

/**
 * Normalize a hex string to `#RRGGBB` uppercase. Expands 3-digit shorthand.
 * Returns null if not a valid hex color.
 */
export function normalizeHex(input: string): string | null {
  const m = input.trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return `#${hex.toUpperCase()}`;
}

export interface ColorResult {
  hex: string;
  /** True when a hex or color name was actually found in the text. */
  matched: boolean;
  source: 'hex' | 'name' | 'default';
}

function matchNamedColor(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [name, hex] of COMPOUND_COLOR_NAMES) {
    if (lower.includes(name)) return hex;
  }
  for (const [name, hex] of Object.entries(NAMED_COLORS)) {
    if (new RegExp(`\\b${name}\\b`).test(lower)) return hex;
  }
  return null;
}

/**
 * Best-effort extraction of the requested tag color from free text.
 * Prefers an explicit hex, then a phrase tied to "background", then a named
 * color, else the app default.
 */
export function extractColor(text: string): ColorResult {
  const hexMatch = text.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
  if (hexMatch) {
    const hex = normalizeHex(hexMatch[0]);
    if (hex) return { hex, matched: true, source: 'hex' };
  }

  const bgPhrase = text.match(/([^,;:\n]+?)\s+background\b/i);
  if (bgPhrase) {
    const hex = matchNamedColor(bgPhrase[1]);
    if (hex) return { hex, matched: true, source: 'name' };
  }

  const hex = matchNamedColor(text);
  if (hex) return { hex, matched: true, source: 'name' };

  return { hex: DEFAULT_BG_HEX, matched: false, source: 'default' };
}
