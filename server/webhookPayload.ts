const ISSUE_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;

/** Slash-command prefix designers use on a Jira comment to request regeneration. */
export const REGENERATE_TAG_COMMAND = '/regenerate-tag';

function isIssueKey(value: unknown): value is string {
  return typeof value === 'string' && ISSUE_KEY_RE.test(value.trim());
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
  if (body == null) return null;

  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (isIssueKey(trimmed)) return trimmed;
    try {
      return extractIssueKey(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }

  if (typeof body !== 'object') return null;
  const obj = body as Record<string, unknown>;

  const candidates: unknown[] = [
    obj.issueKey,
    obj.key,
    (obj.issue as { key?: unknown } | undefined)?.key,
    ((obj.data as { issue?: { key?: unknown } } | undefined)?.issue)?.key,
  ];
  for (const candidate of candidates) {
    if (isIssueKey(candidate)) return candidate.trim();
  }
  return null;
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
