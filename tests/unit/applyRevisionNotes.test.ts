import { describe, it, expect } from 'vitest';
import { applyRevisionNotes, type TagRequest } from '../../server/ticket';

const baseReq: TagRequest = {
  issueKey: 'UTR-1',
  tagName: 'VIP',
  bgHex: '#6923F4',
  colorMatched: false,
  count: 1,
  description: 'VIP member tag',
};

describe('applyRevisionNotes', () => {
  it('stores revision notes on the request', () => {
    const updated = applyRevisionNotes(baseReq, 'simpler icon');
    expect(updated.revisionNotes).toBe('simpler icon');
  });

  it('overrides the background color when notes include a color name', () => {
    const updated = applyRevisionNotes(baseReq, 'use darker green');
    expect(updated.bgHex).toBe('#3DAE2B');
    expect(updated.colorMatched).toBe(true);
  });

  it('does not override color for multi-tag requests', () => {
    const multi: TagRequest = {
      ...baseReq,
      count: 2,
      variants: [
        { label: 'Good', bgHex: '#3DAE2B', colorMatched: true },
        { label: 'Bad', bgHex: '#E1251B', colorMatched: true },
      ],
    };
    const updated = applyRevisionNotes(multi, 'use navy');
    expect(updated.bgHex).toBe('#6923F4');
    expect(updated.revisionNotes).toBe('use navy');
  });
});
