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
    // Nucleo includes a pregnant icon — prefer that over LLM authorship.
    expect(c.isComplex).toBe(false);
    expect(c.iconId).toBe('nucleo-pregnant-woman');
  });

  it('assigns low confidence for UTR-85-shaped angel/halo hint matching person', () => {
    const c = classify(
      req({
        tagName: 'Angel Week Finisher',
        description: 'Tag for clients who completed Angel Week.',
        iconHint: 'an angel or a person with a halo',
      }),
      registry,
    );
    expect(c.isComplex).toBe(false);
    expect(c.mode).toBe('icon');
    expect(c.iconId).toBe('person');
    expect(c.confidence).toBe('low');
    expect(c.fallbackToAi).toBe(true);
    expect(c.unmatchedTerms).toEqual(expect.arrayContaining(['angel', 'halo']));
  });

  it('keeps high confidence for a curated synonym match (vaccinated)', () => {
    const c = classify(
      req({
        tagName: 'Vaccinated Member',
        description: 'show vaccinated status for this client',
      }),
      registry,
    );
    expect(c.isComplex).toBe(false);
    expect(c.iconId).toBe('vaccinated');
    expect(c.confidence).toBe('high');
    expect(c.fallbackToAi).toBeFalsy();
  });

  it('keeps high confidence for a clear initialism (VIP)', () => {
    const c = classify(req({ tagName: 'VIP' }), registry);
    expect(c.confidence).toBe('high');
    expect(c.fallbackToAi).toBeFalsy();
  });

  it('matches UTR-86 from icon hint via Nucleo without AI fallback', () => {
    const c = classify(
      req({
        tagName: 'World Cup Attendee',
        description:
          'Average Joes Gym wants a custom user tag for customers who attended the world cup',
        iconHint: 'Earth or globe',
      }),
      registry,
    );
    expect(c.isComplex).toBe(false);
    expect(c.mode).toBe('icon');
    expect(c.iconId).toMatch(/^nucleo-(earth|globe)/);
    expect(c.confidence).toBe('high');
    expect(c.fallbackToAi).toBeFalsy();
  });

  it('does not let a studio name in the description override an icon hint', () => {
    const c = classify(
      req({
        tagName: 'World Cup Attendee',
        description: 'Average Joes Gym wants a custom user tag',
        iconHint: 'Earth or globe',
      }),
      registry,
    );
    expect(c.iconId).not.toBe('dumbbell');
  });
});
