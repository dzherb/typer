/*
 * Ranking is deliberately plain: a prefix beats a substring, a substring beats
 * scattered letters, and earlier hits beat later ones. Nothing here needs to be
 * clever — the folder is one person's notes, not a search engine.
 */

/** ё and е are the same letter for anyone actually typing Russian. */
function fold(text: string): string {
  return text.toLowerCase().replace(/ё/g, "е");
}

/*
 * The same physical keys on QWERTY and ЙЦУКЕН, so "ghbdtn" can find "привет"
 * and "ьщтвфн" "monday". The punctuation is in there because on ЙЦУКЕН those
 * keys are letters: "k.,jdm" is "любовь" typed with the wrong layout on.
 * Shifted punctuation is listed as well — lowercasing turns "Х" into "х", but
 * the "{" that Shift+[ gave on QWERTY stays a "{".
 */
const LATIN = "`qwertyuiop[]asdfghjkl;'zxcvbnm,.~{}:\"<>";
const CYRILLIC = "ёйцукенгшщзхъфывапролджэячсмитьбюёхъжэбю";

const SWAP = new Map<string, string>();
for (let i = 0; i < LATIN.length; i++) {
  const latin = LATIN.charAt(i);
  const cyrillic = CYRILLIC.charAt(i);
  SWAP.set(latin, cyrillic);
  // The shifted half would map the Cyrillic back to "{" rather than "[".
  if (!SWAP.has(cyrillic)) SWAP.set(cyrillic, latin);
}

/**
 * The query as it would have come out on the other layout. One character for
 * one, so an excerpt found with it is as long as the query that was typed.
 */
function swapLayout(text: string): string {
  let out = "";
  for (const ch of text.toLowerCase()) out += SWAP.get(ch) ?? ch;
  return out;
}

/** What was typed, then the same keys on the other layout — unless they agree. */
function readings(needle: string): string[] {
  const typed = fold(needle);
  const swapped = fold(swapLayout(needle));
  return swapped === typed ? [typed] : [typed, swapped];
}

const PREFIX = 1000;
const SUBSTRING = 600;
const SUBSEQUENCE = 200;

/**
 * Higher is better; null means no match. The query counts whichever layout it
 * was typed in: the better of its two readings is the score.
 */
export function score(haystack: string, needle: string): number | null {
  if (!needle) return 0;

  const hay = fold(haystack);
  let best: number | null = null;
  for (const want of readings(needle)) {
    const rank = scoreFolded(hay, want);
    if (rank !== null && (best === null || rank > best)) best = rank;
  }
  return best;
}

function scoreFolded(hay: string, want: string): number | null {
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

/**
 * A one-line window around the first occurrence, for full-text hits. The query
 * as typed is looked for first, and the other layout only if it is not there.
 */
export function excerpt(body: string, needle: string): Excerpt | null {
  const folded = fold(body);
  for (const want of readings(needle)) {
    const at = folded.indexOf(want);
    if (at !== -1) return around(body, want, at);
  }
  return null;
}

/** `want` is already folded, and `at` is where it stands in the folded body. */
function around(body: string, want: string, at: number): Excerpt {
  const start = Math.max(0, at - CONTEXT);
  const end = Math.min(body.length, at + want.length + CONTEXT);
  const slice = body.slice(start, end).replace(/\s+/g, " ").trim();

  // Re-locate the match inside the collapsed slice.
  const offset = fold(slice).indexOf(want);
  return {
    text: (start > 0 ? "…" : "") + slice + (end < body.length ? "…" : ""),
    at: offset === -1 ? 0 : offset + (start > 0 ? 1 : 0),
    length: want.length,
  };
}
