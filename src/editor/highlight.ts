import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

/*
 * The iA Writer model: markup is never hidden, only quietened. Headings and
 * emphasis get their real weight, while the characters that produce them fade
 * into --syntax.
 *
 * processingInstruction covers every marker the Markdown parser emits (#, *,
 * >, -, backticks, link brackets) and must stay last: markers sit in a span
 * nested inside the span they mark up, so they carry both classes and the
 * later rule wins.
 */
export const markdownHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: "1.5em", fontWeight: "700", lineHeight: "1.35" },
  { tag: t.heading2, fontSize: "1.3em", fontWeight: "700", lineHeight: "1.4" },
  { tag: t.heading3, fontSize: "1.15em", fontWeight: "700" },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: "700" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through", color: "var(--ink-muted)" },
  { tag: t.link, color: "var(--accent)" },
  { tag: t.url, color: "var(--ink-muted)" },
  { tag: t.quote, color: "var(--ink-muted)", fontStyle: "italic" },
  { tag: t.contentSeparator, color: "var(--ink-faint)" },
  {
    tag: [t.monospace, t.labelName],
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.9em",
    color: "var(--ink-muted)",
  },
  { tag: t.processingInstruction, color: "var(--syntax)", fontWeight: "400" },
]);
