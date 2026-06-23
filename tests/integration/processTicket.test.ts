import { describe, it, expect, vi } from 'vitest';

const DEFAULT_MOCK_BG = '#7B2FF7';

function mockSvgForPrompt(prompt: string): string {
  const bgMatch = prompt.match(/Background color \(use exactly\): (#[0-9A-F]{6})/i);
  const bg = bgMatch?.[1]?.toUpperCase() ?? DEFAULT_MOCK_BG;
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">' +
    `<circle cx="15" cy="15" r="15" fill="${bg}"/>` +
    '<path d="M9 9h12v12H9z" fill="#FFFFFF"/></svg>'
  );
}

// Avoid any real network call from the complex (AI) path.
vi.mock('ai', () => ({
  generateText: vi.fn(async ({ prompt }: { prompt: string }) => ({
    text: mockSvgForPrompt(prompt),
  })),
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
  assignedTo: string[] = [];
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
  async assignIssue(_key: string, accountId: string): Promise<void> {
    this.assignedTo.push(accountId);
  }
}

const config: JiraConfig = {
  baseUrl: 'https://example.atlassian.net',
  email: 'bot@example.com',
  apiToken: 'token',
  fieldMap: {},
  transitionStatus: undefined,
  reviewMentions: [
    { accountId: 'acct-123', text: '@Reviewer' },
    { accountId: 'acct-456', text: '@Designer Two' },
  ],
  assigneeAccountId: 'acct-123',
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
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    const client = new FakeJiraClient(
      issueWith('Star Member', 'show a star for favorites, color purple'),
    );

    const result = await processTicket('UTR-100', { config, client });

    randomSpy.mockRestore();

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
    expect(mentions(client.comments[0], 'acct-456')).toBe(false);
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
        'Zzyx',
        'Abstract zzyx marker for our loyalty tier using #7B2FF7.',
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

  it('posts one comment with library and AI options when confidence is low', async () => {
    const client = new FakeJiraClient(
      issueWith(
        'Angel Week Finisher',
        'Tag for clients who completed Angel Week. Icon: an angel or a person with a halo. Color #7B2FF7',
      ),
    );

    const result = await processTicket('UTR-100', { config, client });

    expect(result.isComplex).toBe(false);
    expect(result.mode).toBe('icon');
    expect(result.artifactCount).toBe(2);
    expect(client.attachments).toHaveLength(6);

    const svgNames = client.attachments
      .filter((a) => a.mime === 'image/svg+xml')
      .map((a) => a.fileName);
    expect(svgNames.some((n) => n.includes('_ai_'))).toBe(true);
    expect(svgNames.some((n) => !n.includes('_ai_'))).toBe(true);

    expect(client.comments).toHaveLength(1);
    const text = commentText(client.comments[0]);
    expect(text).toContain('DESIGN REVIEW NEEDED');
    expect(text).toContain('Option A (library)');
    expect(text).toContain('Option B (AI-generated)');
    expect(embeddedFileCount(client.comments[0])).toBe(4);
  });

  it('moves the ticket to In Progress/Review after posting the design-review comment', async () => {
    const client = new FakeJiraClient(issueWith('VIP', 'show the letters VIP, color gold'));
    client.availableTransitions = [
      { id: '11', name: 'Start Progress', to: { name: 'In Progress/Review' } },
      { id: '21', name: 'Done', to: { name: 'Done' } },
    ];

    const reviewConfig: JiraConfig = {
      ...config,
      transitionStatus: 'In Progress/Review',
    };

    await processTicket('UTR-100', { config: reviewConfig, client });

    expect(client.transitions).toEqual(['11']);
    expect(client.assignedTo).toEqual(['acct-123']);
  });

  it('handles UTR-87 as two distinct tags with per-tag labels', async () => {
    const client = new FakeJiraClient({
      key: 'UTR-87',
      fields: {
        summary: '(TEST) World Flex Gym Custom User Tag Request',
        description: 'World Flex Gym wants a custom user tag request for good and bad ombrés',
        customfield_10306: 'green for good and red for bad',
        customfield_10307: 'good and bad ombres',
        customfield_10309: 'smiling emoji for the good tag, and sad emoji for the bad tag',
        customfield_10416: 2,
      },
    });

    const reviewConfig: JiraConfig = {
      ...config,
      fieldMap: {
        tagName: 'customfield_10307',
        color: 'customfield_10306',
        count: 'customfield_10416',
        icon: 'customfield_10309',
      },
    };

    const result = await processTicket('UTR-87', { config: reviewConfig, client });

    expect(result.isComplex).toBe(false);
    expect(result.mode).toBe('icon');
    expect(result.artifactCount).toBe(2);
    expect(client.attachments).toHaveLength(6);

    const svgNames = client.attachments
      .filter((a) => a.mime === 'image/svg+xml')
      .map((a) => a.fileName);
    expect(svgNames.some((n) => n.includes('_ai_'))).toBe(false);

    const text = commentText(client.comments[0]);
    expect(text).toContain('Good ombres (library)');
    expect(text).toContain('Bad ombres (library)');
    expect(text).not.toContain('AI-generated');
    expect(embeddedFileCount(client.comments[0])).toBe(4);
  });

  it('handles UTR-86 with a Nucleo globe and no AI fallback', async () => {
    const client = new FakeJiraClient({
      key: 'UTR-86',
      fields: {
        summary: '(TEST) World Cup Custom User Tag',
        description:
          'Average Joes Gym wants a custom user tag for customers who attended the world cup',
        customfield_10307: 'World Cup Attendee',
        customfield_10306: 'Gold',
        customfield_10416: 1,
        customfield_10309: 'Earth or globe',
      },
    });

    const reviewConfig: JiraConfig = {
      ...config,
      fieldMap: {
        tagName: 'customfield_10307',
        color: 'customfield_10306',
        count: 'customfield_10416',
        icon: 'customfield_10309',
      },
    };

    const result = await processTicket('UTR-86', { config: reviewConfig, client });

    expect(result.isComplex).toBe(false);
    expect(result.mode).toBe('icon');
    expect(result.artifactCount).toBe(1);
    expect(client.attachments).toHaveLength(3);
    expect(client.attachments.every((a) => a.size > 0)).toBe(true);

    const svgNames = client.attachments
      .filter((a) => a.mime === 'image/svg+xml')
      .map((a) => a.fileName);
    expect(svgNames.some((n) => n.includes('_ai_'))).toBe(false);

    const text = commentText(client.comments[0]);
    expect(text).toContain('DESIGN REVIEW NEEDED');
    expect(text).not.toContain('Option B (AI-generated)');
    expect(embeddedFileCount(client.comments[0])).toBe(2);
  });

  it('includes regeneration context in the review comment', async () => {
    const client = new FakeJiraClient(
      issueWith('Star Member', 'show a star for favorites, color purple'),
    );

    const result = await processTicket('UTR-100', {
      config,
      client,
      revisionNotes: 'simpler star, darker purple',
    });

    expect(result.regenerated).toBe(true);
    const text = commentText(client.comments[0]);
    expect(text).toContain('Regenerated per designer notes: simpler star, darker purple');
    expect(mentions(client.comments[0], 'acct-123')).toBe(false);
    expect(mentions(client.comments[0], 'acct-456')).toBe(false);
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
      assignIssue: client.assignIssue.bind(client),
    };

    await expect(processTicket('UTR-101', { config, client: failing })).rejects.toThrow(
      'boom',
    );
    expect(client.comments).toHaveLength(1);
    expect(commentText(client.comments[0])).toMatch(/generation failed/i);
  });
});
