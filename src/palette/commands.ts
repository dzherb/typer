import { applyTheme, updateSettings, type Theme } from "../settings.ts";
import type { Session } from "../session.ts";
import { forgetVault } from "../storage/handle.ts";
import { notice } from "../ui/notice.ts";
import { excerpt, score } from "./match.ts";
import type { Palette, PaletteItem, PaletteSource } from "./palette.ts";

const COMMAND = "команда";
/** Full-text hits rank below every title match, whatever their content. */
const CONTENT_RANK = 5;
const LIMIT = 40;

function plural(n: number, forms: [string, string, string]): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  const mod10 = n % 10;
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’‑-]*/gu;

function countWords(session: Session): void {
  const text = session.text();
  const words = text.match(WORD)?.length ?? 0;
  const chars = [...text].length;
  notice(
    `${words} ${plural(words, ["слово", "слова", "слов"])}, ` +
      `${chars} ${plural(chars, ["знак", "знака", "знаков"])}.`,
    { timeout: 5000 },
  );
}

function confirmDelete(session: Session): void {
  const name = session.currentName();
  if (!name) return;

  notice(`Удалить «${name}»? Файл исчезнет без Корзины.`, {
    actions: [{ label: "Удалить", run: () => void session.deleteCurrent() }],
    timeout: 12000,
  });
}

function renameCurrent(session: Session, palette: Palette): void {
  const name = session.currentName();
  if (!name) return;

  palette.ask({
    prompt: "Новое имя файла",
    initial: name.replace(/\.md$/, ""),
    submit: (value) => session.renameCurrent(value),
  });
}

function setTheme(theme: Theme): void {
  applyTheme(theme);
  updateSettings({ theme });
}

async function changeFolder(session: Session): Promise<void> {
  await session.flush();
  await forgetVault();
  location.reload();
}

function commands(session: Session, palette: Palette): PaletteItem[] {
  return [
    { id: "new", label: "Новая заметка", run: () => session.createNote() },
    { id: "rename", label: "Переименовать заметку", run: () => renameCurrent(session, palette) },
    { id: "delete", label: "Удалить заметку", run: () => confirmDelete(session) },
    { id: "count", label: "Сколько слов", run: () => countWords(session) },
    {
      id: "spellcheck",
      label: session.spellcheckEnabled() ? "Орфография: выключить" : "Орфография: включить",
      run: () => session.setSpellcheckEnabled(!session.spellcheckEnabled()),
    },
    { id: "theme-system", label: "Тема: системная", run: () => setTheme("system") },
    { id: "theme-light", label: "Тема: светлая", run: () => setTheme("light") },
    { id: "theme-dark", label: "Тема: тёмная", run: () => setTheme("dark") },
    { id: "folder", label: "Сменить папку заметок", run: () => changeFolder(session) },
  ].map((command) => ({ ...command, hint: COMMAND }));
}

/**
 * Builds what the palette shows for a query. With nothing typed it is the
 * notes, newest first; typing ranks titles and file names above matches found
 * only in the body of a note.
 */
export function createPaletteSource(session: Session, palette: Palette): PaletteSource {
  return (query) => {
    const notes = session.list();
    const open = session.currentName();

    if (!query) {
      const newNote = commands(session, palette)[0]!;
      return [
        newNote,
        ...notes.map((note) => ({
          id: note.name,
          label: note.title,
          hint: note.name === open ? "открыта" : note.name,
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
            hint: note.name === open ? "открыта" : note.name,
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
