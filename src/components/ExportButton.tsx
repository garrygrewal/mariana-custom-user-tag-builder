import { useState, useCallback } from 'react';
import type { TagConfig } from '../types';
import { exportTagZip } from '../lib/exportZip';
import styles from './ExportButton.module.css';

interface Props {
  config: TagConfig;
  disabled: boolean;
}

export default function ExportButton({ config, disabled }: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportTagZip(config);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [config]);

  return (
    <button
      type="button"
      className={styles.btn}
      disabled={disabled || exporting}
      onClick={handleExport}
    >
      {exporting ? (
        'Exporting...'
      ) : (
        <>
          <svg
            className={styles.downloadIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download ZIP
        </>
      )}
    </button>
  );
}
