import { useTagState } from './hooks/useTagState';
import TagForm from './components/TagForm';
import TagPreview from './components/TagPreview';
import ExportButton from './components/ExportButton';
import styles from './App.module.css';

export default function App() {
  const { state, dispatch, derived } = useTagState();

  const canExport =
    /^#[0-9A-Fa-f]{6}$/.test(state.bgHex) &&
    (state.mode === 'text'
      ? state.text.length > 0
      : state.iconId.length > 0 || Boolean(state.uploadedIcon));

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <header className={styles.sidebarHeader}>
            <img
              src="/xplor-logo.svg"
              alt="Xplor"
              className={styles.logo}
            />
            <h1 className={styles.title}>Custom User Tag Builder</h1>
          </header>
        </div>

        <div className={styles.sidebarContent}>
          <TagForm state={state} dispatch={dispatch} warnings={derived.warnings} />
        </div>
        <div className={styles.sidebarActions}>
          <ExportButton config={state} disabled={!canExport} />
        </div>
      </aside>

      <main className={styles.previewPane}>
        <div className={styles.previewBody}>
          <TagPreview
            config={state}
            fgHex={derived.fgHex}
            zipName={derived.zipName}
          />
        </div>
      </main>
    </div>
  );
}
