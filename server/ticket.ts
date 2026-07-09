import { extractColor, sanitizeBgHex, splitColorSpecs } from './colors.js';
import { resolveExplicitIconId } from './iconIntent.js';
import { loadIconRegistry } from './icons.node.js';

/** Per-tag spec when a ticket requests multiple distinct icons/tags. */
export interface TagVariant {
  /** Human label for comments and filenames (e.g. "Good ombres"). */
  label: string;
  /** Icon/visual brief for this tag only. */
  iconHint?: string;
  /** Background color for this tag. */
  bgHex: string;
  /** True when the color was explicitly stated for this tag. */
  colorMatched: boolean;
}

/** Normalized representation of a custom user tag request from a Jira issue. */
export interface TagRequest {
  issueKey: string;
  /** Human label / tag name (used for filenames and the comment). */
  tagName: string;
  /** Requested background color as #RRGGBB. */
  bgHex: string;
  /** True when the color was explicitly stated on the ticket. */
  colorMatched: boolean;
  /** Number of tags requested (1-5 per the order form). */
  count: number;
  /** Free-text brief describing the desired tag. */
  description: string;
  /** Requested icon / visual hint from the ticket (e.g. "Lululemon logo"). */
  iconHint?: string;
  /** When set, force this registered library icon id. */
  explicitIconId?: string;
  /** When count > 1, per-tag icon/color specs parsed from the form fields. */
  variants?: TagVariant[];
  dueDate?: string;
  /** Designer revision notes from a `/regenerate-tag` comment (not on the ticket). */
  revisionNotes?: string;
}

/** Minimal shape of the Jira issue JSON we rely on. */
export interface JiraIssue {
  key: string;
  fields?: Record<string, unknown> & {
    summary?: string;
    description?: unknown;
    duedate?: string | null;
  };
}

/** Optional env-configured custom field IDs (e.g. "customfield_10050"). */
export interface FieldMap {
  tagName?: string;
  color?: string;
  count?: string;
  description?: string;
  icon?: string;
}

/** Flatten Atlassian Document Format (ADF) or plain string into text. */
export function adfToText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(adfToText).join('');

  const obj = node as { type?: string; text?: string; content?: unknown };
  let out = '';
  if (typeof obj.text === 'string') out += obj.text;
  if (obj.content) out += adfToText(obj.content);
  // Block-level nodes get a trailing newline for readable extraction.
  if (obj.type && /paragraph|heading|listItem|blockquote/.test(obj.type)) {
    out += '\n';
  }
  return out;
}

function fieldString(fields: Record<string, unknown>, id?: string): string {
  if (!id) return '';
  const value = fields[id];
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  // Custom select fields come back as { value: "..." }.
  if (typeof value === 'object' && 'value' in value) {
    const v = (value as { value?: unknown }).value;
    return typeof v === 'string' ? v : '';
  }
  return adfToText(value);
}

function extractCount(text: string): number {
  const m = text.match(
    /(?:number\s+of\s+(?:tags?|icons?)|total\s+(?:#?\s*of\s+)?(?:tags?|icons?)|tags?|icons?|quantity|qty|count)\D{0,12}?(\d+)/i,
  );
  const n = m ? Number(m[1]) : NaN;
  if (Number.isFinite(n) && n >= 1 && n <= 5) return n;
  return 1;
}

function parseCountField(value: string): number | null {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct >= 1 && direct <= 5) return direct;
  return extractCount(`count ${value}`);
}

interface SpecSegment {
  value: string;
  qualifier?: string;
}

interface ColorSpecSegment extends SpecSegment {
  hex: string;
  matched: boolean;
}

/** Split "A and B" style form values into separate specs. */
export function splitConjoinedSpecs(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/\band\b/i)
    .map((segment) => segment.trim().replace(/^[,;]\s*/, '').replace(/[,;]$/, ''))
    .filter(Boolean);
}

/** True when a segment is a short token (e.g. "16", "TP") suitable for list splitting. */
function isSimpleListItem(segment: string): boolean {
  const value = parseSpecSegment(segment).value.trim();
  return /^[A-Za-z0-9.]{1,3}$/.test(value);
}

/**
 * Split multi-tag form values on "and" and, when present, commas between short
 * tokens (e.g. "16, 17" or "16 and 17").
 */
export function splitListSpecs(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const andParts = splitConjoinedSpecs(trimmed);
  if (andParts.length > 1) return andParts;

  const single = andParts[0] ?? trimmed;
  if (!single.includes(',')) return andParts.length ? andParts : [trimmed];

  const commaParts = single
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (commaParts.length > 1 && commaParts.every(isSimpleListItem)) {
    return commaParts;
  }

  return andParts.length ? andParts : [trimmed];
}

