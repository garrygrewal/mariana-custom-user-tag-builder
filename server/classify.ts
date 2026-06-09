import type { IconDef } from '../src/types';
import { TEXT_MAX_LENGTH } from '../src/constants';
import type { TagRequest } from './ticket';

export interface Classification {
  /** When true, route to the LLM SVG author; otherwise to the builder. */
  isComplex: boolean;
  /** Builder mode when not complex. */
  mode: 'text' | 'icon';
  /** Uppercased text content for text mode. */
  text?: string;
  /** Matched library icon id for icon mode. */
  iconId?: string;
  iconLabel?: string;
  /** Short human-readable explanation of the routing decision. */
  reason: string;
}

/**
 * Extra search keywords per library icon id. Lets common concepts map to the
 * existing artwork without an LLM. Keep these conservative to avoid misroutes.
 */
const ICON_SYNONYMS: Record<string, string[]> = {
  dumbbell: ['gym', 'weights', 'workout', 'fitness', 'lifting', 'barbell', 'strength'],
  'mental-health': ['health', 'wellness', 'mindfulness', 'mental', 'brain', 'therapy'],
  'shopping-bag': ['shopping', 'retail', 'store', 'bag', 'purchase', 'merch'],
  'first-responder': ['responder', 'medic', 'ems', 'paramedic', 'firefighter'],
  'people-group': ['group', 'team', 'community', 'members', 'people', 'family'],
  'watch-fitness': ['watch', 'wearable', 'tracker', 'smartwatch'],
  'alarm-clock': ['alarm', 'clock', 'time', 'schedule', 'early'],
  handshake: ['handshake', 'partner', 'deal', 'agreement', 'referral'],
  hand: ['wave', 'raise'],
  ring: ['ring', 'jewelry', 'wedding'],
  child: ['child', 'kid', 'baby', 'children', 'youth'],
  home: ['home', 'house'],
  note: ['note', 'notes', 'memo'],
  priority: ['priority', 'important', 'urgent', 'flag'],
  senior: ['senior', 'elder', 'older', 'retired'],
  instructor: ['instructor', 'coach', 'trainer'],
  educator: ['educator', 'teacher', 'education', 'school', 'faculty'],
  booster: ['booster', 'boost', 'rocket'],
  star: ['star', 'favorite', 'featured'],
  play: ['play', 'video'],
  checkbox: ['checkbox', 'check', 'done', 'complete', 'tick'],
  chair: ['chair', 'seat', 'reformer'],
  location: ['location', 'place', 'pin', 'map'],
  running: ['running', 'runner', 'run', 'cardio'],
};

const LETTERS_INTENT = /\b(letters?|initials?|text|abbreviation|monogram|acronym)\b/i;

function normalizeTextToken(token: string): string | null {
  const cleaned = token.toUpperCase().replace(/[^A-Z0-9.]/g, '');
  if (!cleaned || cleaned.length > TEXT_MAX_LENGTH) return null;
  return cleaned;
}

function tokenize(text: string): Set<string> {
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return new Set(tokens);
}

interface IconKeywords {
  /** Curated synonyms — intentional, may be as short as 3 chars (e.g. "gym"). */
  curated: string[];
  /** Derived from id/label — require >= 4 chars to avoid generic false hits. */
  generic: string[];
}

function keywordsForIcon(icon: IconDef): IconKeywords {
  const fromId = icon.id.split('-');
  const fromLabel = icon.label.toLowerCase().split(/\s+/);
  const curated = (ICON_SYNONYMS[icon.id] ?? [])
    .map((k) => k.trim())
    .filter((k) => /^[a-z]{3,}$/.test(k));
  const generic = [...fromId, ...fromLabel]
    .map((k) => k.trim())
    .filter((k) => /^[a-z]{4,}$/.test(k));
  return { curated: Array.from(new Set(curated)), generic: Array.from(new Set(generic)) };
}

interface IconMatch {
  icon: IconDef;
  score: number;
  matched: number;
}

function matchIcon(text: string, registry: IconDef[]): IconMatch | null {
  const tokens = tokenize(text);

  // Strong special case: discount tags like "10% off" -> "10-off".
  const discount = text.match(/(\d{1,3})\s*%?\s*off\b/i);
  if (discount) {
    const id = `${discount[1]}-off`;
    const icon = registry.find((i) => i.id === id);
    if (icon) return { icon, score: 100, matched: 2 };
  }

  let best: IconMatch | null = null;
  for (const icon of registry) {
    const { curated, generic } = keywordsForIcon(icon);
    let matched = 0;
    let longest = 0;
    let curatedHit = false;
    for (const kw of curated) {
      if (tokens.has(kw)) {
        matched += 1;
        longest = Math.max(longest, kw.length);
        curatedHit = true;
      }
    }
    for (const kw of generic) {
      if (tokens.has(kw)) {
        matched += 1;
        longest = Math.max(longest, kw.length);
      }
    }
    if (matched === 0) continue;
    // Accept on a curated synonym hit, or a sufficiently specific (>=4) token.
    if (!curatedHit && longest < 4) continue;
    const score = longest * 10 + matched + (curatedHit ? 5 : 0);
    if (!best || score > best.score) best = { icon, score, matched };
  }

  return best;
}

/**
 * Classify a tag request as simple (builder) or complex (LLM SVG).
 *
 * Order: explicit short text -> library icon match -> letters intent -> complex.
 */
export function classify(req: TagRequest, registry: IconDef[]): Classification {
  const hay = `${req.tagName}\n${req.description}`;

  // 1. Explicitly quoted short token, e.g. tag should say "AB".
  const quoted = hay.match(/["'\u2018\u2019\u201c\u201d]\s*([A-Za-z0-9.]{1,3})\s*["'\u2018\u2019\u201c\u201d]/);
  if (quoted) {
    const text = normalizeTextToken(quoted[1]);
    if (text) {
      return { isComplex: false, mode: 'text', text, reason: `Quoted short text "${text}".` };
    }
  }

  // 2. Tag name that is already an initialism (all caps / digits, <= 3 chars).
  if (/^[A-Z0-9.]{1,3}$/.test(req.tagName.trim())) {
    const text = normalizeTextToken(req.tagName);
    if (text) {
      return { isComplex: false, mode: 'text', text, reason: `Tag name is a ${text.length}-char initialism.` };
    }
  }

  // 3. Known library icon concept.
  const iconMatch = matchIcon(hay, registry);
  if (iconMatch) {
    return {
      isComplex: false,
      mode: 'icon',
      iconId: iconMatch.icon.id,
      iconLabel: iconMatch.icon.label,
      reason: `Matched library icon "${iconMatch.icon.id}".`,
    };
  }

  // 4. Letters intent with a candidate token in the brief.
  if (LETTERS_INTENT.test(hay)) {
    const tok = req.description.match(/\b([A-Za-z0-9.]{1,3})\b/);
    const text = tok ? normalizeTextToken(tok[1]) : normalizeTextToken(req.tagName.slice(0, 3));
    if (text) {
      return { isComplex: false, mode: 'text', text, reason: `Letters/initials requested ("${text}").` };
    }
  }

  // 5. Otherwise it needs a custom icon.
  return {
    isComplex: true,
    mode: 'icon',
    reason: 'No library icon or short text match — custom icon required.',
  };
}
