import type { JiraConfig } from './config.js';
import type { JiraIssue } from './ticket.js';

/** Atlassian Document Format document node. */
export interface AdfDoc {
  type: 'doc';
  version: 1;
  content: unknown[];
}

/** A workflow transition available for an issue (from GET .../transitions). */
export interface JiraTransition {
  id: string;
  name: string;
  to: { name: string };
}

/** Reference to an uploaded attachment, including its media-services id. */
export interface AttachmentRef {
  /** Numeric Jira attachment id. */
  id: string;
  filename: string;
  /** Media-services file UUID, used to embed the file inline in ADF. */
  mediaId: string;
}

/** Public surface of the Jira client, so callers/tests can inject a fake. */
export interface JiraClientLike {
  getIssue(key: string): Promise<JiraIssue>;
  addAttachment(
    key: string,
    fileName: string,
    data: Uint8Array,
    mime: string,
  ): Promise<AttachmentRef>;
  addComment(key: string, body: AdfDoc): Promise<void>;
  getTransitions(key: string): Promise<JiraTransition[]>;
  transition(key: string, transitionId: string): Promise<void>;
  assignIssue(key: string, accountId: string): Promise<void>;
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
   * Requires the `X-Atlassian-Token: no-check` header. Returns the attachment
   * id plus the media-services UUID needed to embed the file inline in ADF.
   */
  async addAttachment(
    key: string,
    fileName: string,
    data: Uint8Array,
    mime: string,
  ): Promise<AttachmentRef> {
    const form = new FormData();
    // Copy into a fresh ArrayBuffer so Blob gets a clean backing store.
    const bytes = new Uint8Array(data.byteLength);
    bytes.set(data);
    form.append('file', new Blob([bytes], { type: mime }), fileName);

    const resp = await this.request(`/rest/api/3/issue/${key}/attachments`, {
      method: 'POST',
      body: form,
      rawBody: true,
      headers: { 'X-Atlassian-Token': 'no-check' },
    });
    const created = (await resp.json()) as Array<{ id?: string }>;
    const id = created[0]?.id;
    if (!id) throw new Error(`Attachment upload for ${fileName} returned no id`);
    const mediaId = await this.resolveMediaId(id);
    return { id, filename: fileName, mediaId };
  }

  /**
   * Resolve an attachment's media-services file UUID by following the
   * `content` redirect to `api.media.atlassian.com/file/<uuid>/...`.
   */
  private async resolveMediaId(attachmentId: string): Promise<string> {
    const resp = await fetch(
      this.url(`/rest/api/3/attachment/content/${attachmentId}`),
      { method: 'GET', headers: { Authorization: this.authHeader() }, redirect: 'manual' },
    );
    const location = resp.headers.get('location') ?? '';
    const match = location.match(/\/file\/([0-9a-fA-F-]{36})/);
    if (!match) {
      throw new Error(`Could not resolve media id for attachment ${attachmentId}`);
    }
    return match[1];
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

  /** List workflow transitions available for an issue. */
  async getTransitions(key: string): Promise<JiraTransition[]> {
    const resp = await this.request(`/rest/api/3/issue/${key}/transitions`);
    const data = (await resp.json()) as { transitions?: JiraTransition[] };
    return data.transitions ?? [];
  }

  /** Transition an issue to a new status. */
  async transition(key: string, transitionId: string): Promise<void> {
    await this.request(`/rest/api/3/issue/${key}/transitions`, {
      method: 'POST',
      body: JSON.stringify({ transition: { id: transitionId } }),
    });
  }

  /** Assign an issue to a user by Atlassian accountId. */
  async assignIssue(key: string, accountId: string): Promise<void> {
    await this.request(`/rest/api/3/issue/${key}/assignee`, {
      method: 'PUT',
      body: JSON.stringify({ accountId }),
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
