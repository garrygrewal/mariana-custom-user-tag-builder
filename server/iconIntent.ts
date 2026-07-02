import type { IconDef } from '../src/types.js';
import { stripColorLanguage } from './colors.js';

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
 * Text suitable for fuzzy icon matching after removing color instructions.
 */
export function iconMatchText(text: string): string {
  return stripColorLanguage(text);
}
