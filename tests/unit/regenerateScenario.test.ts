import { describe, it, expect } from 'vitest';
import { parseTicket, applyRevisionNotes } from '../../server/ticket';
import { classify } from '../../server/classify';
import { loadIconRegistry } from '../../server/icons.node';
import { generateTag } from '../../server/tagGenerator';
import { applyShadeModifier } from '../../server/colors';

const registry = loadIconRegistry();

describe('UTR-95 regeneration scenario', () => {
  const issue = {
    key: 'UTR-95',
    fields: {
      summary: 'Studio Aura: Pink Circle with Girl in Middle (Name: MAMANBÉBÉ)',
      description:
        'Studio would like a pink icon with a girl in it (a female silhouette would suffice)',
    },
  };

  const revisionNotes =
    'use a lighter shade of pink (pastel pink), and use the user-long-hair icon';

  it('applies pastel pink and user-long-hair on regenerate', () => {
    let req = parseTicket(issue);
    req = applyRevisionNotes(req, revisionNotes);
    const classification = classify(req, registry);

    expect(req.bgHex).toBe(applyShadeModifier('#EC4899', 'pastel'));
    expect(req.explicitIconId).toBe('nucleo-user-long-hair');
    expect(classification).toMatchObject({
      iconId: 'nucleo-user-long-hair',
      confidence: 'high',
      fallbackToAi: false,
    });
  });
});

describe('UTR-115 headset from Nucleo UI', () => {
  const issue = {
    key: 'UTR-115',
    fields: {
      summary:
        'Custom Tag -Change Background colour to be black and white headphones for Instructor Tag',
      description: 'Ritual One Yoga',
      customfield_10416: 1,
      customfield_10306: 'Black',
      customfield_10307: 'Instructor',
      customfield_10309: null,
    },
  };

  const fieldMap = {
    tagName: 'customfield_10307',
    color: 'customfield_10306',
    count: 'customfield_10416',
    icon: 'customfield_10309',
  };

  it('uses nucleo-ui-headset when regenerating with a headset brief', async () => {
    let req = parseTicket(issue, fieldMap);
    req = applyRevisionNotes(req, 'use headset icon from library');
    const classification = classify(req, registry);

    expect(req.explicitIconId).toBe('nucleo-ui-headset');
    expect(classification).toMatchObject({
      iconId: 'nucleo-ui-headset',
      confidence: 'high',
      fallbackToAi: false,
    });

    const result = await generateTag(req);
    expect(result.classification.iconId).toBe('nucleo-ui-headset');
    expect(result.artifacts[0].svg).toContain('10.709,17h-1.959');
    expect(result.artifacts[0].svg).not.toContain('23.7499');
  });
});
