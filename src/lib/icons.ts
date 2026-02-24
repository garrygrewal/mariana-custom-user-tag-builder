import type { IconDef } from '../types';

const svgModules = import.meta.glob<string>('../../icons/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});

/** Supports both single- and double-quoted viewBox attributes. */
function parseViewBox(svg: string): string {
  const match = svg.match(/viewBox=["']([^"']+)["']/);
  return match ? match[1] : '0 0 16 16';
}

function idFromPath(path: string): string {
  const file = path.split('/').pop() ?? '';
  const id = file
    .replace(/\.svg$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return id || 'icon';
}

function labelFromId(id: string): string {
  return id
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ICON_REGISTRY: IconDef[] = Object.entries(svgModules)
  .map(([path, svg]) => {
    const id = idFromPath(path);
    return {
      id,
      label: labelFromId(id),
      svgContent: svg,
      viewBox: parseViewBox(svg),
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));
