/*
 * Every word typer says, in one file.
 *
 * `en` is typed as `typeof ru`, so a missing key or a changed argument list is
 * a build error rather than a blank spot someone notices in production. That
 * check is the only reason this is a catalogue and not a call to a library.
 *
 * Entries with arguments are functions, not templates with placeholders: the
 * compiler then checks the call sites too, and each language is free to put
 * its words — and its quotation marks — wherever that language puts them.
 */

export type Lang = "ru" | "en";

/** Russian has three plural forms, chosen by the last digit or two. */
function plural(n: number, forms: [string, string, string]): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  const mod10 = n % 10;
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

const ru = {
  // The folder gate: the first screen, and the only one before a folder exists.
  pickPrompt: "Где держать заметки? Выберите папку — в ней будут лежать обычные .md файлы.",
  unsupportedBrowser:
    "typer хранит заметки файлами на диске, а этот браузер не умеет давать доступ к папке. Нужен Chrome, Yandex Browser или другой Chromium.",
  noFolderAccess: "Без доступа к папке заметки негде хранить.",
  folderUnreadable: (name: string) =>
    `Папку «${name}» не удалось прочитать. Возможно, её переместили или удалили.`,
  folderOpenFailed: "Не удалось открыть папку.",
  folderMoved: (name: string) =>
    `Папки «${name}» больше нет там, где она была. Выберите её заново.`,
  openFolderIn: (name: string) => `Открыть заметки в папке «${name}»?`,
  pickFolder: "Выбрать папку",
  openFolder: "Открыть",
  pickAnotherFolder: "Выбрать другую папку",
  folderReadFailed: (reason: string) => `Не удалось прочитать папку: ${reason}`,

  // Saving, and the two ways the folder can change under us.
  saveFailed: (reason: string) => `Не удалось сохранить: ${reason}`,
  fileVanished: (name: string) => `Файл «${name}» исчез с диска. Сохранить заново?`,
  saveAgain: "Сохранить",
  reloadedFromDisk: "Заметка обновлена с диска.",
  editedOutside: (name: string) => `«${name}» изменён снаружи, а здесь есть несохранённые правки.`,
  takeDiskCopy: "Взять с диска",
  keepMine: "Оставить мои",

  // The palette itself.
  palettePlaceholder: "Заметка, текст или команда",
  commandPlaceholder: "Команда",
  paletteEmpty: "Ничего не найдено",
  commandHint: "команда",
  noteOpenHint: "открыта",

  // Commands, in the order they appear.
  newNote: "Новая заметка",
  renameNote: "Переименовать заметку",
  deleteNote: "Удалить заметку",
  alignTables: "Выровнять таблицы",
  autoAlignOff: "Автовыравнивание таблиц: выключить",
  autoAlignOn: "Автовыравнивание таблиц: включить",
  countWords: "Сколько слов",
  spellcheckOff: "Орфография: выключить",
  spellcheckOn: "Орфография: включить",
  themeSystem: "Тема: системная",
  themeLight: "Тема: светлая",
  themeDark: "Тема: тёмная",
  langRu: "Язык: Русский",
  langEn: "Язык: English",
  changeFolder: "Сменить папку заметок",
  about: "О программе",
  commands: "Команды",

  // What those commands then ask or answer.
  renamePrompt: "Новое имя файла",
  confirmDelete: (name: string) => `Удалить «${name}»? Файл исчезнет без Корзины.`,
  deleteIt: "Удалить",
  wordCount: (words: number, chars: number) =>
    `${words} ${plural(words, ["слово", "слова", "слов"])}, ` +
    `${chars} ${plural(chars, ["знак", "знака", "знаков"])}.`,
  // Untranslated on purpose: it names a site, and a person looking for the
  // sources looks for that word whichever language the interface is in.
  repo: "GitHub",
};

/*
 * Written in English rather than translated from the Russian: Yandex Browser
 * means nothing to this reader, Edge does, and the Trash the Russian names is
 * a Finder thing while this runs on Windows too.
 */
const en: typeof ru = {
  pickPrompt: "Where should the notes live? Pick a folder — it will hold plain .md files.",
  unsupportedBrowser:
    "typer keeps notes as files on disk, and this browser cannot hand a page access to a folder. Use Chrome, Edge or another Chromium browser.",
  noFolderAccess: "Without access to the folder there is nowhere to put the notes.",
  folderUnreadable: (name: string) =>
    `The folder "${name}" could not be read. It may have been moved or deleted.`,
  folderOpenFailed: "Could not open the folder.",
  folderMoved: (name: string) =>
    `The folder "${name}" is no longer where it was. Pick it again.`,
  openFolderIn: (name: string) => `Open the notes in "${name}"?`,
  pickFolder: "Pick a folder",
  openFolder: "Open",
  pickAnotherFolder: "Pick another folder",
  folderReadFailed: (reason: string) => `Could not read the folder: ${reason}`,

  saveFailed: (reason: string) => `Could not save: ${reason}`,
  fileVanished: (name: string) => `The file "${name}" is gone from disk. Save it again?`,
  saveAgain: "Save",
  reloadedFromDisk: "Note reloaded from disk.",
  editedOutside: (name: string) => `"${name}" changed outside, and there are unsaved edits here.`,
  takeDiskCopy: "Take the disk copy",
  keepMine: "Keep mine",

  palettePlaceholder: "Note, text or command",
  commandPlaceholder: "Command",
  paletteEmpty: "Nothing found",
  commandHint: "command",
  noteOpenHint: "open",

  newNote: "New note",
  renameNote: "Rename note",
  deleteNote: "Delete note",
  alignTables: "Align tables",
  autoAlignOff: "Table auto-align: turn off",
  autoAlignOn: "Table auto-align: turn on",
  countWords: "Word count",
  spellcheckOff: "Spellcheck: turn off",
  spellcheckOn: "Spellcheck: turn on",
  themeSystem: "Theme: system",
  themeLight: "Theme: light",
  themeDark: "Theme: dark",
  // Each language is named in itself, so it is searchable from the other one.
  langRu: "Language: Русский",
  langEn: "Language: English",
  changeFolder: "Change notes folder",
  about: "About",
  commands: "Commands",

  renamePrompt: "New file name",
  confirmDelete: (name: string) => `Delete "${name}"? The file goes for good — there is no undo.`,
  deleteIt: "Delete",
  wordCount: (words: number, chars: number) =>
    `${words} word${words === 1 ? "" : "s"}, ${chars} character${chars === 1 ? "" : "s"}.`,
  repo: "GitHub",
};

const CATALOGUES: Record<Lang, typeof ru> = { ru, en };

/*
 * A live binding, so `t.newNote` at a call site is always the current language
 * without anyone having to re-import or re-render. The one rule this imposes:
 * read `t` inside the function that shows the string, never into a module-level
 * constant, which would freeze whatever language was active at import time.
 */
export let t: typeof ru = ru;

/** The language typer speaks. */
export function setUiLang(lang: Lang): void {
  t = CATALOGUES[lang];
}

/**
 * The language the browser spellchecks against.
 *
 * Deliberately separate from setUiLang, even though one call site sets both:
 * someone writing a Russian diary in an English interface needs these to come
 * apart, and when that day comes it is a second setting here, not a rewrite.
 */
export function setDocumentLang(lang: Lang): void {
  document.documentElement.lang = lang;
}

export function applyLang(lang: Lang): void {
  setUiLang(lang);
  setDocumentLang(lang);
}

/** The language to start in when nobody has chosen one yet. */
export function detectLang(): Lang {
  return navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";
}
