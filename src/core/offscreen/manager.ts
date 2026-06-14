/**
 * Lazily create the single offscreen document that hosts @zkp2p/sdk crypto
 * (and DOM/XPath parsing). Only one offscreen document may exist per
 * extension, so creation is guarded.
 */

const OFFSCREEN_PATH = 'src/offscreen/offscreen.html';
let creating: Promise<void> | null = null;

async function hasDocument(): Promise<boolean> {
  const getContexts = (chrome.runtime as { getContexts?: (filter: unknown) => Promise<unknown[]> }).getContexts;
  if (getContexts) {
    const contexts = await getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    return Array.isArray(contexts) && contexts.length > 0;
  }
  return false;
}

export async function ensureOffscreenDocument(): Promise<void> {
  if (await hasDocument()) return;
  if (creating) {
    await creating;
    return;
  }
  creating = chrome.offscreen
    .createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['DOM_PARSER', 'WORKERS'] as chrome.offscreen.Reason[],
      justification: 'Encrypt payment session material and parse HTML responses.',
    })
    .catch((error: unknown) => {
      // A concurrent caller may have created it; tolerate the race.
      if (error instanceof Error && /single offscreen/i.test(error.message)) return;
      throw error;
    })
    .finally(() => {
      creating = null;
    });
  await creating;
}
