import type { ExtensionModule } from '../core/modules/registry.js';
import { getPrompt, resolvePrompt } from '../core/consent/prompt.js';
import { grantOrigin, listGrants, revokeOrigin } from '../core/storage/origin-grants.js';

/**
 * Built-in handlers used by the extension's own pages (prompt, options).
 * Trust model: these message types only do anything useful when sent from
 * extension pages; content scripts could call them, so resolvePrompt
 * validates the prompt record exists (promptId is an unguessable UUID held
 * only by the prompt window).
 */

interface ResolvePromptPayload {
  promptId?: string;
  approved?: boolean;
}

export const coreModule: ExtensionModule = {
  id: 'core',
  handlers: {
    async getPrompt(payload) {
      const { promptId } = (payload ?? {}) as ResolvePromptPayload;
      if (!promptId) throw new Error('promptId required');
      return getPrompt(promptId);
    },

    async resolvePrompt(payload, sender) {
      if (sender.tab?.url && !sender.tab.url.startsWith(chrome.runtime.getURL(''))) {
        throw new Error('resolvePrompt is extension-page only');
      }
      const { promptId, approved } = (payload ?? {}) as ResolvePromptPayload;
      if (!promptId || typeof approved !== 'boolean') throw new Error('promptId and approved required');
      const record = await getPrompt(promptId);
      if (!record) throw new Error('Unknown prompt');
      if (record.kind === 'connect' && approved) {
        await grantOrigin(record.origin);
      }
      await resolvePrompt(promptId, approved);
      return { ok: true };
    },

    async listGrants() {
      return listGrants();
    },

    async revokeGrant(payload, sender) {
      if (sender.tab?.url && !sender.tab.url.startsWith(chrome.runtime.getURL(''))) {
        throw new Error('revokeGrant is extension-page only');
      }
      const { origin } = (payload ?? {}) as { origin?: string };
      if (!origin) throw new Error('origin required');
      await revokeOrigin(origin);
      return { ok: true };
    },
  },
};
