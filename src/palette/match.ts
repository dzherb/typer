/*
 * Ranking is deliberately plain: a prefix beats a substring, a substring beats
 * scattered letters, and earlier hits beat later ones. Nothing here needs to be
 * clever — the folder is one person's notes, not a search engine.
 */

/** ё and е are the same letter for anyone actually typing Russian. */
function fold(text: string): string {
  return text.toLowerCase().replace(/ё/g, "е");
}

const PREFIX = 1000;
const SUBSTRING = 600;
const SUBSEQUENCE = 200;

/** Higher is better; null means no match. */
export function score(haystack: string, needle: string): number | null {
  if (!needle) return 0;

  const hay = fold(haystack);
  const want = fold(needle);

  const at = hay.indexOf(want);
  if (at === 0) return PREFIX - want.length;
  if (at > 0) return SUBSTRING - Math.min(at, 400);

  // Scattered letters, in order: "prot" finds "pro-otpusk".
  let cursor = 0;
  let gaps = 0;
  for (const ch of want) {
    const found = hay.indexOf(ch, cursor);
    if (found === -1) return null;
    gaps += found - cursor;
    cursor = found + 1;
  }
  return SUBSEQUENCE - Math.min(gaps, 190);
}

export interface Excerpt {
  text: string;
  /** Offset of the match within `text`, for highlighting. */
  at: number;
  length: number;
}

const CONTEXT = 44;

/** A one-line window around the first occurrence, for full-text hits. */
export function excerpt(body: string, needle: string): Excerpt | null {
  const at = fold(body).indexOf(fold(needle));
  if (at === -1) return null;

  const start = Math.max(0, at - CONTEXT);
  const end = Math.min(body.length, at + needle.length + CONTEXT);
  const slice = body.slice(start, end).replace(/\s+/g, " ").trim();

  // Re-locate the match inside the collapsed slice.
  const offset = fold(slice).indexOf(fold(needle));
  return {
    text: (start > 0 ? "…" : "") + slice + (end < body.length ? "…" : ""),
    at: offset === -1 ? 0 : offset + (start > 0 ? 1 : 0),
    length: needle.length,
  };
}
