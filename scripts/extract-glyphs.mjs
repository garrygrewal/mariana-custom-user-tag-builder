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

// src filename (no .svg) -> { id, synonyms }
const CANDIDATES = [
  ['Person', 'person', ['person', 'individual', 'profile', 'user']],
  ['Banned', 'banned', ['banned', 'blocked', 'blacklist', 'ban', 'prohibited', 'denied']],
  ['Staff', 'staff', ['staff', 'team member', 'crew']],
  ['Employee', 'employee', ['employee', 'worker', 'colleague']],
  ['Student', 'student', ['student', 'learner', 'pupil', 'academic']],
  ['Vaccinated', 'vaccinated', ['vaccinated', 'vaccine', 'vaccination', 'syringe', 'shot', 'immunized']],
  ['Pregnancy', 'pregnancy', ['pregnancy', 'pregnant', 'prenatal', 'expecting', 'maternity']],
  ['Investor', 'investor', ['investor', 'shareholder', 'backer']],
  ['Injury', 'injury', ['injury', 'injured', 'hurt', 'rehab']],
  ['NoPhoto', 'no-photo', ['no photo', 'no-photo', 'camera off', 'photo banned']],
  ['MissingDocuments', 'missing-documents', ['missing documents', 'missing docs', 'paperwork', 'incomplete']],
  ['EmergencyServices', 'emergency-services', ['emergency', 'ambulance', 'emergency services', 'paramedic']],
  ['Military', 'military', ['military', 'veteran', 'armed forces', 'army', 'service member']],
  ['Sneaker', 'sneaker', ['sneaker', 'trainers', 'footwear', 'kicks']],
  ['HealthProfessional', 'health-professional', ['healthcare', 'medical', 'doctor', 'nurse', 'health professional', 'clinician']],
  ['Corporate', 'corporate', ['corporate', 'company', 'business', 'b2b', 'office']],
  ['Wedding', 'wedding', ['wedding', 'marriage', 'bride', 'groom', 'newlywed']],
  ['FoundingMember', 'founding-member', ['founding member', 'founder', 'charter member']],
  ['FrequentCustomer', 'frequent-customer', ['frequent customer', 'regular', 'loyal', 'frequent shopper']],
  ['Hands', 'hands', ['hands', 'support', 'care', 'helping hands']],
  ['Livestream', 'livestream', ['livestream', 'streaming', 'live', 'broadcast']],
];

const WHITE = new Set(['#fff', '#ffffff', 'white', 'none', 'currentcolor', '']);

function getBgCircleFill(svg) {
  const m = svg.match(/<circle\b[^>]*\br=["']15["'][^>]*>/i);
  if (!m) return { fill: null, circle: null };
  const fill = m[0].match(/fill=["']([^"']+)["']/i);
  return { fill: fill ? fill[1].toLowerCase() : null, circle: m[0] };
}

function innerOf(svg) {
  const m = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  return m ? m[1] : svg;
}

function fills(s) {
  const out = [];
  for (const m of s.matchAll(/(?:fill|stroke)=["']([^"']+)["']/gi)) out.push(m[1].toLowerCase());
  for (const m of s.matchAll(/(?:fill|stroke)\s*:\s*([^;"']+)/gi)) out.push(m[1].trim().toLowerCase());
  return out;
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
  const { fill: bg, circle } = getBgCircleFill(svg);
  if (!circle) {
    skipped.push(`${src} (no bg circle)`);
    continue;
  }
  const glyph = innerOf(svg).replace(circle, '').trim();
  const bad = fills(glyph).filter((f) => !WHITE.has(f));
  if (bad.length) {
    skipped.push(`${src} (non-recolorable fills: ${[...new Set(bad)].join(', ')})`);
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
