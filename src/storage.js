// Browser storage only. Every read and write is wrapped, so a browser that
// refuses storage (private mode, full quota, blocked) leaves the page working
// and tells the person, rather than failing silently.

export const STORAGE_KEY = 'fb13.tradeslip.v0';

export function loadState(storage = globalThis.localStorage) {
  try {
    if (!storage) return null;
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !Array.isArray(data.lines)) return null;
    return {
      version: 1,
      pastes: Array.isArray(data.pastes) ? data.pastes : [],
      lines: data.lines,
      entries: Array.isArray(data.entries) ? data.entries : [],
    };
  } catch {
    return null;
  }
}

/** Returns true when the write landed, false when the browser refused it. */
export function saveState(state, storage = globalThis.localStorage) {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
