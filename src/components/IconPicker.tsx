import { useEffect, useMemo, useRef, useState } from 'react';
import { ICON_REGISTRY } from '../lib/icons';
import type { IconDef } from '../types';
import styles from './IconPicker.module.css';

const DISPLAY_PAINT_ATTR_RE =
  /\b(fill|stroke)\s*=\s*["']\s*(?:white|#fff(?:fff)?)\s*["']/gi;
const DISPLAY_PAINT_STYLE_RE =
  /\b(fill|stroke)\s*:\s*(?:white|#fff(?:fff)?|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)|rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*1(?:\.0+)?\s*\))/gi;

function recolorDisplayPaint(svgContent: string): string {
  return svgContent
    .replace(DISPLAY_PAINT_ATTR_RE, '$1="#333"')
    .replace(DISPLAY_PAINT_STYLE_RE, '$1:#333');
}

interface Props {
  selectedId: string;
  uploadedIcon?: IconDef | null;
  onSelect: (id: string) => void;
}

export default function IconPicker({
  selectedId,
  uploadedIcon = null,
  onSelect,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const iconOptions = useMemo(() => {
    if (!uploadedIcon) return ICON_REGISTRY;
    return [uploadedIcon, ...ICON_REGISTRY.filter((icon) => icon.id !== uploadedIcon.id)];
  }, [uploadedIcon]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredIcons = useMemo(
    () =>
      iconOptions.filter((icon) => {
        if (!normalizedQuery) return true;
        return (
          icon.label.toLowerCase().includes(normalizedQuery) ||
          icon.id.toLowerCase().includes(normalizedQuery)
        );
      }),
    [iconOptions, normalizedQuery],
  );

  const selectedIcon = iconOptions.find((icon) => icon.id === selectedId) ?? null;
  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  const selectedLabel = selectedIcon?.label ?? '';
  const showSelectedInField = Boolean(selectedLabel) && query.length === 0;
  const noIcons = iconOptions.length === 0;
  const noMatches = filteredIcons.length === 0;
  const selectedThumbSvg = selectedIcon
    ? recolorDisplayPaint(selectedIcon.svgContent)
    : null;

  return (
    <div className={styles.wrapper} ref={dropdownRef}>
      <div className={styles.combobox}>
        {showSelectedInField && selectedThumbSvg ? (
          <span
            className={styles.thumb}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: selectedThumbSvg }}
          />
        ) : null}

        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder={showSelectedInField ? selectedLabel : 'Search icons'}
          aria-label="Search icons"
          value={query}
          onFocus={() => {
            if (!noIcons) {
              setOpen(true);
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />

        {selectedIcon ? (
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Clear selected icon"
            onClick={() => {
              onSelect('');
              setQuery('');
              setOpen(true);
              inputRef.current?.focus();
            }}
          >
            ×
          </button>
        ) : null}

        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Select icon"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            if (noIcons) return;
            setOpen((v) => !v);
            inputRef.current?.focus();
          }}
          disabled={noIcons}
        >
          {open ? '▴' : '▾'}
        </button>
      </div>

      {open ? (
        <div className={styles.options} role="listbox" aria-label="Icon options">
          {noMatches ? (
            <div className={styles.empty}>No matching icons</div>
          ) : (
            <>
          {filteredIcons.map((icon) => {
            const isSelected = icon.id === selectedId;
            return (
              <button
                key={icon.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
                onClick={() => {
                  onSelect(icon.id);
                  setOpen(false);
                }}
              >
                <span
                  className={styles.thumb}
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{
                    __html: recolorDisplayPaint(icon.svgContent),
                  }}
                />
                <span className={styles.optionLabel}>{icon.label}</span>
              </button>
            );
          })}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
