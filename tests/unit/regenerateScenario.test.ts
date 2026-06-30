import { describe, it, expect } from 'vitest';
import { parseTicket, applyRevisionNotes } from '../../server/ticket';
import { classify } from '../../server/classify';
import { loadIconRegistry } from '../../server/icons.node';
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
