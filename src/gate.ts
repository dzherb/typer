import {
  hasAccess,
  pickVault,
  recallVault,
  rememberVault,
  supportsFileSystemAccess,
} from "./storage/handle.ts";
import { Vault } from "./storage/vault.ts";

interface Choice {
  label: string;
  run: () => Promise<FileSystemDirectoryHandle>;
}

function render(parent: HTMLElement, prompt: string, choices: Choice[], error?: string) {
  const gate = document.createElement("div");
  gate.className = "gate";

  const title = document.createElement("p");
  title.className = "gate__title";
  title.textContent = prompt;
  gate.append(title);

  for (const choice of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gate__button";
    button.textContent = choice.label;
    button.dataset.choice = choice.label;
    gate.append(button);
  }

  if (error) {
    const note = document.createElement("p");
    note.className = "gate__error";
    note.textContent = error;
    gate.append(note);
  }

  parent.replaceChildren(gate);
  gate.querySelector<HTMLButtonElement>(".gate__button")?.focus();
  return gate;
}

/**
 * Resolves once we hold a readable, writable folder.
 *
 * A remembered folder still needs its permission confirmed, and Chromium only
 * allows that inside a user gesture — hence a button rather than a prompt on
 * load. It usually takes one click per browser session, and none at all when
 * the app is installed.
 */
export function requestVault(parent: HTMLElement): Promise<Vault> {
  return new Promise((resolve) => {
    if (!supportsFileSystemAccess()) {
      render(
        parent,
        "typer хранит заметки файлами на диске, а этот браузер не умеет давать доступ к папке. Нужен Chrome, Yandex Browser или другой Chromium.",
        [],
      );
      return;
    }

    const attempt = async (choices: Choice[], prompt: string, choice: Choice, error?: string) => {
      try {
        const handle = await choice.run();
        if (!(await hasAccess(handle, true))) {
          show(prompt, choices, "Без доступа к папке заметки негде хранить.");
          return;
        }
        await rememberVault(handle);
        resolve(new Vault(handle));
      } catch (failure) {
        // AbortError just means the picker was dismissed; say nothing.
        const aborted = failure instanceof DOMException && failure.name === "AbortError";
        show(prompt, choices, aborted ? error : "Не удалось открыть папку.");
      }
    };

    const show = (prompt: string, choices: Choice[], error?: string) => {
      const gate = render(parent, prompt, choices, error);
      for (const choice of choices) {
        gate
          .querySelector<HTMLButtonElement>(`[data-choice="${CSS.escape(choice.label)}"]`)
          ?.addEventListener("click", () => void attempt(choices, prompt, choice, error));
      }
    };

    const pick: Choice = { label: "Выбрать папку", run: pickVault };

    void (async () => {
      const remembered = await recallVault().catch(() => undefined);

      if (!remembered) {
        show("Где держать заметки? Выберите папку — в ней будут лежать обычные .md файлы.", [pick]);
        return;
      }

      // Already granted: straight in, no screen at all.
      if (await hasAccess(remembered, false)) {
        resolve(new Vault(remembered));
        return;
      }

      show(`Открыть заметки в папке «${remembered.name}»?`, [
        { label: "Открыть", run: async () => remembered },
        { label: "Выбрать другую папку", run: pickVault },
      ]);
    })();
  });
}
