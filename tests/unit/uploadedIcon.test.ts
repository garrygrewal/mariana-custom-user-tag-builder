import { describe, expect, it } from 'vitest';
import { createUploadedIcon } from '../../src/lib/uploadedIcon';

describe('createUploadedIcon', () => {
  it('builds a normalized uploaded icon definition from valid svg', () => {
    const icon = createUploadedIcon(
      'My Icon.svg',
      '<svg viewBox="0 0 30 30"><path d="M0 0L10 10" fill="white"/></svg>',
    );

    expect(icon.id).toBe('uploaded-my-icon');
    expect(icon.label).toBe('My Icon');
    expect(icon.viewBox).toBe('0 0 30 30');
    expect(icon.svgContent).toContain('<svg');
  });

  it('falls back to width/height when viewBox is missing', () => {
    const icon = createUploadedIcon(
      'Simple.svg',
      '<svg width="18" height="14"><path d="M0 0L10 10" /></svg>',
    );
    expect(icon.viewBox).toBe('0 0 18 14');
  });

  it('throws for non-svg content', () => {
    expect(() => createUploadedIcon('bad.svg', 'not svg')).toThrow(
      /not a valid svg/i,
    );
  });

  it('strips script tags and inline event handlers from uploaded svg', () => {
    const icon = createUploadedIcon(
      'unsafe.svg',
      '<svg viewBox="0 0 10 10"><script>alert(1)</script><path d="M0 0L10 10" onclick="alert(1)" /></svg>',
    );

    expect(icon.svgContent).not.toMatch(/<script/i);
    expect(icon.svgContent).not.toMatch(/\sonclick=/i);
    expect(icon.svgContent).toMatch(/<path/i);
  });
});
