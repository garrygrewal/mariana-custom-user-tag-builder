import { sanitizeBgHex } from '../src/lib/bgColor.js';

export { sanitizeBgHex, isDisallowedBgHex } from '../src/lib/bgColor.js';

/** Multi-word color phrases checked before single-word names (longest first). */
const COMPOUND_COLOR_NAMES: [string, string][] = [
  ['sage green', '#9CAF88'],
  ['royal blue', '#1F3FBF'],
  ['sky blue', '#4FA8E0'],
  ['hot pink', '#FF69B4'],
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
  coral: '#FF7F50',
  peach: '#FFCBA4',
  mint: '#98FF98',
  lavender: '#E6E6FA',
  burgundy: '#800020',
  charcoal: '#36454F',
};

/** Shade modifiers applied to a resolved base color (longest phrases first). */
const SHADE_MODIFIER_PHRASES: [string, ShadeModifier][] = [
  ['lighter shade of', 'lighter'],
  ['darker shade of', 'darker'],
  ['light shade of', 'light'],
  ['dark shade of', 'dark'],
  ['lighter', 'lighter'],
  ['darker', 'darker'],
  ['pastel', 'pastel'],
  ['pale', 'pale'],
  ['deep', 'deep'],
  ['bright', 'bright'],
  ['vivid', 'vivid'],
  ['muted', 'muted'],
  ['light', 'light'],
  ['dark', 'dark'],
];

type ShadeModifier =
  | 'lighter'
  | 'light'
  | 'darker'
  | 'dark'
  | 'pastel'
  | 'pale'
  | 'deep'
  | 'bright'
  | 'vivid'
  | 'muted';

/** App default; used only when a request omits any recognizable color. */
export const DEFAULT_BG_HEX = '#6923F4';

/** Standard number-tag style phrases — one background (black), not two colors. */
const STYLE_BG_PHRASES = ['black and white', 'black & white'];

/** All named color phrases, longest first, for matching and stripping. */
export function namedColorPhrases(): string[] {
  const compounds = COMPOUND_COLOR_NAMES.map(([name]) => name);
  const singles = Object.keys(NAMED_COLORS).sort((a, b) => b.length - a.length);
  return [...compounds, ...singles];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

/** True when text describes standard black-circle / white-foreground styling. */
export function isStyleColorPhrase(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return STYLE_BG_PHRASES.some((phrase) => lower === phrase);
}

/**
 * Split numbered list colors (e.g. "1) Blue 2) Green" or "1. Blue 2. Green").
 * Returns null when the text does not look like a numbered color list.
 */
export function splitNumberedColorSpecs(text: string): string[] | null {
  const trimmed = text.trim();
  const matches = [...trimmed.matchAll(/\d+[\).]\s*([\s\S]+?)(?=\s*\d+[\).]|$)/gi)];
  if (matches.length < 2) return null;

  const segments = matches.map((match) => match[1].trim()).filter(Boolean);
  return segments.length >= 2 ? segments : null;
}

/**
 * Split a color field into per-tag segments. Style phrases like "black and white"
 * stay intact; numbered lists (1) Blue 2) Green) and "and"-joined specs are
 * supported.
 */
export function splitColorSpecs(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (isStyleColorPhrase(trimmed)) return [trimmed];

  const numbered = splitNumberedColorSpecs(trimmed);
  if (numbered) return numbered;

  return trimmed
    .split(/\band\b/i)
    .map((segment) => segment.trim().replace(/^[,;]\s*/, '').replace(/[,;]$/, ''))
    .filter(Boolean);
}

function finalizeColor(result: ColorResult): ColorResult {
  return { ...result, hex: sanitizeBgHex(result.hex) };
}

