import { useRef, useState, useCallback, type Dispatch } from 'react';
import type { TagConfig, TagMode } from '../types';
import type { TagAction } from '../hooks/useTagState';
import { TEXT_MAX_LENGTH } from '../constants';
import { createUploadedIcon } from '../lib/uploadedIcon';
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

const INVALID_CHARS_RE = /[^A-Za-z0-9]/;

export default function TagForm({ state, dispatch, warnings }: Props) {
  const [textError, setTextError] = useState('');
  const [iconUploadError, setIconUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (INVALID_CHARS_RE.test(raw)) {
        setTextError('Only A\u2013Z and 0\u20139 are allowed.');
      } else {
        setTextError('');
      }
      dispatch({ type: 'SET_TEXT', payload: raw });
    },
    [dispatch],
  );

  const handleUploadSvg = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const file = input.files?.[0];
      if (!file) return;

      try {
        if (!/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') {
          throw new Error('Please upload a .svg file.');
        }

        const svgContent = await file.text();
        const uploadedIcon = createUploadedIcon(file.name, svgContent);
        dispatch({ type: 'SET_UPLOADED_ICON', payload: uploadedIcon });
        setIconUploadError('');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to parse the uploaded SVG.';
        setIconUploadError(message);
      } finally {
        input.value = '';
      }
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
          <label htmlFor="tag-text">Text (A-Z, 0-9)</label>
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
            uploadedIcon={state.uploadedIcon}
            onSelect={(id) =>
              dispatch({ type: 'SET_ICON_ID', payload: id })
            }
          />
          <div className={styles.uploadRow}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".svg,image/svg+xml"
              className={styles.fileInput}
              aria-label="Upload SVG icon file"
              onChange={handleUploadSvg}
            />
            <div className={styles.uploadBtnRow}>
              <button
                type="button"
                className={styles.uploadBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload Icon
              </button>
              {state.uploadedIcon ? (
                <>
                  <div className={styles.hint}>
                    {state.uploadedIcon.label}
                  </div>
                  <button
                    type="button"
                    className={styles.clearUploadBtn}
                    onClick={() => dispatch({ type: 'SET_UPLOADED_ICON', payload: null })}
                  >
                    Remove uploaded icon
                  </button>
                </>
              ) : null}
            </div>
            {iconUploadError ? (
              <div className={styles.error} role="alert">
                {iconUploadError}
              </div>
            ) : null}
            <div className={styles.hint}>Accepted format: SVG</div>
          </div>
        </div>
      )}
    </div>
  );
}
