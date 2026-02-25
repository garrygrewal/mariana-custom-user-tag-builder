import { describe, it, expect } from 'vitest';
import {
  parseUploadedSvg,
  parseUploadedPng,
  parseUploadedIconFile,
} from '../../src/lib/uploadedIcon';

const ONE_BY_ONE_PNG = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 1, 0, 0, 0, 1,
  8, 6, 0, 0, 0, 31, 21, 196,
  137, 0, 0, 0, 10, 73, 68, 65,
  84, 120, 156, 99, 0, 1, 0, 0,
  5, 0, 1, 13, 10, 45, 180, 0,
  0, 0, 0, 73, 69, 78, 68, 174,
  66, 96, 130,
]);

describe('uploadedIcon parsing', () => {
  it('parses valid svg and derives id/label from filename', () => {
    const icon = parseUploadedSvg(
      '<svg viewBox="0 0 30 30"><path d="M0 0h10v10z" fill="white"/></svg>',
      'My Badge.svg',
    );

    expect(icon.id).toBe('my-badge');
    expect(icon.label).toBe('My Badge');
    expect(icon.viewBox).toBe('0 0 30 30');
  });

  it('falls back to width/height when viewBox is missing', () => {
    const icon = parseUploadedSvg(
      '<svg width="20" height="14"><path d="M0 0h10v10z"/></svg>',
      'no-viewbox.svg',
    );
    expect(icon.viewBox).toBe('0 0 20 14');
  });

  it('sanitizes scripts and unsafe attributes', () => {
    const icon = parseUploadedSvg(
      '<svg viewBox="0 0 24 24" onload="alert(1)"><script>alert(1)</script><path href="javascript:alert(2)" d="M1 1h10v10z"/></svg>',
      'unsafe.svg',
    );
    expect(icon.svgContent).not.toMatch(/<script/i);
    expect(icon.svgContent).not.toMatch(/\sonload=/i);
    expect(icon.svgContent).not.toMatch(/javascript:/i);
  });

  it('throws for non-svg content', () => {
    expect(() => parseUploadedSvg('<div>not svg</div>', 'bad.svg')).toThrow(
      /valid svg/i,
    );
  });

  it('parses PNG bytes and wraps as SVG image content', () => {
    const icon = parseUploadedPng('My Badge.png', ONE_BY_ONE_PNG);
    expect(icon.id).toBe('my-badge');
    expect(icon.label).toBe('My Badge');
    expect(icon.viewBox).toBe('0 0 1 1');
    expect(icon.svgContent).toContain('<image');
    expect(icon.svgContent).toContain('data:image/png;base64,');
  });

  it('parses uploaded PNG files', async () => {
    const png = new File([ONE_BY_ONE_PNG], 'badge.png', { type: 'image/png' });
    const icon = await parseUploadedIconFile(png);
    expect(icon.id).toBe('badge');
    expect(icon.viewBox).toBe('0 0 1 1');
    expect(icon.svgContent).toContain('<image');
  });

  it('rejects non-image file uploads', async () => {
    const bad = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    await expect(parseUploadedIconFile(bad)).rejects.toThrow(
      /only \.svg or \.png/i,
    );
  });
});
