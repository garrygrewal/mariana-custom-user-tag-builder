import { useState, useCallback, type Dispatch } from 'react';
import type { TagConfig, TagMode } from '../types';
import type { TagAction } from '../hooks/useTagState';
import { TEXT_MAX_LENGTH } from '../constants';
import HexColorInput from './HexColorInput';
import IconPicker from './IconPicker';
import ContrastWarnings from './ContrastWarnings';
import type { ContrastWarning } from '../types';
import styles from './TagForm.module.css';

interface Props {
  state: TagConfig;
  dispatch: Dispatch<TagAction>;
  warnings: ContrastWarning[];
}

const INVALID_CHARS_RE = /[^A-Za-z0-9.]/;

export default function TagForm({ state, dispatch, warnings }: Props) {
  const [textError, setTextError] = useState('');

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (INVALID_CHARS_RE.test(raw)) {
        setTextError('Only A\u2013Z, 0\u20139, and "." are allowed.');
      } else {
        setTextError('');
      }
      dispatch({ type: 'SET_TEXT', payload: raw });
    },
    [dispatch],
  );

  return (
    <div className={styles.form}>
      <div className={styles.field}>
        <label>Background Color</label>
        <HexColorInput
          value={state.bgHex}
          onChange={(hex) => dispatch({ type: 'SET_BG_HEX', payload: hex })}
        />
      </div>

      <ContrastWarnings warnings={warnings} />

      <div className={styles.field}>
        <label>Type</label>
        <div className={styles.toggleGroup}>
          {(['text', 'icon'] as TagMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`${styles.toggleBtn} ${state.mode === m ? styles.active : ''}`}
              onClick={() => dispatch({ type: 'SET_MODE', payload: m })}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {state.mode === 'text' ? (
        <div className={styles.field}>
          <label htmlFor="tag-text">Text (A-Z, 0-9, .)</label>
          <input
            id="tag-text"
            type="text"
            className={`${styles.textInput} ${textError ? styles.inputError : ''}`}
            value={state.text}
            onChange={handleTextChange}
            maxLength={TEXT_MAX_LENGTH}
            placeholder="ABC"
            aria-describedby={textError ? 'tag-text-error' : undefined}
            style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
          />
          {textError ? (
            <div id="tag-text-error" className={styles.error} role="alert">
              {textError}
            </div>
          ) : (
            <div className={styles.hint}>{state.text.length}/{TEXT_MAX_LENGTH} chars</div>
          )}
        </div>
      ) : (
        <div className={styles.field}>
          <label>Icon</label>
          <IconPicker
            selectedId={state.iconId}
            onSelect={(id) =>
              dispatch({ type: 'SET_ICON_ID', payload: id })
            }
          />
        </div>
      )}
    </div>
  );
}
