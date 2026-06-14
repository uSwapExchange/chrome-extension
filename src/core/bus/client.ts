import {
  BUS_CHANNEL,
  isBusResponse,
  newBusId,
  type BusRequest,
  type ModuleId,
} from './protocol.js';

/**
 * Bus client for extension-owned contexts (prompt/options/sidepanel pages and
 * content scripts) talking to the service worker via chrome.runtime.
 */

export async function busCall<T = unknown>(
  module: ModuleId,
  type: string,
  payload?: unknown,
): Promise<T> {
  const request: BusRequest = {
    channel: BUS_CHANNEL,
    kind: 'req',
    id: newBusId(),
    module,
    type,
    payload,
  };
  const response: unknown = await chrome.runtime.sendMessage(request);
  if (!isBusResponse(response)) {
    throw new Error(`Malformed bus response for ${module}:${type}`);
  }
  if (!response.ok) throw new Error(response.error ?? 'Bus call failed');
  return response.payload as T;
}
