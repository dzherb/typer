import { describe, expect, test } from "bun:test";
import { EditorState } from "@codemirror/state";

import { tableChanges } from "../src/editor/table-format.ts";

function changesFor(doc: string) {
  const state = EditorState.create({ doc });
  return { state, changes: tableChanges(state, 0, state.doc.length) };
}

/** The document as the whole-note align command would leave it. */
function aligned(doc: string): string {
  const { state, changes } = changesFor(doc);
  return state.update({ changes }).state.doc.toString();
}

describe("tableChanges", () => {
  test("pads every cell in a column to the widest one", () => {
    expect(aligned(["| a | b |", "| --- | --- |", "| longer | x |"].join("\n"))).toBe(
      ["| a      | b   |", "| ------ | --- |", "| longer | x   |"].join("\n"),
    );
  });

  test("keeps a narrow column three wide, so it still looks like one", () => {
    expect(aligned(["|a|b|", "|-|-|"].join("\n"))).toBe(
      ["| a   | b   |", "| --- | --- |"].join("\n"),
    );
  });

  test("states the alignments it was given, and moves the text to match", () => {
    expect(aligned(["| a | b | c |", "|:--|--:|:-:|", "| 1 | 2 | 3 |"].join("\n"))).toBe(
      ["| a   |   b |  c  |", "| :-- | --: | :-: |", "| 1   |   2 |  3  |"].join("\n"),
    );
  });

  test("gives a short row the cells it is missing", () => {
    expect(aligned(["| a | b | c |", "| --- | --- | --- |", "| 1 |"].join("\n"))).toBe(
      ["| a   | b   | c   |", "| --- | --- | --- |", "| 1   |     |     |"].join("\n"),
    );
  });

  test("widens the table for a row longer than its header, rather than losing the text", () => {
    expect(aligned(["| a | b |", "| --- | --- |", "| 1 | 2 | three |"].join("\n"))).toBe(
      ["| a   | b   |       |", "| --- | --- | ----- |", "| 1   | 2   | three |"].join("\n"),
    );
  });

  test("a table inside a quote stays inside it", () => {
    expect(aligned(["> | a | b |", "> | --- | --- |", "> | 1 | 2 |"].join("\n"))).toBe(
      ["> | a   | b   |", "> | --- | --- |", "> | 1   | 2   |"].join("\n"),
    );
  });

  test("an escaped pipe is text, not a border", () => {
    expect(aligned(["| a \\| b | c |", "| --- | --- |"].join("\n"))).toBe(
      ["| a \\| b | c   |", "| ------ | --- |"].join("\n"),
    );
  });

  test("the outer pipes GFM lets a row leave off are put back", () => {
    expect(aligned(["a | b", "--- | ---", "1 | 2"].join("\n"))).toBe(
      ["| a   | b   |", "| --- | --- |", "| 1   | 2   |"].join("\n"),
    );
  });

  test("a column is counted in glyphs, so an accent adds nothing to it", () => {
    // "e" with a combining acute: two code units, one letter.
    expect(aligned(["| é | b |", "| --- | --- |"].join("\n"))).toBe(
      ["| é   | b   |", "| --- | --- |"].join("\n"),
    );
  });

  test("without a delimiter row there is no table to align", () => {
    const { changes } = changesFor(["| a | b |", "| 1 | 2 |"].join("\n"));
    expect(changes).toEqual([]);
  });

  test("one row is not a table either", () => {
    expect(changesFor("| a | b |").changes).toEqual([]);
  });

  test("a table already lined up is left entirely alone", () => {
    const { changes } = changesFor(["| a   | b   |", "| --- | --- |", "| 1   | 2   |"].join("\n"));
    expect(changes).toEqual([]);
  });

  test("the caret keeps its place in a word the padding moves", () => {
    const doc = ["| a | b |", "| --- | --- |", "| longer | x |"].join("\n");
    const { state, changes } = changesFor(doc);

    // The "g" in the middle of "longer".
    const caret = doc.indexOf("longer") + 3;
    expect(doc[caret]).toBe("g");

    const update = state.update({ changes });
    expect(update.state.doc.toString()[update.changes.mapPos(caret)]).toBe("g");
  });
});
