import type { CapturedRequest } from './session.js';

/**
 * Replay the captured request from the service-worker context to read the
 * response body that webRequest can't expose in MV3.
 *
 * With host permission held, an extension fetch with credentials:'include'
 * attaches the browser cookie jar. For sessions pinned to forbidden headers
 * (Cookie/User-Agent set explicitly), we install a scoped
 * declarativeNetRequest session rule to inject them, then remove it.
 */

const FORBIDDEN_HEADERS = new Set([
  'cookie', 'origin', 'referer', 'user-agent',
  'content-length', 'host', 'connection',
]);

const DNR_RULE_ID = 90_001;

function splitHeaders(headers: Record<string, string>): {
  safe: Record<string, string>;
  forbidden: Record<string, string>;
} {
  const safe: Record<string, string> = {};
  const forbidden: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (FORBIDDEN_HEADERS.has(name.toLowerCase()) || name.toLowerCase().startsWith('sec-')) {
      forbidden[name] = value;
    } else {
      safe[name] = value;
    }
  }
  return { safe, forbidden };
}

async function withForbiddenHeaders<T>(
  url: string,
  forbidden: Record<string, string>,
  run: () => Promise<T>,
): Promise<T> {
  const names = Object.keys(forbidden);
  if (names.length === 0) return run();
  const requestHeaders: chrome.declarativeNetRequest.ModifyHeaderInfo[] = names.map((name) => ({
    header: name,
    operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
    value: forbidden[name],
  }));
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [DNR_RULE_ID],
    addRules: [{
      id: DNR_RULE_ID,
      priority: 1,
      action: { type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType, requestHeaders },
      condition: { urlFilter: url, resourceTypes: ['xmlhttprequest' as chrome.declarativeNetRequest.ResourceType] },
    }],
  });
  try {
    return await run();
  } finally {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [DNR_RULE_ID] });
  }
}

export interface ReplayResult {
  status: number;
  text: string;
  json: unknown;
}

export async function replayRequest(captured: CapturedRequest): Promise<ReplayResult> {
  const { safe, forbidden } = splitHeaders(captured.headers);
  const init: RequestInit = {
    method: captured.method,
    headers: safe,
    credentials: 'include',
  };
  if (captured.method.toUpperCase() !== 'GET' && captured.body) {
    init.body = captured.body;
  }

  const response = await withForbiddenHeaders(captured.url, forbidden, () => fetch(captured.url, init));
  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, text, json };
}
