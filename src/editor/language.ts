import { markdownLanguage } from "@codemirror/lang-markdown";
import { Language } from "@codemirror/language";
import type { MarkdownParser } from "@lezer/markdown";

/*
 * Without setext headings. Under CommonMark a lone "-" beneath a line turns
 * that line into a heading, and "- " is exactly what sits there while a list
 * item is being started under it — so the line above swelled for as long as
 * the new item stayed empty. A heading here is "#", which is also all the
 * file naming reads; "---" under text becomes the rule it looks like.
 */
export const notesMarkdown = new Language(
  markdownLanguage.data,
  (markdownLanguage.parser as MarkdownParser).configure({ remove: ["SetextHeading"] }),
  [],
  "markdown",
);
