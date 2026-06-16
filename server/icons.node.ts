import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IconDef } from '../src/types.js';
import {
  hydrateNucleoIcon,
  isNucleoIconId,
  loadNucleoIconRegistry,
} from './nucleoIcons.node.js';
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

let curatedCache: IconDef[] | null = null;
let mergedCache: IconDef[] | null = null;

function loadCuratedIconRegistry(): IconDef[] {
  if (curatedCache) return curatedCache;

  const dir = resolveProjectPath('icons');
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.svg'));
  } catch {
    files = [];
  }

  curatedCache = files
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

  return curatedCache;
}

/**
 * Curated `icons/*.svg` plus lazy Nucleo entries from `icons/nucleo_core_svg_v1.7.0/`.
 * Nucleo SVGs are read from disk on first render via getIconById.
 */
export function loadIconRegistry(): IconDef[] {
  if (mergedCache) return mergedCache;
  mergedCache = [...loadCuratedIconRegistry(), ...loadNucleoIconRegistry()];
  return mergedCache;
}

export function getIconById(iconId: string): IconDef | null {
  const icon = loadIconRegistry().find((entry) => entry.id === iconId) ?? null;
  if (!icon) return null;
  if (isNucleoIconId(iconId)) return hydrateNucleoIcon(icon);
  return icon;
}

/** @internal Test helper — clears cached registries between runs. */
export function clearIconRegistryCache(): void {
  curatedCache = null;
  mergedCache = null;
}
