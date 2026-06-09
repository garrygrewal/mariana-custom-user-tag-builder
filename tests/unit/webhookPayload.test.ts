import { describe, it, expect } from 'vitest';
import { extractIssueKey } from '../../server/webhookPayload';

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
