import { describe, it, expect } from 'vitest';
import {
  extractIssueKey,
  extractRegenerateRequest,
  parseRegenerateCommand,
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