/** Parse "smiling emoji for the good tag" into value + optional qualifier. */
export function parseSpecSegment(segment: string): SpecSegment {
  const forTag = segment.match(/^(.+?)\s+for\s+(?:the\s+)?(.+?)(?:\s+tag)?\.?$/i);
  if (forTag) {
    return { value: forTag[1].trim(), qualifier: forTag[2].trim().toLowerCase() };
  }
  return { value: segment.trim() };
}

function capitalizeWord(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function variantLabelFrom(
  qualifier: string | undefined,
  tagName: string,
  index: number,
  count: number,
  iconHint?: string,
): string {
  if (!qualifier && iconHint) {
    const token = iconHint.trim();
    if (/^[A-Za-z0-9.]{1,3}$/.test(token)) {
      return token.toUpperCase();
    }
  }

  if (qualifier) {
    const parts = splitConjoinedSpecs(tagName);
    if (parts.length === 2) {
      const left = parts[0].trim();
      const rightWords = parts[1].trim().split(/\s+/);
      const rightHead = rightWords[0] ?? '';
      const sharedSuffix = rightWords.slice(1).join(' ');

      if (left.toLowerCase().includes(qualifier) || qualifier.includes(left.toLowerCase())) {
        return capitalizeWord(sharedSuffix ? `${left} ${sharedSuffix}` : left);
      }
      if (
        rightHead.toLowerCase().includes(qualifier) ||
        qualifier.includes(rightHead.toLowerCase())
      ) {
        return capitalizeWord(sharedSuffix ? `${rightHead} ${sharedSuffix}` : parts[1].trim());
      }
    }

    if (parts.length >= count) {
      const match = parts.find(
        (part) =>
          part.toLowerCase().includes(qualifier) ||
          qualifier.includes(part.toLowerCase().split(/\s+/)[0] ?? ''),
      );
      if (match) return capitalizeWord(match.trim());
    }

    const base = tagName
      .replace(new RegExp(`\\b(and\\s+)?${qualifier}\\b`, 'gi'), '')
      .replace(/\band\b/gi, '')
      .trim();
    if (base) return `${capitalizeWord(qualifier)} ${base}`.replace(/\s+/g, ' ').trim();
    return capitalizeWord(qualifier);
  }
  return count > 1 ? `${tagName} (${index + 1})` : tagName;
}

const SHARED_NUMBER_CIRCLE_ICON =
  /\bnumbers?\s+in\s+(?:a\s+)?circles?\b/i;

/** Comma- or "and"-separated digit tokens (e.g. "1,2,3,4,5" or "16 and 17"). */
export function parseCommaSeparatedNumbers(text: string): string[] | null {
  const parts = splitListSpecs(text).map((segment) => parseSpecSegment(segment).value.trim());
  if (parts.length <= 1) return null;
  if (!parts.every((part) => /^\d{1,3}$/.test(part))) return null;
  return parts;
}

export function isSharedNumberCircleIconHint(iconField: string): boolean {
  return SHARED_NUMBER_CIRCLE_ICON.test(iconField.trim());
}

function resolveSpecSegment<T extends SpecSegment>(
  parts: T[],
  index: number,
  qualifier?: string,
): T | undefined {
  if (qualifier) {
    const byQualifier = parts.find(
      (part) =>
        part.qualifier &&
        (part.qualifier === qualifier ||
          part.qualifier.includes(qualifier) ||
          qualifier.includes(part.qualifier)),
    );
    if (byQualifier) return byQualifier;
  }
  if (parts[index]) return parts[index];
  if (parts.length === 1) return parts[0];
  return undefined;
}

/**
 * When count > 1, parse paired icon/color specs from the form fields.
 * Returns undefined when the fields describe a single shared spec (use design
 * variations instead).
 */
export function parseTagVariants(
  count: number,
  tagName: string,
  colorField: string,
  iconField: string,
  fallbackHex: string,
  fallbackColorMatched: boolean,
): TagVariant[] | undefined {
  if (count <= 1) return undefined;

  let iconParts = iconField ? splitListSpecs(iconField).map(parseSpecSegment) : [];
  const tagNumbers = parseCommaSeparatedNumbers(tagName);
  if (
    tagNumbers &&
    tagNumbers.length === count &&
    iconField &&
    isSharedNumberCircleIconHint(iconField) &&
    iconParts.length <= 1
  ) {
    iconParts = tagNumbers.map((value) => ({ value }));
  }

  const colorParts: ColorSpecSegment[] = colorField
    ? splitColorSpecs(colorField).map((segment) => {
        const { value, qualifier } = parseSpecSegment(segment);
        const color = extractColor(value);
        return {
          value,
          qualifier,
          hex: sanitizeBgHex(color.hex),
          matched: color.matched,
        };
      })
    : [];

  const multiIcon = iconParts.length > 1;
  const multiColor = colorParts.length > 1;
  if (!multiIcon && !multiColor) return undefined;

  const slots: {
    qualifier?: string;
    iconHint?: string;
    bgHex: string;
    colorMatched: boolean;
  }[] = [];

  if (iconParts.length >= count) {
    for (let i = 0; i < count; i++) {
      const icon = iconParts[i] ?? iconParts[0];
      const color = resolveSpecSegment(colorParts, i, icon.qualifier);
      slots.push({
        qualifier: icon.qualifier,
        iconHint: icon.value,
        bgHex: sanitizeBgHex(color?.hex ?? fallbackHex),
        colorMatched: color?.matched ?? fallbackColorMatched,
      });
    }
  } else if (colorParts.length >= count) {
    for (let i = 0; i < count; i++) {
      const color = colorParts[i] ?? colorParts[0];
      const icon = resolveSpecSegment(iconParts, i, color.qualifier);
      slots.push({
        qualifier: color.qualifier ?? icon?.qualifier,
        iconHint: icon?.value,
        bgHex: sanitizeBgHex(color.hex),
        colorMatched: color.matched,
      });
    }
  } else {
    for (let i = 0; i < count; i++) {
      const icon = iconParts[i];
      const color = colorParts[i];
      slots.push({
        qualifier: icon?.qualifier ?? color?.qualifier,
        iconHint: icon?.value,
        bgHex: sanitizeBgHex(color?.hex ?? fallbackHex),
        colorMatched: color?.matched ?? fallbackColorMatched,
      });
    }
  }

  return slots.map((slot, index) => ({
    label: variantLabelFrom(slot.qualifier, tagName, index, count, slot.iconHint),
    iconHint: slot.iconHint,
    bgHex: sanitizeBgHex(slot.bgHex),
    colorMatched: slot.colorMatched,
  }));
}

/**
 * Parse a Jira issue into a normalized TagRequest.
 *
 * Uses configured custom fields when provided, otherwise falls back to the
 * summary/description text. Color and count are extracted from text when not
 * available as discrete fields.
 */
export function parseTicket(issue: JiraIssue, fieldMap: FieldMap = {}): TagRequest {
  const fields = issue.fields ?? {};
  const summary = typeof fields.summary === 'string' ? fields.summary : '';
  const descriptionText = adfToText(fields.description).trim();

  const tagNameField = fieldString(fields, fieldMap.tagName).trim();
  const descField = fieldString(fields, fieldMap.description).trim();
  const colorField = fieldString(fields, fieldMap.color).trim();
  const countField = fieldString(fields, fieldMap.count).trim();
  const iconField = fieldString(fields, fieldMap.icon).trim();

  const description = descField || descriptionText || summary;
  const searchText = [tagNameField, summary, description, colorField, iconField].join('\n');

  const color = colorField
    ? extractColor(colorField)
    : extractColor(searchText);

  const count = countField ? parseCountField(countField) ?? extractCount(searchText) : extractCount(searchText);

  const tagName = (tagNameField || summary || 'Custom Tag').trim();
  const variants = parseTagVariants(
    count,
    tagName,
    colorField,
    iconField,
    color.hex,
    color.matched,
  );

  const iconHint = iconField || undefined;
  const registry = loadIconRegistry();
  const explicitIconId =
    (iconHint ? resolveExplicitIconId(iconHint, registry) : null) ??
    resolveExplicitIconId(searchText, registry) ??
    undefined;

  return {
    issueKey: issue.key,
    tagName,
    bgHex: sanitizeBgHex(color.hex),
    colorMatched: color.matched,
    count,
    description,
    iconHint,
    explicitIconId,
    variants,
    dueDate: typeof fields.duedate === 'string' ? fields.duedate : undefined,
  };
}

/**
 * Merge designer revision notes into a parsed request. Color names, hex values,
 * shade modifiers, and explicit icon ids in the notes override the ticket.
 */
export function applyRevisionNotes(req: TagRequest, revisionNotes: string): TagRequest {
  const trimmed = revisionNotes.trim();
  if (!trimmed) {
    return { ...req, revisionNotes: '' };
  }

  const updated: TagRequest = { ...req, revisionNotes: trimmed };
  const registry = loadIconRegistry();
  const explicitIconId = resolveExplicitIconId(trimmed, registry);
  if (explicitIconId) {
    updated.explicitIconId = explicitIconId;
  }

  const color = extractColor(trimmed);
  if (color.matched) {
    updated.bgHex = sanitizeBgHex(color.hex);
    updated.colorMatched = true;
    if (updated.variants?.length) {
      updated.variants = updated.variants.map((variant) => ({
        ...variant,
        bgHex: sanitizeBgHex(color.hex),
        colorMatched: true,
      }));
    }
  }

  return updated;
}
