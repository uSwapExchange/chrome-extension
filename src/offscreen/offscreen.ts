import {
  apiCreateSellerCredentialBundle,
  createEncryptedBuyerTeeSessionMaterial,
  type SellerCredentialAttestationRuntime,
} from '@zkp2p/sdk';
import type { OffscreenRequest, OffscreenResponse } from '../core/offscreen/rpc.js';

/**
 * Hosts @zkp2p/sdk cryptography and DOM parsing. The SDK pulls in ethers/ox
 * and needs WebCrypto + a real document; keeping it out of the service worker
 * also keeps SW cold-start fast. Plaintext session material is held only
 * transiently here and never persisted — only ciphertext is returned.
 */

const attestationRuntime: SellerCredentialAttestationRuntime = {
  fetch: globalThis.fetch.bind(globalThis),
  subtle: globalThis.crypto.subtle,
  getRandomValues: (array) => globalThis.crypto.getRandomValues(array),
};

async function handleEncryptBuyerTee(payload: Extract<OffscreenRequest, { type: 'encrypt-buyer-tee' }>['payload']) {
  const encrypted = await createEncryptedBuyerTeeSessionMaterial({
    platform: payload.platform,
    actionType: payload.actionType,
    attestationServiceUrl: payload.attestationServiceUrl,
    sessionMaterial: payload.sessionMaterial,
  } as Parameters<typeof createEncryptedBuyerTeeSessionMaterial>[0]);
  return { encryptedSessionMaterial: encrypted };
}

async function handleCreateSellerBundle(payload: Extract<OffscreenRequest, { type: 'create-seller-bundle' }>['payload']) {
  const response = await apiCreateSellerCredentialBundle(
    { payeeId: payload.payeeId, sessionMaterial: payload.sessionMaterial } as never,
    payload.attestationServiceUrl,
    payload.platform as never,
    undefined,
    attestationRuntime,
  );
  return { credentialBundle: (response as { responseObject?: unknown }).responseObject ?? response };
}

function handleXPathExtract(payload: Extract<OffscreenRequest, { type: 'xpath-extract' }>['payload']) {
  const doc = new DOMParser().parseFromString(payload.html, 'text/html');
  const evaluateNodes = (context: Node, expr: string): Node[] => {
    const result = doc.evaluate(expr, context, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const nodes: Node[] = [];
    for (let i = 0; i < result.snapshotLength; i += 1) {
      const node = result.snapshotItem(i);
      if (node) nodes.push(node);
    }
    return nodes;
  };
  const rows = evaluateNodes(doc, payload.listSelector).map((node, originalIndex) => {
    const row: Record<string, unknown> = { originalIndex };
    for (const [field, expr] of Object.entries(payload.fieldSelectors)) {
      const matches = evaluateNodes(node, expr);
      row[field] = matches[0]?.textContent ?? null;
    }
    return row;
  });
  return { rows };
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const request = message as OffscreenRequest;
  if (!request || request.target !== 'offscreen') return undefined;

  const respond = (response: Omit<OffscreenResponse, 'target' | 'id'>) =>
    sendResponse({ target: 'offscreen-result', id: request.id, ...response } satisfies OffscreenResponse);

  (async () => {
    switch (request.type) {
      case 'encrypt-buyer-tee':
        return handleEncryptBuyerTee(request.payload);
      case 'create-seller-bundle':
        return handleCreateSellerBundle(request.payload);
      case 'xpath-extract':
        return handleXPathExtract(request.payload);
      default:
        throw new Error('Unknown offscreen request');
    }
  })()
    .then((result) => respond({ ok: true, result }))
    .catch((error: unknown) => respond({ ok: false, error: error instanceof Error ? error.message : String(error) }));

  return true; // async sendResponse
});
