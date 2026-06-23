const ISSUE_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;

/** Slash-command prefix designers use on a Jira comment to request regeneration. */
export const REGENERATE_TAG_COMMAND = '/regenerate-tag';

function isIssueKey(value: unknown): value is string {
  return typeof value === 'string' && ISSUE_KEY_RE.test(value.trim());
}

function issueKeyFromUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const match = value.match(/\/(?:issue|browse)\/([A-Z][A-Z0-9]+-\d+)(?:[\/?#]|$)/);
  return match?.[1] ?? null;
}

function normalizeBody(body: unknown): unknown {
  if (body == null) return body;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) {
    const text = body.toString('utf8').trim();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return body;
}

/**
 * Parse `/regenerate-tag` and any trailing designer notes from a comment body.
 * Returns null when the command is absent. An empty string after the command is
 * valid (re-run from current ticket fields only).
 */
export function parseRegenerateCommand(text: string): string | null {
  const trimmed = text.trim();
  if (!new RegExp(`^${REGENERATE_TAG_COMMAND}\\b`, 'i').test(trimmed)) {
    return null;
  }
  const match = trimmed.match(new RegExp(`^${REGENERATE_TAG_COMMAND}\\b\\s*([\\s\\S]*)$`, 'i'));
  if (!match) return null;
  return (match[1] ?? '').trim();
}

export interface RegenerateRequest {
  /** True when the payload includes a comment body to parse for regeneration. */
  triggered: boolean;
  /** Designer notes after `/regenerate-tag`, or empty when omitted. */
  notes?: string;
  /** Atlassian accountId of the comment author (required when triggered). */
  commentAuthorId?: string;
}

function readStringField(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * Extract a Jira issue key from a variety of webhook payload shapes.
 *
 * Supports Jira Automation "Send web request" bodies (`{ issue: { key } }`),
 * raw `{ issueKey }`/`{ key }`, nested `{ data: { issue: { key } } }`, and a
 * bare string body. Returns null when no valid key is found.
 */
export function extractIssueKey(body: unknown): string | null {
  const normalized = normalizeBody(body);
  if (normalized == null) return null;

  if (typeof normalized === 'string') {
    const trimmed = normalized.trim();
    if (isIssueKey(trimmed)) return trimmed;
    const fromUrl = issueKeyFromUrl(trimmed);
    if (fromUrl) return fromUrl;
    try {
      return extractIssueKey(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }

  if (typeof normalized !== 'object') return null;
  const obj = normalized as Record<string, unknown>;

  const candidates: unknown[] = [
    obj.issueKey,
    obj.jiraKey,
    obj.jira_key,
    obj.key,
    (obj.issue as { key?: unknown } | undefined)?.key,
    (obj.workItem as { key?: unknown } | undefined)?.key,
    ((obj.data as { issue?: { key?: unknown } } | undefined)?.issue)?.key,
    issueKeyFromUrl(obj.self),
    issueKeyFromUrl(
      typeof obj.issue === 'object' && obj.issue != null
        ? (obj.issue as { self?: unknown }).self
        : undefined,
    ),
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && /\{\{[^}]+\}\}/.test(candidate)) {
      return null;
    }
    if (isIssueKey(candidate)) return candidate.trim();
  }
  return null;
}

/** True when the payload still contains Jira smart-value placeholders. */
export function hasUnsubstitutedSmartValues(body: unknown): boolean {
  const normalized = normalizeBody(body);
  if (normalized == null) return false;
  const text =
    typeof normalized === 'string' ? normalized : JSON.stringify(normalized);
  return /\{\{[^}]+\}\}/.test(text);
}

function readQueryValue(
  query: Record<string, string | string[] | undefined> | undefined,
  ...names: string[]
): string | undefined {
  if (!query) return undefined;
  for (const name of names) {
    const value = query[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
      return value[0].trim();
    }
  }
  return undefined;
}

/**
 * Read a Jira issue key from webhook query params (`?key=`, `?issueKey=`, `?issue=`).
 * Jira Automation can set these via smart values on the Send web request URL.
 */
export function extractIssueKeyFromQuery(
  query: Record<string, string | string[] | undefined> | undefined,
): string | null {
  const raw = readQueryValue(query, 'key', 'issueKey', 'issue');
  if (!raw) return null;
  if (/\{\{[^}]+\}\}/.test(raw)) return null;
  return extractIssueKey(raw);
}

/**
 * Resolve the issue key from the POST body, then from URL query params.
 * Supports the belt-and-suspenders Jira setup: JSON body plus `?key={{issue.key}}`.
 */
export function resolveIssueKey(
  body: unknown,
  query: Record<string, string | string[] | undefined> | undefined,
): string | null {
  return extractIssueKey(body) ?? extractIssueKeyFromQuery(query);
}

/** True when body or query still contains unsubstituted `{{...}}` smart values. */
export function hasUnsubstitutedSmartValuesInRequest(
  body: unknown,
  query: Record<string, string | string[] | undefined> | undefined,
): boolean {
  if (hasUnsubstitutedSmartValues(body)) return true;
  const raw = readQueryValue(query, 'key', 'issueKey', 'issue');
  return raw != null && /\{\{[^}]+\}\}/.test(raw);
}

/**
 * Detect a designer regeneration request from a Jira Automation webhook body.
 *
 * Expects `revisionNotes` (comment body as text) and `commentAuthorId` when
 * fired from a comment-added rule. Returns `triggered: false` for the initial
 * issue-created rule that only sends `{ issue: { key } }`.
 */
export function extractRegenerateRequest(body: unknown): RegenerateRequest {
  if (body == null || typeof body !== 'object') {
    return { triggered: false };
  }

  const obj = body as Record<string, unknown>;
  const comment = obj.comment as { body?: unknown; author?: { accountId?: unknown } } | undefined;
  const rawNotes =
    readStringField(obj, 'revisionNotes', 'commentBody', 'comment') ??
    (typeof comment?.body === 'string' ? comment.body.trim() : undefined);

  if (rawNotes == null) {
    return { triggered: false };
  }

  const commentAuthorId =
    readStringField(obj, 'commentAuthorId', 'authorAccountId') ??
    (typeof comment?.author?.accountId === 'string'
      ? comment.author.accountId.trim()
      : undefined);

  const notes = parseRegenerateCommand(rawNotes);
  return { triggered: true, notes: notes ?? undefined, commentAuthorId };
}
