import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, drawSelection, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { LanguageSupport, syntaxHighlighting } from "@codemirror/language";
import { markdownLanguage } from "@codemirror/lang-markdown";

import { markdownHighlight } from "./highlight.ts";
import { markdownKeymap } from "./markdown-keys.ts";
import { editorTheme } from "./theme.ts";
import { typewriter } from "./typewriter.ts";

export interface EditorOptions {
  parent: HTMLElement;
  doc?: string;
  onChange?: (doc: string) => void;
}

function baseExtensions(onChange?: (doc: string) => void): Extension[] {
  return [
    history(),
    drawSelection(),
    EditorView.lineWrapping,
    new LanguageSupport(markdownLanguage),
    syntaxHighlighting(markdownHighlight),
    editorTheme,
    typewriter(),
    // Ours first: Enter and Tab must beat the defaults.
    keymap.of([...markdownKeymap, ...defaultKeymap, ...historyKeymap]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange?.(update.state.doc.toString());
    }),
  ];
}

export function createEditor({ parent, doc = "", onChange }: EditorOptions): EditorView {
  return new EditorView({
    parent,
    state: EditorState.create({ doc, extensions: baseExtensions(onChange) }),
  });
}

/**
 * Swap the document without tearing down the view. History is reset on
 * purpose: undo must not reach back across a note boundary.
 */
export function loadDocument(view: EditorView, doc: string, onChange?: (doc: string) => void) {
  view.setState(EditorState.create({ doc, extensions: baseExtensions(onChange) }));
}
