import { describe, it, expect, vi } from 'vitest';

const MOCK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">' +
  '<circle cx="15" cy="15" r="15" fill="#7B2FF7"/>' +
  '<path d="M9 9h12v12H9z" fill="#FFFFFF"/></svg>';

// Avoid any real network call from the complex (AI) path.
vi.mock('ai', () => ({
  generateText: vi.fn(async () => ({ text: MOCK_SVG })),
}));

import { processTicket } from '../../server/processTicket';
import { adfToText, type JiraIssue } from '../../server/ticket';
import type { AdfDoc, AttachmentRef, JiraClientLike, JiraTransition } from '../../server/jira';
import type { JiraConfig } from '../../server/config';

interface CapturedAttachment {
  fileName: string;
  mime: string;
  size: number;
}

class FakeJiraClient implements JiraClientLike {
  attachments: CapturedAttachment[] = [];
  comments: AdfDoc[] = [];
  transitions: string[] = [];
  availableTransitions: JiraTransition[] = [];

  constructor(private readonly issue: JiraIssue) {}

  async getIssue(): Promise<JiraIssue> {
    return this.issue;
  }
  async getTransitions(): Promise<JiraTransition[]> {
    return this.availableTransitions;
  }
  async addAttachment(
    _key: string,
    fileName: string,
    data: Uint8Array,
    mime: string,
  ): Promise<AttachmentRef> {
    this.attachments.push({ fileName, mime, size: data.byteLength });
    return { id: String(this.attachments.length), filename: fileName, mediaId: `media-${this.attachments.length}` };
  }
  async addComment(_key: string, body: AdfDoc): Promise<void> {
    this.comments.push(body);
  }
  async transition(_key: string, transitionId: string): Promise<void> {
    this.transitions.push(transitionId);
  }
}

const config: JiraConfig = {
  baseUrl: 'https://example.atlassian.net',
  email: 'bot@example.com',
  apiToken: 'token',
  fieldMap: {},
  transitionStatus: undefined,
  reviewAccountId: 'acct-123',
  reviewMentionText: '@Reviewer',
};

/** Count embedded file nodes (previews + zip bundles) in a comment doc. */
function embeddedFileCount(doc: AdfDoc): number {
  return doc.content.filter((n) => {
    const type = (n as { type?: string }).type;
    return type === 'mediaSingle' || type === 'mediaGroup';
  }).length;
}

/** True if the comment @mentions the given accountId. */
function mentions(doc: AdfDoc, accountId: string): boolean {
  return JSON.stringify(doc.content).includes(`"id":"${accountId}"`);
}

function issueWith(summary: string, description: string): JiraIssue {
  return {
    key: 'UTR-100',
    fields: {
      summary,
      description: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: description }] },
        ],
      },
    },
  };
}

function commentText(doc: AdfDoc): string {
  return adfToText(doc.content);
}

describe('processTicket', () => {
  it('handles a simple icon ticket via the builder', async () => {
    const client = new FakeJiraClient(
      issueWith('Star Member', 'show a star for favorites, color purple'),
    );

    const result = await processTicket('UTR-100', { config, client });

    expect(result.isComplex).toBe(false);
    expect(result.mode).toBe('icon');
    expect(result.artifactCount).toBe(1);
    expect(client.attachments).toHaveLength(3);

    const mimes = client.attachments.map((a) => a.mime).sort();
    expect(mimes).toEqual(['application/zip', 'image/png', 'image/svg+xml']);
    expect(client.attachments.every((a) => a.size > 0)).toBe(true);

    expect(client.comments).toHaveLength(1);
    const text = commentText(client.comments[0]);
    expect(text).toContain('DESIGN REVIEW NEEDED');
    expect(text.toLowerCase()).not.toContain('intercom');
    expect(mentions(client.comments[0], 'acct-123')).toBe(true);
    // One inline SVG preview and one ZIP download per artifact.
    expect(embeddedFileCount(client.comments[0])).toBe(2);
  });

  it('handles a simple letters tag via the builder (text mode)', async () => {
    const client = new FakeJiraClient(
      issueWith('VIP', 'show the letters VIP, color gold'),
    );

    const result = await processTicket('UTR-100', { config, client });

    expect(result.isComplex).toBe(false);
    expect(result.mode).toBe('text');
    expect(result.artifactCount).toBe(1);
    expect(client.attachments).toHaveLength(3);
    expect(client.attachments.every((a) => a.size > 0)).toBe(true);

    const text = commentText(client.comments[0]);
    expect(text).toContain('DESIGN REVIEW NEEDED');
    expect(text.toLowerCase()).not.toContain('intercom');
    expect(embeddedFileCount(client.comments[0])).toBe(2);
  });

  it('handles a complex ticket via the AI path and produces options', async () => {
    const client = new FakeJiraClient(
      issueWith(
        'Lightning Bolt',
        'Please design a lightning bolt tag using #7B2FF7 for our energy program.',
      ),
    );

    const result = await processTicket('UTR-100', { config, client });

    expect(result.isComplex).toBe(true);
    // count defaults to 1 -> 1 complex option (svg + png).
    expect(result.artifactCount).toBe(1);
    expect(client.attachments).toHaveLength(3);

    const text = commentText(client.comments[0]);
    expect(text).toContain('DESIGN REVIEW NEEDED');
    expect(text.toLowerCase()).not.toContain('intercom');
    // One option -> inline SVG preview plus ZIP bundle.
    expect(embeddedFileCount(client.comments[0])).toBe(2);
  });

  it('moves the ticket to In Progress after posting the design-review comment', async () => {
    const client = new FakeJiraClient(issueWith('VIP', 'show the letters VIP, color gold'));
    client.availableTransitions = [
      { id: '11', name: 'Start Progress', to: { name: 'In Progress' } },
      { id: '21', name: 'Done', to: { name: 'Done' } },
    ];

    const reviewConfig: JiraConfig = {
      ...config,
      transitionStatus: 'In Progress',
    };

    await processTicket('UTR-100', { config: reviewConfig, client });

    expect(client.transitions).toEqual(['11']);
  });

  it('posts a failure comment and rethrows when generation fails', async () => {
    const badIssue: JiraIssue = {
      key: 'UTR-101',
      fields: { summary: 'Pregnant', description: 'needs a custom icon' },
    };
    const client = new FakeJiraClient(badIssue);
    const failing: JiraClientLike = {
      ...client,
      getIssue: async () => {
        throw new Error('boom');
      },
      addComment: client.addComment.bind(client),
      addAttachment: client.addAttachment.bind(client),
      getTransitions: client.getTransitions.bind(client),
      transition: client.transition.bind(client),
    };

    await expect(processTicket('UTR-101', { config, client: failing })).rejects.toThrow(
      'boom',
    );
    expect(client.comments).toHaveLength(1);
    expect(commentText(client.comments[0])).toMatch(/generation failed/i);
  });
});
