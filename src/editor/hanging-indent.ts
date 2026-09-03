import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

/*
 * Everything that sits to the left of a block's actual text: indentation,
 * quote markers, and a bullet or number. What is left over is the text the
 * wrapped lines have to line up under.
 */
const BLOCK_PREFIX = /^[ \t]*(?:>[ \t]*)*(?:(?:[-*+]|\d+[.)])[ \t]+)?/;

/*
 * Wrapped lines start at column zero, so a long list item spills out to the
 * left of its own marker. CodeMirror has no notion of a hanging indent, so
 * each line gets a padding the width of its prefix and an equal negative
 * text-indent to pull the first row back out of it.
 *
 * The prefix is measured rather than counted in `ch`: iA Writer Quattro is
 * only nearly monospaced, and a digit is not a space.
 */
class HangingIndent {
  decorations: DecorationSet;

  private readonly view: EditorView;
  private readonly widths = new Map<string, number>();
  private readonly ruler: HTMLElement;
  private stale = false;
  private destroyed = false;

  constructor(view: EditorView) {
    this.view = view;
    this.ruler = document.createElement("div");
    this.ruler.setAttribute("aria-hidden", "true");
    this.ruler.style.cssText =
      "position:absolute;top:-9999px;left:0;visibility:hidden;white-space:pre;pointer-events:none";
    // Inside the scroller so it inherits the font the document is drawn with.
    view.scrollDOM.appendChild(this.ruler);

    this.decorations = this.build();

    // The web font arrives after the first paint, and every width measured
    // against the fallback has to be thrown away when it does.
    document.fonts?.ready.then(() => {
      if (this.destroyed) return;
      this.widths.clear();
      this.stale = true;
      this.view.dispatch({});
    });
  }

  update(update: ViewUpdate): void {
    if (this.stale || update.docChanged || update.viewportChanged || update.geometryChanged) {
      this.stale = false;
      this.decorations = this.build();
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.ruler.remove();
  }

  private build(): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();

    for (const { from, to } of this.view.visibleRanges) {
      for (let pos = from; pos <= to; ) {
        const line = this.view.state.doc.lineAt(pos);
        const prefix = BLOCK_PREFIX.exec(line.text)?.[0] ?? "";
        // A line that is nothing but its prefix has nothing to wrap.
        if (prefix && prefix.length < line.text.length) {
          const width = this.measure(prefix);
          if (width > 0) {
            builder.add(
              line.from,
              line.from,
              Decoration.line({
                attributes: { style: `padding-left:${width}px;text-indent:${-width}px` },
              }),
            );
          }
        }
        pos = line.to + 1;
      }
    }

    return builder.finish();
  }

  private measure(prefix: string): number {
    const cached = this.widths.get(prefix);
    if (cached !== undefined) return cached;

    this.ruler.textContent = prefix;
    const width = this.ruler.getBoundingClientRect().width;
    this.widths.set(prefix, width);
    return width;
  }
}

export function hangingIndent() {
  return ViewPlugin.fromClass(HangingIndent, {
    decorations: (plugin) => plugin.decorations,
  });
}
