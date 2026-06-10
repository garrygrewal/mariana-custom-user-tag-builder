import type { FieldMap } from './ticket.js';

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  fieldMap: FieldMap;
  /** Optional transition id to move the ticket after posting the draft. */
  transitionId?: string;
  /** Optional project role name to restrict the draft comment's visibility. */
  commentVisibilityRole?: string;
  /** Atlassian accountId to @mention in the design-review comment. */
  reviewAccountId?: string;
  /** Fallback display text for the mention (e.g. "@Garry Grewal"). */
  reviewMentionText?: string;
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
    commentVisibilityRole: process.env.JIRA_COMMENT_VISIBILITY_ROLE || undefined,
    reviewAccountId: process.env.JIRA_REVIEW_ACCOUNT_ID || undefined,
    reviewMentionText: process.env.JIRA_REVIEW_MENTION_TEXT || undefined,
    fieldMap: {
      tagName: process.env.JIRA_FIELD_TAG_NAME || undefined,
      color: process.env.JIRA_FIELD_COLOR || undefined,
      count: process.env.JIRA_FIELD_COUNT || undefined,
      description: process.env.JIRA_FIELD_DESCRIPTION || undefined,
      icon: process.env.JIRA_FIELD_ICON || undefined,
    },
  };
}

/** Shared secret used to authenticate inbound webhook calls. */
export function getWebhookSecret(): string | undefined {
  return process.env.WEBHOOK_SECRET || undefined;
}
