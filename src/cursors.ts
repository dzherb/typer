/*
 * Where the caret was left in each note, so coming back to a note lands you on
 * the word you stopped at rather than at the top. Kept apart from the settings
 * because it is a map that grows with the folder: it is pruned against what is
 * actually on disk, not merged over defaults.
 */

const KEY = "typer.cursors";

type Cursors = Record<string, number>;

/* Storage can throw outright in a private window, so every access is guarded. */

function read(): Cursors {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Cursors) : {};
  } catch {
    return {};
  }
}

function write(cursors: Cursors): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cursors));
  } catch {
    // A caret that cannot be remembered is not worth interrupting anyone for.
  }
}

/** The remembered offset for a note, or 0 for one never opened. */
export function recallCursor(name: string): number {
  const at = read()[name];
  return typeof at === "number" && at >= 0 ? at : 0;
}

export function rememberCursor(name: string, at: number): void {
  const cursors = read();
  if (cursors[name] === at) return;

  cursors[name] = at;
  write(cursors);
}

export function forgetCursor(name: string): void {
  const cursors = read();
  if (!(name in cursors)) return;

  delete cursors[name];
  write(cursors);
}

/** Carry a note's caret across a rename, so the file keeps its place. */
export function renameCursor(from: string, to: string): void {
  const cursors = read();
  const at = cursors[from];
  if (at === undefined || from === to) return;

  cursors[to] = at;
  delete cursors[from];
  write(cursors);
}

/** Drop notes that are no longer in the folder, whoever removed them. */
export function pruneCursors(present: Iterable<string>): void {
  const keep = new Set(present);
  const cursors = read();
  const stale = Object.keys(cursors).filter((name) => !keep.has(name));

  if (!stale.length) return;
  for (const name of stale) delete cursors[name];
  write(cursors);
}
