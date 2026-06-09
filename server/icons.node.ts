import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IconDef } from '../src/types.js';
import { resolveProjectPath } from './paths.js';

/** Supports both single- and double-quoted viewBox attributes. */
function parseViewBox(svg: string): string {
  const match = svg.match(/viewBox=["']([^"']+)["']/);
  return match ? match[1] : '0 0 16 16';
}

function idFromFile(file: string): string {
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
  return id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

let cache: IconDef[] | null = null;

/**
 * Read the `icons/*.svg` library from disk into the same IconDef shape the
 * browser registry uses. Mirrors src/lib/icons.ts but uses fs instead of the
 * Vite glob import so it runs in a Node/serverless environment.
 */
export function loadIconRegistry(): IconDef[] {
  if (cache) return cache;

  const dir = resolveProjectPath('icons');
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.svg'));
  } catch {
    files = [];
  }

  cache = files
    .map((file) => {
      const svgContent = readFileSync(resolve(dir, file), 'utf8');
      const id = idFromFile(file);
      return {
        id,
        label: labelFromId(id),
        svgContent,
        viewBox: parseViewBox(svgContent),
      } satisfies IconDef;
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return cache;
}

export function getIconById(iconId: string): IconDef | null {
  return loadIconRegistry().find((icon) => icon.id === iconId) ?? null;
}
