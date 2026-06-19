import { describe, expect, it } from 'vitest';
import { parseReviewMentionsEnv } from '../../server/config.js';

describe('parseReviewMentionsEnv', () => {
  it('parses legacy account ids with @ display names', () => {
    expect(parseReviewMentionsEnv('62e93effd49df231b6275f47:@Mackenzie Knight')).toEqual([
      { accountId: '62e93effd49df231b6275f47', text: '@Mackenzie Knight' },
    ]);
  });

  it('parses colon-style account ids with @ display names', () => {
    expect(
      parseReviewMentionsEnv(
        '712020:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:@Kendall Jackson',
      ),
    ).toEqual([
      {
        accountId: '712020:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        text: '@Kendall Jackson',
      },
    ]);
  });

  it('parses multiple comma-separated mentions', () => {
    expect(
      parseReviewMentionsEnv(
        '62e93effd49df231b6275f47:@Mackenzie Knight,712020:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:@Kendall Jackson',
      ),
    ).toEqual([
      { accountId: '62e93effd49df231b6275f47', text: '@Mackenzie Knight' },
      {
        accountId: '712020:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        text: '@Kendall Jackson',
      },
    ]);
  });

  it('supports legacy display names without a leading @', () => {
    expect(parseReviewMentionsEnv('62e93effd49df231b6275f47:Mackenzie Knight')).toEqual([
      { accountId: '62e93effd49df231b6275f47', text: '@Mackenzie Knight' },
    ]);
  });

  it('treats colon-style account ids without display text as account-only', () => {
    expect(
      parseReviewMentionsEnv('712020:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
    ).toEqual([
      {
        accountId: '712020:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        text: '@reviewer',
      },
    ]);
  });
});
