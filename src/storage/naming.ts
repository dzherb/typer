/*
 * Notes are real files someone will look at in Finder, so names are
 * transliterated to Latin: portable across tools, git and URLs.
 */
// biome-ignore format: a table of letters reads as a table
const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

const MAX_SLUG = 48;

export function slugify(title: string): string {
  // The map is keyed by code point, which is what a Cyrillic letter is.
  // eslint-disable-next-line @typescript-eslint/no-misused-spread
  const latin = [...title.toLowerCase()].map((ch) => CYRILLIC[ch] ?? ch).join("");

  return latin
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/, "");
}

/** Local date, not UTC: a note written at 01:00 belongs to that day. */
export function dateStamp(at: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/*
 * A name is provisional while the note has no title yet. Encoding that in the
 * name itself means there is no side table to keep in sync — the file on disk
 * is the whole truth.
 */
const PROVISIONAL = /^\d{4}-\d{2}-\d{2}(-\d+)?\.md$/;

export function isProvisionalName(name: string): boolean {
  return PROVISIONAL.test(name);
}

/**
 * Whether the writer has finished the title line and moved off it.
 *
 * The title is only taken as final once a line exists after it. Otherwise a
 * pause mid-phrase — stopping for a moment to find the right word — is enough
 * for the autosave to freeze half a heading into the file name for good.
 */
export function isTitleComplete(text: string): boolean {
  const lines = text.split("\n");
  const titleLine = lines.findIndex((line) => line.trim() !== "");
  return titleLine !== -1 && titleLine < lines.length - 1;
}

const HEADING = /^#{1,6}\s+(.+?)\s*#*\s*$/;
const MAX_TITLE = 120;

/** The note's display title: its first heading, else its first line of prose. */
export function titleOf(text: string, fallback: string): string {
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    // An empty heading is the marker a note starts under, not a title yet.
    if (!line || /^#{1,6}$/.test(line)) continue;

    const title = HEADING.exec(line)?.[1] ?? line;
    return title.slice(0, MAX_TITLE);
  }
  return fallback.replace(/\.md$/, "");
}
