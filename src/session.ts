import type { EditorView } from "@codemirror/view";

import {
  forgetCursor,
  pruneCursors,
  recallCursor,
  rememberCursor,
  renameCursor,
} from "./cursors.ts";
import { createEditor, loadDocument, recheckSpelling, setSpellcheck } from "./editor/editor.ts";
import { t } from "./i18n.ts";
import { readSettings, updateSettings } from "./settings.ts";
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
  private spellcheck: boolean;

  private constructor(vault: Vault, parent: HTMLElement) {
    this.vault = vault;
    this.spellcheck = readSettings().spellcheck;
    this.view = createEditor(parent, {
      spellcheck: this.spellcheck,
      onChange: this.handleChange,
    });
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
    pruneCursors(this.notes.keys());
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

  spellcheckEnabled(): boolean {
    return this.spellcheck;
  }

  /** Re-check the open note after the document language changed under it. */
  refreshSpellcheck(): void {
    recheckSpelling(this.view, this.spellcheck);
  }

  setSpellcheckEnabled(enabled: boolean): void {
    this.spellcheck = enabled;
    setSpellcheck(this.view, enabled);
    updateSettings({ spellcheck: enabled });
  }

  /** Note where the caret stands, so this note can be reopened on that word. */
  private saveCursor(): void {
    if (this.name) rememberCursor(this.name, this.view.state.selection.main.head);
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
    this.saveCursor();

    try {
      let modified = await this.vault.write(name, text);
      const settled = await this.vault.settleName(name, text);

      if (settled !== name) {
        this.notes.delete(name);
        renameCursor(name, settled);
        if (this.name === name) this.name = settled;
        updateSettings({ lastNote: settled });
        modified = (await this.vault.modifiedAt(settled)) ?? modified;
      }

      this.baseline = modified;
      this.notes.set(settled, { name: settled, title: titleOf(text, settled), text, modified });
    } catch (error) {
      this.dirty = true;
      notice(t.saveFailed(reason(error)), { timeout: 8000 });
    }
  }

  async open(name: string): Promise<void> {
    // Before anything awaits, while the caret is still the one being left.
    this.saveCursor();
    await this.flush();

    const note = await this.vault.read(name);
    this.name = note.name;
    this.baseline = note.modified;
    this.dirty = false;
    this.conflicted = false;
    this.notes.set(note.name, note);

    loadDocument(this.view, {
      doc: note.text,
      cursor: recallCursor(note.name),
      spellcheck: this.spellcheck,
      onChange: this.handleChange,
    });
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

    this.saveCursor();
    await this.flush();
    const settled = await this.vault.rename(name, to.endsWith(".md") ? to : `${to}.md`);
    this.notes.delete(name);
    renameCursor(name, settled);
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
    forgetCursor(name);
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
      notice(t.fileVanished(name), {
        actions: [{ label: t.saveAgain, run: () => { this.dirty = true; void this.flush(); } }],
      });
      return;
    }

    if (modified === this.baseline) return;

    if (!this.dirty) {
      await this.open(name);
      notice(t.reloadedFromDisk, { timeout: 4000 });
      return;
    }

    // Hold every pending write until the writer decides, or the queued
    // autosave would quietly clobber the file we are asking about.
    this.conflicted = true;
    clearTimeout(this.timer);

    notice(t.editedOutside(name), {
      actions: [
        {
          label: t.takeDiskCopy,
          run: () => {
            this.conflicted = false;
            this.dirty = false;
            void this.open(name);
          },
        },
        {
          label: t.keepMine,
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

  /** Put the note down: the text on disk, the caret where it can be found. */
  private leave(): void {
    this.saveCursor();
    void this.flush();
  }

  private watchLifecycle(): void {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.leave();
      else void this.checkForOutsideEdits();
    });
    window.addEventListener("blur", () => this.leave());
    window.addEventListener("focus", () => void this.checkForOutsideEdits());
    // Last chance on the way out; the write usually completes.
    window.addEventListener("pagehide", () => this.leave());
  }
}
