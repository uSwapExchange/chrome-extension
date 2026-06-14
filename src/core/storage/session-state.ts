/**
 * chrome.storage.session wrapper — memory-backed, never written to disk,
 * survives MV3 service-worker teardown, cleared when the browser closes.
 * Holds transient state: consent prompt records and capture sessions.
 *
 * Access is restricted to trusted contexts (SW/extension pages) at SW boot
 * so content scripts can never read it.
 */

export async function lockSessionStorageToTrustedContexts(): Promise<void> {
  try {
    await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  } catch {
    // Older Chrome: TRUSTED_CONTEXTS is already the default access level.
  }
}

export async function sessionGet<T>(key: string): Promise<T | null> {
  const got = await chrome.storage.session.get(key);
  return (got[key] as T | undefined) ?? null;
}

export async function sessionSet(key: string, value: unknown): Promise<void> {
  await chrome.storage.session.set({ [key]: value });
}

export async function sessionRemove(key: string | string[]): Promise<void> {
  await chrome.storage.session.remove(key);
}

export async function sessionKeys(prefix: string): Promise<string[]> {
  const all = await chrome.storage.session.get(null);
  return Object.keys(all).filter((key) => key.startsWith(prefix));
}
