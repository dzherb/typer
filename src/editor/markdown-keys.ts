import { EditorSelection, type ChangeSpec, type EditorState, type Line } from "@codemirror/state";
import type { Command, KeyBinding } from "@codemirror/view";
import { indentLess, indentMore } from "@codemirror/commands";
import {
  deleteMarkupBackward,
  insertNewlineContinueMarkupCommand,
} from "@codemirror/lang-markdown";

/**
 * Wrap each selection in `mark`, or unwrap it if it is already wrapped.
 * With an empty selection this leaves the caret between the two markers.
 */
function toggleWrap(mark: string): Command {
  return (view) => {
    const { state } = view;
    const changes: ChangeSpec[] = [];
    const ranges = [];

    for (const range of state.selection.ranges) {
      const { from, to } = range;
      const before = state.sliceDoc(Math.max(0, from - mark.length), from);
      const after = state.sliceDoc(to, Math.min(state.doc.length, to + mark.length));

      if (before === mark && after === mark) {
        changes.push({ from: from - mark.length, to: from });
        changes.push({ from: to, to: to + mark.length });
        ranges.push(EditorSelection.range(from - mark.length, to - mark.length));
      } else {
        changes.push({ from, insert: mark });
        changes.push({ from: to, insert: mark });
        ranges.push(EditorSelection.range(from + mark.length, to + mark.length));
      }
    }

    view.dispatch(
      state.update({
        changes,
        selection: EditorSelection.create(ranges, state.selection.mainIndex),
        userEvent: "input.wrap",
      }),
    );
    return true;
  };
}

/*
 * A nested list item has to start where its parent's text starts: column 3
 * under "1. ", column 2 under "- ". A fixed indent unit cannot know that.
 * Two spaces under "1. " is not a child at all — CommonMark reads it as a
 * brand new list, and the line after it becomes a lazy continuation of that
 * item's paragraph, so its "2." stops being a list marker and is left in
 * plain ink while every other marker is dimmed.
 */
const LIST_ITEM = /^([ \t]*)(?:[-*+]|\d+[.)])[ \t]+/;

interface ListLine {
  /** Columns before the marker. */
  indent: number;
  /** Column where the item's own text begins — where a child must start. */
  content: number;
}

function listLine(text: string): ListLine | null {
  const match = LIST_ITEM.exec(text);
  return match ? { indent: match[1].length, content: match[0].length } : null;
}

/** Every line the selection touches, in document order. */
function selectedLines(state: EditorState): Line[] {
  const numbers = new Set<number>();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let n = first; n <= last; n++) numbers.add(n);
  }
  return [...numbers].sort((a, b) => a - b).map((n) => state.doc.line(n));
}

/**
 * The column `line` would have to start at to become a child of the item
 * above it, or null if it cannot move — only the item immediately above can
 * adopt one, and only if this line is not already inside it.
 */
function nestColumn(state: EditorState, line: Line): number | null {
  const here = listLine(line.text);
  if (!here) return null;

  for (let n = line.number - 1; n > 0; n--) {
    const previous = state.doc.line(n);
    if (!previous.text.trim()) continue; // A loose list keeps its blank lines.

    const item = listLine(previous.text);
    if (item) return item.content > here.indent ? item.content : null;
    // An indented line is the parent item's own text and can be looked past;
    // one that starts flush left means the list has not begun yet.
    if (!previous.text.startsWith(" ") && !previous.text.startsWith("\t")) return null;
  }
  return null;
}

/** The column of the enclosing item, i.e. one level back out. */
function unnestColumn(state: EditorState, line: Line): number | null {
  const here = listLine(line.text);
  if (!here || here.indent === 0) return null;

  for (let n = line.number - 1; n > 0; n--) {
    const previous = state.doc.line(n);
    if (!previous.text.trim()) continue;

    const item = listLine(previous.text);
    if (item && item.indent < here.indent) return item.indent;
    if (!item && !previous.text.startsWith(" ") && !previous.text.startsWith("\t")) break;
  }
  return 0;
}

/**
 * Move the selected block one list level in or out. The whole block shifts by
 * the same amount as its first line, so continuation lines and sub-items keep
 * their relative shape. Returns false on anything that is not a list item, so
 * the plain indent commands can have the keystroke instead.
 */
function shiftListItem(outwards: boolean): Command {
  return (view) => {
    const { state } = view;
    const lines = selectedLines(state);
    const first = listLine(lines[0].text);
    if (!first) return false;

    const column = outwards ? unnestColumn(state, lines[0]) : nestColumn(state, lines[0]);
    if (column === null) return false;

    const shift = column - first.indent;
    if (shift === 0) return false;

    const changes: ChangeSpec[] = [];
    for (const line of lines) {
      if (!line.text.trim()) continue;
      const indent = line.text.length - line.text.trimStart().length;
      changes.push({
        from: line.from,
        to: line.from + indent,
        insert: " ".repeat(Math.max(0, indent + shift)),
      });
    }

    view.dispatch(state.update({ changes, userEvent: "input.indent" }));
    return true;
  };
}

/*
 * nonTightLists: false makes Enter on an empty list item leave the list.
 * The default instead inserts a blank line above it and keeps the marker,
 * turning the list loose — which means Enter can never get you out of one.
 */
const continueMarkup = insertNewlineContinueMarkupCommand({ nonTightLists: false });

export const markdownKeymap: readonly KeyBinding[] = [
  { key: "Enter", run: continueMarkup },
  { key: "Backspace", run: deleteMarkupBackward },
  { key: "Tab", run: shiftListItem(false), shift: shiftListItem(true) },
  { key: "Tab", run: indentMore, shift: indentLess },
  { key: "Mod-b", run: toggleWrap("**"), preventDefault: true },
  { key: "Mod-i", run: toggleWrap("_"), preventDefault: true },
];
