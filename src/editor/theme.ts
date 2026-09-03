import { EditorView } from "@codemirror/view";
import { TYPEWRITER_ANCHOR } from "./typewriter.ts";

const topPad = `${(TYPEWRITER_ANCHOR * 100).toFixed(0)}vh`;
const bottomPad = `${((1 - TYPEWRITER_ANCHOR) * 100).toFixed(0)}vh`;

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
  // Padding matches the typewriter anchor so the first and last lines can both
  // reach it without the document appearing to jump.
  ".cm-content": {
    maxWidth: "var(--measure)",
    margin: "0 auto",
    padding: `${topPad} 1.5rem ${bottomPad}`,
    caretColor: "transparent",
  },
  ".cm-line": { padding: "0" },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftWidth: "2px",
    borderLeftColor: "var(--accent)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--selection)",
  },
});
