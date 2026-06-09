import { extractColor } from './colors';

/** Normalized representation of a custom user tag request from a Jira issue. */
export interface TagRequest {
  issueKey: string;
  /** Human label / tag name (used for filenames and the comment). */
  tagName: string;
  /** Requested background color as #RRGGBB. */
  bgHex: string;
  /** True when the color was explicitly stated on the ticket. */
  colorMatched: boolean;
  /** Number of tags requested (1-4 per the order form). */
  count: number;
  /** Free-text brief describing the desired tag. */
  description: string;
  dueDate?: string;
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
  const m = text.match(/(?:number\s+of\s+tags|tags?|quantity|qty|count)\D{0,12}?(\d+)/i);
  const n = m ? Number(m[1]) : NaN;
  if (Number.isFinite(n) && n >= 1 && n <= 4) return n;
  return 1;
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

  const description = descField || descriptionText || summary;
  const searchText = [tagNameField, summary, description, colorField].join('\n');

  const color = colorField
    ? extractColor(colorField)
    : extractColor(searchText);

  const count = countField
    ? extractCount(`count ${countField}`)
    : extractCount(searchText);

  const tagName = (tagNameField || summary || 'Custom Tag').trim();

  return {
    issueKey: issue.key,
    tagName,
    bgHex: color.hex,
    colorMatched: color.matched,
    count,
    description,
    dueDate: typeof fields.duedate === 'string' ? fields.duedate : undefined,
  };
}
