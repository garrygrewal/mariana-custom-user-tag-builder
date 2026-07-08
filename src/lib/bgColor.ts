/** Background colors that must never be used for tag circles. */
const DISALLOWED_BG_HEXS = new Set(['#FFFFFF']);

/** Normalize a hex string to `#RRGGBB` uppercase. Returns null if invalid. */
export function normalizeBgHex(input: string): string | null {
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

/** True when a hex must not be used as a tag background (e.g. pure white). */
export function isDisallowedBgHex(hex: string): boolean {
  const normalized = normalizeBgHex(hex);
  return normalized != null && DISALLOWED_BG_HEXS.has(normalized);
}

/** Reject disallowed backgrounds; white becomes black (standard number-tag default). */
export function sanitizeBgHex(hex: string): string {
  const normalized = normalizeBgHex(hex) ?? hex.toUpperCase();
  if (isDisallowedBgHex(normalized)) return '#000000';
  return normalized;
}
