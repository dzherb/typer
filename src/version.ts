/*
 * The only place that knows what a version looks like.
 *
 * Two layers, kept apart on purpose. The number is declared by hand in
 * package.json and moves rarely; the build behind it is worked out by
 * vite.config.ts on every build and answers a different question — not "which
 * release is this" but "which code is actually running", which is the one the
 * service worker can make interesting.
 */

declare const __VERSION__: string;
declare const __BUILD__: string;

/** The declared number. Minor when the commands change, major when a folder does. */
export const version = __VERSION__;

/*
 * `define` is evaluated once, when the vite server starts. In dev that means a
 * commit and a clock from whenever the morning began, and by the afternoon the
 * string would be quietly wrong — in the one place anyone looks when something
 * has gone wrong. So dev says so instead. Empty when the build had no git.
 */
const build = import.meta.env.DEV ? "dev" : __BUILD__;

/** What the version reads as everywhere: `0.1.0 · 7b44b5f+ · 2026-09-04 14:32`. */
export const versionLine = build ? `${version} · ${build}` : version;
