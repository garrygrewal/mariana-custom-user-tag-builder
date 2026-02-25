import { describe, it, expect } from 'vitest';
import { ICON_REGISTRY } from '../../src/lib/icons';

describe('ICON_REGISTRY (auto-discovered)', () => {
  it('contains at least 4 icons', () => {
    expect(ICON_REGISTRY.length).toBeGreaterThanOrEqual(4);
  });

  it('each icon has a non-empty id and label', () => {
    for (const icon of ICON_REGISTRY) {
      expect(icon.id).toBeTruthy();
      expect(typeof icon.id).toBe('string');
      expect(icon.label).toBeTruthy();
      expect(typeof icon.label).toBe('string');
    }
  });

  it('derives id from filename (lowercase, no extension)', () => {
    for (const icon of ICON_REGISTRY) {
      expect(icon.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('derives label from id with title-casing', () => {
    for (const icon of ICON_REGISTRY) {
      const expected = icon.id
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      expect(icon.label).toBe(expected);
    }
  });

  it('each icon has non-empty svgContent containing an <svg> element', () => {
    for (const icon of ICON_REGISTRY) {
      expect(icon.svgContent).toContain('<svg');
      expect(icon.svgContent).toContain('</svg>');
    }
  });

  it('each icon has a valid viewBox with 4 numeric parts', () => {
    for (const icon of ICON_REGISTRY) {
      expect(icon.viewBox).toMatch(/^\d+\s+\d+\s+\d+\s+\d+$/);
    }
  });

  it('includes non-empty IDs for the discovered icon set', () => {
    const ids = ICON_REGISTRY.map((i) => i.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });

  it('all IDs are unique', () => {
    const ids = ICON_REGISTRY.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is sorted alphabetically by id', () => {
    const ids = ICON_REGISTRY.map((i) => i.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('icon svgContent includes paint declarations used at render time', () => {
    for (const icon of ICON_REGISTRY) {
      expect(icon.svgContent).toMatch(
        /\b(fill|stroke)\s*=|style\s*=/i,
      );
    }
  });
});
