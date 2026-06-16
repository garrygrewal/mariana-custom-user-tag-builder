import { readdirSync, readFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import type { IconDef } from '../src/types.js';
import { resolveProjectPath } from './paths.js';

const NUCLEO_SUBDIR = 'nucleo_core_svg_v1.7.0';
const PREFERRED_SIZE = 32;

export const NUCLEO_ID_PREFIX = 'nucleo-';

/** Supports both single- and double-quoted viewBox attributes. */
function parseViewBox(svg: string): string {
  const match = svg.match(/viewBox=["']([^"']+)["']/);
  return match ? match[1] : '0 0 32 32';
}

interface NucleoCandidate {
  name: string;
  filePath: string;
  size: number;
  /** fill=0, outline=1 */
  variantRank: number;
}

let pathIndexCache: Map<string, string> | null = null;
let registryCache: IconDef[] | null = null;

function nucleoIdFromName(name: string): string {
  return `${NUCLEO_ID_PREFIX}${name.replace(/_/g, '-')}`;
}

function scanNucleoFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.toLowerCase().endsWith('.svg')) out.push(full);
    }
  }
  walk(root);
  return out;
}

function pickBest(candidates: NucleoCandidate[]): NucleoCandidate {
  return [...candidates].sort((a, b) => {
    if (a.variantRank !== b.variantRank) return a.variantRank - b.variantRank;
    const aDist = Math.abs(a.size - PREFERRED_SIZE);
    const bDist = Math.abs(b.size - PREFERRED_SIZE);
    if (aDist !== bDist) return aDist - bDist;
    return a.size - b.size;
  })[0];
}

function labelFromNucleoName(name: string): string {
  return name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildPathIndex(): Map<string, string> {
  if (pathIndexCache) return pathIndexCache;

  const root = resolveProjectPath('icons', NUCLEO_SUBDIR);
  let files: string[] = [];
  try {
    files = scanNucleoFiles(root);
  } catch {
    pathIndexCache = new Map();
    return pathIndexCache;
  }

  const byName = new Map<string, NucleoCandidate[]>();
  for (const filePath of files) {
    const base = basename(filePath, '.svg');
    const m = base.match(/^(\d+)px_(.+)$/i);
    if (!m) continue;

    const rel = relative(root, filePath).replace(/\\/g, '/');
    const isFill = rel.startsWith('fill/');
    const candidate: NucleoCandidate = {
      name: m[2],
      filePath,
      size: Number(m[1]),
      variantRank: isFill ? 0 : 1,
    };
    const list = byName.get(m[2]) ?? [];
    list.push(candidate);
    byName.set(m[2], list);
  }

  pathIndexCache = new Map();
  for (const [name, candidates] of byName) {
    const best = pickBest(candidates);
    pathIndexCache.set(nucleoIdFromName(name), best.filePath);
  }
  return pathIndexCache;
}

/**
 * Lightweight Nucleo registry entries (SVG loaded on demand via hydrateNucleoIcon).
 * Returns an empty list when the Nucleo export folder is absent.
 */
export function loadNucleoIconRegistry(): IconDef[] {
  if (registryCache) return registryCache;

  const index = buildPathIndex();
  registryCache = [...index.keys()]
    .map((id) => {
      const name = id.slice(NUCLEO_ID_PREFIX.length);
      return {
        id,
        label: labelFromNucleoName(name),
        svgContent: '',
        viewBox: '0 0 32 32',
      } satisfies IconDef;
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return registryCache;
}

export function isNucleoIconId(id: string): boolean {
  return id.startsWith(NUCLEO_ID_PREFIX);
}

/** Read the SVG from disk the first time a Nucleo icon is rendered. */
export function hydrateNucleoIcon(icon: IconDef): IconDef {
  if (icon.svgContent || !isNucleoIconId(icon.id)) return icon;

  const filePath = buildPathIndex().get(icon.id);
  if (!filePath) return icon;

  const svgContent = readFileSync(filePath, 'utf8');
  return {
    ...icon,
    svgContent,
    viewBox: parseViewBox(svgContent),
  };
}

/** @internal Test helper — clears cached Nucleo index between runs. */
export function clearNucleoIconCache(): void {
  pathIndexCache = null;
  registryCache = null;
}
