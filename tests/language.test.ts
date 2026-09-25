import { describe, expect, test } from "bun:test";

import { notesMarkdown } from "../src/editor/language.ts";

/** Every node the parser finds in `doc`, by name, in document order. */
function nodes(doc: string): string[] {
  const names: string[] = [];
  notesMarkdown.parser.parse(doc).iterate({ enter: (node) => void names.push(node.name) });
  return names;
}

describe("a heading is only ever a #", () => {
  test("a list item started under a line leaves that line as it was", () => {
    expect(nodes("1. Reply to the audit:\n   - ")).toEqual([
      "Document",
      "OrderedList",
      "ListItem",
      "ListMark",
      "Paragraph",
    ]);
  });

  test("--- under a line is a rule, not an underline", () => {
    expect(nodes("Title\n---\n")).toEqual(["Document", "Paragraph", "HorizontalRule"]);
  });

  test("=== under a line is just more of the line", () => {
    expect(nodes("Title\n===\n")).toEqual(["Document", "Paragraph"]);
  });

  test("# still makes one", () => {
    expect(nodes("## Title\n")).toEqual(["Document", "ATXHeading2", "HeaderMark"]);
  });
});
