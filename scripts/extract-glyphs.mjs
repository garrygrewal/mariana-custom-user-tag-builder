// One-off tool: extract recolorable glyphs from approved full tags in
// reference-tags/ into builder library icons in icons/. Computes a tight
// viewBox by rasterizing the glyph and scanning alpha bounds, and skips tags
// whose detail depends on background-colored negative space (not recolorable).
//
//   node scripts/extract-glyphs.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(ROOT, 'reference-tags');
const OUT = resolve(ROOT, 'icons');
const SCALE = 10; // 30u -> 300px

// src filename (no .svg) -> { id, synonyms }. Already-extracted glyphs are
// intentionally omitted so re-running this round does not touch them.
const CANDIDATES = [
  ['EmergencyServices', 'emergency-services', ['emergency', 'ambulance', 'paramedic', 'ems']],
  ['Hands', 'hands', ['hands', 'helping', 'gratitude', 'namaste']],
  ['BirthdayReservation', 'birthday', ['birthday', 'bday', 'cake', 'celebration']],
  ['CCIssue', 'alert', ['alert', 'warning', 'exclamation', 'caution']],
  ['Add-OnReservation', 'dollar', ['dollar', 'payment', 'money']],
  // Reviewed-out: Military (negative-space/two-color), EnergyExchange ("EE"
  // text), CommunityPartnership (duplicate of existing handshake).
];

const PRESERVE = new Set(['', 'none', 'inherit', 'currentcolor', 'context-fill', 'context-stroke']);
const isPreserved = (v) => {
  const t = v.trim().toLowerCase();
  return PRESERVE.has(t) || t.startsWith('url(') || t.startsWith('var(');
};

function innerOf(svg) {
  const m = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  return m ? m[1] : svg;
}

/** Strip the first drawable element (the background circle or circle-path). */
function stripBackground(inner) {
  const m = inner.match(/<(circle|rect|ellipse|path)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/i);
  if (!m) return { glyph: inner.trim(), bg: null };
  const el = m[0];
  const fill = el.match(/fill=["']([^"']+)["']/i);
  const stroke = el.match(/stroke=["']([^"']+)["']/i);
  const bg =
    fill && fill[1].toLowerCase() !== 'none'
      ? fill[1].toLowerCase()
      : stroke
        ? stroke[1].toLowerCase()
        : null;
  return { glyph: inner.replace(el, '').trim(), bg };
}

/** Distinct, non-inherited paint colors used by the glyph. */
function glyphColors(s) {
  const set = new Set();
  for (const m of s.matchAll(/(?:fill|stroke)=["']([^"']+)["']/gi)) {
    if (!isPreserved(m[1])) set.add(m[1].toLowerCase());
  }
  for (const m of s.matchAll(/(?:fill|stroke)\s*:\s*([^;"']+)/gi)) {
    if (!isPreserved(m[1])) set.add(m[1].trim().toLowerCase());
  }
  return set;
}

function bbox(glyphInner) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">${glyphInner}</svg>`;
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: 30 * SCALE }, background: 'rgba(0,0,0,0)' }).render();
  const { width: w, height: h, pixels } = img;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (pixels[(y * w + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  // Integer viewBox (matches the library convention); round outward so the
  // glyph is never clipped.
  const minXi = Math.floor(minX / SCALE);
  const minYi = Math.floor(minY / SCALE);
  const maxXi = Math.ceil((maxX + 1) / SCALE);
  const maxYi = Math.ceil((maxY + 1) / SCALE);
  return { minX: minXi, minY: minYi, w: maxXi - minXi, h: maxYi - minYi };
}

const accepted = [];
const skipped = [];
for (const [src, id, synonyms] of CANDIDATES) {
  const file = resolve(SRC, `${src}.svg`);
  if (!existsSync(file)) {
    skipped.push(`${src} (missing file)`);
    continue;
  }
  const svg = readFileSync(file, 'utf8');
  const { glyph, bg } = stripBackground(innerOf(svg));
  if (!glyph) {
    skipped.push(`${src} (empty after background strip)`);
    continue;
  }
  const colors = glyphColors(glyph);
  if (colors.size !== 1 || (bg && colors.has(bg))) {
    skipped.push(`${src} (not single-color: {${[...colors].join(', ')}} bg=${bg})`);
    continue;
  }
  const box = bbox(glyph);
  if (!box) {
    skipped.push(`${src} (empty render)`);
    continue;
  }
  const out = `<svg xmlns="http://www.w3.org/2000/svg" width="${box.w}" height="${box.h}" viewBox="${box.minX} ${box.minY} ${box.w} ${box.h}" fill="none">\n${glyph}\n</svg>\n`;
  writeFileSync(resolve(OUT, `${id}.svg`), out);
  accepted.push({ id, synonyms });
}

console.log(`\nAccepted ${accepted.length}:`);
for (const a of accepted) console.log(`  ${a.id}`);
console.log(`\nSkipped ${skipped.length}:`);
for (const s of skipped) console.log(`  ${s}`);

console.log('\n--- synonyms snippet for classify.ts ICON_SYNONYMS ---');
for (const a of accepted) {
  console.log(`  '${a.id}': [${a.synonyms.map((s) => `'${s}'`).join(', ')}],`);
}
