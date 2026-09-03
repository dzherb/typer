/*
 * Directory handles are structured-cloneable, so IndexedDB can remember which
 * folder was chosen. The permission that comes with it is not remembered as
 * reliably — Chromium may ask again on a new browser session — so every entry
 * point re-checks before touching the disk.
 */

const DB_NAME = "typer";
const DB_VERSION = 1;
const STORE = "handles";
const KEY = "vault";

const ACCESS: FileSystemHandlePermissionDescriptor = { mode: "readwrite" };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transact<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }).finally(() => db.close()),
  );
}

export function rememberVault(handle: FileSystemDirectoryHandle): Promise<unknown> {
  return transact("readwrite", (store) => store.put(handle, KEY));
}

export function recallVault(): Promise<FileSystemDirectoryHandle | undefined> {
  return transact("readonly", (store) => store.get(KEY));
}

export function forgetVault(): Promise<unknown> {
  return transact("readwrite", (store) => store.delete(KEY));
}

/**
 * Whether we may read and write the folder. `requestPermission` only works
 * inside a user gesture, so `interactive` must be false on startup paths.
 */
export async function hasAccess(
  handle: FileSystemDirectoryHandle,
  interactive: boolean,
): Promise<boolean> {
  if ((await handle.queryPermission(ACCESS)) === "granted") return true;
  if (!interactive) return false;
  return (await handle.requestPermission(ACCESS)) === "granted";
}

export function supportsFileSystemAccess(): boolean {
  return typeof window.showDirectoryPicker === "function";
}

export function pickVault(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker({ mode: "readwrite", id: "typer-vault" });
}
