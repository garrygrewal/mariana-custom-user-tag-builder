import { describe, it, expect } from 'vitest';
import {
  resolveExplicitIconId,
  revisionNotesChangeIcon,
  stripJiraBoilerplate,
  iconMatchText,
} from '../../server/iconIntent';
import { loadIconRegistry } from '../../server/icons.node';

const registry = loadIconRegistry();

describe('resolveExplicitIconId', () => {
  it('resolves nucleo icon ids from revision notes', () => {
    expect(
      resolveExplicitIconId(
        'use a lighter shade of pink (pastel pink), and use the user-long-hair icon',
        registry,
      ),
    ).toBe('nucleo-user-long-hair');
  });

  it('resolves use-the-icon phrasing', () => {
    expect(resolveExplicitIconId('use the nucleo-heart icon', registry)).toBe('nucleo-heart');
  });

  it('resolves icon: shorthand', () => {
    expect(resolveExplicitIconId('icon: child', registry)).toBe('child');
  });

  it('returns null when no registered icon matches', () => {
    expect(resolveExplicitIconId('use the made-up-icon icon', registry)).toBeNull();
  });

  it('resolves use-a-icon phrasing with an article', () => {
    expect(resolveExplicitIconId('use a snake icon instead', registry)).toBe('nucleo-snake');
  });
});

describe('stripJiraBoilerplate', () => {
  it('removes Description and other field labels but keeps content', () => {
    const text =
      'User Tag Name: Totalpass\nDescription: This is a Totalpass reservation.\nBackground Color: Green\nIcon: Letters "TP" (white)';
    expect(stripJiraBoilerplate(text)).toBe(
      'Totalpass This is a Totalpass reservation. Green Letters "TP" (white)',
    );
    expect(iconMatchText(text)).not.toMatch(/\bdescription\b/i);
  });
});

describe('revisionNotesChangeIcon', () => {
  it('returns false for color-only notes', () => {
    expect(revisionNotesChangeIcon('color should be green', registry)).toBe(false);
    expect(revisionNotesChangeIcon('darker green', registry)).toBe(false);
  });

  it('returns true when notes request a different icon', () => {
    expect(revisionNotesChangeIcon('use a snake icon instead', registry)).toBe(true);
    expect(revisionNotesChangeIcon('simpler star, darker purple', registry)).toBe(true);
  });
});
