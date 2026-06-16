import type { IconDef } from '../src/types.js';
import { TEXT_MAX_LENGTH } from '../src/constants.js';
import { isNucleoIconId } from './nucleoIcons.node.js';
import type { TagRequest } from './ticket.js';

export type Confidence = 'high' | 'low';

export type IconMatchSource = 'priority' | 'full';

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
  /** Routing confidence for simple (non-complex) paths. */
  confidence: Confidence;
  /** When true, also generate one AI option alongside the library/text artifact. */
  fallbackToAi?: boolean;
  /** Tokens that contributed to the library icon match. */
  matchedTerms?: string[];
  /** Salient tokens from the brief that did not support the match. */
  unmatchedTerms?: string[];
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
  note: ['note', 'notes', 'memo', 'document', 'paperwork', 'waiver', 'consent', 'covid'],
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
  person: ['person', 'individual', 'profile'],
  banned: ['banned', 'blocked', 'blacklist', 'ban', 'prohibited', 'denied'],
  staff: ['staff', 'crew'],
  employee: ['employee', 'worker', 'colleague', 'staffer'],
  student: ['student', 'learner', 'pupil', 'academic'],
  vaccinated: ['vaccinated', 'vaccine', 'vaccination', 'syringe', 'immunized'],
  investor: ['investor', 'shareholder', 'backer'],
  injury: ['injury', 'injured', 'hurt', 'rehab'],
  sneaker: ['sneaker', 'trainers', 'footwear', 'kicks'],
  'health-professional': ['healthcare', 'medical', 'doctor', 'nurse', 'clinician'],
  corporate: ['corporate', 'company', 'business', 'office'],
  wedding: ['wedding', 'marriage', 'bride', 'groom', 'newlywed'],
  'frequent-customer': ['regular', 'loyal'],
  livestream: ['livestream', 'streaming', 'broadcast'],
  'emergency-services': ['emergency', 'ambulance', 'paramedic', 'ems'],
  hands: ['hands', 'helping', 'gratitude', 'namaste'],
  birthday: ['birthday', 'bday', 'cake', 'celebration'],
  alert: ['alert', 'warning', 'exclamation', 'caution'],
  dollar: ['dollar', 'payment', 'money'],
  'friends-family': ['friends', 'family', 'household'],
  'nucleo-earth': ['earth', 'globe', 'world', 'global', 'planet'],
  'nucleo-globe-2': ['globe', 'earth', 'world', 'global', 'planet'],
  'nucleo-soccer': ['soccer', 'football', 'futbol'],
  'nucleo-soccer-ball': ['soccer', 'football', 'ball'],
  'nucleo-trophy': ['trophy', 'winner', 'champion', 'award'],
};

/** Library icons that are weak defaults when matched without strong intent. */
const GENERIC_ICON_IDS = new Set(['person', 'star', 'note']);

const LETTERS_INTENT = /\b(letters?|initials?|text|abbreviation|monogram|acronym)\b/i;

const STOP_WORDS = new Set([
  'the',
  'for',
  'and',
  'with',
  'our',
  'tag',
  'show',
  'display',
  'using',
  'color',
  'tags',
  'user',
  'custom',
  'please',
  'design',
  'need',
  'needs',
  'want',
  'requested',
  'wants',
  'a',
  'an',
  'or',
  'to',
  'of',
  'in',
  'on',
  'is',
  'it',
  'this',
  'that',
  'be',
  'has',
  'have',
  'who',
  'attended',
]);

/** Tag-name filler that should not alone trigger a semantic-gap signal. */
const TAG_FILLER = new Set([
  'member',
  'members',
  'customer',
  'client',
  'week',
  'finisher',
  'program',
  'club',
  'badge',
  'attendee',
]);

const LOW_MATCH_SCORE = 35;
const CLOSE_SCORE_MARGIN = 12;

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

