import { JSONPath } from 'jsonpath-plus';
import type { ExtractedRow, ProviderTemplate } from '../templates/types.js';

/**
 * Pure JSON metadata extraction. HTML/XPath templates are extracted in the
 * offscreen document (the service worker has no DOMParser) and are not
 * handled here.
 */

function jsonQuery(json: unknown, path: string): unknown {
  const result = JSONPath({ path, json: json as object, wrap: false });
  return result;
}

/**
 * Run the template's transactionsExtraction selectors over a parsed JSON
 * response. Each row keeps its originalIndex in the platform's raw list —
 * index-requiring platforms (venmo/cashapp/revolut/zelle) need it to build
 * per-row params.
 */
export function extractJsonRows(template: ProviderTemplate, responseJson: unknown): ExtractedRow[] {
  const extraction = template.metadata.transactionsExtraction;
  const listSelector = extraction?.transactionJsonPathListSelector;
  const fieldSelectors = extraction?.transactionJsonPathSelectors;
  if (!listSelector || !fieldSelectors) return [];

  const list = jsonQuery(responseJson, listSelector);
  if (!Array.isArray(list)) return [];

  return list.map((item, originalIndex): ExtractedRow => {
    const row: ExtractedRow = { originalIndex };
    for (const [field, selector] of Object.entries(fieldSelectors)) {
      row[field] = jsonQuery(item, selector);
    }
    return row;
  });
}

/** Evaluate a JSONPath against the full response body with {{INDEX}} bound. */
export function jsonPathWithIndex(json: unknown, path: string, index: number): unknown {
  const resolved = path.replace(/\{\{INDEX\}\}/g, String(index));
  return jsonQuery(json, resolved);
}
