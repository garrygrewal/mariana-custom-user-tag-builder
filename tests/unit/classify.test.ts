import { describe, it, expect } from 'vitest';
import { classify } from '../../server/classify';
import { loadIconRegistry } from '../../server/icons.node';
import type { TagRequest } from '../../server/ticket';

const registry = loadIconRegistry();

function req(partial: Partial<TagRequest>): TagRequest {
  return {
    issueKey: 'UTR-1',
    tagName: '',
    bgHex: '#000000',
    colorMatched: true,
    count: 1,
    description: '',
    ...partial,
  };
}

describe('classify', () => {
  it('routes an initialism tag name to text mode', () => {
    const c = classify(req({ tagName: 'VIP' }), registry);
    expect(c.isComplex).toBe(false);
    expect(c.mode).toBe('text');
    expect(c.text).toBe('VIP');
  });

  it('routes a quoted short token to text mode', () => {
    const c = classify(
      req({ tagName: 'Member Code', description: 'Tag should display "AB".' }),
      registry,
    );
    expect(c.mode).toBe('text');
    expect(c.text).toBe('AB');
  });

  it('routes a discount request to the matching library icon', () => {
    const c = classify(
      req({ tagName: '10% Off', description: 'discount tag for promo' }),
      registry,
    );
    expect(c.isComplex).toBe(false);
    expect(c.mode).toBe('icon');
    expect(c.iconId).toBe('10-off');
  });

  it('matches a curated synonym to a library icon', () => {
    const c = classify(
      req({ tagName: 'Gym Rat', description: 'for our dedicated gym crowd' }),
      registry,
    );
    expect(c.isComplex).toBe(false);
    expect(c.iconId).toBe('dumbbell');
  });

  it('matches a concept word to a library icon (star)', () => {
    const c = classify(
      req({ tagName: 'Top Reviewer', description: 'show a star for favorites' }),
      registry,
    );
    expect(c.iconId).toBe('star');
  });

  it('routes a novel concept with no match to complex', () => {
    const c = classify(
      req({ tagName: 'Pregnant', description: 'indicate a pregnant client' }),
      registry,
    );
    expect(c.isComplex).toBe(true);
  });
});
