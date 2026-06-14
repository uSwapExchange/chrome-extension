import {
  BUS_CHANNEL,
  isBusEvent,
  isBusResponse,
  newBusId,
  type BusRequest,
} from '../core/bus/protocol.js';
import {
  PEER_TYPES,
  type PeerAuthenticateParams,
  type PeerMetadataMessage,
  type PeerPageApi,
} from '../modules/peer-capture/api-contract.js';

/**
 * MAIN-world content script: defines window.peer for @zkp2p/sdk's
 * createPeerExtensionSdk(). Talks only to the ISOLATED relay via
 * window.postMessage — chrome.* APIs are unavailable here by design.
 */

const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
const metadataCallbacks = new Set<(message: PeerMetadataMessage) => void>();

function call<T>(type: string, payload?: unknown): Promise<T> {
  const request: BusRequest = {
    channel: BUS_CHANNEL,
    kind: 'req',
    id: newBusId(),
    module: 'peer-capture',
    type,
    payload,
  };
  return new Promise<T>((resolve, reject) => {
    pending.set(request.id, { resolve: resolve as (value: unknown) => void, reject });
    window.postMessage(request, window.location.origin);
  });
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return;
  const data: unknown = event.data;
  if (isBusResponse(data)) {
    const waiter = pending.get(data.id);
    if (!waiter) return;
    pending.delete(data.id);
    if (data.ok) waiter.resolve(data.payload);
    else waiter.reject(new Error(data.error ?? 'Extension call failed'));
    return;
  }
  if (isBusEvent(data) && data.module === 'peer-capture' && data.type === PEER_TYPES.metadataMessage) {
    const message = data.payload as PeerMetadataMessage;
    for (const callback of metadataCallbacks) {
      try {
        callback(message);
      } catch {
        // page callback errors are the page's problem
      }
    }
  }
});

const peer: PeerPageApi = {
  getVersion: () => call<string>(PEER_TYPES.getVersion),
  requestConnection: () => call<boolean>(PEER_TYPES.requestConnection),
  checkConnectionStatus: () => call(PEER_TYPES.checkConnectionStatus),
  authenticate: (params: PeerAuthenticateParams) => {
    void call(PEER_TYPES.authenticate, params).catch((error: unknown) => {
      // authenticate() is fire-and-forget per the contract; surface failures
      // through the metadata channel so the page's listener hears about them.
      const message: PeerMetadataMessage = {
        requestId: 'error',
        platform: params.platform,
        metadata: [],
        expiresAt: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      };
      for (const callback of metadataCallbacks) {
        try {
          callback(message);
        } catch { /* ignore */ }
      }
    });
  },
  onMetadataMessage: (callback) => {
    metadataCallbacks.add(callback);
    return () => metadataCallbacks.delete(callback);
  },
};

declare global {
  interface Window {
    peer?: PeerPageApi;
  }
}

if (!window.peer) {
  window.peer = peer;
}
