import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JiraClient } from '../../server/jira';
import type { JiraConfig } from '../../server/config';

const config: JiraConfig = {
  baseUrl: 'https://example.atlassian.net',
  email: 'bot@example.com',
  apiToken: 'token',
  fieldMap: {},
};

describe('JiraClient.addAttachment', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/attachments') && init?.method === 'POST') {
          return new Response(JSON.stringify([{ id: '12345' }]), { status: 200 });
        }
        if (url.includes('/attachment/content/12345')) {
          return new Response(null, {
            status: 303,
            headers: {
              location:
                'https://api.media.atlassian.com/file/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/binary',
            },
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips media id resolution when resolveMediaId is false', async () => {
    const client = new JiraClient(config);
    const ref = await client.addAttachment(
      'UTR-1',
      'tag.png',
      new Uint8Array([1, 2, 3]),
      'image/png',
      { resolveMediaId: false },
    );

    expect(ref).toEqual({ id: '12345', filename: 'tag.png' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries media id resolution before failing', async () => {
    let contentAttempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/attachments') && init?.method === 'POST') {
          return new Response(JSON.stringify([{ id: '99999' }]), { status: 200 });
        }
        if (url.includes('/attachment/content/99999')) {
          contentAttempts += 1;
          if (contentAttempts < 3) {
            return new Response(null, { status: 303, headers: { location: '' } });
          }
          return new Response(null, {
            status: 303,
            headers: {
              location:
                'https://api.media.atlassian.com/file/bbbbbbbb-cccc-dddd-eeee-ffffffffffff/binary',
            },
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const client = new JiraClient(config);
    const ref = await client.addAttachment(
      'UTR-1',
      'tag.svg',
      new Uint8Array([1, 2, 3]),
      'image/svg+xml',
    );

    expect(ref.mediaId).toBe('bbbbbbbb-cccc-dddd-eeee-ffffffffffff');
    expect(contentAttempts).toBe(3);
  });
});
