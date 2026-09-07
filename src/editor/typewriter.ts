import type { Extension } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";

/**
 * Fraction of the viewport height the caret is pinned to. The editor's top and
 * bottom padding derive from this so the first and last lines can reach the
 * anchor.
 */
export const TYPEWRITER_ANCHOR = 0.38;

/** Pull the caret's line back to the anchor line. */
function reanchor(view: EditorView) {
  const coords = view.coordsAtPos(view.state.selection.main.head);
  if (!coords) return;

  const scroller = view.scrollDOM;
  const box = scroller.getBoundingClientRect();
  const target = box.top + box.height * TYPEWRITER_ANCHOR;
  const delta = coords.top - target;

  if (Math.abs(delta) > 1) scroller.scrollTop += delta;
}

/*
 * Recentre after typing, and after keyboard navigation — but not after a click
 * or a drag-select, where yanking the page out from under the pointer is
 * disorienting rather than helpful.
 */
function shouldReanchor(update: ViewUpdate) {
  if (update.docChanged) return true;
  if (!update.selectionSet) return false;
  return !update.transactions.some(
    (tr) => tr.isUserEvent("select.pointer") || tr.isUserEvent("select.drag"),
  );
}

/**
 * Bring a position onto the anchor line in one scroll — for a note just opened
 * at a remembered caret. Left to the editor rather than measured here: the
 * line is not rendered yet, so its height is still an estimate the editor has
 * to correct before it can settle on a scroll position.
 */
export function scrollToAnchor(view: EditorView, pos: number): void {
  view.dispatch({
    effects: EditorView.scrollIntoView(pos, {
      y: "start",
      yMargin: view.scrollDOM.clientHeight * TYPEWRITER_ANCHOR,
    }),
  });
}

export function typewriter(): Extension {
  return EditorView.updateListener.of((update) => {
    if (shouldReanchor(update)) {
      // After the DOM has settled, so measurement reflects the new layout.
      update.view.requestMeasure({ read: () => reanchor(update.view) });
    }
  });
}
