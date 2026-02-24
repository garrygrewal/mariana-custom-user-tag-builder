import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getFontBase64,
  getEmbeddedFontData,
  getTrueTypeFontData,
} from '../../src/lib/fontLoader';

describe('getFontBase64', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws a descriptive error when fetch returns non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 404, statusText: 'Not Found' }),
    );

    await expect(getFontBase64()).rejects.toThrow(
      /Font fetch failed: 404 Not Found/,
    );
  });

  it('throws on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('Network error'),
    );

    await expect(getFontBase64()).rejects.toThrow('Network error');
  });

  it('returns a base64 string on success', async () => {
    const fakeBytes = new Uint8Array([0x00, 0x01, 0x02, 0xff]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(fakeBytes, { status: 200 }),
    );

    const result = await getFontBase64();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(atob(result)).toBeTruthy();
  });
});

describe('getEmbeddedFontData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers woff2 and falls back to truetype when woff2 is missing', async () => {
    const ttfBytes = new Uint8Array([0x01, 0x02, 0x03]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy
      .mockResolvedValueOnce(
        new Response(null, { status: 404, statusText: 'Not Found' }),
      )
      .mockResolvedValueOnce(new Response(ttfBytes, { status: 200 }));

    const data = await getEmbeddedFontData();
    expect(data.format).toBe('truetype');
    expect(data.mime).toBe('font/truetype');
    expect(data.path).toMatch(/proxima-nova-extrabold\.ttf$/);
    expect(data.base64.length).toBeGreaterThan(0);
  });
});

describe('getTrueTypeFontData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the TTF source even when WOFF2 exists', async () => {
    const ttfBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(ttfBytes, { status: 200 }),
    );

    const data = await getTrueTypeFontData();
    expect(data.format).toBe('truetype');
    expect(data.path).toMatch(/proxima-nova-extrabold\.ttf$/);
    expect(data.buffer.byteLength).toBe(4);
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringMatching(/\.ttf$/));
  });
});
