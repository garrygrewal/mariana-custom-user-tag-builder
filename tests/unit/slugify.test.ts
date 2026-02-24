import { describe, it, expect } from 'vitest';
import { toSlug, buildFileName } from '../../src/lib/slugify';

describe('toSlug', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(toSlug('Hello World')).toBe('hello-world');
  });

  it('strips special characters', () => {
    expect(toSlug('Test@#$Tag!')).toBe('test-tag');
  });

  it('collapses consecutive non-alphanumeric chars into one hyphen', () => {
    expect(toSlug('a---b')).toBe('a-b');
    expect(toSlug('foo   bar')).toBe('foo-bar');
  });

  it('trims leading and trailing hyphens', () => {
    expect(toSlug('--hello--')).toBe('hello');
    expect(toSlug('!!!test!!!')).toBe('test');
  });

  it('returns "untitled" for empty string', () => {
    expect(toSlug('')).toBe('untitled');
  });

  it('returns "untitled" for all-special-character input', () => {
    expect(toSlug('---')).toBe('untitled');
    expect(toSlug('!@#$%')).toBe('untitled');
  });

  it('preserves numbers', () => {
    expect(toSlug('Tag 123')).toBe('tag-123');
  });

  it('handles single character', () => {
    expect(toSlug('X')).toBe('x');
  });
});

describe('buildFileName', () => {
  it('assembles correct format for text mode', () => {
    expect(buildFileName('My Tag', 'text', '#FF5733', 'svg')).toBe(
      'custom-tag_my-tag_text_ff5733.svg',
    );
  });

  it('assembles correct format for icon mode', () => {
    expect(buildFileName('Star Label', 'icon', '#00AAFF', 'png')).toBe(
      'custom-tag_star-label_icon_00aaff.png',
    );
  });

  it('handles hex without hash prefix', () => {
    expect(buildFileName('Tag', 'icon', 'AABB00', 'png')).toBe(
      'custom-tag_tag_icon_aabb00.png',
    );
  });

  it('lowercases the hex in filename', () => {
    expect(buildFileName('T', 'text', '#ABCDEF', 'svg')).toBe(
      'custom-tag_t_text_abcdef.svg',
    );
  });

  it('uses "untitled" when label is empty', () => {
    expect(buildFileName('', 'text', '#000000', 'svg')).toBe(
      'custom-tag_untitled_text_000000.svg',
    );
  });
});
