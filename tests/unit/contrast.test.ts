import { describe, it, expect } from 'vitest';
import {
  relativeLuminance,
  contrastRatio,
  pickForeground,
} from '../../src/lib/contrast';

describe('relativeLuminance', () => {
  it('returns 0 for pure black', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
  });

  it('returns 1 for pure white', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('handles mid-gray (#808080) correctly', () => {
    // sRGB 128/255 ≈ 0.5020, linearized ≈ 0.2159 per channel
    expect(relativeLuminance('#808080')).toBeCloseTo(0.2159, 3);
  });

  it('computes known red luminance', () => {
    // Pure red: 0.2126 * linearize(255) = 0.2126
    expect(relativeLuminance('#FF0000')).toBeCloseTo(0.2126, 4);
  });

  it('accepts hex without hash prefix', () => {
    expect(relativeLuminance('000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('FFFFFF')).toBeCloseTo(1, 5);
  });
});

describe('contrastRatio', () => {
  it('returns 21:1 for black vs white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('returns 1:1 for identical colors', () => {
    expect(contrastRatio('#FF0000', '#FF0000')).toBeCloseTo(1, 5);
  });

  it('is symmetric (order does not matter)', () => {
    const ab = contrastRatio('#123456', '#FEDCBA');
    const ba = contrastRatio('#FEDCBA', '#123456');
    expect(ab).toBeCloseTo(ba, 5);
  });

  it('returns expected ratio for a known pair', () => {
    // #000080 (navy) vs white
    // navy luminance ≈ 0.0722 * linearize(128) ≈ 0.01444
    // ratio ≈ (1 + 0.05) / (0.01444 + 0.05) ≈ 16.3
    const ratio = contrastRatio('#000080', '#FFFFFF');
    expect(ratio).toBeGreaterThan(15);
    expect(ratio).toBeLessThan(17);
  });
});

describe('pickForeground', () => {
  it('returns black for white background', () => {
    expect(pickForeground('#FFFFFF')).toBe('#000000');
  });

  it('returns white for black background', () => {
    expect(pickForeground('#000000')).toBe('#FFFFFF');
  });

  it('returns black for bright yellow', () => {
    expect(pickForeground('#FFFF00')).toBe('#000000');
  });

  it('returns white for dark navy', () => {
    expect(pickForeground('#000080')).toBe('#FFFFFF');
  });

  it('returns white for dark red', () => {
    expect(pickForeground('#8B0000')).toBe('#FFFFFF');
  });

  it('returns black for light pink', () => {
    expect(pickForeground('#FFB6C1')).toBe('#000000');
  });
});
