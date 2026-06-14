import {
  TAB_PORT_NAME,
  busErr,
  isBusEvent,
  isBusRequest,
} from '../core/bus/protocol.js';

/**
 * ISOLATED-world relay: bridges window.postMessage (MAIN-world window.peer)
 * to the service worker. The SW treats sender.origin/sender.tab as
 * authoritative — nothing security-relevant is taken from page payloads.
 */

let port: chrome.runtime.Port | null = null;

function ensurePort(): chrome.runtime.Port {
  if (port) return port;
  const next = chrome.runtime.connect({ name: TAB_PORT_NAME });
  next.onMessage.addListener((message: unknown) => {
    if (isBusEvent(message)) {
      window.postMessage(message, window.location.origin);
    }
  });
  next.onDisconnect.addListener(() => {
    if (port === next) port = null;
  });
  port = next;
  return next;
}

// Open the port immediately so the SW learns tabId -> origin and can push
// events even before the first page call.
ensurePort();

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return;
  const data: unknown = event.data;
  if (!isBusRequest(data)) return;
  ensurePort();
  chrome.runtime.sendMessage(data).then(
    (response: unknown) => {
      window.postMessage(response, window.location.origin);
    },
    (error: unknown) => {
      const text = error instanceof Error ? error.message : String(error);
      window.postMessage(busErr(data.id, text), window.location.origin);
    },
  );
});
