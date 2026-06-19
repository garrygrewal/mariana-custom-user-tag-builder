import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  assertRegenerateAuthorized,
  getWebhookSecret,
  RegenerateAuthError,
} from '../server/config.js';
import { extractIssueKey, extractRegenerateRequest } from '../server/webhookPayload.js';
import { processTicket } from '../server/processTicket.js';

/**
 * Webhook endpoint hit by Jira Automation when a UTR ticket is created or when
 * a designer comments `/regenerate-tag` on an existing ticket. Verifies the
 * shared secret, resolves the issue key from the payload, and runs generation ->
 * attach -> draft comment.
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

  const regenerate = extractRegenerateRequest(req.body);
  if (regenerate.triggered) {
    if (regenerate.notes === undefined) {
      res.status(400).json({
        ok: false,
        issueKey,
        error: 'Comment must start with /regenerate-tag',
      });
      return;
    }

    try {
      assertRegenerateAuthorized(regenerate.commentAuthorId);
    } catch (error) {
      if (error instanceof RegenerateAuthError) {
        res.status(403).json({ ok: false, issueKey, error: error.message });
        return;
      }
      throw error;
    }
  }

  try {
    const result = await processTicket(issueKey, {
      revisionNotes: regenerate.triggered ? regenerate.notes : undefined,
    });
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ ok: false, issueKey, error: message });
  }
}
