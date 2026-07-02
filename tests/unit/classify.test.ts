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

  it('matches UTR-87 good variant to Nucleo face-smile from smiling emoji hint', () => {
    const c = classify(
      req({
        tagName: 'Good ombres',
        iconHint: 'smiling emoji',
      }),
      registry,
    );
    expect(c.isComplex).toBe(false);
    expect(c.mode).toBe('icon');
    expect(c.iconId).toBe('nucleo-face-smile');
    expect(c.confidence).toBe('high');
    expect(c.fallbackToAi).toBeFalsy();
  });

  it('matches UTR-87 bad variant to Nucleo face-sad from sad emoji hint', () => {
    const c = classify(
      req({
        tagName: 'Bad ombres',
        iconHint: 'sad emoji',
      }),
      registry,
    );
    expect(c.isComplex).toBe(false);
    expect(c.mode).toBe('icon');
    expect(c.iconId).toBe('nucleo-face-sad');
    expect(c.confidence).toBe('high');
    expect(c.fallbackToAi).toBeFalsy();
  });

  it('routes thumbs up and thumbs down to distinct Nucleo icons', () => {
    const up = classify(req({ tagName: 'Like', iconHint: 'thumbs up' }), registry);
    const down = classify(req({ tagName: 'Dislike', iconHint: 'thumbs down' }), registry);
    expect(up.iconId).toBe('nucleo-thumbs-up');
    expect(down.iconId).toBe('nucleo-thumbs-down');
  });

  it('matches common studio hints to Nucleo via synonyms', () => {
    const cases: Array<[string, string, string]> = [
      ['VIP Member', 'vip', 'nucleo-crown'],
      ['Pilates', 'pilates', 'nucleo-mat'],
      ['Kickboxing', 'kickboxing', 'nucleo-punching-bag'],
      ['Dog Friendly', 'dog', 'nucleo-dog'],
      ['Valentine', 'valentine', 'nucleo-heart'],
      ['New Member', 'new member', 'nucleo-user-plus'],
      ['Invite Bonus', 'invite', 'nucleo-users-shaking-hands'],
      ['Promo', 'promo', 'nucleo-discount-2'],
    ];
    for (const [tagName, hint, iconId] of cases) {
      const c = classify(req({ tagName, iconHint: hint }), registry);
      expect(c.iconId, hint).toBe(iconId);
      expect(c.isComplex, hint).toBe(false);
    }
  });

  it('does not route (TEST) tag names to pregnancy-test via the word test', () => {
    const c = classify(
      req({
        tagName: '(TEST) Sample Tag',
        iconHint: 'Earth or globe',
      }),
      registry,
    );
    expect(c.iconId).not.toBe('nucleo-pregnancy-test');
    expect(c.iconId).toMatch(/^nucleo-(earth|globe)/);
  });

  it('routes UTR-97 letters PRO from the icon hint to text mode (not abc-letters)', () => {
    const c = classify(
      req({
        tagName: 'Pro User',
        iconHint: 'letters PRO',
        description:
          'Globo Gym wants a custom user tag with the letters PRO to indicate pro users',
      }),
      registry,
    );
    expect(c.isComplex).toBe(false);
    expect(c.mode).toBe('text');
    expect(c.text).toBe('PRO');
    expect(c.confidence).toBe('high');
    expect(c.fallbackToAi).toBeFalsy();
    expect(c.iconId).toBeUndefined();
  });

  it('prefers the tag name over description tokens for icon matching', () => {
    const c = classify(
      req({
        tagName: 'Gym Rat',
        description: 'Average Joes Gym wants a star icon for favorites',
      }),
      registry,
    );
    expect(c.mode).toBe('icon');
    expect(c.iconId).toBe('dumbbell');
    expect(c.iconId).not.toBe('star');
  });

  it('falls back to the description for icon matching when form fields do not match', () => {
    const c = classify(
      req({
        tagName: 'Top Reviewer',
        description: 'show a star for favorites',
      }),
      registry,
    );
    expect(c.mode).toBe('icon');
    expect(c.iconId).toBe('star');
    expect(c.confidence).toBe('low');
    expect(c.fallbackToAi).toBe(true);
  });

  it('extracts letters PRO from the description when the form omits them', () => {
    const c = classify(
      req({
        tagName: 'Pro User',
        description:
          'Globo Gym wants a custom user tag with the letters PRO to indicate pro users',
      }),
      registry,
    );
    expect(c.mode).toBe('text');
    expect(c.text).toBe('PRO');
    expect(c.confidence).toBe('high');
  });

  it('routes UTR-99 regenerate snake notes to the snake icon, not letters PRO', () => {
    const c = classify(
      req({
        tagName: 'Pro User',
        iconHint: 'letters PRO',
        description:
          'Globo Gym wants a custom user tag with the letters PRO to indicate pro users',
        revisionNotes: 'use a snake icon instead',
      }),
      registry,
    );
    expect(c.mode).toBe('icon');
    expect(c.iconId).toBe('nucleo-snake');
    expect(c.text).toBeUndefined();
  });
});
