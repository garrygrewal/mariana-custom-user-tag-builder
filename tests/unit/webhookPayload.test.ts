import { describe, it, expect } from 'vitest';
import {
  extractIssueKey,
  extractIssueKeyFromQuery,
  extractRegenerateRequest,
  parseRegenerateCommand,
  resolveIssueKey,
} from '../../server/webhookPayload';

describe('extractIssueKey', () => {
  it('reads { issue: { key } }', () => {
    expect(extractIssueKey({ issue: { key: 'UTR-123' } })).toBe('UTR-123');
  });
  it('reads { issueKey }', () => {
    expect(extractIssueKey({ issueKey: 'UTR-9' })).toBe('UTR-9');
  });
  it('reads { key }', () => {
    expect(extractIssueKey({ key: 'ABC-1' })).toBe('ABC-1');
  });
  it('reads nested { data: { issue: { key } } }', () => {
    expect(extractIssueKey({ data: { issue: { key: 'UTR-5' } } })).toBe('UTR-5');
  });
  it('parses a JSON string body', () => {
    expect(extractIssueKey('{"issue":{"key":"UTR-77"}}')).toBe('UTR-77');
  });
  it('accepts a bare key string', () => {
    expect(extractIssueKey('UTR-2')).toBe('UTR-2');
  });
  it('returns null for unrecognized input', () => {
    expect(extractIssueKey({ foo: 'bar' })).toBeNull();
    expect(extractIssueKey('not a key')).toBeNull();
    expect(extractIssueKey(null)).toBeNull();
  });
  it('reads top-level Automation format { key }', () => {
    expect(extractIssueKey({ key: 'UTR-55', fields: { summary: 'VIP' } })).toBe('UTR-55');
  });
  it('reads { jira_key } and { jiraKey }', () => {
    expect(extractIssueKey({ jira_key: 'UTR-8' })).toBe('UTR-8');
    expect(extractIssueKey({ jiraKey: 'UTR-8' })).toBe('UTR-8');
  });
  it('extracts key from Jira self/browse URLs', () => {
    expect(
      extractIssueKey({
        self: 'https://example.atlassian.net/rest/api/2/issue/UTR-99',
      }),
    ).toBe('UTR-99');
  });
});

describe('extractIssueKeyFromQuery', () => {
  it('reads ?key=UTR-123', () => {
    expect(extractIssueKeyFromQuery({ key: 'UTR-123' })).toBe('UTR-123');
  });

  it('reads ?issueKey= and ?issue= aliases', () => {
    expect(extractIssueKeyFromQuery({ issueKey: 'UTR-4' })).toBe('UTR-4');
    expect(extractIssueKeyFromQuery({ issue: 'UTR-4' })).toBe('UTR-4');
  });

  it('uses the first value when query params are arrays', () => {
    expect(extractIssueKeyFromQuery({ key: ['UTR-7', 'UTR-8'] })).toBe('UTR-7');
  });

  it('rejects unsubstituted smart values', () => {
    expect(extractIssueKeyFromQuery({ key: '{{issue.key}}' })).toBeNull();
  });
});

describe('resolveIssueKey', () => {
  it('prefers the POST body over the query string', () => {
    expect(resolveIssueKey({ issue: { key: 'UTR-1' } }, { key: 'UTR-2' })).toBe('UTR-1');
  });

  it('falls back to ?key= when the body has no issue key', () => {
    expect(resolveIssueKey({}, { key: 'UTR-99' })).toBe('UTR-99');
    expect(resolveIssueKey(null, { key: 'UTR-99' })).toBe('UTR-99');
  });
});

describe('parseRegenerateCommand', () => {
  it('parses notes after the command', () => {
    expect(parseRegenerateCommand('/regenerate-tag darker green')).toBe('darker green');
  });

  it('allows an empty notes body', () => {
    expect(parseRegenerateCommand('/regenerate-tag')).toBe('');
  });

  it('supports multiline notes', () => {
    expect(parseRegenerateCommand('/regenerate-tag line one\nline two')).toBe(
      'line one\nline two',
    );
  });

  it('returns null when the command is absent', () => {
    expect(parseRegenerateCommand('please update the tag')).toBeNull();
  });
});

describe('extractRegenerateRequest', () => {
  it('is not triggered for issue-created payloads', () => {
    expect(extractRegenerateRequest({ issue: { key: 'UTR-1' } })).toEqual({
      triggered: false,
    });
  });

  it('reads revisionNotes and commentAuthorId', () => {
    expect(
      extractRegenerateRequest({
        issue: { key: 'UTR-2' },
        revisionNotes: '/regenerate-tag simpler icon',
        commentAuthorId: 'acct-99',
      }),
    ).toEqual({
      triggered: true,
      notes: 'simpler icon',
      commentAuthorId: 'acct-99',
    });
  });

  it('marks invalid regenerate comments as triggered without notes', () => {
    expect(
      extractRegenerateRequest({
        revisionNotes: 'not a command',
        commentAuthorId: 'acct-1',
      }),
    ).toEqual({
      triggered: true,
      notes: undefined,
      commentAuthorId: 'acct-1',
    });
  });
});
