import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, drawSelection, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { LanguageSupport, syntaxHighlighting } from "@codemirror/language";
import { markdownLanguage } from "@codemirror/lang-markdown";

import { markdownHighlight } from "./highlight.ts";
import { markdownKeymap } from "./markdown-keys.ts";
import { editorTheme } from "./theme.ts";
import { typewriter } from "./typewriter.ts";

export interface EditorConfig {
  doc?: string;
  spellcheck: boolean;
  onChange?: (doc: string) => void;
}

/* Kept in a compartment so it can be switched without rebuilding the state. */
const spellcheckSlot = new Compartment();

/*
 * CodeMirror sets spellcheck="false" on its content element, so this has to be
 * turned back on explicitly. autocorrect stays off: silently rewriting words
 * in someone's diary is a different thing from underlining them, and
 * CodeMirror's own iOS handling reads that attribute expecting "off".
 */
function spellcheckAttribute(enabled: boolean): Extension {
  return EditorView.contentAttributes.of({ spellcheck: enabled ? "true" : "false" });
}

function baseExtensions({ spellcheck, onChange }: EditorConfig): Extension[] {
  return [
    history(),
    drawSelection(),
    EditorView.lineWrapping,
    new LanguageSupport(markdownLanguage),
    syntaxHighlighting(markdownHighlight),
    editorTheme,
    typewriter(),
    spellcheckSlot.of(spellcheckAttribute(spellcheck)),
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
  view.setState(EditorState.create({ doc: config.doc ?? "", extensions: baseExtensions(config) }));
}

export function setSpellcheck(view: EditorView, enabled: boolean): void {
  view.dispatch({ effects: spellcheckSlot.reconfigure(spellcheckAttribute(enabled)) });
}
