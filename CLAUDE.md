# typer

A markdown editor for daily notes. No backend: the notes are `.md` files in a
folder on disk, reached through the File System Access API, and the whole app
runs in the browser. Chromium only.

Read `README.md` first — it describes the behaviour this code has to keep.

## Commands

```bash
bun install
bun run dev      # vite on 5173
bun run build    # tsc && vite build — tsc is the gate and must pass
./deploy.sh      # builds, rsyncs dist/ to the server
```

There are no tests, no linter and no formatter. `bun run build` is the whole
check: it type-checks under `strict` and fails on unused locals and parameters.

English for code, comments, commit messages and README — the sources are going
public. Russian only inside the `ru` catalogue.

## What not to add

**No dependencies that do not survive the question "how many lines would this
be by hand?"** The service worker in `vite.config.ts` is written out rather
than pulled from a plugin because the whole strategy is fifteen lines. At
runtime there is CodeMirror and nothing else.

**No permanent chrome.** The app has exactly two surfaces: the palette
(`Cmd+K`) and the notices at the foot of the page. Anything new arrives
through one of them; nothing new sits on screen while someone is writing.

## Strings

Every word typer says lives in `src/i18n.ts`, in both catalogues. `en` is
typed as `typeof ru`, so a missing key or a changed argument list is a build
error — do not widen the type to get around it.

Strings taking arguments are functions, not templates with placeholders: the
compiler then checks the call sites, and each language puts its words, and its
quotation marks, where that language puts them.

Read `t` inside the function that shows the string. It is a live binding, and
lifting it into a module-level constant freezes whatever language happened to
be active at import time.

## Notices

`notice()` either times out or stays until a button is pressed, and the choice
is not about length:

- **Stays** when expiring would leave the app in a bad or undecided state — an
  unresolved conflict, a frozen autosave, a dead screen.
- **Times out** when expiring is itself a fine answer. `confirmDelete` times
  out for exactly that reason: not deciding means not deleting.

The durations track how much there is to read — 4000 for a line, 5000 for a
sentence of numbers, 8000 for something holding a hash or an arbitrary error.

## Version

`version` in `package.json` is set by hand: a minor when the palette's command
list gains or changes something, a patch for a fix, a major only if an
existing folder of notes stops working the way it did. The build behind it —
hash, `+` for a dirty tree, time — is worked out in `vite.config.ts`, and
`src/version.ts` is the only place that knows what a version looks like.

Commit before deploying: `deploy.sh` builds the working tree, so an
uncommitted deploy carries a `+` until the next one. At a release, bump
`package.json`, commit, `git tag v0.2.0`, then deploy. Nothing tags on its own.

## Comments

Comments here say why, and usually name the trap being avoided — see the top
of `src/storage/naming.ts`, or the line above `applyLang` in `src/main.ts`.
Match that density in both directions: a comment restating the line below it
does not belong either.
