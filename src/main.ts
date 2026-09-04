import "./styles/fonts.css";
import "./styles/theme.css";
import "./styles/app.css";

import { requestVault } from "./gate.ts";
import { applyLang, detectLang, t } from "./i18n.ts";
import { createPaletteSource } from "./palette/commands.ts";
import { Palette } from "./palette/palette.ts";
import { Session } from "./session.ts";
import { applyTheme, readSettings } from "./settings.ts";
import { forgetVault } from "./storage/handle.ts";
import { notice } from "./ui/notice.ts";

/*
 * Registered first, and deliberately not behind the "load" event: the module
 * suspends below on the folder gate, which can wait for a click indefinitely.
 * Anything after that await would never run on a first visit — and offline
 * access is the whole point of the worker.
 */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js");
}

const app = document.querySelector<HTMLDivElement>("#app")!;

applyTheme(readSettings().theme);
// Before the gate: it is the first thing anyone reads, and on a first visit it
// is the only thing they read before choosing a language is even possible.
applyLang(readSettings().lang ?? detectLang());

const vault = await requestVault(app);
app.replaceChildren();

let session: Session;
try {
  session = await Session.start(vault, app, readSettings().lastNote);
} catch (error) {
  // The gate checked the folder a moment ago, so this is something unforeseen.
  // Say so and offer a way out rather than leaving a dead screen.
  notice(t.folderReadFailed(error instanceof Error ? error.message : String(error)), {
    actions: [
      {
        label: t.pickAnotherFolder,
        run: () => void forgetVault().finally(() => location.reload()),
      },
    ],
  });
  throw error;
}

// Constructed with a lazy source so the palette and its commands, which need
// to reopen the palette, can refer to each other.
const palette: Palette = new Palette((query) => source(query));
const source = createPaletteSource(session, palette);

window.addEventListener("keydown", (event) => {
  // Matched on the physical key: on a Cyrillic layout this one reports "л",
  // and matching the character would leave the palette unreachable there.
  if (event.code !== "KeyK" || !(event.metaKey || event.ctrlKey)) return;
  if (event.repeat) return;

  event.preventDefault();
  if (palette.isOpen) palette.close();
  else palette.open();
});
