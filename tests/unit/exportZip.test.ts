import { describe, it, expect, vi, beforeEach } from 'vitest';

const fileMock = vi.fn();
const generateAsyncMock = vi.fn().mockResolvedValue(new Blob(['zip']));

vi.mock('jszip', () => {
  return {
    default: class JSZipMock {
      file = fileMock;
      generateAsync = generateAsyncMock;
    },
  };
});

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

vi.mock('../../src/lib/rasterize', () => ({
  svgToPngBlob: vi.fn().mockResolvedValue(new Blob(['png'])),
}));

import { exportTagZip } from '../../src/lib/exportZip';
import * as fontLoader from '../../src/lib/fontLoader';
import * as textToPath from '../../src/lib/textToPath';
import { saveAs } from 'file-saver';
import type { TagConfig } from '../../src/types';

const testConfig: TagConfig = {
  label: 'Test',
  bgHex: '#FF5733',
  mode: 'text',
  text: 'AB',
  iconId: 'star',
};

describe('exportTagZip — svg size optimization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    generateAsyncMock.mockResolvedValue(new Blob(['zip']));
  });

  it('exports without embedding a font-face block (size-optimized SVG)', async () => {
    await exportTagZip(testConfig);
    expect(saveAs).toHaveBeenCalledTimes(1);

    const svgCall = fileMock.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any[]) => typeof c[0] === 'string' && c[0].endsWith('.svg'),
    );
    expect(svgCall?.[1]).not.toContain('@font-face');
    expect(svgCall?.[1]).toContain('font-family=');
    expect(svgCall?.[1]).not.toContain('data:font');
  });

  it('outlines text into a <path> when text-to-path succeeds', async () => {
    vi.spyOn(fontLoader, 'getTrueTypeFontData').mockResolvedValue({
      buffer: new ArrayBuffer(8),
      path: '/fonts/proxima-nova-extrabold.ttf',
      mime: 'font/truetype',
      format: 'truetype',
    });
    vi.spyOn(textToPath, 'buildOutlinedTextPath').mockReturnValue({
      d: 'M0 0L1 1Z',
      translateX: 1,
      translateY: 2,
    });

    await exportTagZip(testConfig);

    const svgCall = fileMock.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any[]) => typeof c[0] === 'string' && c[0].endsWith('.svg'),
    );
    expect(svgCall?.[1]).toContain('<path d="M0 0L1 1Z"');
    expect(svgCall?.[1]).not.toContain('<text');
  });

  it('falls back to <text> when text-to-path generation fails', async () => {
    vi.spyOn(fontLoader, 'getTrueTypeFontData').mockRejectedValue(
      new Error('missing font'),
    );

    await exportTagZip(testConfig);

    const svgCall = fileMock.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any[]) => typeof c[0] === 'string' && c[0].endsWith('.svg'),
    );
    expect(svgCall?.[1]).toContain('<text');
    expect(svgCall?.[1]).not.toContain('<path d="M0 0L1 1Z"');
  });

  it('uses correct zip filename', async () => {
    await exportTagZip(testConfig);

    const zipFileName = vi.mocked(saveAs).mock.calls[0][1];
    expect(zipFileName).toBe('custom-tag_test_text_ff5733.zip');
  });

  it('falls back to text/icon id for filename when label is empty', async () => {
    await exportTagZip({ ...testConfig, label: '', text: 'AB' });
    expect(vi.mocked(saveAs).mock.calls[0][1]).toBe('custom-tag_ab_text_ff5733.zip');

    await exportTagZip({
      ...testConfig,
      label: '',
      mode: 'icon',
      text: '',
      iconId: 'star',
    });
    expect(vi.mocked(saveAs).mock.calls[1][1]).toBe('custom-tag_star_icon_ff5733.zip');
  });

  it('preloads font only for text mode exports', async () => {
    const ensureSpy = vi.spyOn(fontLoader, 'ensureFontLoaded');
    const ttfSpy = vi.spyOn(fontLoader, 'getTrueTypeFontData').mockResolvedValue({
      buffer: new ArrayBuffer(8),
      path: '/fonts/proxima-nova-extrabold.ttf',
      mime: 'font/truetype',
      format: 'truetype',
    });

    await exportTagZip(testConfig);
    expect(ensureSpy).toHaveBeenCalledTimes(1);
    expect(ttfSpy).toHaveBeenCalledTimes(1);

    ensureSpy.mockClear();
    ttfSpy.mockClear();
    await exportTagZip({
      ...testConfig,
      mode: 'icon',
      text: '',
      iconId: 'star',
    });

    expect(ensureSpy).not.toHaveBeenCalled();
    expect(ttfSpy).not.toHaveBeenCalled();
  });
});
