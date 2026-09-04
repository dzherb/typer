import type { EditorView } from "@codemirror/view";

/** Anything outside the editor that has its own claim on the caret. */
const FIELD = "input, textarea, select, [contenteditable]";

/**
 * Whether a click landed on the editor's scrollbar rather than on the page.
 * The bar takes the space between the client box and the border box, so
 * anything past that edge belongs to it — and dragging it must keep working.
 */
function onScrollbar(view: EditorView, event: MouseEvent): boolean {
  const scroller = view.scrollDOM;
  return event.clientX > scroller.getBoundingClientRect().left + scroller.clientWidth;
}

/**
 * Leave the caret alone unless the writer aims at the text.
 *
 * The editor is the whole page, but the text is a column in the middle of it,
 * and the chrome that appears over it — a notice, the backdrop the palette
 * dims the page with — is not part of the editor at all. A click anywhere but
 * the text used to lose the caret: focus landed on the page body, and no key
 * brought it back, so the writer had to find the text and click it again.
 *
 * Refusing that click's default settles both halves of it. Nothing is blurred,
 * so the caret stays exactly where it was left — a click beside the text is
 * simply a click on nothing, not a way to move it — and the button under the
 * pointer still gets its click.
 */
export function keepCaret(view: EditorView): void {
  document.addEventListener("mousedown", (event) => {
    if (!(event.target instanceof Element)) return;
    // The text itself: the editor places the caret, which is what was asked.
    if (view.contentDOM.contains(event.target)) return;
    // A modal dialog owns the focus while it is open, and the editor under it
    // is inert; the caret comes back when it closes, below.
    if (document.querySelector("dialog[open]")) return;
    if (event.target.closest(FIELD)) return;
    if (onScrollbar(view, event)) return;

    event.preventDefault();
    view.focus();
  });

  /*
   * A dialog gives focus back to whatever held it before, but the same click
   * that closed the palette then takes it away again for the page body. Ask
   * for it back. The event does not bubble, hence the capture phase, and it
   * arrives a turn late — by which time a dialog that closed only to reopen,
   * as the palette does to ask for a name, is open again and none of our
   * business.
   */
  document.addEventListener(
    "close",
    () => {
      if (!document.querySelector("dialog[open]")) view.focus();
    },
    true,
  );
}
