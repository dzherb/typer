import type { ChangeSpec, EditorState, Line } from "@codemirror/state";

/*
 * Lining the pipes up in the source is the whole of it: typer shows the
 * source, so a table that is a grid in the file is a grid on screen — and it
 * stays one in git, on GitHub, and in whatever else opens the note.
 */

/** What can sit left of the first pipe: indent, and a quote the table is in. */
const ROW_PREFIX = /^[ \t]*(?:>[ \t]*)*/;

/** A delimiter cell: dashes, with a colon on the side the column aligns to. */
const DELIMITER = /^:?-+:?$/;

/** Three dashes keep ":-:" expressible and a narrow column looking like one. */
const MIN_WIDTH = 3;

type Align = "left" | "right" | "center" | "none";

interface Cell {
  text: string;
  /** Where that text sits in the document, so it can be left where it is. */
  from: number;
  to: number;
}

interface Row {
  line: Line;
  /** Where the row's own text starts, past any quote markers. */
  bodyFrom: number;
  cells: Cell[];
}

/*
 * Cells are counted in graphemes rather than code units: a combining accent
 * adds nothing to a column, and an emoji is one glyph rather than two chars.
 * What this cannot know is that a glyph may draw two columns wide — an emoji
 * does, a CJK line does — and such a column comes out a space too narrow. The
 * cure is a width table, which is more than a notes app owes its tables.
 */
const glyphs = new Intl.Segmenter();

function width(text: string): number {
  return [...glyphs.segment(text)].length;
}

function splitRow(line: Line): Row | null {
  const prefix = ROW_PREFIX.exec(line.text)?.[0] ?? "";
  const pipes: number[] = [];

  for (let i = prefix.length; i < line.text.length; i++) {
    // An escaped pipe belongs to a cell's text and is not a border.
    if (line.text[i] === "\\") i++;
    else if (line.text[i] === "|") pipes.push(i);
  }
  if (pipes.length === 0) return null;

  const bounds: Array<[number, number]> = [];
  let start = prefix.length;
  for (const pipe of pipes) {
    bounds.push([start, pipe]);
    start = pipe + 1;
  }
  bounds.push([start, line.text.length]);

  // An outer pipe leaves an empty stretch beyond it; the outer pipes GFM lets
  // a row leave off do not, and what stands there is the first or last cell.
  const blank = ([from, to]: [number, number]) => !line.text.slice(from, to).trim();
  if (blank(bounds[0])) bounds.shift();
  if (bounds.length > 0 && blank(bounds[bounds.length - 1])) bounds.pop();

  const cells = bounds.map(([from, to]) => {
    const text = line.text.slice(from, to);
    const lead = text.length - text.trimStart().length;
    const trimmed = text.trim();
    return {
      text: trimmed,
      from: line.from + from + lead,
      to: line.from + from + lead + trimmed.length,
    };
  });

  return { line, bodyFrom: line.from + prefix.length, cells };
}

/** The column alignments a delimiter row states, or null if it is not one. */
function alignments(row: Row): Align[] | null {
  const align: Align[] = [];

  for (const cell of row.cells) {
    if (!DELIMITER.test(cell.text)) return null;
    const left = cell.text.startsWith(":");
    const right = cell.text.endsWith(":");
    align.push(left && right ? "center" : left ? "left" : right ? "right" : "none");
  }

  return align.length > 0 ? align : null;
}

/** Trailing empty cells are typing, not columns: a stray "|" adds nothing. */
function cellCount(row: Row): number {
  let count = row.cells.length;
  while (count > 0 && !row.cells[count - 1].text) count--;
  return count;
}

/** The spaces that put `text` where its column wants it. */
function padding(text: string, size: number, align: Align): [string, string] {
  const slack = Math.max(0, size - width(text));
  if (align === "right") return [" ".repeat(slack), ""];
  if (align === "center") {
    const left = Math.floor(slack / 2);
    return [" ".repeat(left), " ".repeat(slack - left)];
  }
  return ["", " ".repeat(slack)];
}

function delimiterCell(size: number, align: Align): string {
  if (align === "center") return `:${"-".repeat(size - 2)}:`;
  if (align === "left") return `:${"-".repeat(size - 1)}`;
  if (align === "right") return `${"-".repeat(size - 1)}:`;
  return "-".repeat(size);
}

/**
 * The changes that line one row up, written around the text of its cells
 * rather than over it: only the spaces and pipes between them move, so a caret
 * standing in a word stays in that word. `anchored` is false for the delimiter
 * row, whose text is the dashes themselves and is rewritten outright.
 */
function rowChanges(
  state: EditorState,
  row: Row,
  widths: number[],
  align: Align[],
  anchored: boolean,
): ChangeSpec[] {
  const changes: ChangeSpec[] = [];
  let at = row.bodyFrom;
  let pending = "|";

  const write = (to: number, insert: string) => {
    if (state.sliceDoc(at, to) !== insert) changes.push({ from: at, to, insert });
  };

  for (let column = 0; column < widths.length; column++) {
    const cell = anchored ? row.cells.at(column) : undefined;
    const text = anchored ? (cell?.text ?? "") : delimiterCell(widths[column], align[column]);
    const [left, right] = anchored ? padding(text, widths[column], align[column]) : ["", ""];

    pending += ` ${left}`;
    if (cell && cell.text) {
      write(cell.from, pending);
      at = cell.to;
      pending = "";
    } else {
      pending += text;
    }
    pending += `${right} |`;
  }

  write(row.line.to, pending);
  return changes;
}

/**
 * The changes that align the table covering [from, to]. Rows shorter than the
 * table gain the cells they are missing, and a row longer than the header
 * widens the whole table rather than losing its last cell: text that is in the
 * file has to stay visible in it.
 */
export function tableChanges(state: EditorState, from: number, to: number): ChangeSpec[] {
  const rows: Row[] = [];
  const last = state.doc.lineAt(to).number;

  for (let n = state.doc.lineAt(from).number; n <= last; n++) {
    const row = splitRow(state.doc.line(n));
    if (row) rows.push(row);
  }
  if (rows.length < 2) return [];

  // The second row states the alignments; without one this is not a table.
  const delimiter = rows[1];
  const align = alignments(delimiter);
  if (!align) return [];

  const columns = Math.max(align.length, ...rows.map(cellCount));
  while (align.length < columns) align.push("none");

  const widths = new Array<number>(columns).fill(MIN_WIDTH);
  for (const row of rows) {
    if (row === delimiter) continue;
    row.cells.forEach((cell, column) => {
      if (column < columns) widths[column] = Math.max(widths[column], width(cell.text));
    });
  }

  return rows.flatMap((row) => rowChanges(state, row, widths, align, row !== delimiter));
}
