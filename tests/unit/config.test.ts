import { describe, expect, it } from 'vitest';
import { parseReviewMentionsEnv, pickRandomReviewMention } from '../../server/config.js';

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

describe('pickRandomReviewMention', () => {
  const pool = [
    { accountId: 'a', text: '@One' },
    { accountId: 'b', text: '@Two' },
    { accountId: 'c', text: '@Three' },
  ];

  it('returns undefined for an empty pool', () => {
    expect(pickRandomReviewMention([])).toBeUndefined();
  });

  it('returns the only member when the pool has one entry', () => {
    expect(pickRandomReviewMention([pool[0]])).toEqual(pool[0]);
  });

  it('selects by index from the random function', () => {
    expect(pickRandomReviewMention(pool, () => 0)).toEqual(pool[0]);
    expect(pickRandomReviewMention(pool, () => 0.99)).toEqual(pool[2]);
    expect(pickRandomReviewMention(pool, () => 0.5)).toEqual(pool[1]);
  });
});
