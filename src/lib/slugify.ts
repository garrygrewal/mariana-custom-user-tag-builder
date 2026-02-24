/**
 * Convert a label string into a URL/filename-safe slug.
 * - Lowercases
 * - Replaces non-alphanumeric runs with a single hyphen
 * - Trims leading/trailing hyphens
 * - Falls back to "untitled" if empty
 */
export function toSlug(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'untitled';
}

/**
 * Build the standardized export filename.
 * Format: custom-tag_<slug>_<text|icon>_<hexNoHash>.<ext>
 */
export function buildFileName(
  label: string,
  mode: 'text' | 'icon',
  bgHex: string,
  ext: string,
): string {
  const slug = toSlug(label);
  const hex = bgHex.replace(/^#/, '').toLowerCase();
  return `custom-tag_${slug}_${mode}_${hex}.${ext}`;
}
