import "./styles/fonts.css";
import "./styles/theme.css";
import "./styles/app.css";

import { requestVault } from "./gate.ts";
import { Session } from "./session.ts";
import { applyTheme, readSettings } from "./settings.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;

applyTheme(readSettings().theme);

const vault = await requestVault(app);
app.replaceChildren();

const session = await Session.start(vault, app, readSettings().lastNote);

// Scaffolding: the automation harness in use cannot deliver real key events,
// so behaviour is exercised against this handle. Removed before release.
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__session = session;
