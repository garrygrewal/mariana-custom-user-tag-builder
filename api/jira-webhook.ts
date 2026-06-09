import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getWebhookSecret } from '../server/config';
import { extractIssueKey } from '../server/webhookPayload';
import { processTicket } from '../server/processTicket';

/**
 * Webhook endpoint hit by the Jira Automation rule when a UTR ticket is
 * created. Verifies the shared secret, resolves the issue key from the
 * payload, and runs generation -> attach -> draft comment.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const secret = getWebhookSecret();
  if (secret) {
    const provided =
      (req.headers['x-webhook-secret'] as string | undefined) ??
      (typeof req.query.secret === 'string' ? req.query.secret : undefined);
    if (provided !== secret) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }
  }

  const issueKey =
    extractIssueKey(req.body) ??
    (typeof req.query.key === 'string' ? extractIssueKey(req.query.key) : null);

  if (!issueKey) {
    res.status(400).json({ ok: false, error: 'Could not resolve a Jira issue key' });
    return;
  }

  try {
    const result = await processTicket(issueKey);
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ ok: false, issueKey, error: message });
  }
}