function allIconKeywords(icon: IconDef): Set<string> {
  const { curated, generic } = keywordsForIcon(icon);
  return new Set([...curated, ...generic, ...icon.id.split('-')]);
}

export interface IconMatch {
  icon: IconDef;
  score: number;
  matched: number;
  matchedTerms: string[];
  curatedHit: boolean;
  longest: number;
}

function rankIconMatches(text: string, registry: IconDef[]): IconMatch[] {
  const tokens = tokenize(text);

  const discount = text.match(/(\d{1,3})\s*%?\s*off\b/i);
  if (discount) {
    const id = `${discount[1]}-off`;
    const icon = registry.find((i) => i.id === id);
    if (icon) {
      return [
        {
          icon,
          score: 100,
          matched: 2,
          matchedTerms: [discount[1], 'off'],
          curatedHit: true,
          longest: 3,
        },
      ];
    }
  }

  const matches: IconMatch[] = [];
  for (const icon of registry) {
    const { curated, generic } = keywordsForIcon(icon);
    const matchedTerms: string[] = [];
    let longest = 0;
    let curatedHit = false;
    for (const kw of curated) {
      if (tokens.has(kw)) {
        matchedTerms.push(kw);
        longest = Math.max(longest, kw.length);
        curatedHit = true;
      }
    }
    for (const kw of generic) {
      if (tokens.has(kw)) {
        matchedTerms.push(kw);
        longest = Math.max(longest, kw.length);
      }
    }
    if (matchedTerms.length === 0) continue;
    if (!curatedHit && longest < 4) continue;
    const score = longest * 10 + matchedTerms.length + (curatedHit ? 5 : 0);
    matches.push({
      icon,
      score,
      matched: matchedTerms.length,
      matchedTerms: Array.from(new Set(matchedTerms)),
      curatedHit,
      longest,
    });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches;
}

function isSalientToken(token: string): boolean {
  if (STOP_WORDS.has(token) || TAG_FILLER.has(token)) return false;
  return token.length >= 4 || /^[a-z]{3,}$/.test(token);
}

function strongCuratedIntent(match: IconMatch, req: TagRequest): boolean {
  const intentHay = `${req.tagName}\n${req.iconHint ?? ''}`.toLowerCase();
  const curated = new Set(keywordsForIcon(match.icon).curated);
  return match.matchedTerms.some((term) => curated.has(term) && intentHay.includes(term));
}

function unmatchedSalientTerms(
  req: TagRequest,
  matchedTerms: Set<string>,
  iconKeywords: Set<string>,
): string[] {
  const priorityHay = `${req.tagName} ${req.iconHint ?? ''}`;
  const tokens = tokenize(priorityHay);
  return [...tokens].filter(
    (t) => isSalientToken(t) && !matchedTerms.has(t) && !iconKeywords.has(t),
  );
}

function tagNameSemanticGap(
  tagName: string,
  matchedTerms: Set<string>,
  iconKeywords: Set<string>,
): string[] {
  const tokens = tokenize(tagName);
  return [...tokens].filter(
    (t) => isSalientToken(t) && !matchedTerms.has(t) && !iconKeywords.has(t),
  );
}

function iconHintBranches(iconHint: string): Set<string>[] {
  return iconHint.split(/\bor\b/i).map((branch) => tokenize(branch));
}

function iconHintSatisfied(req: TagRequest, match: IconMatch): boolean {
  if (!req.iconHint?.trim()) return false;

  const branches = iconHintBranches(req.iconHint);
  if (branches.length > 1) {
    return branches.some((branch) =>
      match.matchedTerms.some((term) => branch.has(term)),
    );
  }

  const hintTokens = tokenize(req.iconHint);
  return match.matchedTerms.some((term) => hintTokens.has(term));
}

function buildMatchHaystacks(req: TagRequest): { priority: string; full: string } {
  const priority = [req.iconHint, req.tagName].filter(Boolean).join('\n');
  const full = priority
    ? `${priority}\n${req.description}`
    : `${req.tagName}\n${req.description}`;
  return { priority, full };
}

function pickIconMatch(
  req: TagRequest,
  registry: IconDef[],
): { match: IconMatch; ranked: IconMatch[]; source: IconMatchSource } | null {
  const { priority, full } = buildMatchHaystacks(req);
  const hay = req.iconHint?.trim() ? priority : full;

  const curated = registry.filter((icon) => !isNucleoIconId(icon.id));
  const nucleo = registry.filter((icon) => isNucleoIconId(icon.id));

  const curatedRanked = rankIconMatches(hay, curated);
  if (curatedRanked[0]) {
    return {
      match: curatedRanked[0],
      ranked: curatedRanked,
      source: req.iconHint?.trim() ? 'priority' : 'full',
    };
  }

  const nucleoRanked = rankIconMatches(hay, nucleo);
  if (!nucleoRanked[0]) return null;

  return {
    match: nucleoRanked[0],
    ranked: nucleoRanked,
    source: req.iconHint?.trim() ? 'priority' : 'full',
  };
}

interface ConfidenceAssessment {
  confidence: Confidence;
  fallbackToAi: boolean;
  matchedTerms?: string[];
  unmatchedTerms?: string[];
  reasonSuffix: string;
}

function unmatchedHintTerms(req: TagRequest, match: IconMatch): string[] {
  if (!req.iconHint?.trim()) return [];
  const iconKeywords = allIconKeywords(match.icon);
  const matched = new Set(match.matchedTerms);
  return [...tokenize(req.iconHint)].filter(
    (t) => isSalientToken(t) && !matched.has(t) && !iconKeywords.has(t),
  );
}

function assessIconConfidence(
  req: TagRequest,
  match: IconMatch,
  runnerUp: IconMatch | null,
  source: IconMatchSource,
): ConfidenceAssessment {
  const unmatchedInHint = unmatchedHintTerms(req, match);
  const hintPartial =
    source === 'priority' &&
    iconHintSatisfied(req, match) &&
    unmatchedInHint.length > 0 &&
    (GENERIC_ICON_IDS.has(match.icon.id) || !match.curatedHit);

  if (hintPartial) {
    return {
      confidence: 'low',
      fallbackToAi: true,
      matchedTerms: match.matchedTerms,
      unmatchedTerms: unmatchedInHint,
      reasonSuffix: ` Low confidence (icon hint partially matched; missing ${unmatchedInHint.join(', ')}); including AI fallback.`,
    };
  }

  if (source === 'priority' && iconHintSatisfied(req, match)) {
    return {
      confidence: 'high',
      fallbackToAi: false,
      matchedTerms: match.matchedTerms,
      reasonSuffix: ' Matched from icon hint / tag name.',
    };
  }

  if (isNucleoIconId(match.icon.id) && source === 'priority' && match.score >= LOW_MATCH_SCORE) {
    return {
      confidence: 'high',
      fallbackToAi: false,
      matchedTerms: match.matchedTerms,
      reasonSuffix: ' Matched Nucleo icon from icon hint / tag name.',
    };
  }

  const matchedTermSet = new Set(match.matchedTerms);
  const iconKeywords = allIconKeywords(match.icon);
  const lowSignals: string[] = [];

  if (GENERIC_ICON_IDS.has(match.icon.id) && !strongCuratedIntent(match, req)) {
    lowSignals.push('generic library icon');
  }
  if (!match.curatedHit) {
    lowSignals.push('generic token hit only');
  }
  if (match.score < LOW_MATCH_SCORE) {
    lowSignals.push('low match score');
  }

  const unmatched = unmatchedSalientTerms(req, matchedTermSet, iconKeywords);
  if (unmatched.length > 0) {
    lowSignals.push(`unmatched salient terms (${unmatched.join(', ')})`);
  }

  if (runnerUp && match.score - runnerUp.score <= CLOSE_SCORE_MARGIN) {
    const sharedTerms = match.matchedTerms.filter((t) => runnerUp.matchedTerms.includes(t));
    if (sharedTerms.length === 0) {
      lowSignals.push('close competing icon scores');
    }
  }

  if (req.iconHint && /\bor\b/i.test(req.iconHint) && !iconHintSatisfied(req, match)) {
    lowSignals.push('disjunction in icon hint');
  }

  const gap = tagNameSemanticGap(req.tagName, matchedTermSet, iconKeywords);
  if (gap.length > 0) {
    lowSignals.push(`semantic gap in tag name (${gap.join(', ')})`);
  }

  if (lowSignals.length === 0) {
    return {
      confidence: 'high',
      fallbackToAi: false,
      matchedTerms: match.matchedTerms,
      reasonSuffix: '',
    };
  }

  return {
    confidence: 'low',
    fallbackToAi: true,
    matchedTerms: match.matchedTerms,
    unmatchedTerms: Array.from(new Set([...unmatched, ...gap])),
    reasonSuffix: ` Low confidence (${lowSignals.join('; ')}); including AI fallback.`,
  };
}

function highTextClassification(
  text: string,
  reason: string,
): Classification {
  return {
    isComplex: false,
    mode: 'text',
    text,
    confidence: 'high',
    reason,
  };
}

/**
 * Classify a tag request as simple (builder) or complex (LLM SVG).
 *
 * Order: explicit short text -> library icon match -> letters intent -> complex.
 * When an icon hint is present, only the hint and tag name are used for icon
 * matching so studio names in the description cannot misroute the request.
 */
export function classify(req: TagRequest, registry: IconDef[]): Classification {
  const { priority, full } = buildMatchHaystacks(req);
  const hay = req.iconHint?.trim() ? priority : full;

  const quoted = hay.match(/["'\u2018\u2019\u201c\u201d]\s*([A-Za-z0-9.]{1,3})\s*["'\u2018\u2019\u201c\u201d]/);
  if (quoted) {
    const text = normalizeTextToken(quoted[1]);
    if (text) {
      return highTextClassification(text, `Quoted short text "${text}".`);
    }
  }

  if (/^[A-Z0-9.]{1,3}$/.test(req.tagName.trim())) {
    const text = normalizeTextToken(req.tagName);
    if (text) {
      return highTextClassification(
        text,
        `Tag name is a ${text.length}-char initialism.`,
      );
    }
  }

  const picked = pickIconMatch(req, registry);
  if (picked) {
    const runnerUp = picked.ranked[1] ?? null;
    const assessment = assessIconConfidence(req, picked.match, runnerUp, picked.source);
    return {
      isComplex: false,
      mode: 'icon',
      iconId: picked.match.icon.id,
      iconLabel: picked.match.icon.label,
      confidence: assessment.confidence,
      fallbackToAi: assessment.fallbackToAi,
      matchedTerms: assessment.matchedTerms,
      unmatchedTerms: assessment.unmatchedTerms,
      reason: `Matched library icon "${picked.match.icon.id}".${assessment.reasonSuffix}`,
    };
  }

  if (LETTERS_INTENT.test(hay)) {
    const tok = req.description.match(/\b([A-Za-z0-9.]{1,3})\b/);
    if (tok) {
      const text = normalizeTextToken(tok[1]);
      if (text) {
        return highTextClassification(
          text,
          `Letters/initials requested ("${text}").`,
        );
      }
    }
    const fuzzy = normalizeTextToken(req.tagName.slice(0, 3));
    if (fuzzy) {
      return {
        isComplex: false,
        mode: 'text',
        text: fuzzy,
        confidence: 'low',
        fallbackToAi: true,
        reason: `Letters intent with inferred text "${fuzzy}" (low confidence).`,
      };
    }
  }

  return {
    isComplex: true,
    mode: 'icon',
    confidence: 'high',
    reason: 'No library icon or short text match — custom icon required.',
  };
}
