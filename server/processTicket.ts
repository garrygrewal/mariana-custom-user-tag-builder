import { getJiraConfig, type JiraConfig } from './config.js';
import { JiraClient, buildAdf, type AdfDoc, type JiraClientLike } from './jira.js';
import { parseTicket, type TagRequest } from './ticket.js';
import { generateTag, type GenerationResult } from './tagGenerator.js';

export interface ProcessResult {
  issueKey: string;
  isComplex: boolean;
  mode: string;
  artifactCount: number;
  attachments: string[];
}

export interface ProcessDeps {
  config?: JiraConfig;
  client?: JiraClientLike;
}

function buildDraftComment(req: TagRequest, result: GenerationResult): AdfDoc {
  const { classification, bgHex, fgHex, artifacts, warnings, aiModel } = result;

  const facts: string[] = [
    `Routing: ${classification.isComplex ? 'custom (AI-authored SVG)' : `builder (${classification.mode})`} — ${classification.reason}`,
    `Background: ${bgHex}${req.colorMatched ? '' : ' (inferred — please confirm the requested color)'}`,
    `Foreground: ${fgHex}`,
  ];
  for (const a of artifacts) {
    facts.push(
      `${a.optionLabel ?? 'Tag'}: ${a.svgFileName} + ${a.pngFileName}`,
    );
  }
  if (aiModel) facts.push(`Generated with: ${aiModel}`);

  const blocks: Array<string | string[]> = [
    'Automated user-tag draft for designer review. These were auto-generated and have NOT been sent to the requester or client.',
    facts,
  ];

  if (warnings.length > 0) {
    blocks.push(warnings.map((w) => `Warning: ${w}`));
  }

  blocks.push(
    'Next: review the attached SVG/PNG, adjust or pick an option if needed, then forward the approved tag to the client yourself using the usual client comment prefix.',
  );

  return buildAdf(blocks);
}

function buildFailureComment(error: unknown): AdfDoc {
  const message = error instanceof Error ? error.message : String(error);
  return buildAdf([
    'Automated user-tag generation failed for this ticket. A designer needs to create the tag manually.',
    [`Error: ${message}`],
  ]);
}

/**
 * Process a single UTR ticket end-to-end: read it, generate the tag(s),
 * attach the SVG/PNG artifacts, and post an internal draft comment for the
 * designer. On failure, best-effort posts a failure comment and rethrows.
 */
export async function processTicket(
  issueKey: string,
  deps: ProcessDeps = {},
): Promise<ProcessResult> {
  const config = deps.config ?? getJiraConfig();
  const client = deps.client ?? new JiraClient(config);

  try {
    const issue = await client.getIssue(issueKey);
    const req = parseTicket(issue, config.fieldMap);
    const result = await generateTag(req);

    const attachments: string[] = [];
    for (const artifact of result.artifacts) {
      await client.addAttachment(
        issueKey,
        artifact.svgFileName,
        new TextEncoder().encode(artifact.svg),
        'image/svg+xml',
      );
      await client.addAttachment(
        issueKey,
        artifact.pngFileName,
        artifact.png,
        'image/png',
      );
      attachments.push(artifact.svgFileName, artifact.pngFileName);
    }

    await client.addComment(issueKey, buildDraftComment(req, result));

    if (config.transitionId) {
      await client.transition(issueKey, config.transitionId);
    }

    return {
      issueKey,
      isComplex: result.classification.isComplex,
      mode: result.classification.mode,
      artifactCount: result.artifacts.length,
      attachments,
    };
  } catch (error) {
    await client.addComment(issueKey, buildFailureComment(error)).catch(() => {});
    throw error;
  }
}
