import { t } from "../i18n.ts";
import type { Excerpt } from "./match.ts";

/**
 * A keystroke, written twice: `label` is what the row shows, `spoken` the same
 * chord in words. Screen readers make what they like of ⌘ and ⇧, so the
 * accessible name gets the words instead.
 */
export interface ChordName {
  label: string;
  spoken: string;
}

export interface PaletteItem {
  id: string;
  label: string;
  /** Commands are marked in the margin; notes carry no mark. */
  kind?: "command";
  /** Shown dimmed at the right — a file name, or what kind of thing this is. */
  hint?: string;
  /** The keystroke that runs this without the palette, for the few that have one. */
  chord?: ChordName;
  /** A second line: the line of prose a full-text hit was found in. */
  excerpt?: Excerpt;
  run: () => unknown;
}

/**
 * "all" is the everyday palette — notes, their text, and the commands mixed in.
 * "commands" is the list of commands and nothing else; typing narrows it, and
 * the only way out is closing the palette.
 */
export type PaletteMode = "all" | "commands";

export type PaletteSource = (query: string, mode: PaletteMode) => PaletteItem[];

export interface AskOptions {
  prompt: string;
  initial?: string;
  submit: (value: string) => unknown;
}

/**
 * The only navigation surface: switching notes, searching their text, and
 * every command. One widget instead of a sidebar, a search field and a menu.
 */
export class Palette {
  private readonly source: PaletteSource;
  private readonly dialog: HTMLDialogElement;
  private readonly input: HTMLInputElement;
  private readonly list: HTMLUListElement;

  private items: PaletteItem[] = [];
  private active = 0;
  private mode: PaletteMode = "all";
  private asking: AskOptions | null = null;

  constructor(source: PaletteSource) {
    this.source = source;

    this.dialog = document.createElement("dialog");
    this.dialog.className = "palette";

    this.input = document.createElement("input");
    this.input.className = "palette__input";
    this.input.type = "text";
    this.input.autocomplete = "off";
    this.input.spellcheck = false;

    this.list = document.createElement("ul");
    this.list.className = "palette__list";

    this.dialog.append(this.input, this.list);
    document.body.append(this.dialog);

    this.input.addEventListener("input", () => this.refresh());
    this.dialog.addEventListener("keydown", (event) => this.onKeydown(event));
    // Clicking the backdrop, which is the dialog element itself.
    this.dialog.addEventListener("mousedown", (event) => {
      if (event.target === this.dialog) this.close();
    });
    /*
     * Deliberately no "close" handler. The event is delivered asynchronously,
     * so a handler that resets state would land after a reopen that happened
     * in the same turn — which is exactly what "Rename note" does: it closes
     * the palette and immediately reopens it to ask for a name. State is set up
     * on the way in instead, by open(), showCommands() and ask().
     */
  }

  get isOpen(): boolean {
    return this.dialog.open;
  }

  /**
   * Whether the input is standing in for a value rather than a query. The key
   * handler reads this to leave a half-typed name alone.
   */
  get isAsking(): boolean {
    return this.asking !== null;
  }

  open(query = ""): void {
    if (this.dialog.open) return;
    this.asking = null;
    this.mode = "all";
    this.input.placeholder = t.palettePlaceholder;
    this.input.value = query;
    this.dialog.showModal();
    this.refresh();
    this.input.select();
  }

  /**
   * Show the commands, and only them. Reopens the dialog because a command runs
   * after choose() has closed it — the same move "Rename note" makes below.
   */
  showCommands(): void {
    if (this.dialog.open) this.dialog.close();
    this.asking = null;
    this.mode = "commands";
    this.input.placeholder = t.commandPlaceholder;
    this.input.value = "";
    this.dialog.showModal();
    this.refresh();
  }

  /** Borrow the same input to ask for a single value, e.g. a new name. */
  ask(options: AskOptions): void {
    if (this.dialog.open) this.dialog.close();
    this.asking = options;
    this.input.placeholder = options.prompt;
    this.input.value = options.initial ?? "";
    this.dialog.showModal();
    this.items = [];
    this.renderHint(options.prompt);
    this.input.select();
  }

  close(): void {
    if (this.dialog.open) this.dialog.close();
  }

  private renderHint(text: string): void {
    const hint = document.createElement("li");
    hint.className = "palette__hint";
    hint.textContent = text;
    this.list.replaceChildren(hint);
  }

  private refresh(): void {
    if (this.asking) return;
    this.items = this.source(this.input.value.trim(), this.mode);
    this.active = 0;
    this.render();
  }

  private render(): void {
    if (this.items.length === 0) {
      this.renderHint(t.paletteEmpty);
      return;
    }

    this.list.replaceChildren(
      ...this.items.map((item, index) => {
        const row = document.createElement("li");
        row.className = "palette__item";
        if (item.kind === "command") {
          row.classList.add("palette__item--command");
          /*
           * The margin glyph is decorative, so the kind has to be spoken some
           * other way. aria-label replaces the accessible name rather than
           * adding to it, hence the label is repeated here — dropping it would
           * leave a row announced as just "command".
           */
          const chord = item.chord ? `, ${item.chord.spoken}` : "";
          row.setAttribute("aria-label", `${item.label}, ${t.commandHint}${chord}`);
        }
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", String(index === this.active));

        const label = document.createElement("span");
        label.className = "palette__label";
        label.textContent = item.label;
        row.append(label);

        if (item.hint) {
          const hint = document.createElement("span");
          hint.className = "palette__meta";
          hint.textContent = item.hint;
          row.append(hint);
        }

        // The same dim column the file names sit in: a command has no name to
        // put there, and nothing else competes for the space.
        if (item.chord) {
          const chord = document.createElement("span");
          chord.className = "palette__meta";
          chord.textContent = item.chord.label;
          row.append(chord);
        }

        if (item.excerpt) row.append(renderExcerpt(item.excerpt));

        row.addEventListener("mousemove", () => this.setActive(index));
        row.addEventListener("click", () => this.choose(index));
        return row;
      }),
    );

    this.scrollActiveIntoView();
  }

  private setActive(index: number): void {
    if (index === this.active) return;
    this.active = index;
    for (const [i, row] of [...this.list.children].entries()) {
      row.setAttribute("aria-selected", String(i === this.active));
    }
  }

  private move(delta: number): void {
    if (this.items.length === 0) return;
    const count = this.items.length;
    this.setActive((this.active + delta + count) % count);
    this.scrollActiveIntoView();
  }

  private scrollActiveIntoView(): void {
    this.list.children[this.active]?.scrollIntoView({ block: "nearest" });
  }

  private choose(index: number): void {
    const item = this.items[index];
    if (!item) return;
    this.close();
    void item.run();
  }

  private onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        this.move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        this.move(-1);
        break;
      case "Enter": {
        event.preventDefault();
        const asking = this.asking;
        if (asking) {
          const value = this.input.value.trim();
          this.close();
          if (value) void asking.submit(value);
        } else {
          this.choose(this.active);
        }
        break;
      }
      // Escape closes the dialog natively.
    }
  }
}

function renderExcerpt(excerpt: Excerpt): HTMLElement {
  const line = document.createElement("span");
  line.className = "palette__excerpt";

  const before = excerpt.text.slice(0, excerpt.at);
  const hit = excerpt.text.slice(excerpt.at, excerpt.at + excerpt.length);
  const after = excerpt.text.slice(excerpt.at + excerpt.length);

  const mark = document.createElement("mark");
  mark.textContent = hit;
  line.append(before, mark, after);
  return line;
}
