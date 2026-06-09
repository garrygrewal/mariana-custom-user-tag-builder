import type { JiraConfig } from './config.js';
import type { JiraIssue } from './ticket.js';

/** Atlassian Document Format document node. */
export interface AdfDoc {
  type: 'doc';
  version: 1;
  content: unknown[];
}

/** Public surface of the Jira client, so callers/tests can inject a fake. */
export interface JiraClientLike {
  getIssue(key: string): Promise<JiraIssue>;
  addAttachment(
    key: string,
    fileName: string,
    data: Uint8Array,
    mime: string,
  ): Promise<void>;
  addComment(key: string, body: AdfDoc): Promise<void>;
  transition(key: string, transitionId: string): Promise<void>;
}

export class JiraClient implements JiraClientLike {
  constructor(private readonly config: JiraConfig) {}

  private authHeader(): string {
    const token = Buffer.from(
      `${this.config.email}:${this.config.apiToken}`,
    ).toString('base64');
    return `Basic ${token}`;
  }

  private url(path: string): string {
    return `${this.config.baseUrl}${path}`;
  }

  private async request(
    path: string,
    init: RequestInit & { rawBody?: boolean } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: this.authHeader(),
      Accept: 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };
    if (!init.rawBody && init.body && typeof init.body === 'string') {
      headers['Content-Type'] = 'application/json';
    }

    const resp = await fetch(this.url(path), { ...init, headers });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(
        `Jira ${init.method ?? 'GET'} ${path} failed: ${resp.status} ${resp.statusText} ${text}`.trim(),
      );
    }
    return resp;
  }

  /** Fetch an issue with the fields needed for parsing. */
  async getIssue(key: string): Promise<JiraIssue> {
    const fields = ['summary', 'description', 'duedate'];
    const custom = Object.values(this.config.fieldMap).filter(Boolean) as string[];
    const fieldParam = encodeURIComponent([...fields, ...custom].join(','));
    const resp = await this.request(`/rest/api/3/issue/${key}?fields=${fieldParam}`);
    return (await resp.json()) as JiraIssue;
  }

  /**
   * Upload a file attachment to an issue.
   * Requires the `X-Atlassian-Token: no-check` header.
   */
  async addAttachment(
    key: string,
    fileName: string,
    data: Uint8Array,
    mime: string,
  ): Promise<void> {
    const form = new FormData();
    // Copy into a fresh ArrayBuffer so Blob gets a clean backing store.
    const bytes = new Uint8Array(data.byteLength);
    bytes.set(data);
    form.append('file', new Blob([bytes], { type: mime }), fileName);

    await this.request(`/rest/api/3/issue/${key}/attachments`, {
      method: 'POST',
      body: form,
      rawBody: true,
      headers: { 'X-Atlassian-Token': 'no-check' },
    });
  }

  /** Add a comment (ADF). Optionally restrict visibility to a project role. */
  async addComment(key: string, body: AdfDoc): Promise<void> {
    const payload: Record<string, unknown> = { body };
    if (this.config.commentVisibilityRole) {
      payload.visibility = {
        type: 'role',
        value: this.config.commentVisibilityRole,
      };
    }
    await this.request(`/rest/api/3/issue/${key}/comment`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /** Transition an issue to a new status. */
  async transition(key: string, transitionId: string): Promise<void> {
    await this.request(`/rest/api/3/issue/${key}/transitions`, {
      method: 'POST',
      body: JSON.stringify({ transition: { id: transitionId } }),
    });
  }
}

/** Build a simple ADF document from paragraph/bullet content. */
export function buildAdf(blocks: Array<string | string[]>): AdfDoc {
  const content = blocks.map((block) => {
    if (Array.isArray(block)) {
      return {
        type: 'bulletList',
        content: block.map((item) => ({
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: item }] },
          ],
        })),
      };
    }
    return { type: 'paragraph', content: [{ type: 'text', text: block }] };
  });
  return { type: 'doc', version: 1, content };
}
