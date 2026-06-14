import { allCapturePatterns } from '../templates/platforms.js';
import {
  findSessionByAuthTab,
  getSession,
  putSession,
  type CapturedRequest,
  type CaptureSession,
} from './session.js';

/**
 * webRequest interception. Listeners are registered synchronously at SW
 * startup (MV3 wakeup rule) but only act when an active capture session
 * matches the request's tab + the template's urlRegex.
 *
 * Bodies arrive in onBeforeRequest; headers (incl. Cookie/Authorization, via
 * extraHeaders) in onBeforeSendHeaders. They're joined on the chrome
 * requestId. Response bodies are NOT readable here — see replay.ts.
 */

interface PartialCapture {
  authTabId: number;
  sessionRequestId: string;
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
}

// chrome requestId -> partial capture (in-memory; a lost SW restart just drops
// an in-flight capture and the user retries).
const inflight = new Map<string, PartialCapture>();

let onCaptureComplete: ((session: CaptureSession) => void) | null = null;
export function setCaptureCompleteHandler(handler: (session: CaptureSession) => void): void {
  onCaptureComplete = handler;
}

type RequestBody = chrome.webRequest.OnBeforeRequestDetails['requestBody'];

function decodeBody(requestBody: RequestBody): string {
  if (!requestBody) return '';
  if (requestBody.raw?.length) {
    try {
      const decoder = new TextDecoder();
      return requestBody.raw
        .map((part: { bytes?: ArrayBuffer }) => (part.bytes ? decoder.decode(part.bytes) : ''))
        .join('');
    } catch {
      return '';
    }
  }
  if (requestBody.formData) {
    return JSON.stringify(requestBody.formData);
  }
  return '';
}

function matchesTemplate(session: CaptureSession, url: string, method: string): boolean {
  const meta = session.template.metadata;
  const methodOk = !meta.method || meta.method.toUpperCase() === method.toUpperCase();
  if (methodOk && new RegExp(meta.urlRegex).test(url)) return true;
  if (meta.fallbackUrlRegex && new RegExp(meta.fallbackUrlRegex).test(url)) return true;
  if (meta.metadataUrl && url.startsWith(meta.metadataUrl)) return true;
  return false;
}

async function maybeComplete(requestId: string): Promise<void> {
  const partial = inflight.get(requestId);
  if (!partial || partial.body === undefined || partial.headers === undefined) return;
  inflight.delete(requestId);

  const session = await getSession(partial.sessionRequestId);
  if (!session || session.status !== 'awaiting_request') return;

  const captured: CapturedRequest = {
    url: partial.url,
    method: partial.method,
    headers: partial.headers,
    body: partial.body,
  };
  const updated: CaptureSession = { ...session, captured, status: 'captured' };
  await putSession(updated);
  onCaptureComplete?.(updated);
}

export function registerInterceptor(): void {
  const filter: chrome.webRequest.RequestFilter = { urls: allCapturePatterns() };

  chrome.webRequest.onBeforeRequest.addListener(
    (details): chrome.webRequest.BlockingResponse | undefined => {
      if (details.tabId < 0) return undefined;
      void (async () => {
        const session = await findSessionByAuthTab(details.tabId);
        if (!session || !matchesTemplate(session, details.url, details.method)) return;
        const existing = inflight.get(details.requestId) ?? {
          authTabId: details.tabId,
          sessionRequestId: session.requestId,
          url: details.url,
          method: details.method,
        };
        existing.body = decodeBody(details.requestBody);
        inflight.set(details.requestId, existing);
        await maybeComplete(details.requestId);
      })();
      return undefined;
    },
    filter,
    ['requestBody'],
  );

  chrome.webRequest.onBeforeSendHeaders.addListener(
    (details): chrome.webRequest.BlockingResponse | undefined => {
      if (details.tabId < 0) return undefined;
      void (async () => {
        const session = await findSessionByAuthTab(details.tabId);
        if (!session || !matchesTemplate(session, details.url, details.method)) return;
        const headers: Record<string, string> = {};
        for (const header of details.requestHeaders ?? []) {
          if (header.name && header.value != null) headers[header.name] = header.value;
        }
        const existing = inflight.get(details.requestId) ?? {
          authTabId: details.tabId,
          sessionRequestId: session.requestId,
          url: details.url,
          method: details.method,
        };
        existing.headers = headers;
        inflight.set(details.requestId, existing);
        await maybeComplete(details.requestId);
      })();
      return undefined;
    },
    filter,
    ['requestHeaders', 'extraHeaders'],
  );
}
