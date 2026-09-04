import { readdirSync, readFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import type { IconDef } from '../src/types.js';
import { resolveProjectPath } from './paths.js';

export const NUCLEO_ID_PREFIX = 'nucleo-';

interface NucleoPackConfig {
  subdir: string;
  /** Registry id prefix, e.g. `nucleo-` or `nucleo-ui-`. */
  idPrefix: string;
  preferredSize: number;
}

const NUCLEO_PACKS: NucleoPackConfig[] = [
  { subdir: 'nucleo_core_svg_v1.7.0', idPrefix: 'nucleo-', preferredSize: 32 },
  { subdir: 'nucleo_ui_svg_v1.8.0', idPrefix: 'nucleo-ui-', preferredSize: 18 },
];

/** Supports both single- and double-quoted viewBox attributes. */
function parseViewBox(svg: string): string {
  const match = svg.match(/viewBox=["']([^"']+)["']/);
  return match ? match[1] : '0 0 32 32';
}

interface NucleoCandidate {
  name: string;
  filePath: string;
  size: number;
  variantRank: number;
}

let pathIndexCache: Map<string, string> | null = null;
let registryCache: IconDef[] | null = null;

function nucleoIdFromName(name: string, idPrefix: string): string {
  return `${idPrefix}${name.replace(/_/g, '-')}`;
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

function variantRankFromRel(rel: string): number {
  if (rel.startsWith('fill/')) return 0;
  if (rel.startsWith('outline-duo/')) return 3;
  if (rel.startsWith('outline/')) return 1;
  if (rel.startsWith('glyph-duo/')) return 2;
  return 4;
}

function pickBest(candidates: NucleoCandidate[], preferredSize: number): NucleoCandidate {
  return [...candidates].sort((a, b) => {
    if (a.variantRank !== b.variantRank) return a.variantRank - b.variantRank;
    const aDist = Math.abs(a.size - preferredSize);
    const bDist = Math.abs(b.size - preferredSize);
    if (aDist !== bDist) return aDist - bDist;
    return a.size - b.size;
  })[0];
}

function labelFromNucleoName(name: string): string {
  return name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function indexPack(pack: NucleoPackConfig, index: Map<string, string>): void {
  const root = resolveProjectPath('icons', pack.subdir);
  let files: string[] = [];
  try {
    files = scanNucleoFiles(root);
  } catch {
    return;
  }

  const byName = new Map<string, NucleoCandidate[]>();
  for (const filePath of files) {
    const base = basename(filePath, '.svg');
    const m = base.match(/^(\d+)px_(.+)$/i);
    if (!m) continue;

    const rel = relative(root, filePath).replace(/\\/g, '/');
    const candidate: NucleoCandidate = {
      name: m[2],
      filePath,
      size: Number(m[1]),
      variantRank: variantRankFromRel(rel),
    };
    const list = byName.get(m[2]) ?? [];
    list.push(candidate);
    byName.set(m[2], list);
  }

  for (const [name, candidates] of byName) {
    const best = pickBest(candidates, pack.preferredSize);
    index.set(nucleoIdFromName(name, pack.idPrefix), best.filePath);
  }
}

function buildPathIndex(): Map<string, string> {
  if (pathIndexCache) return pathIndexCache;

  pathIndexCache = new Map();
  for (const pack of NUCLEO_PACKS) {
    indexPack(pack, pathIndexCache);
  }
  return pathIndexCache;
}

/**
 * Lightweight Nucleo registry entries (SVG loaded on demand via hydrateNucleoIcon).
 * Returns an empty list when no Nucleo export folders are present.
 */
export function loadNucleoIconRegistry(): IconDef[] {
  if (registryCache) return registryCache;

  const index = buildPathIndex();
  registryCache = [...index.keys()]
    .map((id) => {
      const prefix = NUCLEO_PACKS.find((pack) => id.startsWith(pack.idPrefix))?.idPrefix
        ?? NUCLEO_ID_PREFIX;
      const name = id.slice(prefix.length);
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
