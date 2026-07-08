import type { IconDef } from '../src/types.js';
import { extractColor, stripColorLanguage } from './colors.js';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Jira order-form field labels that should not participate in icon matching. */
const JIRA_FIELD_LABELS = [
  'user tag name',
  'tag name',
  'background color',
  'tag color',
  'number of tags',
  'number of icons',
  'description',
  'icon',
] as const;

function normalizeIconToken(token: string): string {
  return token.trim().toLowerCase().replace(/_/g, '-');
}

function collectIconCandidates(text: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const add = (raw: string) => {
    const normalized = normalizeIconToken(raw);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  const useIcon =
    text.match(/\buse(?:\s+(?:a|an|the))?\s+([a-z0-9][a-z0-9-_]*)\s+icon\b/gi) ?? [];
  for (const match of useIcon) {
    const captured = match.match(/\buse(?:\s+(?:a|an|the))?\s+([a-z0-9][a-z0-9-_]*)\s+icon\b/i);
    if (captured?.[1]) add(captured[1]);
  }

  const iconRefs = text.match(/\bicon[:\s]+([a-z0-9][a-z0-9-_]*)\b/gi) ?? [];
  for (const match of iconRefs) {
    const captured = match.match(/\bicon[:\s]+([a-z0-9][a-z0-9-_]*)\b/i);
    if (captured?.[1]) add(captured[1]);
  }

  const hyphenated =
    text.match(/\b((?:nucleo-)?[a-z][a-z0-9]*(?:-[a-z0-9]+)+)\b/gi) ?? [];
  for (const token of hyphenated) add(token);

  const singleWord = text.match(/\bicon[:\s]+([a-z0-9]+)\b/gi) ?? [];
  for (const match of singleWord) {
    const captured = match.match(/\bicon[:\s]+([a-z0-9]+)\b/i);
    if (captured?.[1]) add(captured[1]);
  }

  return candidates;
}

/**
 * Resolve an explicit library icon id from free text (revision notes, icon field).
 * Returns null when no registered icon matches.
 */
export function resolveExplicitIconId(
  text: string,
  registry: IconDef[],
): string | null {
  const ids = new Set(registry.map((icon) => icon.id));
  const candidates = collectIconCandidates(text);

  for (const candidate of candidates) {
    if (ids.has(candidate)) return candidate;

    const withNucleo = candidate.startsWith('nucleo-')
      ? candidate
      : `nucleo-${candidate}`;
    if (ids.has(withNucleo)) return withNucleo;

    if (candidate.startsWith('nucleo-')) {
      const withoutNucleo = candidate.slice('nucleo-'.length);
      if (ids.has(withoutNucleo)) return withoutNucleo;
    }
  }

  return null;
}

/**
 * Remove Jira order-form field labels (e.g. "Description:") so label words do
 * not spuriously match library icon keywords.
 */
export function stripJiraBoilerplate(text: string): string {
  let out = text;
  for (const label of JIRA_FIELD_LABELS) {
    const escaped = escapeRegExp(label);
    out = out.replace(
      new RegExp(`(^|[\\n\\r])\\s*${escaped}\\s*:\\s*`, 'gi'),
      '$1',
    );
    out = out.replace(new RegExp(`^\\s*${escaped}\\s*:\\s*`, 'gi'), '');
  }
  return out.replace(/\s+/g, ' ').trim();
}

const LETTER_REVISION =
  /\b(?:letters?|initials?|monogram|acronym|abbreviation)\s+["'\u2018\u2019\u201c\u201d]?[A-Za-z0-9.]{1,3}/i;
const QUOTED_LETTER_REVISION =
  /["'\u2018\u2019\u201c\u201d]\s*[A-Za-z0-9.]{1,3}\s*["'\u2018\u2019\u201c\u201d]/;

/**
 * True when `/regenerate-tag` notes change the icon or letter brief, not just
 * the background color. Color-only notes should preserve the original icon hint.
 */
export function revisionNotesChangeIcon(notes: string, registry: IconDef[]): boolean {
  const trimmed = notes.trim();
  if (!trimmed) return false;

  if (resolveExplicitIconId(trimmed, registry)) return true;
  if (LETTER_REVISION.test(trimmed)) return true;
  if (QUOTED_LETTER_REVISION.test(trimmed)) return true;
  if (/\b(?:icon|logo|emoji|glyph|symbol|silhouette)\b/i.test(trimmed)) return true;
  if (/\b(?:instead|rather|replace|switch)\b/i.test(trimmed)) return true;

  const afterColor = stripColorLanguage(trimmed);
  const afterFiller = afterColor
    .replace(
      /\b(?:should|be|the|please|make|set|change|tag|use|a|an|to|it|instead|simpler|different)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();

  if (extractColor(trimmed).matched && afterFiller.length === 0) return false;

  return afterFiller.length > 0;
}

/**
 * Text suitable for fuzzy icon matching after removing color instructions and
 * Jira field labels.
 */
export function iconMatchText(text: string): string {
  return stripColorLanguage(stripJiraBoilerplate(text));
}
