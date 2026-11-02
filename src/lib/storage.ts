// localStorage can throw (private mode, blocked site data). Everything that
// reads or writes it goes through here so a failure degrades to "not saved".

export function readJson<T>(key: string, storage: Storage = localStorage): T | null {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown, storage: Storage = localStorage): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Not persisted; the in-memory value still works for this visit.
  }
}

export function remove(key: string, storage: Storage = localStorage): void {
  try {
    storage.removeItem(key);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
