import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import {
  type ChangeSpec,
  type EditorState,
  type Extension,
  RangeSetBuilder,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

import { tableChanges } from "./table-format.ts";
import { MONO_FAMILY } from "./theme.ts";

interface TableRange {
  from: number;
  to: number;
}

/**
 * The table the given position stands in.
 *
 * Asked at the start of the line rather than at the position itself: the end
 * of the last row and the start of the line under it are the same offset seen
 * from two sides, and a caret that has just left the table would still resolve
 * into it.
 */
function tableAt(state: EditorState, pos: number): TableRange | null {
  let node = syntaxTree(state).resolveInner(state.doc.lineAt(pos).from, 1);

  while (node.name !== "Table") {
    const parent = node.parent;
    if (!parent) return null;
    node = parent;
  }
  return { from: node.from, to: node.to };
}

const tableLine = Decoration.line({ class: "cm-table" });
const headerLine = Decoration.line({ class: "cm-table cm-table-header" });

function tableLines(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { doc } = view.state;
  // A table can straddle two visible ranges and so be entered twice.
  let written = -1;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== "Table") return;

        const first = doc.lineAt(node.from).number;
        const last = doc.lineAt(node.to).number;
        for (let n = first; n <= last; n++) {
          const line = doc.line(n);
          if (line.from <= written) continue;
          written = line.from;
          builder.add(line.from, line.from, n === first ? headerLine : tableLine);
        }
        return false;
      },
    });
  }

  return builder.finish();
}

/*
 * Table rows are set in the same monospace as code spans, because a column is
 * a column only if a space is as wide as a letter — iA Writer Quattro is not
 * quite monospaced, and padding it with spaces would prove nothing. Cells keep
 * the line's own size: a code span at 0.9em would tilt the grid it sits in.
 */
const tableTheme = EditorView.theme({
  ".cm-line.cm-table": {
    /*
     * A table is not prose and is not held to the prose measure. It starts
     * where the prose starts and grows right into whatever the window has to
     * spare; on a window with nothing to spare that is the prose measure
     * again, wrapped. Wrapping rather than scrolling is the point: a
     * horizontal scrollbar under a page of writing is worse than the rare
     * table it would save.
     */
    maxWidth: "none",
    marginLeft: "max(0px, (100% - var(--measure)) / 2)",
    marginRight: "0",
    fontFamily: MONO_FAMILY,
    fontSize: "0.9em",
    fontVariantNumeric: "tabular-nums",
  },
  ".cm-table span": { fontSize: "1em" },
  ".cm-table-header": { fontWeight: "700" },
});

const decorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = tableLines(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = tableLines(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function align(view: EditorView, changes: ChangeSpec[]): void {
  if (changes.length > 0) view.dispatch({ changes, userEvent: "input.format" });
}

function alignTableAt(view: EditorView, pos: number): void {
  if (pos > view.state.doc.length) return;
  const table = tableAt(view.state, pos);
  if (table) align(view, tableChanges(view.state, table.from, table.to));
}

/** Line the pipes up in every table in the note. */
export function alignTables(view: EditorView): void {
  const { state } = view;
  const changes: ChangeSpec[] = [];
  // A table below the viewport may not be parsed yet, and this is asked of the
  // whole note; the partial tree is still better than nothing if that times out.
  const tree = ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state);

  tree.iterate({
    enter: (node) => {
      if (node.name !== "Table") return;
      changes.push(...tableChanges(state, node.from, node.to));
      return false;
    },
  });

  align(view, changes);
}

/**
 * Aligning a table by itself, when the caret leaves it — never while it is
 * being typed, where re-padding on every keystroke would slide the columns out
 * from under the word being written. Same reasoning as the file names: the
 * shape settles once the thing is finished, not mid-phrase.
 *
 * Kept apart from the rest so it can be switched off. What is left then is how
 * tables are drawn, which is not a matter of opinion, and the palette command,
 * which is asked for rather than done to you.
 */
export const autoAlign: Extension = EditorView.updateListener.of((update) => {
  if (!update.docChanged && !update.selectionSet) return;

  const left = tableAt(update.startState, update.startState.selection.main.head);
  if (!left) return;

  const from = update.changes.mapPos(left.from, 1);
  const entered = tableAt(update.state, update.state.selection.main.head);
  if (entered?.from === from) return;

  // Not from inside the update that noticed it: dispatching there is not
  // allowed, and a microtask still runs before anything is painted.
  queueMicrotask(() => alignTableAt(update.view, from));
});

export function tables(): Extension {
  return [decorations, tableTheme];
}
