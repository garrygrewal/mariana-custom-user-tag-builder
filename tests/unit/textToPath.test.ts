import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildOutlinedTextPath } from '../../src/lib/textToPath';
import { parse } from 'opentype.js';

vi.mock('opentype.js', () => ({
  parse: vi.fn(),
}));

describe('buildOutlinedTextPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for empty text', () => {
    const result = buildOutlinedTextPath({
      text: '   ',
      fontSize: 12,
      centerX: 15,
      centerY: 15,
      fontBuffer: new ArrayBuffer(8),
    });
    expect(result).toBeNull();
  });

  it('returns centered path data when parsing succeeds', () => {
    const fakePath = {
      getBoundingBox: () => ({ x1: 2, y1: -6, x2: 10, y2: 2 }),
      toPathData: () => 'M0 0L1 1Z',
    };
    const fakeFont = {
      getPath: vi.fn(() => fakePath),
    };
    vi.mocked(parse).mockReturnValue(fakeFont as never);

    const result = buildOutlinedTextPath({
      text: 'AB',
      fontSize: 12.5,
      centerX: 15,
      centerY: 15,
      fontBuffer: new ArrayBuffer(16),
    });

    expect(result).toEqual({
      d: 'M0 0L1 1Z',
      translateX: 9,
      translateY: 17,
    });
    expect(fakeFont.getPath).toHaveBeenCalledWith('AB', 0, 0, 12.5);
  });

  it('returns null when parsing throws', () => {
    vi.mocked(parse).mockImplementation(() => {
      throw new Error('parse failed');
    });

    const result = buildOutlinedTextPath({
      text: 'AB',
      fontSize: 12.5,
      centerX: 15,
      centerY: 15,
      fontBuffer: new ArrayBuffer(16),
    });

    expect(result).toBeNull();
  });
});
