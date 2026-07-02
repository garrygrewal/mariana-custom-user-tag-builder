import type { IconDef } from '../src/types.js';
import { TEXT_MAX_LENGTH } from '../src/constants.js';
import { isNucleoIconId } from './nucleoIcons.node.js';
import { iconMatchText } from './iconIntent.js';
import type { TagRequest } from './ticket.js';

export type Confidence = 'high' | 'low';

export type IconMatchSource = 'priority' | 'description';

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
  'nucleo-face-smile': ['smile', 'smiling', 'happy', 'emoji'],
  'nucleo-face-sad': ['sad', 'unhappy', 'emoji'],
  'nucleo-face-sad-crying': ['crying', 'cry', 'upset', 'emoji'],
  'nucleo-face-smile-wink': ['wink', 'winking', 'emoji'],
  'nucleo-face-angry': ['angry', 'mad', 'furious', 'upset'],
  'nucleo-face-surprised': ['surprised', 'surprise', 'shock', 'shocked', 'wow'],
  'nucleo-face-laughing': ['laughing', 'laugh', 'lol', 'haha'],
  'nucleo-face-kiss': ['kiss', 'romance'],
  'nucleo-face-tired': ['tired', 'exhausted', 'burnout'],
  'nucleo-face-mask': ['mask', 'covid', 'sick'],
  'nucleo-thumbs-up': ['thumbs', 'up', 'like', 'approve', 'positive', 'thumbs-up'],
  'nucleo-thumbs-down': ['down', 'dislike', 'negative', 'thumbs-down'],
  'nucleo-clapping-hands': ['clapping', 'clap', 'applause', 'celebrate'],
  'nucleo-hands-praying': ['praying', 'gratitude', 'namaste', 'thanks'],
  'nucleo-cake': ['birthday', 'bday', 'celebration', 'cake'],
  'nucleo-skull': ['skull', 'danger', 'toxic'],
  'nucleo-party': ['party', 'celebrate', 'celebration'],
  'nucleo-high-five': ['high-five', 'highfive'],
  'nucleo-crown': ['vip', 'premium', 'elite', 'exclusive', 'crown'],
  'nucleo-new': ['new', 'rookie', 'newcomer'],
  'nucleo-user-plus': ['signup', 'join', 'new-member'],
  'nucleo-mat': ['pilates', 'mat', 'reformer'],
  'nucleo-punching-bag': ['kickboxing', 'kickbox', 'martial'],
  'nucleo-exercise-bike': ['spin', 'spinning', 'cycle'],
  'nucleo-surfboard': ['surf', 'surfing'],
  'nucleo-dog': ['dog', 'pet', 'puppy', 'canine'],
  'nucleo-paw': ['pet', 'paw', 'animal'],
  'nucleo-accessibility': ['accessible', 'a11y', 'ada'],
  'nucleo-heart': ['heart', 'love', 'valentine'],
  'nucleo-pregnant-woman': ['pregnant', 'pregnancy', 'expecting', 'maternity'],
  'nucleo-users-shaking-hands': ['referral', 'friend', 'invite'],
  'nucleo-discount-2': ['promo', 'promotion', 'sale'],
  'nucleo-sun': ['sun', 'sunny', 'hot'],
  'nucleo-cloud-showers': ['rain', 'rainy', 'weather'],
  'nucleo-ambulance': ['ambulance', 'ems'],
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

/** Id segments too ambiguous to use as generic keyword hits (e.g. pregnancy-"test"). */
const ICON_ID_STOP_WORDS = new Set(['test', 'nucleo']);

function normalizeTextToken(token: string): string | null {
  const cleaned = token.toUpperCase().replace(/[^A-Z0-9.]/g, '');
  if (!cleaned || cleaned.length > TEXT_MAX_LENGTH) return null;
  return cleaned;
}

function tokenize(text: string): Set<string> {
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return new Set(tokens);
}

