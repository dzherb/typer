import "./styles/fonts.css";
import "./styles/theme.css";
import "./styles/app.css";

import { requestVault } from "./gate.ts";
import { createPaletteSource } from "./palette/commands.ts";
import { Palette } from "./palette/palette.ts";
import { Session } from "./session.ts";
import { applyTheme, readSettings } from "./settings.ts";

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

// Scaffolding: the automation harness in use cannot deliver real key events,
// so behaviour is exercised against these. Removed before release.
if (import.meta.env.DEV) {
  Object.assign(window as unknown as Record<string, unknown>, { __session: session, __palette: palette });
}
