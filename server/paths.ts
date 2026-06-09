import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve a path to a repo-relative resource (icons, fonts, docs) in a way that
 * works both locally (cwd = repo root) and when bundled into a Vercel function.
 *
 * Tries, in order: PROJECT_ROOT env, process.cwd(), then ascends from this
 * file. Returns the first existing candidate, else a cwd-based path so callers
 * can surface a clear ENOENT.
 */
export function resolveProjectPath(...segments: string[]): string {
  if (segments.length === 1 && isAbsolute(segments[0])) return segments[0];

  const candidates: string[] = [];
  if (process.env.PROJECT_ROOT) {
    candidates.push(resolve(process.env.PROJECT_ROOT, ...segments));
  }
  candidates.push(resolve(process.cwd(), ...segments));

  let dir = here;
  for (let i = 0; i < 8; i++) {
    candidates.push(resolve(dir, ...segments));
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return resolve(process.cwd(), ...segments);
}
