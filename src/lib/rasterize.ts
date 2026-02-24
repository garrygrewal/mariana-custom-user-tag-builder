import { EXPORT_SIZE } from '../constants';

/**
 * Rasterize an SVG string to a PNG Blob at EXPORT_SIZE x EXPORT_SIZE (30x30).
 * Uses an OffscreenCanvas + Image element with a data URI.
 */
export function svgToPngBlob(svgString: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const size = EXPORT_SIZE;
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error('Canvas 2D context unavailable'));
      }
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas toBlob returned null'));
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG into Image'));
    };

    img.src = url;
  });
}
