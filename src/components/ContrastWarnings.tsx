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
          <svg
            className={styles.warningIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 2L1 21h22L12 2z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          {w.message}
        </div>
      ))}
    </div>
  );
}
