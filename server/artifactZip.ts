import JSZip from 'jszip';

/** Bundle SVG + PNG into a ZIP matching the browser export layout. */
export async function buildArtifactZip(
  svg: string,
  png: Uint8Array,
  svgFileName: string,
  pngFileName: string,
): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(svgFileName, svg);
  zip.file(pngFileName, png);
  return zip.generateAsync({ type: 'uint8array' });
}
