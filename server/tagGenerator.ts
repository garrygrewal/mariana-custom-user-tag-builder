import type { TagConfig } from '../src/types';
import { TAG_RADIUS } from '../src/constants';
import { buildTagSvg, fitFontSize } from '../src/lib/svgBuilder';
import { buildOutlinedTextPath } from '../src/lib/textToPath';
import { pickForeground } from '../src/lib/contrast';
import { toSlug } from '../src/lib/slugify';
import { classify, type Classification } from './classify';
import { getIconById, loadIconRegistry } from './icons.node';
import { loadFontTtf } from './fonts.node';
import { svgToPng } from './rasterize.node';
import { generateComplexSvgs } from './aiSvg';
import type { TagRequest } from './ticket';

export interface GeneratedArtifact {
  svg: string;
  png: Buffer;
  svgFileName: string;
  pngFileName: string;
  /** Set for multi-option complex requests (e.g. "Option 1"). */
  optionLabel?: string;
}

export interface GenerationResult {
  classification: Classification;
  bgHex: string;
  fgHex: string;
  artifacts: GeneratedArtifact[];
  warnings: string[];
  aiModel?: string;
}

export interface GenerateOptions {
  /** Override the number of complex options to generate. */
  optionCount?: number;
  model?: string;
}

function fileNames(slug: string, hex: string, optionIndex?: number) {
  const suffix = optionIndex != null ? `_opt${optionIndex + 1}` : '';
  const base = `custom-tag_${slug}${suffix}_${hex.replace(/^#/, '').toLowerCase()}`;
  return { svgFileName: `${base}.svg`, pngFileName: `${base}.png` };
}

function buildSimpleSvg(req: TagRequest, c: Classification, fgHex: string): string {
  const config: TagConfig = {
    label: req.tagName,
    bgHex: req.bgHex,
    mode: c.mode,
    text: c.text ?? '',
    iconId: c.iconId ?? '',
    uploadedIcon: null,
  };

  if (c.mode === 'text' && c.text) {
    const font = loadFontTtf();
    const outlinedTextPath = font
      ? buildOutlinedTextPath({
          text: c.text,
          fontSize: fitFontSize(c.text),
          centerX: TAG_RADIUS,
          centerY: TAG_RADIUS,
          fontBuffer: font.buffer,
        })
      : null;
    return buildTagSvg({ config, fgHex, outlinedTextPath });
  }

  const icon = c.iconId ? getIconById(c.iconId) : null;
  return buildTagSvg({ config, fgHex, icon });
}

/**
 * End-to-end generation for one ticket: classify, build (simple) or author via
 * the LLM (complex), then rasterize each SVG to PNG. Returns attach-ready
 * artifacts plus the routing decision and any advisory warnings.
 */
export async function generateTag(
  req: TagRequest,
  options: GenerateOptions = {},
): Promise<GenerationResult> {
  const registry = loadIconRegistry();
  const classification = classify(req, registry);
  const bgHex = req.bgHex;
  const fgHex = pickForeground(bgHex);
  const slug = toSlug(req.tagName);

  if (!classification.isComplex) {
    const svg = buildSimpleSvg(req, classification, fgHex);
    const names = fileNames(slug, bgHex);
    return {
      classification,
      bgHex,
      fgHex,
      warnings: [],
      artifacts: [
        { svg, png: svgToPng(svg), svgFileName: names.svgFileName, pngFileName: names.pngFileName },
      ],
    };
  }

  const optionCount =
    options.optionCount ?? Math.min(Math.max(req.count, 2), 3);
  const ai = await generateComplexSvgs(req, bgHex, fgHex, {
    optionCount,
    model: options.model,
  });

  const artifacts: GeneratedArtifact[] = ai.svgs.map((svg, i) => {
    const multi = ai.svgs.length > 1;
    const names = fileNames(slug, bgHex, multi ? i : undefined);
    return {
      svg,
      png: svgToPng(svg),
      svgFileName: names.svgFileName,
      pngFileName: names.pngFileName,
      optionLabel: multi ? `Option ${i + 1}` : undefined,
    };
  });

  return {
    classification,
    bgHex,
    fgHex,
    warnings: ai.warnings,
    aiModel: ai.model,
    artifacts,
  };
}
