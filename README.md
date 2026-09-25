# typer

A minimal markdown editor for daily notes. No server: the notes are ordinary
`.md` files in a folder on disk, and the whole app runs in the browser.

Running at <https://typer.dzherb.ru>. Chromium only, for the reason under
*Browsers* below.

## How it works

- **Editor** — CodeMirror 6. The markdown source stays visible at all times,
  muted but never hidden (the iA Writer model, not Typora).
- **Storage** — the File System Access API. You pick the folder once and its
  handle lives in IndexedDB. Nothing leaves the machine: the server only
  serves static files.
- **Navigation** — `Cmd+K`. Switching notes, full-text search, creating,
  renaming, deleting, aligning tables, word count, theme, language. Nothing
  else is on screen. A `Commands` command lists the rest of them, with the
  notes out of the way; typing then narrows that list, and Escape leaves it.
  `About` is where the version lives. The three commands that come up daily
  have a chord of their own as well, printed beside them in the palette.
  The query is read on both layouts, QWERTY and ЙЦУКЕН, so `ghbdtn` finds
  «привет» and `ьщтвфн` finds `monday`.
- **Offline** — a service worker precaches the entire app.
- **Spelling** — the browser's own checker, on by default. A palette command
  turns it off, and the choice is remembered.

## Shortcuts

| | |
|---|---|
| `Cmd+K` | palette: notes, search, commands |
| `Cmd+Enter` | new note |
| `Cmd+Shift+P` | the command list |
| `Cmd+Shift+F` | align every table in the note |
| `Enter` | continues a list or a quote; on an empty item it leaves the list |
| `Tab` / `Shift+Tab` | indent level of the item |
| `Cmd+B` / `Cmd+I` | bold / italic |

`Cmd` is `Ctrl` off a Mac, and the palette writes whichever one this keyboard
has. The chords are read from the physical key, so a Cyrillic layout keeps
them.

## Tables

The pipes are lined up in the file, not only on screen: cells are padded to a
common width, the delimiter row is stretched to match, and a row short of
cells is given them. This happens when the caret leaves the table, never while
you are typing inside one — re-padding on every keystroke would slide the
columns out from under the word being written.

`Cmd+Shift+F`, or `Cmd+K` → `Align tables`, does the whole note at once, which
is what a table pasted in from somewhere else needs. The automatic half can be turned off —
`Cmd+K` → `Table auto-align` — and the choice is remembered; what is left then
is that command, so a table is aligned when you ask and never on its own.

Rows are set in the same monospace as code spans, because a column lines up
only where a space is as wide as a letter, and they are allowed wider than the
measure the prose keeps to. A table too wide even for that wraps like any
other line: a horizontal scrollbar under a page of writing costs more than the
rare table it would save.

## File names

A new note is created as `2026-09-04.md`. The name is settled once —
`2026-09-04-on-holiday.md`, transliterated where it has to be — but only after
the title line is finished and another line has appeared below it. A pause
mid-phrase, while you look for the right word, settles nothing: otherwise the
autosave would freeze half a heading into the file name for good.

If the title is written but no line break follows it yet, the name stays a
date — the note still shows under its own title in the palette, and the name
lands when you finish the line. After that the file is never renamed on its
own: a name that changes under you breaks outside links and confuses git.
Renaming by hand is a palette command.

## Saving

Automatically 700 ms after you stop typing, on losing focus, and on closing
the tab. The browser cannot watch a folder, so mtime is compared whenever the
tab comes back: with no pending edits the note is simply re-read, and with
edits you are asked whose version wins.

Deletion is permanent: the browser has no access to the system Trash.

## Language

The interface comes in Russian and English. On a first visit the browser's own
language decides; after that, `Cmd+K` → `Language: Русский` / `Language:
English`, and the choice is remembered. Each language is named in itself, so
either one is findable from the other.

The choice also sets the page's `lang`, which is what the browser's spell
checker reads — see below.

## Development

```bash
bun install
bun run dev
```

Before a commit:

```bash
bun run check
```

TypeScript, Biome, ESLint and the tests in `tests/`, in that order.
`bun run format` rewrites what Biome can fix by itself.

## Deployment

Where a copy of typer goes is a property of the copy, not of the project, so
`deploy.sh` reads it from `deploy.env` — a file git ignores:

```bash
TYPER_HOST=my-server                 # ssh alias, or user@host
TYPER_ROOT=/var/www/typer            # optional, and this is the default
TYPER_URL=https://typer.example.com  # optional, printed when the deploy lands
```

After that, every time:

```bash
./deploy.sh
```

It builds and rsyncs `dist/` there. The same three names read from the
environment too, which is what a one-off deploy from somewhere else wants.

Once, on the server. The certificate comes first: the config refers to it, and
`nginx -t` will not pass on a config it cannot verify.

```bash
sudo certbot certonly --nginx -d typer.example.com
sudo mkdir -p /var/www/typer && sudo chown "$USER" /var/www/typer
sed 's/typer\.example\.com/YOUR-DOMAIN/g' deploy/nginx.conf |
  sudo tee /etc/nginx/sites-available/typer > /dev/null
sudo ln -s /etc/nginx/sites-available/typer /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Then open the site, pick a folder and install it as an app — in its own
window, without browser chrome, the folder permission sticks far more
reliably.

## Version

The number is `version` in `package.json`, set by hand. It goes up a minor
when the palette gains or changes a command — that list is the whole surface
of this app — a patch when something is fixed, and a major only if an existing
folder of notes stops working the way it did.

`About` shows it with the build behind it: `typer 0.1.0 · 7b44b5f+ ·
2026-09-04 14:32`. The hash is the commit, and the `+` means the working tree
was dirty when it was built — `deploy.sh` builds the tree, not the commit, so
without that mark the hash would name a commit the build does not contain. The
same string, minus the name, is on `<html data-version>`, the quickest way to
tell whether the service worker is still serving yesterday's bundle.

A tag is written by hand at release, `git tag v0.1.0`. Nothing creates it
automatically: a tag put on a dirty deploy would point at code that was never
shipped, and a tag that lies is worse than no tag.

## Browsers

Chromium is required: Chrome, Edge, Yandex Browser. Safari has no File System
Access API, and without it the notes have nowhere to live.

Spell checking is the browser's; the app carries no dictionaries of its own.
Which language gets checked follows the page's `lang`, which follows the
language you picked — so English words in a Russian note are underlined until
the English dictionary is enabled in the browser's own language settings, and
the other way round. Autocorrect is off on purpose: silently rewriting words
in someone's diary is not the same thing as underlining them.

## Font

iA Writer Quattro S, [SIL OFL 1.1](public/fonts/LICENSE.md), © Information
Architects. Full Cyrillic coverage — the face is built on IBM Plex.

## License

[MIT](LICENSE) — the code. The font is not covered by it: iA Writer Quattro S
stays under the [SIL OFL 1.1](public/fonts/LICENSE.md) it ships with, and that
license has to travel with the files wherever they are copied.
