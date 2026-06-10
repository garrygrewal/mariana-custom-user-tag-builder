import { readFileSync, readdirSync } from 'node:fs';
import { generateText } from 'ai';
import { resolveProjectPath } from './paths.js';
import { validateComplexSvg } from './svgValidate.js';
import type { TagRequest } from './ticket.js';

let guidelinesCache: string | null = null;

function loadGuidelines(): string {
  if (guidelinesCache != null) return guidelinesCache;
  try {
    guidelinesCache = readFileSync(
      resolveProjectPath('docs/user-tag-design-guidelines.md'),
      'utf8',
    );
  } catch {
    guidelinesCache = '';
  }
  return guidelinesCache;
}

let exemplarsCache: string | null = null;

/**
 * Load curated house-style example tags (full approved SVGs) to anchor the
 * model's structure and visual quality. Drop/remove .svg files in
 * docs/tag-exemplars to tune the set.
 */
function loadExemplars(): string {
  if (exemplarsCache != null) return exemplarsCache;
  try {
    const dir = resolveProjectPath('docs/tag-exemplars');
    const files = readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.svg'))
      .sort();
    exemplarsCache = files
      .map((f, i) => `Example ${i + 1}:\n${readFileSync(`${dir}/${f}`, 'utf8').trim()}`)
      .join('\n\n');
  } catch {
    exemplarsCache = '';
  }
  return exemplarsCache;
}

/** Default model routed through the Vercel AI Gateway; override via env. */
export const DEFAULT_TAG_AI_MODEL = 'openai/gpt-5.4';

export interface AiSvgOptions {
  /** How many distinct options to attempt (1-3). */
  optionCount?: number;
  /** Validation retries per option. */
  maxAttempts?: number;
  /** Gateway model id (e.g. "openai/gpt-5.4"). */
  model?: string;
}

export interface AiSvgResult {
  svgs: string[];
  model: string;
  /** Validation warnings collected across accepted options. */
  warnings: string[];
}

function stripToSvg(raw: string): string {
  const match = raw.match(/<svg[\s\S]*?<\/svg>/i);
  return (match ? match[0] : raw).trim();
}

function systemPrompt(): string {
  const guidelines = loadGuidelines();
  const exemplars = loadExemplars();
  const parts = [
    'You are a senior icon designer producing a single Mariana Tek custom user tag as SVG.',
    'A user tag is a small circular badge shown at ~16-30px next to a customer name.',
    'Follow the design guidelines exactly. Output ONLY the raw <svg> element — no markdown, no comments, no prose.',
    '',
    '=== DESIGN GUIDELINES ===',
    guidelines,
  ];
  if (exemplars) {
    parts.push(
      '',
      '=== HOUSE-STYLE EXAMPLES ===',
      'These are approved tags. Match their structure and visual quality (solid',
      'FontAwesome-style glyph, negative-space detail via background-colored',
      'sub-paths). Do NOT copy their subjects or colors — use the requested ones.',
      '',
      exemplars,
    );
  }
  return parts.join('\n');
}

function userPrompt(
  req: TagRequest,
  bgHex: string,
  fgHex: string,
  variant: { index: number; total: number } | null,
  validationFeedback: string | null,
): string {
  const lines = [
    `Tag name: ${req.tagName}`,
    `Brief: ${req.description}`,
    ...(req.iconHint ? [`Requested icon/visual: ${req.iconHint}`] : []),
    `Background color (use exactly): ${bgHex}`,
    `Foreground color (use exactly for the glyph): ${fgHex}`,
    '',
    'Produce one complete 30x30 SVG: an edge-to-edge background circle',
    `(<circle cx="15" cy="15" r="15" fill="${bgHex}" />) and a single centered,`,
    `monochrome ${fgHex} glyph that represents the brief, fit within 80% width / 72% height.`,
  ];
  if (variant && variant.total > 1) {
    lines.push(
      '',
      `This is design variation ${variant.index + 1} of ${variant.total}. Make it a` +
        ' visually distinct interpretation (different metaphor, composition, or framing)' +
        ' from the other variations.',
    );
  }
  if (validationFeedback) {
    lines.push(
      '',
      'Your previous attempt was rejected for these reasons — fix them:',
      validationFeedback,
    );
  }
  return lines.join('\n');
}

/**
 * Generate one or more validated complex tag SVGs from the brief.
 *
 * Each option is retried up to `maxAttempts` with validation feedback before
 * being skipped. Throws if no valid option can be produced.
 */
export async function generateComplexSvgs(
  req: TagRequest,
  bgHex: string,
  fgHex: string,
  options: AiSvgOptions = {},
): Promise<AiSvgResult> {
  const optionCount = Math.min(Math.max(options.optionCount ?? 1, 1), 3);
  // Allow one validation retry per option. Options run in parallel and the
  // chosen model is fast, so worst-case wall-time stays well within the
  // function timeout while a single invalid output no longer fails the tag.
  const maxAttempts = Math.max(options.maxAttempts ?? 2, 1);
  const model = options.model ?? process.env.TAG_AI_MODEL ?? DEFAULT_TAG_AI_MODEL;

  // Generate the options concurrently so total latency stays within the
  // function timeout. Each option retries its own validation independently;
  // distinctness is seeded via a variation hint rather than prior outputs.
  const tasks = Array.from({ length: optionCount }, (_, index) =>
    (async (): Promise<{ svg: string; warnings: string[] } | null> => {
      let feedback: string | null = null;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { text } = await generateText({
          model,
          system: systemPrompt(),
          prompt: userPrompt(req, bgHex, fgHex, { index, total: optionCount }, feedback),
          maxRetries: 1,
        });
        const svg = stripToSvg(text);
        const validation = validateComplexSvg(svg, bgHex, fgHex);
        if (validation.ok) return { svg, warnings: validation.warnings };
        feedback = validation.errors.map((e) => `- ${e}`).join('\n');
      }
      return null;
    })(),
  );

  const accepted: string[] = [];
  const warnings: string[] = [];
  for (const result of await Promise.all(tasks)) {
    if (result) {
      accepted.push(result.svg);
      warnings.push(...result.warnings);
    }
  }

  if (accepted.length === 0) {
    throw new Error('AI failed to produce a valid tag SVG after retries.');
  }

  return { svgs: accepted, model, warnings: Array.from(new Set(warnings)) };
}
