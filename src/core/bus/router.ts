import {
  TAB_PORT_NAME,
  busErr,
  busOk,
  isBusRequest,
  type BusEvent,
} from './protocol.js';
import { resolveHandler, type ModuleContext } from '../modules/registry.js';

/**
 * Service-worker side of the bus: dispatches BusRequests to module handlers
 * and tracks the long-lived relay Port per tab so modules can push events
 * (e.g. metadata messages) back to exactly the originating tab.
 *
 * Everything here must be wired synchronously at SW top level so webRequest/
 * runtime events wake the worker.
 */

const tabPorts = new Map<number, chrome.runtime.Port>();

export function pushToTab(tabId: number, event: BusEvent): boolean {
  const port = tabPorts.get(tabId);
  if (!port) return false;
  try {
    port.postMessage(event);
    return true;
  } catch {
    tabPorts.delete(tabId);
    return false;
  }
}

export function createModuleContext(): ModuleContext {
  return { pushToTab };
}

export function startBusRouter(): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== TAB_PORT_NAME) return;
    const tabId = port.sender?.tab?.id;
    if (typeof tabId !== 'number') {
      port.disconnect();
      return;
    }
    tabPorts.set(tabId, port);
    port.onDisconnect.addListener(() => {
      if (tabPorts.get(tabId) === port) tabPorts.delete(tabId);
    });
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isBusRequest(message)) return undefined;
    const handler = resolveHandler(message.module, message.type);
    if (!handler) {
      sendResponse(busErr(message.id, `Unknown message ${message.module}:${message.type}`));
      return undefined;
    }
    handler(message.payload, sender)
      .then((payload) => sendResponse(busOk(message.id, payload)))
      .catch((error: unknown) => {
        const text = error instanceof Error ? error.message : String(error);
        sendResponse(busErr(message.id, text));
      });
    return true; // keep sendResponse alive for the async handler
  });
}
