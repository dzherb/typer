import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  forgetCursor,
  pruneCursors,
  recallCursor,
  rememberCursor,
  renameCursor,
} from "../src/cursors.ts";
import { dropStorage, useStorage } from "./support.ts";

describe("cursors", () => {
  beforeEach(() => {
    useStorage();
  });
  afterEach(dropStorage);

  test("a note never opened starts at the top", () => {
    expect(recallCursor("2026-09-07.md")).toBe(0);
  });

  test("remembers where a note was left", () => {
    rememberCursor("a.md", 42);
    expect(recallCursor("a.md")).toBe(42);
    expect(recallCursor("b.md")).toBe(0);
  });

  test("a nonsense offset is read as the top", () => {
    localStorage.setItem("typer.cursors", JSON.stringify({ "a.md": -1, "b.md": "twelve" }));
    expect(recallCursor("a.md")).toBe(0);
    expect(recallCursor("b.md")).toBe(0);
  });

  test("forgetting a note leaves the others alone", () => {
    rememberCursor("a.md", 1);
    rememberCursor("b.md", 2);

    forgetCursor("a.md");
    expect(recallCursor("a.md")).toBe(0);
    expect(recallCursor("b.md")).toBe(2);
  });

  test("a rename carries the caret to the new name", () => {
    rememberCursor("2026-09-07.md", 12);
    renameCursor("2026-09-07.md", "2026-09-07-monday.md");

    expect(recallCursor("2026-09-07-monday.md")).toBe(12);
    expect(recallCursor("2026-09-07.md")).toBe(0);
  });

  test("renaming a note nobody has opened changes nothing", () => {
    renameCursor("a.md", "b.md");
    expect(recallCursor("b.md")).toBe(0);
  });

  test("pruning drops the notes that are no longer in the folder", () => {
    rememberCursor("a.md", 1);
    rememberCursor("b.md", 2);

    pruneCursors(["b.md"]);
    expect(recallCursor("a.md")).toBe(0);
    expect(recallCursor("b.md")).toBe(2);
  });
});

describe("cursors in a private window", () => {
  beforeEach(() => {
    useStorage("sealed");
  });
  afterEach(dropStorage);

  test("a caret that cannot be kept is not worth an interruption", () => {
    expect(() => {
      rememberCursor("a.md", 3);
    }).not.toThrow();
    expect(recallCursor("a.md")).toBe(0);
  });
});
