import type { TagConfig } from '../src/types.js';
import { TAG_RADIUS } from '../src/constants.js';
import { buildTagSvg, fitFontSize } from '../src/lib/svgBuilder.js';
import { buildOutlinedTextPath } from '../src/lib/textToPath.js';
import { pickForeground } from '../src/lib/contrast.js';
import { toSlug } from '../src/lib/slugify.js';
import { classify, type Classification } from './classify.js';
import { resolveExplicitIconId } from './iconIntent.js';
import { getIconById, loadIconRegistry } from './icons.node.js';
import { loadFontTtf } from './fonts.node.js';
import { svgToPng } from './rasterize.node.js';
import { generateComplexSvgs } from './aiSvg.js';
import type { TagRequest } from './ticket.js';

export type ArtifactSource = 'library' | 'ai';

export interface GeneratedArtifact {
  svg: string;
  png: Buffer;
  svgFileName: string;
  pngFileName: string;
  zipFileName: string;
  source: ArtifactSource;
  /** Human label when this artifact is one of several distinct requested tags. */
  label?: string;
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

function fileNames(
  slug: string,
  hex: string,
  options?: { optionIndex?: number; ai?: boolean },
) {
  const suffix = options?.optionIndex != null ? `_opt${options.optionIndex + 1}` : '';
  const aiSuffix = options?.ai ? '_ai' : '';
  const base = `custom-tag_${slug}${suffix}${aiSuffix}_${hex.replace(/^#/, '').toLowerCase()}`;
  return {
    svgFileName: `${base}.svg`,
    pngFileName: `${base}.png`,
    zipFileName: `${base}.zip`,
  };
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
  if (req.variants && req.variants.length >= req.count && req.count > 1) {
    return generateDistinctTags(req, options);
  }
  return generateSingleTag(req, options);
}

async function generateDistinctTags(
  req: TagRequest,
  options: GenerateOptions,
): Promise<GenerationResult> {
  const variants = req.variants!.slice(0, req.count);
  const registry = loadIconRegistry();
  const artifacts: GeneratedArtifact[] = [];
  const warnings: string[] = [];
  let classification: Classification | null = null;
  let aiModel: string | undefined;
  let anyComplex = false;

  for (const variant of variants) {
    const iconHint = variant.iconHint ?? req.iconHint;
    const variantReq: TagRequest = {
      ...req,
      tagName: variant.label,
      iconHint,
      explicitIconId:
        (iconHint ? resolveExplicitIconId(iconHint, registry) : null) ??
        req.explicitIconId,
      bgHex: variant.bgHex,
      colorMatched: variant.colorMatched,
      count: 1,
      variants: undefined,
    };
    const result = await generateSingleTag(variantReq, { ...options, optionCount: 1 });
    anyComplex = anyComplex || result.classification.isComplex;
    classification = classification ?? result.classification;
    aiModel = result.aiModel ?? aiModel;
    warnings.push(...result.warnings);

    for (const artifact of result.artifacts) {
      artifacts.push({ ...artifact, label: variant.label });
    }
  }

  return {
    classification: {
      ...(classification ?? {
        isComplex: anyComplex,
        mode: 'icon',
        confidence: 'high',
        reason: 'Multi-tag request',
      }),
      isComplex: anyComplex || (classification?.isComplex ?? false),
    },
    bgHex: variants[0]?.bgHex ?? req.bgHex,
    fgHex: pickForeground(variants[0]?.bgHex ?? req.bgHex),
    warnings: Array.from(new Set(warnings)),
    aiModel,
    artifacts,
  };
}

async function generateSingleTag(
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
    const artifacts: GeneratedArtifact[] = [
      {
        svg,
        png: svgToPng(svg),
        svgFileName: names.svgFileName,
        pngFileName: names.pngFileName,
        zipFileName: names.zipFileName,
        source: 'library',
      },
    ];

    if (classification.confidence === 'low' && classification.fallbackToAi) {
      const ai = await generateComplexSvgs(req, bgHex, fgHex, {
        optionCount: 1,
        model: options.model,
      });
      const aiSvg = ai.svgs[0];
      if (aiSvg) {
        const aiNames = fileNames(slug, bgHex, { ai: true });
        artifacts.push({
          svg: aiSvg,
          png: svgToPng(aiSvg),
          svgFileName: aiNames.svgFileName,
          pngFileName: aiNames.pngFileName,
          zipFileName: aiNames.zipFileName,
          source: 'ai',
        });
      }
      return {
        classification,
        bgHex,
        fgHex,
        warnings: ai.warnings,
        aiModel: ai.model,
        artifacts,
      };
    }

    return {
      classification,
      bgHex,
      fgHex,
      warnings: [],
      artifacts,
    };
  }

  // One option per requested tag (cost-efficient); a designer reviews and
  // refines. Requests for multiple tags get multiple distinct options.
  const optionCount =
    options.optionCount ?? Math.min(Math.max(req.count, 1), 3);
  const ai = await generateComplexSvgs(req, bgHex, fgHex, {
    optionCount,
    model: options.model,
  });

  const multi = ai.svgs.length > 1;
  const artifacts: GeneratedArtifact[] = ai.svgs.map((svg, i) => {
    const names = fileNames(slug, bgHex, { optionIndex: multi ? i : undefined });
    return {
      svg,
      png: svgToPng(svg),
      svgFileName: names.svgFileName,
      pngFileName: names.pngFileName,
      zipFileName: names.zipFileName,
      source: 'ai' as const,
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
