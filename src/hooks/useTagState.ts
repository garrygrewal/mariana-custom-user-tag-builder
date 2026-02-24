import { useReducer, useMemo } from 'react';
import type { TagConfig, TagMode, ContrastWarning } from '../types';
import {
  TEXT_MAX_LENGTH,
  CONTRAST_THRESHOLD_TEXT,
  CONTRAST_THRESHOLD_BG_WHITE,
} from '../constants';
import { contrastRatio, pickForeground } from '../lib/contrast';
import { buildFileName } from '../lib/slugify';

export type TagAction =
  | { type: 'SET_BG_HEX'; payload: string }
  | { type: 'SET_MODE'; payload: TagMode }
  | { type: 'SET_TEXT'; payload: string }
  | { type: 'SET_ICON_ID'; payload: string };

const initialState: TagConfig = {
  label: '',
  bgHex: '#6923F4',
  mode: 'text',
  text: '',
  iconId: '',
};

function reducer(state: TagConfig, action: TagAction): TagConfig {
  switch (action.type) {
    case 'SET_BG_HEX':
      return { ...state, bgHex: action.payload };
    case 'SET_MODE':
      return { ...state, mode: action.payload };
    case 'SET_TEXT': {
      const cleaned = action.payload
        .toUpperCase()
        .replace(/[^A-Z0-9.]/g, '')
        .slice(0, TEXT_MAX_LENGTH);
      return { ...state, text: cleaned };
    }
    case 'SET_ICON_ID':
      return { ...state, iconId: action.payload };
    default:
      return state;
  }
}

export function useTagState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const derived = useMemo(() => {
    const fgHex = pickForeground(state.bgHex);
    const fgBgContrast = contrastRatio(fgHex, state.bgHex);
    const bgWhiteContrast = contrastRatio(state.bgHex, '#FFFFFF');

    const warnings: ContrastWarning[] = [];
    if (fgBgContrast < CONTRAST_THRESHOLD_TEXT) {
      warnings.push({
        type: 'low-fg-contrast',
        message: `Low text/icon contrast (${fgBgContrast.toFixed(1)}:1). Minimum recommended is ${CONTRAST_THRESHOLD_TEXT}:1.`,
        ratio: fgBgContrast,
      });
    }
    if (bgWhiteContrast < CONTRAST_THRESHOLD_BG_WHITE) {
      warnings.push({
        type: 'low-bg-visibility',
        message: `Tag may be hard to see on white backgrounds (${bgWhiteContrast.toFixed(1)}:1). Minimum recommended is ${CONTRAST_THRESHOLD_BG_WHITE}:1.`,
        ratio: bgWhiteContrast,
      });
    }

    const fileLabel =
      state.label.trim() ||
      (state.mode === 'text' ? state.text.trim() : state.iconId.trim());

    const zipName = buildFileName(
      fileLabel,
      state.mode,
      state.bgHex,
      'zip',
    );

    return { fgHex, fgBgContrast, bgWhiteContrast, warnings, zipName };
  }, [state]);

  return { state, dispatch, derived } as const;
}
