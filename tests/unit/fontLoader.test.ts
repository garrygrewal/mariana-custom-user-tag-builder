import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFontBase64 } from '../../src/lib/fontLoader';

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
