import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { readSettings, type Settings, updateSettings } from "../src/settings.ts";
import { dropStorage, useStorage } from "./support.ts";

const DEFAULTS: Settings = { theme: "system", spellcheck: true, autoAlign: true };

describe("settings", () => {
  beforeEach(() => {
    useStorage();
  });
  afterEach(dropStorage);

  test("a folder opened for the first time gets the defaults", () => {
    expect(readSettings()).toEqual(DEFAULTS);
  });

  test("a change is kept, and everything else is left alone", () => {
    expect(updateSettings({ theme: "dark" })).toEqual({ ...DEFAULTS, theme: "dark" });
    expect(readSettings()).toEqual({ ...DEFAULTS, theme: "dark" });

    updateSettings({ spellcheck: false });
    expect(readSettings()).toEqual({ ...DEFAULTS, theme: "dark", spellcheck: false });
  });

  test("settings written by an older version keep their defaults for the rest", () => {
    localStorage.setItem("typer.settings", JSON.stringify({ theme: "light" }));
    expect(readSettings()).toEqual({ ...DEFAULTS, theme: "light" });
  });

  test("unreadable settings are the defaults, not a dead screen", () => {
    localStorage.setItem("typer.settings", "{ this is not json");
    expect(readSettings()).toEqual(DEFAULTS);
  });

  test("the note to reopen is remembered by name", () => {
    updateSettings({ lastNote: "2026-09-07-monday.md" });
    expect(readSettings().lastNote).toBe("2026-09-07-monday.md");
  });
});

describe("settings in a private window", () => {
  beforeEach(() => {
    useStorage("sealed");
  });
  afterEach(dropStorage);

  test("reading falls back to the defaults", () => {
    expect(readSettings()).toEqual(DEFAULTS);
  });

  test("writing is given up on quietly", () => {
    expect(updateSettings({ theme: "dark" })).toEqual({ ...DEFAULTS, theme: "dark" });
  });
});
