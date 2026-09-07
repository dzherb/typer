import { afterEach, describe, expect, test } from "bun:test";

import { setUiLang, t } from "../src/i18n.ts";

// `t` is a live binding: the catalogue has to be read after the switch, which
// is the rule the app code follows too.
afterEach(() => {
  setUiLang("ru");
});

describe("catalogues", () => {
  test("say the same things in both languages", () => {
    setUiLang("ru");
    const ru = Object.keys(t).sort();
    setUiLang("en");
    const en = Object.keys(t).sort();

    expect(en).toEqual(ru);
    expect(ru.length).toBeGreaterThan(0);
  });

  test("switching language switches every string that follows", () => {
    setUiLang("en");
    expect(t.newNote).toBe("New note");
    setUiLang("ru");
    expect(t.newNote).toBe("Новая заметка");
  });

  test("name each language in itself, so either is findable from the other", () => {
    setUiLang("en");
    expect(t.langRu).toContain("Русский");
    setUiLang("ru");
    expect(t.langEn).toContain("English");
  });
});

describe("Russian plurals", () => {
  test("take the form the last digit asks for", () => {
    setUiLang("ru");
    expect(t.wordCount(1, 1)).toBe("1 слово, 1 знак.");
    expect(t.wordCount(2, 3)).toBe("2 слова, 3 знака.");
    expect(t.wordCount(5, 9)).toBe("5 слов, 9 знаков.");
    expect(t.wordCount(21, 22)).toBe("21 слово, 22 знака.");
    expect(t.wordCount(0, 0)).toBe("0 слов, 0 знаков.");
  });

  test("eleven through fourteen are the exception", () => {
    setUiLang("ru");
    expect(t.wordCount(11, 12)).toBe("11 слов, 12 знаков.");
    expect(t.wordCount(14, 111)).toBe("14 слов, 111 знаков.");
    expect(t.wordCount(101, 102)).toBe("101 слово, 102 знака.");
  });
});

describe("English plurals", () => {
  test("are the one letter English has", () => {
    setUiLang("en");
    expect(t.wordCount(1, 1)).toBe("1 word, 1 character.");
    expect(t.wordCount(0, 2)).toBe("0 words, 2 characters.");
  });
});

describe("strings that take a name", () => {
  test("quote it the way the language quotes", () => {
    setUiLang("ru");
    expect(t.confirmDelete("note.md")).toContain("«note.md»");
    setUiLang("en");
    expect(t.confirmDelete("note.md")).toContain('"note.md"');
  });
});
