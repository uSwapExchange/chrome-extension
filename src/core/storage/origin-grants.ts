/**
 * Persistent per-origin connection grants. This is the ONLY thing the
 * extension keeps in chrome.storage.local — never session material,
 * templates, or keys.
 */

const KEY = 'connections';

export interface OriginGrant {
  grantedAt: number;
}

type GrantMap = Record<string, OriginGrant>;

async function readGrants(): Promise<GrantMap> {
  const got = await chrome.storage.local.get(KEY);
  const value = got[KEY];
  return value && typeof value === 'object' ? (value as GrantMap) : {};
}

export async function isOriginGranted(origin: string): Promise<boolean> {
  const grants = await readGrants();
  return Boolean(grants[origin]);
}

export async function grantOrigin(origin: string): Promise<void> {
  const grants = await readGrants();
  grants[origin] = { grantedAt: Date.now() };
  await chrome.storage.local.set({ [KEY]: grants });
}

export async function revokeOrigin(origin: string): Promise<void> {
  const grants = await readGrants();
  delete grants[origin];
  await chrome.storage.local.set({ [KEY]: grants });
}

export async function listGrants(): Promise<Array<{ origin: string; grantedAt: number }>> {
  const grants = await readGrants();
  return Object.entries(grants)
    .map(([origin, grant]) => ({ origin, grantedAt: grant.grantedAt }))
    .sort((a, b) => b.grantedAt - a.grantedAt);
}
