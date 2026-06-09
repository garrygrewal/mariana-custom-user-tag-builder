const ISSUE_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;

function isIssueKey(value: unknown): value is string {
  return typeof value === 'string' && ISSUE_KEY_RE.test(value.trim());
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
