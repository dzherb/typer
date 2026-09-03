import "./styles/fonts.css";
import "./styles/theme.css";
import "./styles/app.css";

import { requestVault } from "./gate.ts";
import { createPaletteSource } from "./palette/commands.ts";
import { Palette } from "./palette/palette.ts";
import { Session } from "./session.ts";
import { applyTheme, readSettings } from "./settings.ts";

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

const vault = await requestVault(app);
app.replaceChildren();

const session = await Session.start(vault, app, readSettings().lastNote);

// Constructed with a lazy source so the palette and its commands, which need
// to reopen the palette, can refer to each other.
const palette: Palette = new Palette((query) => source(query));
const source = createPaletteSource(session, palette);

window.addEventListener("keydown", (event) => {
  if (!(event.metaKey || event.ctrlKey) || event.key !== "k") return;
  event.preventDefault();
  if (palette.isOpen) palette.close();
  else palette.open();
});
