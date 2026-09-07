import { describe, expect, test } from "bun:test";

import {
  dateStamp,
  isProvisionalName,
  isTitleComplete,
  slugify,
  titleOf,
} from "../src/storage/naming.ts";

describe("slugify", () => {
  test("transliterates Cyrillic", () => {
    expect(slugify("Привет мир")).toBe("privet-mir");
    expect(slugify("Ёжик")).toBe("ezhik");
    expect(slugify("Щи и борщ")).toBe("schi-i-borsch");
  });

  test("drops the letters that have no sound", () => {
    expect(slugify("подъезд")).toBe("podezd");
    expect(slugify("день")).toBe("den");
  });

  test("strips diacritics rather than the letter under them", () => {
    expect(slugify("Café")).toBe("cafe");
    expect(slugify("naïve résumé")).toBe("naive-resume");
  });

  test("keeps names portable", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
    expect(slugify("  spaces   everywhere  ")).toBe("spaces-everywhere");
    expect(slugify("a/b:c")).toBe("a-b-c");
  });

  test("is empty when nothing survives", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("")).toBe("");
  });

  test("cuts at 48 characters and never on a dash", () => {
    const long = slugify("a".repeat(60));
    expect(long).toHaveLength(48);

    // The 49th character is a space, so the cut would leave a trailing dash.
    const cut = slugify(`${"b".repeat(48)} tail`);
    expect(cut).toBe("b".repeat(48));
  });
});

describe("dateStamp", () => {
  test("is the local date, zero-padded", () => {
    expect(dateStamp(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dateStamp(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  test("a note written at 01:00 belongs to that day", () => {
    expect(dateStamp(new Date(2026, 8, 7, 1, 0))).toBe("2026-09-07");
  });
});

describe("isProvisionalName", () => {
  test("recognises the date-only names", () => {
    expect(isProvisionalName("2026-09-07.md")).toBe(true);
    expect(isProvisionalName("2026-09-07-2.md")).toBe(true);
  });

  test("a name with a slug is not provisional", () => {
    expect(isProvisionalName("2026-09-07-first-note.md")).toBe(false);
    expect(isProvisionalName("notes.md")).toBe(false);
    expect(isProvisionalName("2026-09-07.txt")).toBe(false);
  });
});

describe("isTitleComplete", () => {
  test("waits for a line after the title", () => {
    expect(isTitleComplete("# Half a headin")).toBe(false);
    expect(isTitleComplete("# A title\n")).toBe(true);
    expect(isTitleComplete("# A title\nand the note")).toBe(true);
  });

  test("blank lines before the title do not count as the title", () => {
    expect(isTitleComplete("\n\n# A title")).toBe(false);
    expect(isTitleComplete("\n\n# A title\n")).toBe(true);
  });

  test("an empty note has no title to finish", () => {
    expect(isTitleComplete("")).toBe(false);
    expect(isTitleComplete("\n\n")).toBe(false);
  });
});

describe("titleOf", () => {
  test("takes the first heading", () => {
    expect(titleOf("# Monday\n\nnotes", "x.md")).toBe("Monday");
    expect(titleOf("### Deep\n", "x.md")).toBe("Deep");
    expect(titleOf("## Closed ##\n", "x.md")).toBe("Closed");
  });

  test("takes the first line of prose when there is no heading", () => {
    expect(titleOf("just writing\nmore", "x.md")).toBe("just writing");
    expect(titleOf("\n\n  indented start\n", "x.md")).toBe("indented start");
  });

  test("the marker a new note starts under is not a title", () => {
    expect(titleOf("# ", "2026-09-07.md")).toBe("2026-09-07");
    expect(titleOf("#\nthe body", "x.md")).toBe("the body");
  });

  test("falls back to the file name without its extension", () => {
    expect(titleOf("", "2026-09-07.md")).toBe("2026-09-07");
    expect(titleOf("\n\n", "notes.md")).toBe("notes");
  });

  test("cuts at 120 characters", () => {
    expect(titleOf(`# ${"a".repeat(200)}`, "x.md")).toHaveLength(120);
  });
});
