import { describe, it, expect } from 'vitest';
import { resolveExplicitIconId } from '../../server/iconIntent';
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
