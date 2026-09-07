/*
 * A folder in memory, standing in for the one the File System Access API
 * hands over. Only the handful of calls Vault makes are here — enough to run
 * the naming, the uniquifying and the reindexing against something.
 */

interface Entry {
  text: string;
  modified: number;
}

/** As much of a file handle as Vault asks for. */
interface FakeFile {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{
    write: (chunk: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

export class FakeFolder {
  readonly name = "notes";
  readonly kind = "directory";

  private readonly entries = new Map<string, Entry>();
  /** A clock that only moves on a write, so mtimes are ordered and stable. */
  private clock = 1_000;

  constructor(files: Record<string, string> = {}) {
    for (const [name, text] of Object.entries(files)) this.put(name, text);
  }

  /** What is on disk, for a test to look at without going through Vault. */
  names(): string[] {
    return [...this.entries.keys()].sort();
  }

  textOf(name: string): string | undefined {
    return this.entries.get(name)?.text;
  }

  /** The handle a Vault is built around. */
  handle(): FileSystemDirectoryHandle {
    return this as unknown as FileSystemDirectoryHandle;
  }

  private put(name: string, text: string): Entry {
    this.clock += 1;
    const entry = { text, modified: this.clock };
    this.entries.set(name, entry);
    return entry;
  }

  private fileHandle(name: string): FakeFile {
    return {
      kind: "file" as const,
      name,
      getFile: () => {
        const entry = this.entries.get(name);
        if (!entry) throw new DOMException(`${name} is gone`, "NotFoundError");
        return Promise.resolve(new File([entry.text], name, { lastModified: entry.modified }));
      },
      createWritable: () => {
        let written = "";
        return Promise.resolve({
          write: (chunk: string) => {
            written += chunk;
            return Promise.resolve();
          },
          close: () => {
            this.put(name, written);
            return Promise.resolve();
          },
        });
      },
    };
  }

  getFileHandle(name: string, options?: { create?: boolean }): Promise<FakeFile> {
    if (!this.entries.has(name) && !options?.create) {
      return Promise.reject(new DOMException(`${name} is not there`, "NotFoundError"));
    }
    return Promise.resolve(this.fileHandle(name));
  }

  removeEntry(name: string): Promise<void> {
    if (!this.entries.delete(name)) {
      return Promise.reject(new DOMException(`${name} is not there`, "NotFoundError"));
    }
    return Promise.resolve();
  }

  /** `for await` takes a plain generator too, and there is nothing to await. */
  *values(): Generator<FakeFile> {
    for (const name of this.entries.keys()) yield this.fileHandle(name);
  }
}
