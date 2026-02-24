import { useMemo } from 'react';
import type { TagConfig } from '../types';
import { buildTagSvg } from '../lib/svgBuilder';
import styles from './TagPreview.module.css';

interface Props {
  config: TagConfig;
  fgHex: string;
  zipName: string;
}

export default function TagPreview({ config, fgHex, zipName }: Props) {
  const svgMarkup = useMemo(
    () => buildTagSvg({ config, fgHex }),
    [config, fgHex],
  );

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.previewArea}
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
        aria-label="Tag preview"
      />
      <div className={styles.meta}>{zipName}</div>
    </div>
  );
}
