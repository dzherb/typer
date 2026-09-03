import {
  forgetVault,
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

const PICK_PROMPT =
  "Где держать заметки? Выберите папку — в ней будут лежать обычные .md файлы.";

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
 * Whether the folder is still where it was. Permission outlives the directory
 * itself: move it, rename it or delete it in Finder and the handle still says
 * "granted" while every read fails.
 *
 * Only meaningful once permission is granted — without it this fails for the
 * other reason.
 */
async function isReachable(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    await handle.values().next();
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves once we hold a folder that is both permitted and actually there.
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

    /** Resolves the outer promise, or returns why it could not. */
    const accept = async (handle: FileSystemDirectoryHandle): Promise<string | null> => {
      if (!(await hasAccess(handle, true))) {
        return "Без доступа к папке заметки негде хранить.";
      }
      if (!(await isReachable(handle))) {
        return `Папку «${handle.name}» не удалось прочитать. Возможно, её переместили или удалили.`;
      }
      await rememberVault(handle);
      resolve(new Vault(handle));
      return null;
    };

    const screen = (prompt: string, choices: Choice[], error?: string): void => {
      const gate = render(parent, prompt, choices, error);

      gate.addEventListener("click", (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".gate__button");
        const choice = choices.find((c) => c.label === button?.dataset.choice);
        if (!button || !choice) return;

        button.disabled = true;
        void (async () => {
          try {
            const failure = await accept(await choice.run());
            if (failure) screen(prompt, choices, failure);
          } catch (thrown) {
            // AbortError just means the picker was dismissed; leave the screen be.
            if (thrown instanceof DOMException && thrown.name === "AbortError") {
              button.disabled = false;
            } else {
              screen(prompt, choices, "Не удалось открыть папку.");
            }
          }
        })();
      });
    };

    const pick: Choice = { label: "Выбрать папку", run: pickVault };

    void (async () => {
      const remembered = await recallVault().catch(() => undefined);

      if (!remembered) {
        screen(PICK_PROMPT, [pick]);
        return;
      }

      if (await hasAccess(remembered, false)) {
        // Already granted: straight in, no screen at all.
        if (await isReachable(remembered)) {
          resolve(new Vault(remembered));
          return;
        }
        await forgetVault().catch(() => undefined);
        screen(
          PICK_PROMPT,
          [pick],
          `Папки «${remembered.name}» больше нет там, где она была. Выберите её заново.`,
        );
        return;
      }

      screen(`Открыть заметки в папке «${remembered.name}»?`, [
        { label: "Открыть", run: async () => remembered },
        { label: "Выбрать другую папку", run: pickVault },
      ]);
    })();
  });
}
