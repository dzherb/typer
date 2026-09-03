export type Theme = "system" | "light" | "dark";

export interface Settings {
  theme: Theme;
  /** Whether the browser underlines misspellings as you write. */
  spellcheck: boolean;
  /** Name of the note to reopen on startup. */
  lastNote?: string;
}

const KEY = "typer.settings";
const DEFAULTS: Settings = { theme: "system", spellcheck: true };

/* Storage can throw outright in a private window, so every access is guarded. */

export function readSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = { ...readSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // A setting that cannot be remembered is not worth interrupting anyone for.
  }
  return next;
}

/** "system" leaves the attribute off so prefers-color-scheme decides. */
export function applyTheme(theme: Theme): void {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}