/** Expand hint tokens with simple stems so "smiling" can match icon id "smile". */
function expandMatchTokens(tokens: Set<string>): Set<string> {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    if (token.endsWith('ing') && token.length >= 5) {
      const stem = token.slice(0, -3);
      if (stem.length >= 3) expanded.add(stem);
      expanded.add(`${stem}e`);
    }
    if (token.endsWith('ed') && token.length >= 5) {
      const stem = token.slice(0, -2);
      if (stem.length >= 3) expanded.add(stem);
      expanded.add(`${stem}e`);
    }
  }
  return expanded;
}

function matchTokens(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const tokens = expandMatchTokens(new Set(words));
  for (let i = 0; i < words.length - 1; i++) {
    tokens.add(`${words[i]}-${words[i + 1]}`);
  }
  return tokens;
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
    .filter((k) => /^[a-z0-9-]{3,}$/.test(k));
  const generic = [...fromId, ...fromLabel]
    .map((k) => k.trim())
    .filter((k) => /^[a-z]{4,}$/.test(k) && !ICON_ID_STOP_WORDS.has(k));
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
  const tokens = matchTokens(text);

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
      match.matchedTerms.some((term) => expandMatchTokens(branch).has(term)),
    );
  }

  const hintTokens = matchTokens(req.iconHint);
  return match.matchedTerms.some((term) => hintTokens.has(term));
}

/** Jira form fields and revision notes — weighted above the free-text description. */
function buildMatchHaystacks(req: TagRequest): { priority: string; description: string } {
  const revision = req.revisionNotes?.trim();
  const iconHint = req.iconHint ? iconMatchText(req.iconHint) : undefined;
  const cleanedRevision = revision ? iconMatchText(revision) : undefined;
  const cleanedDescription = iconMatchText(req.description);
  const cleanedTagName = iconMatchText(req.tagName);
  // Designer `/regenerate-tag` notes replace the original icon hint for matching.
  const priority = cleanedRevision
    ? [cleanedRevision, cleanedTagName].filter(Boolean).join('\n')
    : [iconHint, cleanedTagName, cleanedRevision].filter(Boolean).join('\n');
  return { priority, description: cleanedDescription };
}

function rankIconMatchInRegistry(
  hay: string,
  registry: IconDef[],
): { match: IconMatch; ranked: IconMatch[] } | null {
  const curated = registry.filter((icon) => !isNucleoIconId(icon.id));
  const nucleo = registry.filter((icon) => isNucleoIconId(icon.id));

  const curatedRanked = rankIconMatches(hay, curated);
  if (curatedRanked[0]) {
    return { match: curatedRanked[0], ranked: curatedRanked };
  }

  const nucleoRanked = rankIconMatches(hay, nucleo);
  if (!nucleoRanked[0]) return null;

  return { match: nucleoRanked[0], ranked: nucleoRanked };
}

/**
 * Match a library icon. Form fields (icon hint, tag name, revision) are tried
 * first; the free-text description is only consulted when they yield no match.
 */
function pickIconMatch(
  req: TagRequest,
  registry: IconDef[],
): { match: IconMatch; ranked: IconMatch[]; source: IconMatchSource } | null {
  const { priority, description } = buildMatchHaystacks(req);

  if (priority) {
    const fromFields = rankIconMatchInRegistry(priority, registry);
    if (fromFields) {
      return { ...fromFields, source: 'priority' };
    }
  }

  if (description) {
    const fromDescription = rankIconMatchInRegistry(description, registry);
    if (fromDescription) {
      return { ...fromDescription, source: 'description' };
    }
  }

  return null;
}

