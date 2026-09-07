import { describe, expect, test } from "bun:test";
import { EditorState, type Transaction } from "@codemirror/state";
import type { EditorView, KeyBinding } from "@codemirror/view";

import { markdownKeymap } from "../src/editor/markdown-keys.ts";
import { must } from "./support.ts";

/*
 * The keymap is exercised through a view that is nothing but a document and a
 * dispatch — which is all these commands touch. Anything needing a real editor
 * (the DOM, measurement, scrolling) is not in here.
 */
function editor(doc: string, selection?: { anchor: number; head?: number }) {
  let state = EditorState.create({ doc, ...(selection && { selection }) });

  const view = {
    get state() {
      return state;
    },
    dispatch: (transaction: Transaction) => {
      state = transaction.state;
    },
  } as unknown as EditorView;

  return { view, text: () => state.doc.toString(), selection: () => state.selection.main };
}

function binding(key: string): KeyBinding {
  return must(markdownKeymap.find((entry) => entry.key === key));
}

/** The list-aware Tab, which is the first of the two the keymap binds. */
const tab = binding("Tab");

describe("Tab nests a list item", () => {
  test("under the item above it, at that item's text", () => {
    const { view, text } = editor("- one\n- two", { anchor: 8 });

    expect(must(tab.run)(view)).toBe(true);
    expect(text()).toBe("- one\n  - two");
  });

  test("under a numbered item, where a numbered item's text starts", () => {
    const { view, text } = editor("1. one\n2. two", { anchor: 9 });

    expect(must(tab.run)(view)).toBe(true);
    expect(text()).toBe("1. one\n   2. two");
  });

  test("but not the first item of a list, which has nothing to nest under", () => {
    const { view, text } = editor("- one\n- two", { anchor: 2 });

    expect(must(tab.run)(view)).toBe(false);
    expect(text()).toBe("- one\n- two");
  });

  test("and not a line that is not a list item at all", () => {
    const { view } = editor("plain prose", { anchor: 3 });

    expect(must(tab.run)(view)).toBe(false);
  });

  test("only once: an item already nested under its parent stays put", () => {
    const { view } = editor("- one\n  - two", { anchor: 10 });

    expect(must(tab.run)(view)).toBe(false);
  });
});

describe("Shift-Tab moves an item back out", () => {
  test("to the column of the item that held it", () => {
    const { view, text } = editor("- one\n  - two", { anchor: 10 });

    expect(must(tab.shift)(view)).toBe(true);
    expect(text()).toBe("- one\n- two");
  });

  test("but not past the left margin", () => {
    const { view } = editor("- one\n- two", { anchor: 8 });

    expect(must(tab.shift)(view)).toBe(false);
  });
});

describe("a selection of several lines", () => {
  test("moves as one block, keeping its own shape", () => {
    const doc = "- one\n- two\n  - deeper";
    const { view, text } = editor(doc, { anchor: 6, head: doc.length });

    expect(must(tab.run)(view)).toBe(true);
    expect(text()).toBe("- one\n  - two\n    - deeper");
  });
});

describe("Cmd+B and Cmd+I", () => {
  test("wrap the selection in the marker", () => {
    const { view, text } = editor("make this bold", { anchor: 5, head: 14 });

    expect(must(binding("Mod-b").run)(view)).toBe(true);
    expect(text()).toBe("make **this bold**");
  });

  test("unwrap it again when it is already wrapped", () => {
    const { view, text } = editor("make **this bold**", { anchor: 7, head: 16 });

    expect(must(binding("Mod-b").run)(view)).toBe(true);
    expect(text()).toBe("make this bold");
  });

  test("leave the caret between the markers when nothing is selected", () => {
    const { view, text, selection } = editor("word ", { anchor: 5 });

    expect(must(binding("Mod-i").run)(view)).toBe(true);
    expect(text()).toBe("word __");
    expect(selection().head).toBe(6);
  });
});
