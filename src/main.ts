import "./styles/fonts.css";
import "./styles/theme.css";
import "./styles/app.css";

import { createEditor } from "./editor/editor.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;

const view = createEditor({
  parent: app,
  doc: [
    "# Заголовок",
    "",
    "Обычный абзац с **жирным**, _курсивом_ и [ссылкой](https://dzherb.ru).",
    "",
    "- список",
    "- ещё пункт",
    "",
    "> Цитата.",
  ].join("\n"),
});

// Scaffolding: the automation harness in use cannot deliver real key events,
// so key bindings are exercised against this handle. Removed before release.
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__editor = view;
