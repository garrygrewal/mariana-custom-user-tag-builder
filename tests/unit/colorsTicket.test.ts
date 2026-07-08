import { describe, it, expect } from 'vitest';
import { extractColor, normalizeHex, DEFAULT_BG_HEX, applyShadeModifier, splitColorSpecs, sanitizeBgHex } from '../../server/colors';
import {
  parseTicket,
  adfToText,
  splitConjoinedSpecs,
  splitListSpecs,
  parseSpecSegment,
  type JiraIssue,
} from '../../server/ticket';
import { classify } from '../../server/classify';
import { loadIconRegistry } from '../../server/icons.node';

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
  it('prefers the color tied to "background" when both background and icon colors appear', () => {
    const r = extractColor('Black background - Sage green icon');
    expect(r).toMatchObject({ hex: '#000000', matched: true, source: 'name' });
  });
  it('recognizes sage green as a background color', () => {
    const r = extractColor('Sage green background');
    expect(r).toMatchObject({ hex: '#9CAF88', matched: true, source: 'name' });
  });
  it('uses the default when nothing matches', () => {
    const r = extractColor('no color mentioned here');
    expect(r).toMatchObject({ hex: DEFAULT_BG_HEX, matched: false, source: 'default' });
  });

  it('applies lighter shade modifiers', () => {
    const r = extractColor('use a lighter shade of pink');
    expect(r.matched).toBe(true);
    expect(r.hex).not.toBe('#EC4899');
    expect(r.hex).toBe(applyShadeModifier('#EC4899', 'lighter'));
  });

  it('applies pastel modifiers', () => {
    const r = extractColor('pastel pink background');
    expect(r.matched).toBe(true);
    expect(r.hex).toBe(applyShadeModifier('#EC4899', 'pastel'));
  });

  it('applies darker modifiers', () => {
    const r = extractColor('darker blue');
    expect(r.matched).toBe(true);
    expect(r.hex).toBe(applyShadeModifier('#2D6CDF', 'darker'));
  });

  it('treats "black and white" as a single black background style', () => {
    const r = extractColor('black and white');
    expect(r).toMatchObject({ hex: '#000000', matched: true, source: 'name' });
  });

  it('rejects white as a tag background', () => {
    expect(extractColor('white')).toMatchObject({ hex: '#000000', matched: true });
    expect(extractColor('#FFFFFF')).toMatchObject({ hex: '#000000', matched: true });
    expect(sanitizeBgHex('#FFFFFF')).toBe('#000000');
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

  it('maps the UTR form fields (named color, numeric count, icon hint)', () => {
    const issue: JiraIssue = {
      key: 'UTR-81',
      fields: {
        summary: 'Custom User Tag: Lululemon employee',
        description: 'clients wants a custom user tag that indicates when a user is a lululemon employee',
        customfield_10306: 'red',
        customfield_10307: 'lululemon employee',
        customfield_10309: 'Lululemon logo',
        customfield_10416: 1,
      },
    };
    const req = parseTicket(issue, {
      tagName: 'customfield_10307',
      color: 'customfield_10306',
      count: 'customfield_10416',
      icon: 'customfield_10309',
    });
    expect(req.tagName).toBe('lululemon employee');
    expect(req.bgHex).toBe('#E1251B'); // red
    expect(req.colorMatched).toBe(true);
    expect(req.count).toBe(1);
    expect(req.iconHint).toBe('Lululemon logo');
    expect(req.variants).toBeUndefined();
  });

  it('parses UTR-87 as two distinct tag specs (happy/sad emoji, green/red)', () => {
    const issue: JiraIssue = {
      key: 'UTR-87',
      fields: {
        summary: '(TEST) World Flex Gym Custom User Tag Request',
        description: 'World Flex Gym wants a custom user tag request for good and bad ombrés',
        customfield_10306: 'green for good and red for bad',
        customfield_10307: 'good and bad ombres',
        customfield_10309: 'smiling emoji for the good tag, and sad emoji for the bad tag',
        customfield_10416: 2,
      },
    };
    const req = parseTicket(issue, {
      tagName: 'customfield_10307',
      color: 'customfield_10306',
      count: 'customfield_10416',
      icon: 'customfield_10309',
    });

    expect(req.count).toBe(2);
    expect(req.variants).toHaveLength(2);
    expect(req.variants![0]).toMatchObject({
      label: 'Good ombres',
      iconHint: 'smiling emoji',
      bgHex: '#3DAE2B',
      colorMatched: true,
    });
    expect(req.variants![1]).toMatchObject({
      label: 'Bad ombres',
      iconHint: 'sad emoji',
      bgHex: '#E1251B',
      colorMatched: true,
    });
  });

  it('parses UTR-102 as two number tags with shared black background', () => {
    const issue: JiraIssue = {
      key: 'UTR-102',
      fields: {
        summary: 'Custom User Tag',
        description:
          'Studio: Recoil Bungee Fitness ID: 7010\n\nwould like a tag for the numbers 16 and 17. Please have them the same colour and style as the standard number user tags.',
        customfield_10306: 'black and white',
        customfield_10307: '16, 17',
        customfield_10309: '16 and 17',
        customfield_10416: 2,
      },
    };
    const req = parseTicket(issue, {
      tagName: 'customfield_10307',
      color: 'customfield_10306',
      count: 'customfield_10416',
      icon: 'customfield_10309',
    });

    expect(req.count).toBe(2);
    expect(req.bgHex).toBe('#000000');
    expect(req.variants).toHaveLength(2);
    expect(req.variants![0]).toMatchObject({
      label: '16',
      iconHint: '16',
      bgHex: '#000000',
      colorMatched: true,
    });
    expect(req.variants![1]).toMatchObject({
      label: '17',
      iconHint: '17',
      bgHex: '#000000',
      colorMatched: true,
    });

    const registry = loadIconRegistry();
    for (const variant of req.variants!) {
      const c = classify(
        {
          ...req,
          tagName: variant.label,
          iconHint: variant.iconHint,
          bgHex: variant.bgHex,
          count: 1,
          variants: undefined,
        },
        registry,
      );
      expect(c).toMatchObject({
        isComplex: false,
        mode: 'text',
        text: variant.label,
        confidence: 'high',
      });
    }
  });
});

describe('parseTagVariants helpers', () => {
  it('splits conjoined specs on "and"', () => {
    expect(splitConjoinedSpecs('green for good and red for bad')).toEqual([
      'green for good',
      'red for bad',
    ]);
  });

  it('splits comma-separated short tokens', () => {
    expect(splitListSpecs('16, 17')).toEqual(['16', '17']);
    expect(splitListSpecs('16 and 17')).toEqual(['16', '17']);
  });

  it('does not split "black and white" into two colors', () => {
    expect(splitColorSpecs('black and white')).toEqual(['black and white']);
    expect(splitColorSpecs('green for good and red for bad')).toEqual([
      'green for good',
      'red for bad',
    ]);
  });

  it('extracts qualifier segments from icon hints', () => {
    expect(parseSpecSegment('smiling emoji for the good tag')).toEqual({
      value: 'smiling emoji',
      qualifier: 'good',
    });
  });
});
