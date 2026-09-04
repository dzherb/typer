import { Compartment, EditorSelection, EditorState, type Extension } from "@codemirror/state";
import { EditorView, drawSelection, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { LanguageSupport, syntaxHighlighting } from "@codemirror/language";
import { markdownLanguage } from "@codemirror/lang-markdown";

import { hangingIndent } from "./hanging-indent.ts";
import { markdownHighlight } from "./highlight.ts";
import { markdownKeymap } from "./markdown-keys.ts";
import { autoAlign, tables } from "./tables.ts";
import { editorTheme } from "./theme.ts";
import { scrollToAnchor, typewriter } from "./typewriter.ts";

export interface EditorConfig {
  doc?: string;
  /** Offset to put the caret at; clamped, so a stale one is harmless. */
  cursor?: number;
  spellcheck: boolean;
  /** Whether a table lines its own pipes up as the caret leaves it. */
  autoAlign: boolean;
  onChange?: (doc: string) => void;
}

/* Kept in compartments so they can be switched without rebuilding the state. */
const spellcheckSlot = new Compartment();
const autoAlignSlot = new Compartment();

/*
 * CodeMirror sets spellcheck="false" on its content element, so this has to be
 * turned back on explicitly. autocorrect stays off: silently rewriting words
 * in someone's diary is a different thing from underlining them, and
 * CodeMirror's own iOS handling reads that attribute expecting "off".
 */
function spellcheckAttribute(enabled: boolean): Extension {
  return EditorView.contentAttributes.of({ spellcheck: enabled ? "true" : "false" });
}

function baseExtensions({ spellcheck, autoAlign: align, onChange }: EditorConfig): Extension[] {
  return [
    history(),
    drawSelection(),
    EditorView.lineWrapping,
    new LanguageSupport(markdownLanguage),
    syntaxHighlighting(markdownHighlight),
    editorTheme,
    hangingIndent(),
    tables(),
    typewriter(),
    spellcheckSlot.of(spellcheckAttribute(spellcheck)),
    autoAlignSlot.of(align ? autoAlign : []),
    // Ours first: Enter and Tab must beat the defaults.
    keymap.of([...markdownKeymap, ...defaultKeymap, ...historyKeymap]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange?.(update.state.doc.toString());
    }),
  ];
}

export function createEditor(parent: HTMLElement, config: EditorConfig): EditorView {
  return new EditorView({
    parent,
    state: EditorState.create({ doc: config.doc ?? "", extensions: baseExtensions(config) }),
  });
}

/**
 * Swap the document without tearing down the view. History is reset on
 * purpose: undo must not reach back across a note boundary.
 */
export function loadDocument(view: EditorView, config: EditorConfig): void {
  const doc = config.doc ?? "";
  // The file may have been cut short since we last saw it.
  const head = Math.min(Math.max(config.cursor ?? 0, 0), doc.length);

  view.setState(
    EditorState.create({
      doc,
      selection: EditorSelection.cursor(head),
      extensions: baseExtensions(config),
    }),
  );

  // A new state starts scrolled to the top, and nothing has moved the caret,
  // so the typewriter has no edit to react to: the anchoring is asked for.
  scrollToAnchor(view, head);
}

export function setSpellcheck(view: EditorView, enabled: boolean): void {
  view.dispatch({ effects: spellcheckSlot.reconfigure(spellcheckAttribute(enabled)) });
}

export function setAutoAlign(view: EditorView, enabled: boolean): void {
  view.dispatch({ effects: autoAlignSlot.reconfigure(enabled ? autoAlign : []) });
}

/**
 * Make the browser check the note again, against whatever dictionary the
 * document language now names.
 *
 * Changing `<html lang>` does not by itself invalidate the underlines already
 * drawn: they sit there until the text next changes. Someone who switches
 * language and sees the old dictionary's marks concludes the switch did not
 * work. Turning the attribute off and back on over a frame boundary is what
 * makes the browser start over — within one frame it coalesces the two writes
 * and nothing happens.
 */
export function recheckSpelling(view: EditorView, enabled: boolean): void {
  if (!enabled) return;
  setSpellcheck(view, false);
  requestAnimationFrame(() => setSpellcheck(view, true));
}
