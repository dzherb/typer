export interface NoticeAction {
  label: string;
  run: () => void;
}

export interface NoticeOptions {
  actions?: NoticeAction[];
  /** Milliseconds until it fades on its own; omit to make it stay. */
  timeout?: number;
}

let host: HTMLElement | null = null;

function noticeHost(): HTMLElement {
  if (!host) {
    host = document.createElement("div");
    host.className = "notices";
    document.body.append(host);
  }
  return host;
}

/**
 * A transient message at the foot of the page. The editor has no permanent
 * chrome, so this is the only thing that ever speaks up — keep it to things
 * the writer must know: conflicts, failures, an answer they asked for.
 */
export function notice(message: string, options: NoticeOptions = {}): () => void {
  const element = document.createElement("div");
  element.className = "notice";
  element.setAttribute("role", "status");

  const text = document.createElement("span");
  text.className = "notice__text";
  text.textContent = message;
  element.append(text);

  const dismiss = () => {
    clearTimeout(timer);
    element.remove();
  };

  for (const action of options.actions ?? []) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "notice__action";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      dismiss();
      action.run();
    });
    element.append(button);
  }

  const timer = options.timeout ? setTimeout(dismiss, options.timeout) : undefined;
  noticeHost().append(element);
  return dismiss;
}
