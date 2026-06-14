import { sessionGet, sessionRemove, sessionSet } from '../storage/session-state.js';

/**
 * Consent prompts open a small extension window and resolve when the user
 * decides. Prompt records live in chrome.storage.session; the resolver map
 * is in-memory (an SW restart mid-prompt rejects the originating call —
 * callers simply re-request).
 */

export type PromptKind = 'connect' | 'inline-template' | 'platform-permission';

export interface PromptRecord {
  promptId: string;
  kind: PromptKind;
  origin: string;
  createdAt: number;
  /** Kind-specific display payload (e.g. inline template summary). */
  detail?: unknown;
}

const PROMPT_PREFIX = 'prompt:';
const resolvers = new Map<string, (approved: boolean) => void>();

export async function openPrompt(record: Omit<PromptRecord, 'promptId' | 'createdAt'>): Promise<boolean> {
  const promptId = crypto.randomUUID();
  const full: PromptRecord = { ...record, promptId, createdAt: Date.now() };
  await sessionSet(PROMPT_PREFIX + promptId, full);

  const url = chrome.runtime.getURL(`src/prompt/index.html#/${record.kind}?promptId=${promptId}`);
  await chrome.windows.create({ url, type: 'popup', width: 400, height: 600, focused: true });

  return new Promise<boolean>((resolve) => {
    resolvers.set(promptId, resolve);
  });
}

export async function getPrompt(promptId: string): Promise<PromptRecord | null> {
  return sessionGet<PromptRecord>(PROMPT_PREFIX + promptId);
}

export async function resolvePrompt(promptId: string, approved: boolean): Promise<void> {
  await sessionRemove(PROMPT_PREFIX + promptId);
  const resolve = resolvers.get(promptId);
  resolvers.delete(promptId);
  resolve?.(approved);
}

export async function hasOpenPrompt(origin: string, kind: PromptKind): Promise<boolean> {
  // Only consult in-memory resolvers; storage records without a resolver are
  // stale leftovers from an SW restart and must not report 'pending' forever.
  for (const promptId of resolvers.keys()) {
    const record = await getPrompt(promptId);
    if (record && record.origin === origin && record.kind === kind) return true;
  }
  return false;
}
