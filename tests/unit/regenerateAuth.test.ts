import { afterEach, describe, it, expect } from 'vitest';
import {
  assertRegenerateAuthorized,
  getAllowedRegenerateAccountIds,
  RegenerateAuthError,
} from '../../server/config';

const ENV_KEYS = [
  'JIRA_ALLOWED_REGENERATE_ACCOUNT_IDS',
  'JIRA_REVIEW_ACCOUNT_ID',
  'JIRA_ADDITIONAL_REVIEW_MENTIONS',
  'JIRA_ASSIGNEE_ACCOUNT_ID',
] as const;

describe('regenerate authorization', () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  it('uses explicit allowlist when configured', () => {
    process.env.JIRA_ALLOWED_REGENERATE_ACCOUNT_IDS = 'acct-a, acct-b';
    expect(getAllowedRegenerateAccountIds()).toEqual(['acct-a', 'acct-b']);
    expect(() => assertRegenerateAuthorized('acct-a')).not.toThrow();
    expect(() => assertRegenerateAuthorized('acct-x')).toThrow(RegenerateAuthError);
  });

  it('falls back to review and assignee ids', () => {
    process.env.JIRA_REVIEW_ACCOUNT_ID = 'reviewer-1';
    process.env.JIRA_ASSIGNEE_ACCOUNT_ID = 'assignee-1';
    process.env.JIRA_ADDITIONAL_REVIEW_MENTIONS = 'designer-2:@Designer Two';
    expect(getAllowedRegenerateAccountIds().sort()).toEqual(
      ['assignee-1', 'designer-2', 'reviewer-1'].sort(),
    );
  });
});
