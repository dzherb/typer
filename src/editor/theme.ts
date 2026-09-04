import { EditorView } from "@codemirror/view";
import { TYPEWRITER_ANCHOR } from "./typewriter.ts";

const topPad = `${(TYPEWRITER_ANCHOR * 100).toFixed(0)}vh`;
const bottomPad = `${((1 - TYPEWRITER_ANCHOR) * 100).toFixed(0)}vh`;
const gutter = "1.5rem";

/** The one monospaced stack in the app: code spans and tables share it. */
export const MONO_FAMILY = "ui-monospace, SFMono-Regular, Menlo, monospace";

export const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--ink)",
    backgroundColor: "transparent",
    fontSize: "var(--text-size)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "inherit",
    lineHeight: "var(--line-height)",
    overflowX: "hidden",
  },
  /*
   * Vertical padding matches the typewriter anchor so the first and last lines
   * can both reach it without the document appearing to jump.
   *
   * The measure is held by the line rather than by the content, so that a
   * table can step outside it while the prose around it does not move.
   *
   * The content is then wide enough to hold a table that starts where the
   * prose starts: centring the prose puts its left edge at (width - measure)/2,
   * and that offset plus the table's own measure is what has to fit — hence
   * twice the one less the other. Everything below is a share of this box
   * rather than of the window, which is what keeps a wide table clear of the
   * scrollbar: 100vw counts it in and would run under it.
   */
  ".cm-content": {
    maxWidth: `calc(2 * var(--measure-table) - var(--measure) + ${gutter} * 2)`,
    margin: "0 auto",
    padding: `${topPad} ${gutter} ${bottomPad}`,
    caretColor: "transparent",
  },
  ".cm-line": { padding: "0", maxWidth: "var(--measure)", margin: "0 auto" },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftWidth: "2px",
    borderLeftColor: "var(--accent)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--selection)",
  },
});
