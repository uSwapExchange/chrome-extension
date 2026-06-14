import { parseProviderTemplate, type ProviderTemplate } from './types.js';

const TEMPLATE_BASE = 'https://api.zkp2p.xyz/providers';

export interface ResolvedTemplate {
  template: ProviderTemplate;
  /** Inline templates require explicit post-extraction approval before delivery. */
  inline: boolean;
}

/**
 * Resolve a provider template: inline providerConfig (untrusted, must be
 * approved) takes precedence; otherwise fetch the platform/actionType JSON.
 */
export async function resolveTemplate(input: {
  platform: string;
  actionType: string;
  providerConfig?: unknown;
}): Promise<ResolvedTemplate> {
  if (input.providerConfig != null) {
    return { template: parseProviderTemplate(input.providerConfig), inline: true };
  }
  const url = `${TEMPLATE_BASE}/${encodeURIComponent(input.platform)}/${encodeURIComponent(input.actionType)}.json`;
  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok) {
    throw new Error(`Failed to load template ${input.platform}/${input.actionType}: HTTP ${response.status}`);
  }
  const json: unknown = await response.json();
  return { template: parseProviderTemplate(json), inline: false };
}
