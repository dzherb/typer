import { EditorSelection, type ChangeSpec } from "@codemirror/state";
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
 * nonTightLists: false makes Enter on an empty list item leave the list.
 * The default instead inserts a blank line above it and keeps the marker,
 * turning the list loose — which means Enter can never get you out of one.
 */
const continueMarkup = insertNewlineContinueMarkupCommand({ nonTightLists: false });

export const markdownKeymap: readonly KeyBinding[] = [
  { key: "Enter", run: continueMarkup },
  { key: "Backspace", run: deleteMarkupBackward },
  { key: "Tab", run: indentMore, shift: indentLess },
  { key: "Mod-b", run: toggleWrap("**"), preventDefault: true },
  { key: "Mod-i", run: toggleWrap("_"), preventDefault: true },
];
