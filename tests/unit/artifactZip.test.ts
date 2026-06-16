import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildArtifactZip } from '../../server/artifactZip';

describe('buildArtifactZip', () => {
  it('bundles svg and png under their original filenames', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const zipBytes = await buildArtifactZip(
      svg,
      png,
      'custom-tag_vip_text_ff5733.svg',
      'custom-tag_vip_text_ff5733.png',
    );

    expect(zipBytes.byteLength).toBeGreaterThan(0);

    const zip = await JSZip.loadAsync(zipBytes);
    expect(Object.keys(zip.files).sort()).toEqual([
      'custom-tag_vip_text_ff5733.png',
      'custom-tag_vip_text_ff5733.svg',
    ]);
    expect(await zip.file('custom-tag_vip_text_ff5733.svg')!.async('string')).toBe(svg);
    expect(await zip.file('custom-tag_vip_text_ff5733.png')!.async('uint8array')).toEqual(png);
  });
});