const LETTERS_AFTER_INTENT =
  /\b(?:letters?|initials?|text|abbreviation|monogram|acronym)\s+["'\u2018\u2019\u201c\u201d]?([A-Za-z0-9.]{1,3})["'\u2018\u2019\u201c\u201d]?\b/i;

const QUOTED_SHORT_TEXT =
  /["'\u2018\u2019\u201c\u201d]\s*([A-Za-z0-9.]{1,3})\s*["'\u2018\u2019\u201c\u201d]/;

interface ParsedLetters {
  text: string;
}

/** Parse an explicit 1-3 character letter request from a single text blob. */
function parseExplicitLetters(text: string): ParsedLetters | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const afterIntent = trimmed.match(LETTERS_AFTER_INTENT);
  if (afterIntent) {
    const normalized = normalizeTextToken(afterIntent[1]);
    return normalized ? { text: normalized } : null;
  }

  const quoted = trimmed.match(QUOTED_SHORT_TEXT);
  if (quoted) {
    const normalized = normalizeTextToken(quoted[1]);
    return normalized ? { text: normalized } : null;
  }

  return null;
}

interface LetterExtraction {
  text: string;
  source: string;
  confidence: Confidence;
}

/**
 * Extract requested letter content. Form fields are checked before the
 * description so studio names in the brief cannot override the ticket form.
 * When revision notes are present, only those notes and the tag name are
 * consulted so a `/regenerate-tag` icon change is not overridden by the
 * original "letters PRO" form value or description.
 */
function extractRequestedLetters(req: TagRequest): LetterExtraction | null {
  const ordered: [string, string][] = req.revisionNotes?.trim()
    ? [
        ['revision notes', req.revisionNotes],
        ['tag name', req.tagName],
      ]
    : [
        ['icon hint', req.iconHint ?? ''],
        ['tag name', req.tagName],
        ['revision notes', req.revisionNotes ?? ''],
        ['description', req.description],
      ];

  for (const [source, text] of ordered) {
    const parsed = parseExplicitLetters(text);
    if (parsed) {
      return { text: parsed.text, source, confidence: 'high' };
    }
  }

  const formHay = req.revisionNotes?.trim()
    ? [req.revisionNotes, req.tagName].filter(Boolean).join('\n')
    : [req.iconHint, req.tagName, req.revisionNotes].filter(Boolean).join('\n');
  const lettersHay = req.revisionNotes?.trim()
    ? formHay
    : `${formHay}\n${req.description}`;
  if (LETTERS_INTENT.test(lettersHay)) {
    const fuzzy = normalizeTextToken(req.tagName.slice(0, 3));
    if (fuzzy) {
      return {
        text: fuzzy,
        source: 'tag name',
        confidence: 'low',
      };
    }
  }

  return null;
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

  if (source === 'description') {
    lowSignals.push('matched from description only (form fields did not match)');
  }

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
 * Order: explicit icon id -> tag-name initialism -> letters from form fields ->
 * library icon match (form fields, then description) -> letters from description ->
 * complex.
 *
 * Jira form fields (tag name, icon hint) and revision notes outrank the free-text
 * description for both letter extraction and icon matching.
 */
export function classify(req: TagRequest, registry: IconDef[]): Classification {
  if (req.explicitIconId) {
    const icon = registry.find((entry) => entry.id === req.explicitIconId);
    if (icon) {
      return {
        isComplex: false,
        mode: 'icon',
        iconId: icon.id,
        iconLabel: icon.label,
        confidence: 'high',
        fallbackToAi: false,
        reason: `Designer specified library icon "${icon.id}".`,
      };
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

  const letters = extractRequestedLetters(req);
  if (letters && letters.confidence === 'high') {
    return highTextClassification(
      letters.text,
      `Letters/initials requested in ${letters.source} ("${letters.text}").`,
    );
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

  if (letters) {
    return {
      isComplex: false,
      mode: 'text',
      text: letters.text,
      confidence: 'low',
      fallbackToAi: true,
      reason: `Letters/initials requested in ${letters.source} ("${letters.text}") (low confidence).`,
    };
  }

  return {
    isComplex: true,
    mode: 'icon',
    confidence: 'high',
    reason: 'No library icon or short text match — custom icon required.',
  };
}
