import type { FieldMap } from './ticket.js';

export interface ReviewMention {
  accountId: string;
  text: string;
}

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  fieldMap: FieldMap;
  /** Optional transition id to move the ticket after design review is posted. */
  transitionId?: string;
  /**
   * Target status name when moving the ticket for design review (default: In Progress/Review).
   * Resolved via available transitions. Set to empty string to disable.
   */
  transitionStatus?: string;
  /** Optional project role name to restrict the draft comment's visibility. */
  commentVisibilityRole?: string;
  /** Atlassian accountIds to @mention in the design-review comment. */
  reviewMentions?: ReviewMention[];
  /** Atlassian accountId to assign the ticket to after posting the review comment. */
  assigneeAccountId?: string;
}

/** Atlassian accountId: 24-char hex or `siteId:uuid` (uuid may contain colons in the id segment). */
const ATLASSIAN_ACCOUNT_ID =
  /^(?:[a-f0-9]{24}|\d+:[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12})$/i;

/** Parse `accountId:@Display Name` entries from a comma-separated env value. */
export function parseReviewMentionsEnv(value: string | undefined): ReviewMention[] {
  if (!value?.trim()) return [];
  return value.split(',').flatMap((entry) => {
    const trimmed = entry.trim();
    if (!trimmed) return [];

    const displayDelimiter = trimmed.indexOf(':@');
    if (displayDelimiter !== -1) {
      const accountId = trimmed.slice(0, displayDelimiter).trim();
      const text = trimmed.slice(displayDelimiter + 1).trim();
      if (!accountId) return [];
      return [{ accountId, text: text || '@reviewer' }];
    }

    if (ATLASSIAN_ACCOUNT_ID.test(trimmed)) {
      return [{ accountId: trimmed, text: '@reviewer' }];
    }

    const colon = trimmed.indexOf(':');
    if (colon === -1) return [{ accountId: trimmed, text: '@reviewer' }];

    const accountId = trimmed.slice(0, colon).trim();
    const rawText = trimmed.slice(colon + 1).trim();
    if (!accountId) return [];
    const text = rawText
      ? rawText.startsWith('@')
        ? rawText
        : `@${rawText}`
      : '@reviewer';
    return [{ accountId, text }];
  });
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

/** Read Jira configuration from the environment. Throws if required vars are absent. */
export function getJiraConfig(): JiraConfig {
  const baseUrl = required('JIRA_BASE_URL').replace(/\/+$/, '');
  return {
    baseUrl,
    email: required('JIRA_EMAIL'),
    apiToken: required('JIRA_API_TOKEN'),
    transitionId: process.env.JIRA_TRANSITION_ID || undefined,
    transitionStatus:
      process.env.JIRA_TRANSITION_STATUS === ''
        ? undefined
        : (process.env.JIRA_TRANSITION_STATUS ?? 'In Progress/Review'),
    commentVisibilityRole: process.env.JIRA_COMMENT_VISIBILITY_ROLE || undefined,
    reviewMentions: buildReviewMentions(),
    assigneeAccountId:
      process.env.JIRA_ASSIGNEE_ACCOUNT_ID?.trim() ||
      process.env.JIRA_REVIEW_ACCOUNT_ID?.trim() ||
      undefined,
    fieldMap: {
      tagName: process.env.JIRA_FIELD_TAG_NAME || undefined,
      color: process.env.JIRA_FIELD_COLOR || undefined,
      count: process.env.JIRA_FIELD_COUNT || undefined,
      description: process.env.JIRA_FIELD_DESCRIPTION || undefined,
      icon: process.env.JIRA_FIELD_ICON || undefined,
    },
  };
}

function buildReviewMentions(): ReviewMention[] | undefined {
  const mentions: ReviewMention[] = [];

  const primaryAccountId = process.env.JIRA_REVIEW_ACCOUNT_ID?.trim();
  if (primaryAccountId) {
    mentions.push({
      accountId: primaryAccountId,
      text: process.env.JIRA_REVIEW_MENTION_TEXT?.trim() || '@reviewer',
    });
  }

  mentions.push(...parseReviewMentionsEnv(process.env.JIRA_ADDITIONAL_REVIEW_MENTIONS));

  return mentions.length > 0 ? mentions : undefined;
}

/** Pick one designer at random from the configured review-mention pool. */
export function pickRandomReviewMention(
  mentions: ReviewMention[],
  random: () => number = Math.random,
): ReviewMention | undefined {
  if (mentions.length === 0) return undefined;
  const index = Math.floor(random() * mentions.length);
  return mentions[index];
}

/** Shared secret used to authenticate inbound webhook calls. */
export function getWebhookSecret(): string | undefined {
  return process.env.WEBHOOK_SECRET || undefined;
}

export class RegenerateAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegenerateAuthError';
  }
}

/**
 * Account ids allowed to trigger `/regenerate-tag` regeneration.
 * Falls back to review/assignee ids when `JIRA_ALLOWED_REGENERATE_ACCOUNT_IDS` is unset.
 */
export function getAllowedRegenerateAccountIds(): string[] {
  const explicit = process.env.JIRA_ALLOWED_REGENERATE_ACCOUNT_IDS?.trim();
  if (explicit) {
    return explicit
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  const ids = new Set<string>();
  const reviewAccountId = process.env.JIRA_REVIEW_ACCOUNT_ID?.trim();
  if (reviewAccountId) ids.add(reviewAccountId);
  for (const mention of parseReviewMentionsEnv(process.env.JIRA_ADDITIONAL_REVIEW_MENTIONS)) {
    ids.add(mention.accountId);
  }
  const assigneeAccountId = process.env.JIRA_ASSIGNEE_ACCOUNT_ID?.trim();
  if (assigneeAccountId) ids.add(assigneeAccountId);
  return [...ids];
}

/** Reject regeneration when the comment author is not on the allowlist. */
export function assertRegenerateAuthorized(commentAuthorId: string | undefined): void {
  const allowed = getAllowedRegenerateAccountIds();
  if (allowed.length === 0) {
    throw new RegenerateAuthError(
      'Regeneration is not configured. Set JIRA_ALLOWED_REGENERATE_ACCOUNT_IDS or JIRA_REVIEW_ACCOUNT_ID.',
    );
  }
  if (!commentAuthorId || !allowed.includes(commentAuthorId)) {
    throw new RegenerateAuthError('Comment author is not allowed to regenerate user tags.');
  }
}
