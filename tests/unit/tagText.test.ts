import { describe, expect, it } from 'vitest';
import {
  hasDisallowedTagTextChars,
  isTagText,
  sanitizeTagText,
  TEXT_PATTERN,
} from '../../src/lib/tagText';

describe('sanitizeTagText', () => {
  it('uppercases letters and keeps digits', () => {
    expect(sanitizeTagText('vip')).toBe('VIP');
    expect(sanitizeTagText('ab1')).toBe('AB1');
  });

  it('keeps < and other punctuation used on age/status tags', () => {
    expect(sanitizeTagText('<18')).toBe('<18');
    expect(sanitizeTagText('18+')).toBe('18+');
    expect(sanitizeTagText('10%')).toBe('10%');
  });

  it('strips disallowed characters and caps at 3', () => {
    expect(sanitizeTagText('A~B~C~D')).toBe('ABCD'.slice(0, 3));
    expect(sanitizeTagText('<18 extra')).toBe('<18');
  });
});

describe('isTagText', () => {
  it('accepts 1–3 character tokens including punctuation', () => {
    expect(isTagText('VIP')).toBe(true);
    expect(isTagText('<18')).toBe(true);
    expect(isTagText('18+')).toBe(true);
    expect(isTagText('a.')).toBe(true);
  });

  it('rejects empty, too-long, or disallowed input', () => {
    expect(isTagText('')).toBe(false);
    expect(isTagText('VIPs')).toBe(false);
    expect(isTagText('A~')).toBe(false);
    expect(isTagText('Under 18')).toBe(false);
  });
});

describe('hasDisallowedTagTextChars', () => {
  it('allows lowercase and punctuation before sanitizing', () => {
    expect(hasDisallowedTagTextChars('<18')).toBe(false);
    expect(hasDisallowedTagTextChars('ab')).toBe(false);
  });

  it('flags characters outside the allowed set', () => {
    expect(hasDisallowedTagTextChars('A~')).toBe(true);
    expect(hasDisallowedTagTextChars('A^')).toBe(true);
  });
});

describe('TEXT_PATTERN', () => {
  it('matches sanitized tag text including <18', () => {
    expect(TEXT_PATTERN.test('<18')).toBe(true);
    expect(TEXT_PATTERN.test('VIP')).toBe(true);
    expect(TEXT_PATTERN.test('')).toBe(true);
    expect(TEXT_PATTERN.test('VIPs')).toBe(false);
  });
});
