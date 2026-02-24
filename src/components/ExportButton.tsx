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
      {exporting ? 'Exporting...' : 'Download ZIP'}
    </button>
  );
}
