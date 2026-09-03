import { TEXT_MAX_LENGTH } from '../constants';

/**
 * Allowed tag-text characters after uppercasing.
 * Letters, digits, and punctuation used on short badges (VIP, 18+, <18, 10%).
 * `-` is last so it stays literal in the character class.
 */
export const TEXT_ALLOWED_CHAR_CLASS = 'A-Z0-9.<>+/*&%#!?@*=:$-';

/** Same set plus lowercase, for validating raw form input before sanitizing. */
export const TEXT_INPUT_CHAR_CLASS = 'A-Za-z0-9.<>+/*&%#!?@*=:$-';

/** Capture group source for 1–TEXT_MAX_LENGTH allowed characters. */
export const TAG_TEXT_CAPTURE = `[${TEXT_ALLOWED_CHAR_CLASS}]{1,${TEXT_MAX_LENGTH}}`;

export const TEXT_PATTERN = new RegExp(
  `^[${TEXT_ALLOWED_CHAR_CLASS}]{0,${TEXT_MAX_LENGTH}}$`,
);

const DISALLOWED_RE = new RegExp(`[^${TEXT_ALLOWED_CHAR_CLASS}]`, 'g');
const TAG_TEXT_RE = new RegExp(`^${TAG_TEXT_CAPTURE}$`);
const DISALLOWED_INPUT_RE = new RegExp(`[^${TEXT_INPUT_CHAR_CLASS}]`);

/** Uppercase, drop disallowed characters, and cap at the tag-text length. */
export function sanitizeTagText(raw: string): string {
  return raw.toUpperCase().replace(DISALLOWED_RE, '').slice(0, TEXT_MAX_LENGTH);
}

/** True when the trimmed value is already a 1–3 character tag-text token. */
export function isTagText(value: string): boolean {
  return TAG_TEXT_RE.test(value.trim().toUpperCase());
}

/** True when raw input contains characters that will be stripped. */
export function hasDisallowedTagTextChars(raw: string): boolean {
  return DISALLOWED_INPUT_RE.test(raw);
}
