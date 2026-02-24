import { useCallback } from 'react';
import styles from './HexColorInput.module.css';

interface Props {
  value: string;
  onChange: (hex: string) => void;
}

export default function HexColorInput({ value, onChange }: Props) {
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = e.target.value.trim();
      if (!v.startsWith('#')) v = '#' + v;
      v = v.slice(0, 7);
      if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) {
        onChange(v);
      }
    },
    [onChange],
  );

  const handleSwatchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value.toUpperCase());
    },
    [onChange],
  );

  return (
    <div className={styles.wrapper}>
      <input
        type="color"
        className={styles.swatch}
        value={value.length === 7 ? value : '#000000'}
        onChange={handleSwatchChange}
        aria-label="Color picker"
      />
      <input
        type="text"
        className={styles.input}
        value={value}
        onChange={handleTextChange}
        placeholder="#6923F4"
        maxLength={7}
        aria-label="Hex color code"
      />
    </div>
  );
}
