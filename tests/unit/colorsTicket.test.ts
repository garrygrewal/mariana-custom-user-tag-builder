import { describe, it, expect } from 'vitest';
import { extractColor, normalizeHex, DEFAULT_BG_HEX } from '../../server/colors';
import { parseTicket, adfToText, type JiraIssue } from '../../server/ticket';

describe('normalizeHex', () => {
  it('expands shorthand and uppercases', () => {
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(normalizeHex('6923f4')).toBe('#6923F4');
  });
  it('rejects invalid hex', () => {
    expect(normalizeHex('nope')).toBeNull();
  });
});

describe('extractColor', () => {
  it('prefers an explicit hex', () => {
    const r = extractColor('please use #1F3FBF for the background');
    expect(r).toMatchObject({ hex: '#1F3FBF', matched: true, source: 'hex' });
  });
  it('falls back to a named color', () => {
    const r = extractColor('make it green');
    expect(r.source).toBe('name');
    expect(r.matched).toBe(true);
  });
  it('uses the default when nothing matches', () => {
    const r = extractColor('no color mentioned here');
    expect(r).toMatchObject({ hex: DEFAULT_BG_HEX, matched: false, source: 'default' });
  });
});

describe('adfToText', () => {
  it('flattens ADF content to text', () => {
    const adf = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Tag color: purple.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Number of tags: 2' }] },
      ],
    };
    expect(adfToText(adf)).toContain('Tag color: purple.');
    expect(adfToText(adf)).toContain('Number of tags: 2');
  });
});

describe('parseTicket', () => {
  it('parses summary, color, and count from a text-based issue', () => {
    const issue: JiraIssue = {
      key: 'UTR-42',
      fields: {
        summary: 'Pregnant',
        description: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Indicate a pregnant client. Color blue. Number of tags: 2.' },
              ],
            },
          ],
        },
        duedate: '2026-07-01',
      },
    };
    const req = parseTicket(issue);
    expect(req.issueKey).toBe('UTR-42');
    expect(req.tagName).toBe('Pregnant');
    expect(req.bgHex).toBe('#2D6CDF'); // blue
    expect(req.colorMatched).toBe(true);
    expect(req.count).toBe(2);
    expect(req.dueDate).toBe('2026-07-01');
  });

  it('honors configured custom fields', () => {
    const issue: JiraIssue = {
      key: 'UTR-7',
      fields: {
        summary: 'fallback summary',
        customfield_1: 'Founding Member',
        customfield_2: '#A4D233',
        customfield_3: '3',
        customfield_4: 'A laurel wreath for founding members',
      },
    };
    const req = parseTicket(issue, {
      tagName: 'customfield_1',
      color: 'customfield_2',
      count: 'customfield_3',
      description: 'customfield_4',
    });
    expect(req.tagName).toBe('Founding Member');
    expect(req.bgHex).toBe('#A4D233');
    expect(req.count).toBe(3);
    expect(req.description).toContain('laurel wreath');
  });
});
