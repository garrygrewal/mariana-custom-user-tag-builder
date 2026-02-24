import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildTagSvg, fitFontSize } from '../../src/lib/svgBuilder';
import type { TagConfig } from '../../src/types';
import { ICON_REGISTRY } from '../../src/lib/icons';

const baseConfig: TagConfig = {
  label: 'Test',
  bgHex: '#FF5733',
  mode: 'text',
  text: 'AB',
  iconId: '',
};

describe('buildTagSvg — text mode', () => {
  it('produces an SVG string with correct dimensions', () => {
    const svg = buildTagSvg({ config: baseConfig, fgHex: '#FFFFFF' });
    expect(svg).toContain('width="30"');
    expect(svg).toContain('height="30"');
    expect(svg).toContain('viewBox="0 0 30 30"');
  });

  it('contains a circle with the background color', () => {
    const svg = buildTagSvg({ config: baseConfig, fgHex: '#FFFFFF' });
    expect(svg).toContain('<circle');
    expect(svg).toContain('fill="#FF5733"');
  });

  it('contains a <text> element with the correct content and fg color', () => {
    const svg = buildTagSvg({ config: baseConfig, fgHex: '#FFFFFF' });
    expect(svg).toContain('<text');
    expect(svg).toContain('fill="#FFFFFF"');
    expect(svg).toContain('>AB</text>');
  });

  it('renders outlined text path when provided', () => {
    const svg = buildTagSvg({
      config: baseConfig,
      fgHex: '#FFFFFF',
      outlinedTextPath: {
        d: 'M0 0L1 1Z',
        translateX: 1.5,
        translateY: 2.5,
      },
    });
    expect(svg).toContain('<path d="M0 0L1 1Z"');
    expect(svg).toContain('transform="translate(1.5,2.5)"');
    expect(svg).toContain('fill="#FFFFFF"');
    expect(svg).not.toContain('<text');
  });

  it('applies text-anchor middle and dominant-baseline central', () => {
    const svg = buildTagSvg({ config: baseConfig, fgHex: '#000000' });
    expect(svg).toContain('text-anchor="middle"');
    expect(svg).toContain('dominant-baseline="central"');
  });

  it('escapes special XML characters in text', () => {
    const config = { ...baseConfig, text: 'A' };
    const svg = buildTagSvg({ config, fgHex: '#000000' });
    expect(svg).not.toContain('<A>');
  });
});

describe('buildTagSvg — font-family attribute validity', () => {
  it('emits font-family with single-quote-wrapped value (not JSON double-quote wrapping)', () => {
    const svg = buildTagSvg({ config: baseConfig, fgHex: '#000000' });
    expect(svg).not.toMatch(/font-family="\\".*\\"/);
    const match = svg.match(/font-family='([^']+)'/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('"Proxima Nova"');
    expect(match![1]).toContain('sans-serif');
  });

  it('produces well-formed XML (no unescaped quotes breaking attributes)', () => {
    const svg = buildTagSvg({ config: baseConfig, fgHex: '#000000' });
    expect(svg).not.toContain('font-family="');
    expect(svg).toMatch(/font-family='[^']+'/);
  });

  it('resulting SVG is parseable as valid XML', () => {
    const svg = buildTagSvg({ config: baseConfig, fgHex: '#000000' });
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const parseError = doc.querySelector('parsererror');
    expect(parseError).toBeNull();
  });
});

