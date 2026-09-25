import { describe, expect, test } from "bun:test";

import { excerpt, score } from "../src/palette/match.ts";
import { must } from "./support.ts";

describe("score", () => {
  test("a prefix beats a substring, and a substring beats scattered letters", () => {
    const prefix = must(score("monday meeting", "mon"));
    const substring = must(score("this monday", "mon"));
    const scattered = must(score("my own notebook", "mon"));

    expect(prefix).toBeGreaterThan(substring);
    expect(substring).toBeGreaterThan(scattered);
  });

  test("a shorter prefix match beats a longer one", () => {
    expect(must(score("abc", "a"))).toBeGreaterThan(must(score("abc", "abc")));
  });

  test("an earlier substring beats a later one", () => {
    expect(must(score("x needle", "needle"))).toBeGreaterThan(
      must(score("xxxxx needle", "needle")),
    );
  });

  test("scattered letters have to be in order", () => {
    expect(score("pro-otpusk", "prot")).not.toBeNull();
    expect(score("pro-otpusk", "torp")).toBeNull();
  });

  test("a letter that is not there is no match", () => {
    expect(score("monday", "z")).toBeNull();
  });

  test("case and ё are folded away", () => {
    expect(score("Monday", "monday")).toBe(score("monday", "Monday"));
    expect(score("Ёлка", "елка")).toBe(score("елка", "елка"));
    expect(score("Планёрка", "планерка")).not.toBeNull();
  });

  test("a query typed on the wrong layout finds what the same keys spell on the other", () => {
    expect(score("привет", "ghbdtn")).toBe(score("привет", "привет"));
    expect(score("Monday meeting", "ьщтвфн")).toBe(score("Monday meeting", "monday"));
    expect(score("Любовь", "K.,JDM")).toBe(score("любовь", "любовь"));
    expect(score("Ёлка", "`kf")).not.toBeNull();
    expect(score("хлеб", "{kt,")).not.toBeNull();
  });

  test("the layout a query was typed in counts over the other one", () => {
    expect(score("cfv", "cfv")).toBe(score("cfv", "сам"));
    expect(score("monday", "zzz")).toBeNull();
  });

  test("everything matches an empty query, equally", () => {
    expect(score("anything", "")).toBe(0);
    expect(score("", "")).toBe(0);
  });
});

describe("excerpt", () => {
  test("is null when the text is not there", () => {
    expect(excerpt("a note about nothing", "needle")).toBeNull();
  });

  test("points at the match inside the window it returns", () => {
    const found = must(excerpt("a note about a needle in it", "needle"));
    expect(found.text.slice(found.at, found.at + found.length)).toBe("needle");
    expect(found.length).toBe(6);
  });

  test("marks the ends it cut with an ellipsis", () => {
    const long = `${"x ".repeat(60)}needle${" y".repeat(60)}`;
    const found = must(excerpt(long, "needle"));

    expect(found.text.startsWith("…")).toBe(true);
    expect(found.text.endsWith("…")).toBe(true);
    expect(found.text.slice(found.at, found.at + found.length)).toBe("needle");
  });

  test("keeps the whole line when the window covers it", () => {
    const found = must(excerpt("short note", "note"));
    expect(found.text).toBe("short note");
    expect(found.at).toBe(6);
  });

  test("collapses the whitespace it found on the way", () => {
    const found = must(excerpt("a note\n\twith   gaps", "with"));
    expect(found.text).toBe("a note with gaps");
    expect(found.text.slice(found.at, found.at + found.length)).toBe("with");
  });

  test("finds it on the other layout, and marks the words that are there", () => {
    const found = must(excerpt("пишу про отпуск в августе", "jngecr"));
    expect(found.text.slice(found.at, found.at + found.length)).toBe("отпуск");
  });

  test("prefers the query as typed when both layouts are in the note", () => {
    const found = must(excerpt("сам, and later cfv", "cfv"));
    expect(found.text.slice(found.at, found.at + found.length)).toBe("cfv");
  });

  test("finds it whatever the case, and says where it stands", () => {
    const found = must(excerpt("A Note About Needles", "needle"));
    expect(found.text.slice(found.at, found.at + found.length)).toBe("Needle");
  });
});
