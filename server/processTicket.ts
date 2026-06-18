import { getJiraConfig, type JiraConfig } from './config.js';
import {
  buildAdf,
  JiraClient,
  type AdfDoc,
  type JiraClientLike,
  type JiraTransition,
} from './jira.js';
import { parseTicket } from './ticket.js';
import { generateTag, type GeneratedArtifact } from './tagGenerator.js';
import { buildArtifactZip } from './artifactZip.js';

const REVIEW_TEXT =
  ' DESIGN REVIEW NEEDED - Do not upload until approved by design. Please wait for a designer to comment and approve these user tags.';

/** Inline display size (px) for embedded tag previews in the review comment. */
const PREVIEW_PX = 96;

type CommentEmbed =
  | { kind: 'preview'; mediaId: string }
  | { kind: 'zip'; mediaId: string };

interface ReviewOption {
  label: string;
  embeds: CommentEmbed[];
}

function optionLabel(artifact: GeneratedArtifact, index: number, total: number): string {
  if (artifact.label) {
    switch (artifact.source) {
      case 'library':
        return `${artifact.label} (library)`;
      case 'ai':
        return `${artifact.label} (AI-generated)`;
      default: {
        const _exhaustive: never = artifact.source;
        return _exhaustive;
      }
    }
  }
  if (total === 1) {
    return artifact.source === 'ai' ? 'AI-generated option' : 'Library option';
  }
  const letter = String.fromCharCode(65 + index);
  switch (artifact.source) {
    case 'library':
      return `Option ${letter} (library)`;
    case 'ai':
      return `Option ${letter} (AI-generated)`;
    default: {
      const _exhaustive: never = artifact.source;
      return _exhaustive;
    }
  }
}

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
 * followed by labeled inline SVG preview(s) and downloadable ZIP bundle(s).
 */
function buildReviewComment(config: JiraConfig, options: ReviewOption[]): AdfDoc {
  const paragraph: { type: 'paragraph'; content: unknown[] } = {
    type: 'paragraph',
    content: [],
  };
  if (config.reviewMentions?.length) {
    for (let i = 0; i < config.reviewMentions.length; i++) {
      if (i > 0) {
        paragraph.content.push({ type: 'text', text: ' ' });
      }
      const mention = config.reviewMentions[i];
      paragraph.content.push({
        type: 'mention',
        attrs: { id: mention.accountId, text: mention.text },
      });
    }
    paragraph.content.push({ type: 'text', text: REVIEW_TEXT });
  } else {
    paragraph.content.push({ type: 'text', text: REVIEW_TEXT.trimStart() });
  }

  const content: unknown[] = [paragraph];

  for (const option of options) {
    content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: option.label, marks: [{ type: 'strong' }] }],
    });

    for (const embed of option.embeds) {
      if (embed.kind === 'preview') {
        content.push({
          type: 'mediaSingle',
          attrs: { layout: 'center', width: PREVIEW_PX, widthType: 'pixel' },
          content: [
            {
              type: 'media',
              attrs: {
                type: 'file',
                id: embed.mediaId,
                collection: '',
                width: PREVIEW_PX,
                height: PREVIEW_PX,
              },
            },
          ],
        });
        continue;
      }
      content.push({
        type: 'mediaGroup',
        content: [
          {
            type: 'media',
            attrs: { type: 'file', id: embed.mediaId, collection: '' },
          },
        ],
      });
    }
  }

  return { type: 'doc', version: 1, content };
}

/** Assign the ticket to the configured reviewer when set. */
async function assignForDesignReview(
  issueKey: string,
  config: JiraConfig,
  client: JiraClientLike,
): Promise<void> {
  if (!config.assigneeAccountId) return;
  await client.assignIssue(issueKey, config.assigneeAccountId);
}

/** Move the ticket to the configured design-review column (default: In Progress/Review). */
async function transitionForDesignReview(
  issueKey: string,
  config: JiraConfig,
  client: JiraClientLike,
): Promise<void> {
  if (config.transitionId) {
    await client.transition(issueKey, config.transitionId);
    return;
  }

  const statusName = config.transitionStatus;
  if (!statusName) return;

  const transitions = await client.getTransitions(issueKey);
  const match = findTransitionToStatus(transitions, statusName);
  if (!match) {
    throw new Error(
      `No transition to status "${statusName}" available for ${issueKey}`,
    );
  }
  await client.transition(issueKey, match.id);
}

function findTransitionToStatus(
  transitions: JiraTransition[],
  statusName: string,
): JiraTransition | undefined {
  const target = statusName.toLowerCase();
  return transitions.find((t) => t.to.name.toLowerCase() === target);
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
    const reviewOptions: ReviewOption[] = [];
    for (let i = 0; i < result.artifacts.length; i++) {
      const artifact = result.artifacts[i];
      const commentEmbeds: CommentEmbed[] = [];
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
      const zipBytes = await buildArtifactZip(
        artifact.svg,
        artifact.png,
        artifact.svgFileName,
        artifact.pngFileName,
      );
      const zipRef = await client.addAttachment(
        issueKey,
        artifact.zipFileName,
        zipBytes,
        'application/zip',
      );
      commentEmbeds.push({ kind: 'preview', mediaId: svgRef.mediaId });
      commentEmbeds.push({ kind: 'zip', mediaId: zipRef.mediaId });
      reviewOptions.push({
        label: optionLabel(artifact, i, result.artifacts.length),
        embeds: commentEmbeds,
      });
      attachments.push(artifact.svgFileName, artifact.pngFileName, artifact.zipFileName);
    }

    await client.addComment(issueKey, buildReviewComment(config, reviewOptions));

    try {
      await assignForDesignReview(issueKey, config, client);
    } catch (assignError) {
      console.error(`Design-review assignment failed for ${issueKey}:`, assignError);
    }

    try {
      await transitionForDesignReview(issueKey, config, client);
    } catch (transitionError) {
      // Tags and review comment are already on the ticket; don't fail the run.
      console.error(
        `Design-review transition failed for ${issueKey}:`,
        transitionError,
      );
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
