import { readFileSync } from 'node:fs';
import { generateText } from 'ai';
import { resolveProjectPath } from './paths';
import { validateComplexSvg } from './svgValidate';
import type { TagRequest } from './ticket';

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
  return [
    'You are a senior icon designer producing a single Mariana Tek custom user tag as SVG.',
    'A user tag is a small circular badge shown at ~16-30px next to a customer name.',
    'Follow the design guidelines exactly. Output ONLY the raw <svg> element — no markdown, no comments, no prose.',
    '',
    '=== DESIGN GUIDELINES ===',
    guidelines,
  ].join('\n');
}

function userPrompt(
  req: TagRequest,
  bgHex: string,
  fgHex: string,
  previous: string[],
  validationFeedback: string | null,
): string {
  const lines = [
    `Tag name: ${req.tagName}`,
    `Brief: ${req.description}`,
    `Background color (use exactly): ${bgHex}`,
    `Foreground color (use exactly for the glyph): ${fgHex}`,
    '',
    'Produce one complete 30x30 SVG: an edge-to-edge background circle',
    `(<circle cx="15" cy="15" r="15" fill="${bgHex}" />) and a single centered,`,
    `monochrome ${fgHex} glyph that represents the brief, fit within 80% width / 72% height.`,
  ];
  if (previous.length > 0) {
    lines.push(
      '',
      'Provide a DISTINCT interpretation that differs visually from these prior options:',
      ...previous.map((p, i) => `Option ${i + 1}: ${p}`),
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
  const maxAttempts = Math.max(options.maxAttempts ?? 2, 1);
  const model = options.model ?? process.env.TAG_AI_MODEL ?? DEFAULT_TAG_AI_MODEL;

  const accepted: string[] = [];
  const warnings: string[] = [];

  for (let option = 0; option < optionCount; option++) {
    let feedback: string | null = null;
    let produced = false;

    for (let attempt = 0; attempt < maxAttempts && !produced; attempt++) {
      const { text } = await generateText({
        model,
        system: systemPrompt(),
        prompt: userPrompt(req, bgHex, fgHex, accepted, feedback),
        maxRetries: 2,
      });

      const svg = stripToSvg(text);
      const validation = validateComplexSvg(svg, bgHex, fgHex);
      if (validation.ok) {
        accepted.push(svg);
        warnings.push(...validation.warnings);
        produced = true;
      } else {
        feedback = validation.errors.map((e) => `- ${e}`).join('\n');
      }
    }
  }

  if (accepted.length === 0) {
    throw new Error('AI failed to produce a valid tag SVG after retries.');
  }

  return { svgs: accepted, model, warnings: Array.from(new Set(warnings)) };
}
