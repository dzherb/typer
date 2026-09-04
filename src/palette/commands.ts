import { applyLang, t, type Lang } from "../i18n.ts";
import { applyTheme, updateSettings, type Theme } from "../settings.ts";
import type { Session } from "../session.ts";
import { forgetVault } from "../storage/handle.ts";
import { notice } from "../ui/notice.ts";
import { versionLine } from "../version.ts";
import { excerpt, score } from "./match.ts";
import type { Palette, PaletteItem, PaletteSource } from "./palette.ts";

/** Full-text hits rank below every title match, whatever their content. */
const CONTENT_RANK = 5;
const LIMIT = 40;

/** The command that lists the commands; it is left out of its own list. */
const LIST_ID = "commands";

const REPO = "https://github.com/dzherb/typer";

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’‑-]*/gu;

function countWords(session: Session): void {
  const text = session.text();
  const words = text.match(WORD)?.length ?? 0;
  const chars = [...text].length;
  notice(t.wordCount(words, chars), { timeout: 5000 });
}

function confirmDelete(session: Session): void {
  const name = session.currentName();
  if (!name) return;

  notice(t.confirmDelete(name), {
    actions: [{ label: t.deleteIt, run: () => void session.deleteCurrent() }],
    timeout: 12000,
  });
}

function renameCurrent(session: Session, palette: Palette): void {
  const name = session.currentName();
  if (!name) return;

  palette.ask({
    prompt: t.renamePrompt,
    initial: name.replace(/\.md$/, ""),
    submit: (value) => session.renameCurrent(value),
  });
}

function setTheme(theme: Theme): void {
  applyTheme(theme);
  updateSettings({ theme });
}

/*
 * The editor is told to look again because the document language changed under
 * it: without that, the note keeps the underlines the previous dictionary drew
 * and the switch looks broken.
 */
function setLang(session: Session, lang: Lang): void {
  applyLang(lang);
  updateSettings({ lang });
  session.refreshSpellcheck();
}

/*
 * The version, and the one place it is worth carrying to. Timed out rather
 * than left standing: nothing here is a question, so letting it go answers
 * nothing badly — but it is a hex hash and a clock, read a character at a
 * time, so it gets the length of an error rather than of a word count.
 */
function showAbout(): void {
  notice(`typer ${versionLine}`, {
    actions: [{ label: t.repo, run: () => window.open(REPO, "_blank", "noopener") }],
    timeout: 8000,
  });
}

async function changeFolder(session: Session): Promise<void> {
  await session.flush();
  await forgetVault();
  location.reload();
}

function commands(session: Session, palette: Palette): PaletteItem[] {
  return [
    { id: "new", label: t.newNote, run: () => session.createNote() },
    { id: "rename", label: t.renameNote, run: () => renameCurrent(session, palette) },
    { id: "delete", label: t.deleteNote, run: () => confirmDelete(session) },
    { id: "align", label: t.alignTables, run: () => session.alignTables() },
    { id: "count", label: t.countWords, run: () => countWords(session) },
    {
      id: "auto-align",
      label: session.autoAlignEnabled() ? t.autoAlignOff : t.autoAlignOn,
      run: () => session.setAutoAlignEnabled(!session.autoAlignEnabled()),
    },
    {
      id: "spellcheck",
      label: session.spellcheckEnabled() ? t.spellcheckOff : t.spellcheckOn,
      run: () => session.setSpellcheckEnabled(!session.spellcheckEnabled()),
    },
    { id: "theme-system", label: t.themeSystem, run: () => setTheme("system") },
    { id: "theme-light", label: t.themeLight, run: () => setTheme("light") },
    { id: "theme-dark", label: t.themeDark, run: () => setTheme("dark") },
    // Each language is named in itself, so either one is findable from the
    // other: "english" hits it in a Russian interface and "русский" in an
    // English one.
    { id: "lang-ru", label: t.langRu, run: () => setLang(session, "ru") },
    { id: "lang-en", label: t.langEn, run: () => setLang(session, "en") },
    { id: "folder", label: t.changeFolder, run: () => changeFolder(session) },
    { id: "about", label: t.about, run: () => showAbout() },
    { id: LIST_ID, label: t.commands, run: () => palette.showCommands() },
  ].map((command) => ({ ...command, kind: "command" as const }));
}

/**
 * The command mode: every command except the one that opened this list, in the
 * order they are written above. Typing narrows the list rather than leaving it,
 * so a note can never turn up here.
 */
function commandList(session: Session, palette: Palette, query: string): PaletteItem[] {
  const all = commands(session, palette).filter((command) => command.id !== LIST_ID);
  if (!query) return all;

  const ranked: Array<{ item: PaletteItem; rank: number }> = [];

  for (const command of all) {
    const rank = score(command.label, query);
    if (rank !== null) ranked.push({ item: command, rank });
  }

  return ranked.sort((a, b) => b.rank - a.rank).map(({ item }) => item);
}

/**
 * Builds what the palette shows for a query. With nothing typed it is the
 * notes, newest first; typing ranks titles and file names above matches found
 * only in the body of a note.
 */
export function createPaletteSource(session: Session, palette: Palette): PaletteSource {
  return (query, mode) => {
    if (mode === "commands") return commandList(session, palette, query);

    const notes = session.list();
    const open = session.currentName();

    if (!query) {
      const newNote = commands(session, palette)[0]!;
      return [
        newNote,
        ...notes.map((note) => ({
          id: note.name,
          label: note.title,
          hint: note.name === open ? t.noteOpenHint : note.name,
          run: () => session.open(note.name),
        })),
      ];
    }

    const ranked: Array<{ item: PaletteItem; rank: number }> = [];

    for (const command of commands(session, palette)) {
      const rank = score(command.label, query);
      if (rank !== null) ranked.push({ item: command, rank });
    }

    for (const note of notes) {
      const byTitle = score(note.title, query);
      const byName = score(note.name, query);
      const rank = Math.max(byTitle ?? -1, byName ?? -1);

      if (rank >= 0) {
        ranked.push({
          item: {
            id: note.name,
            label: note.title,
            hint: note.name === open ? t.noteOpenHint : note.name,
            run: () => session.open(note.name),
          },
          rank,
        });
        continue;
      }

      const hit = excerpt(note.text, query);
      if (hit) {
        ranked.push({
          item: {
            id: note.name,
            label: note.title,
            hint: note.name,
            excerpt: hit,
            run: () => session.open(note.name),
          },
          rank: CONTENT_RANK,
        });
      }
    }

    return ranked
      .sort((a, b) => b.rank - a.rank)
      .slice(0, LIMIT)
      .map(({ item }) => item);
  };
}
