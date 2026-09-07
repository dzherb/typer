/** Narrows away the null the assertion above has already ruled out. */
export function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value, got none");
  return value;
}

class MemoryStorage {
  private readonly items = new Map<string, string>();

  get length(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

/** The storage of a private window, where every access throws. */
const sealedStorage = new Proxy(
  {},
  {
    get() {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
  },
) as Storage;

/**
 * There is no localStorage outside a browser, so the tests bring their own.
 * `kind: "sealed"` is the private window the storage modules guard against.
 */
export function useStorage(kind: "memory" | "sealed" = "memory"): void {
  globalThis.localStorage = kind === "memory" ? new MemoryStorage() : sealedStorage;
}

export function dropStorage(): void {
  Reflect.deleteProperty(globalThis, "localStorage");
}