export interface ColorResult {
  hex: string;
  /** True when a hex or color name was actually found in the text. */
  matched: boolean;
  source: 'hex' | 'name' | 'default';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex);
  if (!normalized) return { r: 0, g: 0, b: 0 };
  const n = parseInt(normalized.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toByte = (v: number) =>
    Math.round(clamp(v, 0, 255))
      .toString(16)
      .padStart(2, '0');
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`.toUpperCase();
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const hn = ((h % 360) + 360) % 360 / 360;

  if (sn === 0) {
    const gray = ln * 255;
    return rgbToHex(gray, gray, gray);
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const r = hue2rgb(p, q, hn + 1 / 3) * 255;
  const g = hue2rgb(p, q, hn) * 255;
  const b = hue2rgb(p, q, hn - 1 / 3) * 255;
  return rgbToHex(r, g, b);
}

/** Apply a natural-language shade modifier to a base hex color. */
export function applyShadeModifier(hex: string, modifier: ShadeModifier): string {
  const { h, s, l } = hexToHsl(hex);
  switch (modifier) {
    case 'lighter':
    case 'light':
      return hslToHex(h, clamp(s * 0.85, 0, 100), clamp(l + 18, 0, 92));
    case 'darker':
    case 'dark':
      return hslToHex(h, clamp(s * 1.05, 0, 100), clamp(l - 18, 8, 100));
    case 'pastel':
      return hslToHex(h, clamp(s * 0.45, 8, 55), clamp(l + 22, 72, 92));
    case 'pale':
      return hslToHex(h, clamp(s * 0.35, 5, 45), clamp(l + 28, 78, 95));
    case 'deep':
      return hslToHex(h, clamp(s * 1.1, 0, 100), clamp(l - 25, 12, 45));
    case 'bright':
    case 'vivid':
      return hslToHex(h, clamp(s * 1.25, 0, 100), clamp(l + 5, 0, 88));
    case 'muted':
      return hslToHex(h, clamp(s * 0.55, 0, 70), clamp(l + 8, 0, 90));
    default: {
      const _exhaustive: never = modifier;
      return _exhaustive;
    }
  }
}

function baseHexForName(name: string): string | null {
  const lower = name.toLowerCase().trim();
  for (const [compound, hex] of COMPOUND_COLOR_NAMES) {
    if (lower === compound) return hex;
  }
  return NAMED_COLORS[lower] ?? null;
}

function matchNamedColor(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [name, hex] of COMPOUND_COLOR_NAMES) {
    if (lower.includes(name)) return hex;
  }
  for (const [name, hex] of Object.entries(NAMED_COLORS)) {
    if (new RegExp(`\\b${escapeRegExp(name)}\\b`).test(lower)) return hex;
  }
  return null;
}

function matchShadedColor(text: string): { hex: string; modifier?: ShadeModifier } | null {
  const lower = text.toLowerCase();
  const colorNames = namedColorPhrases();

  for (const [modifierPhrase, modifier] of SHADE_MODIFIER_PHRASES) {
    for (const name of colorNames) {
      const pattern = new RegExp(
        `\\b${escapeRegExp(modifierPhrase)}\\s+(?:the\\s+)?${escapeRegExp(name)}\\b`,
        'i',
      );
      if (!pattern.test(lower)) continue;
      const base = baseHexForName(name);
      if (!base) continue;
      return { hex: applyShadeModifier(base, modifier), modifier };
    }
  }

  return null;
}

/**
 * Remove color language from text so icon matching is not thrown off by
 * phrases like "lighter shade of pink".
 */
export function stripColorLanguage(text: string): string {
  let out = text;
  out = out.replace(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/gi, ' ');

  const colorNames = namedColorPhrases();
  for (const [modifierPhrase] of SHADE_MODIFIER_PHRASES) {
    for (const name of colorNames) {
      const pattern = new RegExp(
        `\\b${escapeRegExp(modifierPhrase)}\\s+(?:the\\s+)?${escapeRegExp(name)}\\b`,
        'gi',
      );
      out = out.replace(pattern, ' ');
    }
  }

  for (const name of colorNames) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi'), ' ');
  }

  out = out.replace(
    /\b(?:shade|tone|tint|hue|color|colour|background)\b/gi,
    ' ',
  );
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Best-effort extraction of the requested tag color from free text.
 * Prefers an explicit hex, then shaded color phrases (e.g. pastel pink,
 * lighter green), then a phrase tied to "background", then a named color,
 * else the app default.
 */
export function extractColor(text: string): ColorResult {
  if (isStyleColorPhrase(text)) {
    return finalizeColor({ hex: '#000000', matched: true, source: 'name' });
  }

  const hexMatch = text.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
  if (hexMatch) {
    const hex = normalizeHex(hexMatch[0]);
    if (hex) return finalizeColor({ hex, matched: true, source: 'hex' });
  }

  const parenthetical = text.match(/\(([^)]+)\)/);
  if (parenthetical?.[1]) {
    const shadedParen = matchShadedColor(parenthetical[1]);
    if (shadedParen) return finalizeColor({ hex: shadedParen.hex, matched: true, source: 'name' });
    const namedParen = matchNamedColor(parenthetical[1]);
    if (namedParen) return finalizeColor({ hex: namedParen, matched: true, source: 'name' });
  }

  const shaded = matchShadedColor(text);
  if (shaded) return finalizeColor({ hex: shaded.hex, matched: true, source: 'name' });

  const bgPhrase = text.match(/([^,;:\n]+?)\s+background\b/i);
  if (bgPhrase) {
    const shadedBg = matchShadedColor(bgPhrase[1]);
    if (shadedBg) return finalizeColor({ hex: shadedBg.hex, matched: true, source: 'name' });
    const hex = matchNamedColor(bgPhrase[1]);
    if (hex) return finalizeColor({ hex, matched: true, source: 'name' });
  }

  const hex = matchNamedColor(text);
  if (hex) return finalizeColor({ hex, matched: true, source: 'name' });

  return finalizeColor({ hex: DEFAULT_BG_HEX, matched: false, source: 'default' });
}
