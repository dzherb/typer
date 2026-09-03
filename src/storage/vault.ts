import {
  dateStamp,
  isProvisionalName,
  isTitleComplete,
  slugify,
  titleOf,
} from "./naming.ts";

export interface Note {
  /** File name including the .md extension; unique within the folder. */
  name: string;
  title: string;
  text: string;
  /** The file's mtime, used to notice edits made outside the browser. */
  modified: number;
}

const EXT = ".md";

function isNoteFile(name: string): boolean {
  return name.endsWith(EXT) && !name.startsWith(".");
}

/** A flat folder of Markdown files. No nesting, by design. */
export class Vault {
  readonly dir: FileSystemDirectoryHandle;

  constructor(dir: FileSystemDirectoryHandle) {
    this.dir = dir;
  }

  async exists(name: string): Promise<boolean> {
    try {
      await this.dir.getFileHandle(name);
      return true;
    } catch {
      return false;
    }
  }

  /** `wanted` if free, else the same stem with -2, -3, … appended. */
  private async freeName(wanted: string): Promise<string> {
    if (!(await this.exists(wanted))) return wanted;

    const stem = wanted.slice(0, -EXT.length);
    for (let n = 2; ; n++) {
      const candidate = `${stem}-${n}${EXT}`;
      if (!(await this.exists(candidate))) return candidate;
    }
  }

  /** Every note, newest first. The whole folder is read to build the index. */
  async load(): Promise<Note[]> {
    const notes: Note[] = [];

    for await (const handle of this.dir.values()) {
      if (handle.kind !== "file" || !isNoteFile(handle.name)) continue;

      const file = await handle.getFile();
      const text = await file.text();
      notes.push({
        name: handle.name,
        title: titleOf(text, handle.name),
        text,
        modified: file.lastModified,
      });
    }

    return notes.sort((a, b) => b.modified - a.modified);
  }

  async read(name: string): Promise<Note> {
    const file = await (await this.dir.getFileHandle(name)).getFile();
    const text = await file.text();
    return { name, title: titleOf(text, name), text, modified: file.lastModified };
  }

  /** The file's mtime, or null if it is no longer there. */
  async modifiedAt(name: string): Promise<number | null> {
    try {
      return (await (await this.dir.getFileHandle(name)).getFile()).lastModified;
    } catch {
      return null;
    }
  }

  /** Writes the file and returns its new mtime. */
  async write(name: string, text: string): Promise<number> {
    const handle = await this.dir.getFileHandle(name, { create: true });
    const stream = await handle.createWritable();
    await stream.write(text);
    await stream.close();
    return (await handle.getFile()).lastModified;
  }

  /** An empty note under a provisional, date-only name. */
  async create(at: Date = new Date()): Promise<Note> {
    const name = await this.freeName(`${dateStamp(at)}${EXT}`);
    const modified = await this.write(name, "");
    return { name, title: titleOf("", name), text: "", modified };
  }

  /**
   * There is no rename in the File System Access API, so this copies and
   * deletes. Returns the name actually used, which may be uniquified.
   */
  async rename(from: string, to: string): Promise<string> {
    if (from === to) return from;

    const { text } = await this.read(from);
    const name = await this.freeName(to);
    await this.write(name, text);
    await this.dir.removeEntry(from);
    return name;
  }

  /** Permanent: the browser cannot move a file to the system Trash. */
  async remove(name: string): Promise<void> {
    await this.dir.removeEntry(name);
  }

  /**
   * Give a still-untitled note its lasting name, once its first heading is
   * written and left behind. Notes that already carry a slug are never renamed
   * again — a file moving under you while you write is worse than an
   * out-of-date name. Returns the note's name, changed or not.
   */
  async settleName(name: string, text: string): Promise<string> {
    if (!isProvisionalName(name)) return name;
    // Still on the title line: the heading is not finished being typed.
    if (!isTitleComplete(text)) return name;

    const slug = slugify(titleOf(text, ""));
    if (!slug) return name;

    // Keep the date the note was created under, not today's.
    const date = /^\d{4}-\d{2}-\d{2}/.exec(name)![0];
    return this.rename(name, `${date}-${slug}${EXT}`);
  }
}
