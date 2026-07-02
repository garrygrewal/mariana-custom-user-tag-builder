import { describe, it, expect } from 'vitest';
import { applyRevisionNotes, type TagRequest } from '../../server/ticket';
import { applyShadeModifier } from '../../server/colors';

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

  it('overrides the background color when notes include a shaded color name', () => {
    const updated = applyRevisionNotes(baseReq, 'use darker green');
    expect(updated.bgHex).toBe(applyShadeModifier('#3DAE2B', 'darker'));
    expect(updated.colorMatched).toBe(true);
  });

  it('forces an explicit icon id from revision notes', () => {
    const updated = applyRevisionNotes(
      baseReq,
      'use a lighter shade of pink (pastel pink), and use the user-long-hair icon',
    );
    expect(updated.explicitIconId).toBe('nucleo-user-long-hair');
    expect(updated.bgHex).toBe(applyShadeModifier('#EC4899', 'pastel'));
  });

  it('forces an explicit icon id from use-a-icon phrasing', () => {
    const updated = applyRevisionNotes(baseReq, 'use a snake icon instead');
    expect(updated.explicitIconId).toBe('nucleo-snake');
  });

  it('overrides color for multi-tag requests when notes include a color', () => {
    const multi: TagRequest = {
      ...baseReq,
      count: 2,
      variants: [
        { label: 'Good', bgHex: '#3DAE2B', colorMatched: true },
        { label: 'Bad', bgHex: '#E1251B', colorMatched: true },
      ],
    };
    const updated = applyRevisionNotes(multi, 'use navy');
    expect(updated.bgHex).toBe('#001F5B');
    expect(updated.variants?.every((variant) => variant.bgHex === '#001F5B')).toBe(true);
    expect(updated.revisionNotes).toBe('use navy');
  });
});