describe('buildTagSvg — icon mode', () => {
  it('renders icon path data inside a <g> transform group', () => {
    expect(ICON_REGISTRY.length).toBeGreaterThan(0);
    const config: TagConfig = {
      ...baseConfig,
      mode: 'icon',
      iconId: ICON_REGISTRY[0].id,
    };
    const svg = buildTagSvg({ config, fgHex: '#000000' });
    expect(svg).toContain('<g transform=');
    expect(svg).toMatch(/<(path|circle|rect|polygon|line|polyline|ellipse)\b/);
  });

  it('replaces fill="white" with the foreground color', () => {
    const iconId = '__fill-white-attr-test__';
    ICON_REGISTRY.push({
      id: iconId,
      label: 'Fill White Attr Test',
      viewBox: '0 0 10 10',
      svgContent:
        '<svg viewBox="0 0 10 10"><path d="M1 1L9 9" fill="white" /><path d="M1 9L9 1" fill="#fff" /></svg>',
    });

    try {
      const config: TagConfig = { ...baseConfig, mode: 'icon', iconId };
      const svg = buildTagSvg({ config, fgHex: '#000000' });
      expect(svg).not.toMatch(/fill\s*=\s*["']\s*(?:white|#fff(?:fff)?)\s*["']/i);
      expect(svg).toContain('fill="#000000"');
    } finally {
      const i = ICON_REGISTRY.findIndex((icon) => icon.id === iconId);
      if (i >= 0) ICON_REGISTRY.splice(i, 1);
    }
  });

  it('replaces white stroke attribute variants with the foreground color', () => {
    const iconId = '__stroke-white-attr-test__';
    ICON_REGISTRY.push({
      id: iconId,
      label: 'Stroke White Attr Test',
      viewBox: '0 0 10 10',
      svgContent:
        '<svg viewBox="0 0 10 10"><path d="M1 1L9 9" stroke="#fff" fill="none" /><path d="M1 9L9 1" stroke=\'WHITE\' fill="none" /></svg>',
    });

    try {
      const config: TagConfig = { ...baseConfig, mode: 'icon', iconId };
      const svg = buildTagSvg({ config, fgHex: '#123456' });
      expect(svg).not.toMatch(/stroke\s*=\s*["']\s*(?:white|#fff(?:fff)?)\s*["']/i);
      expect(svg).toContain('stroke="#123456"');
    } finally {
      const i = ICON_REGISTRY.findIndex((icon) => icon.id === iconId);
      if (i >= 0) ICON_REGISTRY.splice(i, 1);
    }
  });

  it('replaces white fill/stroke style variants with the foreground color', () => {
    const iconId = '__white-style-test__';
    ICON_REGISTRY.push({
      id: iconId,
      label: 'White Style Test',
      viewBox: '0 0 10 10',
      svgContent:
        '<svg viewBox="0 0 10 10"><path d="M1 1L9 9" style="fill:white;stroke:#ffffff;stroke-width:1" /><path d="M1 9L9 1" style="fill: rgb(255,255,255); stroke: rgba(255, 255, 255, 1);" /></svg>',
    });

    try {
      const config: TagConfig = { ...baseConfig, mode: 'icon', iconId };
      const svg = buildTagSvg({ config, fgHex: '#654321' });
      expect(svg).not.toMatch(
        /\b(fill|stroke)\s*:\s*(?:white|#fff(?:fff)?|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)|rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*1(?:\.0+)?\s*\))/i,
      );
      expect(svg).toContain('fill:#654321');
      expect(svg).toContain('stroke:#654321');
    } finally {
      const i = ICON_REGISTRY.findIndex((icon) => icon.id === iconId);
      if (i >= 0) ICON_REGISTRY.splice(i, 1);
    }
  });

  it('replaces non-white fill/stroke paint values with the foreground color', () => {
    const iconId = '__non-white-paint-test__';
    ICON_REGISTRY.push({
      id: iconId,
      label: 'Non White Paint Test',
      viewBox: '0 0 10 10',
      svgContent:
        '<svg viewBox="0 0 10 10"><path d="M1 1L9 9" fill="#292632" stroke="rgb(10, 20, 30)" /><path d="M1 9L9 1" style="fill:#123456; stroke:#abcdef;" /></svg>',
    });

    try {
      const config: TagConfig = { ...baseConfig, mode: 'icon', iconId };
      const svg = buildTagSvg({ config, fgHex: '#FFFFFF' });
      expect(svg).toContain('fill="#FFFFFF"');
      expect(svg).toContain('stroke="#FFFFFF"');
      expect(svg).toContain('fill:#FFFFFF');
      expect(svg).toContain('stroke:#FFFFFF');
      expect(svg).not.toContain('#292632');
      expect(svg).not.toContain('#123456');
      expect(svg).not.toContain('#abcdef');
    } finally {
      const i = ICON_REGISTRY.findIndex((icon) => icon.id === iconId);
      if (i >= 0) ICON_REGISTRY.splice(i, 1);
    }
  });

  it('still includes the circle background', () => {
    expect(ICON_REGISTRY.length).toBeGreaterThan(0);
    const config: TagConfig = {
      ...baseConfig,
      mode: 'icon',
      iconId: ICON_REGISTRY[0].id,
    };
    const svg = buildTagSvg({ config, fgHex: '#FFFFFF' });
    expect(svg).toContain('<circle');
    expect(svg).toContain('fill="#FF5733"');
  });
});

describe('buildTagSvg — font embedding', () => {
  const fakeBase64 = 'AAAA';

  it('does not embed font by default', () => {
    const svg = buildTagSvg({ config: baseConfig, fgHex: '#FFF' });
    expect(svg).not.toContain('@font-face');
    expect(svg).not.toContain('data:font');
  });

  it('embeds font when fontBase64 is provided', () => {
    const svg = buildTagSvg({
      config: baseConfig,
      fgHex: '#FFF',
      fontBase64: fakeBase64,
    });
    expect(svg).toContain('@font-face');
    expect(svg).toContain(`base64,${fakeBase64}`);
  });
});

describe('fitFontSize', () => {
  it('returns preferred size (18.5) for single-char text', () => {
    expect(fitFontSize('A')).toBe(18.5);
  });

  it('returns preferred size (16.5) for two-char text when it fits', () => {
    expect(fitFontSize('AB')).toBe(16.5);
  });

  it('returns at or below 12.5 for three-char text', () => {
    const size = fitFontSize('ABC');
    expect(size).toBeGreaterThanOrEqual(9);
    expect(size).toBeLessThanOrEqual(12.5);
  });

  it('returns a number', () => {
    expect(typeof fitFontSize('WW')).toBe('number');
  });

  it('keeps wider 3-char combos from exceeding regular 3-char sizing', () => {
    expect(fitFontSize('WWW')).toBeLessThanOrEqual(fitFontSize('VIP'));
  });
});

describe('fitFontSize — OffscreenCanvas fallback', () => {
  const originalOffscreen = globalThis.OffscreenCanvas;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).OffscreenCanvas;
  });

  afterEach(() => {
    globalThis.OffscreenCanvas = originalOffscreen;
  });

  it('still returns a valid font size when OffscreenCanvas is missing', () => {
    // Falls back to document.createElement('canvas') or inline heuristic
    const size = fitFontSize('AB');
    expect(size).toBeGreaterThanOrEqual(9);
    expect(size).toBeLessThanOrEqual(16.5);
  });

  it('handles single-char input without error', () => {
    expect(() => fitFontSize('X')).not.toThrow();
    expect(fitFontSize('X')).toBe(18.5);
  });

  it('handles 3-char input', () => {
    const size = fitFontSize('WWW');
    expect(size).toBeGreaterThanOrEqual(9);
    expect(size).toBeLessThanOrEqual(12.5);
  });
});
