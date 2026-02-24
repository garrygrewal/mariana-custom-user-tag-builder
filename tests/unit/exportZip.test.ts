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
import { saveAs } from 'file-saver';
import type { TagConfig } from '../../src/types';

const testConfig: TagConfig = {
  label: 'Test',
  bgHex: '#FF5733',
  mode: 'text',
  text: 'AB',
  iconId: 'star',
};

describe('exportTagZip — font fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateAsyncMock.mockResolvedValue(new Blob(['zip']));
  });

  it('completes export even when getFontBase64 throws', async () => {
    vi.spyOn(fontLoader, 'getFontBase64').mockRejectedValue(
      new Error('Font fetch failed: 404'),
    );

    await exportTagZip(testConfig);
    expect(saveAs).toHaveBeenCalledTimes(1);
  });

  it('exports with embedded font when getFontBase64 succeeds', async () => {
    vi.spyOn(fontLoader, 'getFontBase64').mockResolvedValue('AAAA');

    await exportTagZip(testConfig);
    expect(saveAs).toHaveBeenCalledTimes(1);

    const svgCall = fileMock.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any[]) => typeof c[0] === 'string' && c[0].endsWith('.svg'),
    );
    expect(svgCall?.[1]).toContain('@font-face');
    expect(svgCall?.[1]).toContain('base64,AAAA');
  });

  it('SVG has no embedded font when getFontBase64 fails', async () => {
    vi.spyOn(fontLoader, 'getFontBase64').mockRejectedValue(
      new Error('Font fetch failed'),
    );

    await exportTagZip(testConfig);

    const svgCall = fileMock.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any[]) => typeof c[0] === 'string' && c[0].endsWith('.svg'),
    );
    expect(svgCall?.[1]).not.toContain('@font-face');
    expect(svgCall?.[1]).toContain('font-family=');
  });

  it('uses correct zip filename', async () => {
    vi.spyOn(fontLoader, 'getFontBase64').mockResolvedValue('AAAA');

    await exportTagZip(testConfig);

    const zipFileName = vi.mocked(saveAs).mock.calls[0][1];
    expect(zipFileName).toBe('custom-tag_test_text_ff5733.zip');
  });

  it('falls back to text/icon id for filename when label is empty', async () => {
    vi.spyOn(fontLoader, 'getFontBase64').mockResolvedValue('AAAA');

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
});
