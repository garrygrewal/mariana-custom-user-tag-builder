import type { ContrastWarning } from '../types';
import styles from './ContrastWarnings.module.css';

interface Props {
  warnings: ContrastWarning[];
}

export default function ContrastWarnings({ warnings }: Props) {
  if (warnings.length === 0) return null;

  return (
    <div className={styles.list} role="status" aria-live="polite">
      {warnings.map((w) => (
        <div key={w.type} className={styles.warning}>
          {w.message}
        </div>
      ))}
    </div>
  );
}
