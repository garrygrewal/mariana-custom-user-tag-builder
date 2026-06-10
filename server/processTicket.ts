import { getJiraConfig, type JiraConfig } from './config.js';
import { buildAdf, JiraClient, type AdfDoc, type JiraClientLike } from './jira.js';
import { parseTicket } from './ticket.js';
import { generateTag } from './tagGenerator.js';

const REVIEW_TEXT =
  ' DESIGN REVIEW NEEDED - Do not upload until approved by design. Please wait for a designer to comment and approve these user tags.';

/** Inline display size (px) for embedded tag previews in the review comment. */
const PREVIEW_PX = 96;

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

/**
 * Build the design-review comment: a single line that @mentions the reviewer,
 * followed by the generated tag image(s) embedded inline via media nodes.
 */
function buildReviewComment(config: JiraConfig, mediaIds: string[]): AdfDoc {
  const paragraph: { type: 'paragraph'; content: unknown[] } = {
    type: 'paragraph',
    content: [],
  };
  if (config.reviewAccountId) {
    paragraph.content.push({
      type: 'mention',
      attrs: { id: config.reviewAccountId, text: config.reviewMentionText ?? '@reviewer' },
    });
    paragraph.content.push({ type: 'text', text: REVIEW_TEXT });
  } else {
    paragraph.content.push({ type: 'text', text: REVIEW_TEXT.trimStart() });
  }

  // Embed each preview as a vector SVG sized down so it stays crisp (no
  // upscaling/pixelation) and isn't oversized in the comment stream.
  const media = mediaIds.map((id) => ({
    type: 'mediaSingle',
    attrs: { layout: 'center', width: PREVIEW_PX, widthType: 'pixel' },
    content: [
      {
        type: 'media',
        attrs: { type: 'file', id, collection: '', width: PREVIEW_PX, height: PREVIEW_PX },
      },
    ],
  }));

  return { type: 'doc', version: 1, content: [paragraph, ...media] };
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
    const previewMediaIds: string[] = [];
    for (const artifact of result.artifacts) {
      // Embed the SVG inline (vector — stays crisp at small sizes); keep the
      // PNG as a ticket attachment for quick download/preview.
      const svgRef = await client.addAttachment(
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
      previewMediaIds.push(svgRef.mediaId);
      attachments.push(artifact.svgFileName, artifact.pngFileName);
    }

    await client.addComment(issueKey, buildReviewComment(config, previewMediaIds));

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
