import type { EditorView } from "@codemirror/view";

import { createEditor, loadDocument } from "./editor/editor.ts";
import { updateSettings } from "./settings.ts";
import { titleOf } from "./storage/naming.ts";
import type { Note } from "./storage/vault.ts";
import { Vault } from "./storage/vault.ts";
import { notice } from "./ui/notice.ts";

/** Quiet time before a write. Short enough to forget it exists. */
const AUTOSAVE_DELAY = 700;

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The running app: one folder, one open note, saved as you stop typing. */
export class Session {
  readonly vault: Vault;
  private readonly view: EditorView;
  private readonly handleChange = () => this.touch();

  private notes = new Map<string, Note>();
  private name: string | null = null;
  /** The mtime we believe the open file has; a mismatch means outside edits. */
  private baseline = 0;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private writes: Promise<unknown> = Promise.resolve();
  private conflicted = false;

  private constructor(vault: Vault, parent: HTMLElement) {
    this.vault = vault;
    this.view = createEditor({ parent, onChange: this.handleChange });
  }

  static async start(vault: Vault, parent: HTMLElement, lastNote?: string): Promise<Session> {
    const session = new Session(vault, parent);
    await session.reindex();

    const opening =
      (lastNote && session.notes.has(lastNote) ? lastNote : undefined) ??
      session.list()[0]?.name;

    if (opening) await session.open(opening);
    else await session.createNote();

    session.watchLifecycle();
    return session;
  }

  /** Re-read the whole folder. Cheap enough for a flat folder of prose. */
  async reindex(): Promise<void> {
    const notes = await this.vault.load();
    this.notes = new Map(notes.map((note) => [note.name, note]));
  }

  /** Every note, newest first. */
  list(): Note[] {
    return [...this.notes.values()].sort((a, b) => b.modified - a.modified);
  }

  currentName(): string | null {
    return this.name;
  }

  text(): string {
    return this.view.state.doc.toString();
  }

  focus(): void {
    this.view.focus();
  }

  private touch(): void {
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), AUTOSAVE_DELAY);
  }

  /** Writes run one at a time, so a save can never overtake the one before. */
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.writes.then(job, job);
    this.writes = run.catch(() => undefined);
    return run;
  }

  /** Write pending changes now. Safe to call when there are none. */
  flush(): Promise<void> {
    clearTimeout(this.timer);
    return this.enqueue(() => this.persist());
  }

  private async persist(): Promise<void> {
    const name = this.name;
    // While a conflict is unresolved the file is not ours to write.
    if (!name || !this.dirty || this.conflicted) return;

    const text = this.text();
    // Cleared before the write: anything typed during it re-arms the timer.
    this.dirty = false;

    try {
      let modified = await this.vault.write(name, text);
      const settled = await this.vault.settleName(name, text);

      if (settled !== name) {
        this.notes.delete(name);
        if (this.name === name) this.name = settled;
        updateSettings({ lastNote: settled });
        modified = (await this.vault.modifiedAt(settled)) ?? modified;
      }

      this.baseline = modified;
      this.notes.set(settled, { name: settled, title: titleOf(text, settled), text, modified });
    } catch (error) {
      this.dirty = true;
      notice(`Не удалось сохранить: ${reason(error)}`, { timeout: 8000 });
    }
  }

  async open(name: string): Promise<void> {
    await this.flush();

    const note = await this.vault.read(name);
    this.name = note.name;
    this.baseline = note.modified;
    this.dirty = false;
    this.conflicted = false;
    this.notes.set(note.name, note);

    loadDocument(this.view, note.text, this.handleChange);
    this.view.focus();
    updateSettings({ lastNote: note.name });
  }

  async createNote(): Promise<void> {
    await this.flush();
    const note = await this.vault.create();
    this.notes.set(note.name, note);
    await this.open(note.name);
  }

  async renameCurrent(to: string): Promise<void> {
    const name = this.name;
    if (!name) return;

    await this.flush();
    const settled = await this.vault.rename(name, to.endsWith(".md") ? to : `${to}.md`);
    this.notes.delete(name);
    await this.reindex();
    await this.open(settled);
  }

  async deleteCurrent(): Promise<void> {
    const name = this.name;
    if (!name) return;

    clearTimeout(this.timer);
    this.dirty = false;
    await this.vault.remove(name);
    this.notes.delete(name);
    this.name = null;

    const next = this.list()[0]?.name;
    if (next) await this.open(next);
    else await this.createNote();
  }

  /**
   * The browser cannot watch the folder, so we compare mtimes whenever the
   * window comes back. With nothing unsaved there is nothing to lose, so we
   * just reload; with local edits the choice is the writer's.
   */
  private async checkForOutsideEdits(): Promise<void> {
    const name = this.name;
    if (!name || this.conflicted) return;

    const modified = await this.vault.modifiedAt(name);
    if (modified === null) {
      notice(`Файл «${name}» исчез с диска. Сохранить заново?`, {
        actions: [{ label: "Сохранить", run: () => { this.dirty = true; void this.flush(); } }],
      });
      return;
    }

    if (modified === this.baseline) return;

    if (!this.dirty) {
      await this.open(name);
      notice("Заметка обновлена с диска.", { timeout: 4000 });
      return;
    }

    // Hold every pending write until the writer decides, or the queued
    // autosave would quietly clobber the file we are asking about.
    this.conflicted = true;
    clearTimeout(this.timer);

    notice(`«${name}» изменён снаружи, а здесь есть несохранённые правки.`, {
      actions: [
        {
          label: "Взять с диска",
          run: () => {
            this.conflicted = false;
            this.dirty = false;
            void this.open(name);
          },
        },
        {
          label: "Оставить мои",
          run: () => {
            this.conflicted = false;
            this.baseline = modified;
            this.dirty = true;
            void this.flush();
          },
        },
      ],
    });
  }

  private watchLifecycle(): void {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void this.flush();
      else void this.checkForOutsideEdits();
    });
    window.addEventListener("blur", () => void this.flush());
    window.addEventListener("focus", () => void this.checkForOutsideEdits());
    // Last chance on the way out; the write usually completes.
    window.addEventListener("pagehide", () => void this.flush());
  }
}
