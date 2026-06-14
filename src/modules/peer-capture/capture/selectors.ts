import type { ProviderTemplate, TemplateSelector } from '../templates/types.js';
import { jsonPathWithIndex } from './extract.js';

/**
 * Build the buyer-TEE `params` object from the template's paramNames /
 * paramSelectors for a selected row.
 *
 * Selectors are evaluated with {{INDEX}} bound to the row's originalIndex.
 * `source` routes the evaluation target; it defaults to the response body.
 * A selector sourced from `requestBody` produces PRIVATE session material —
 * such values are flagged so they can never appear in metadata rows.
 */

export interface CaptureSources {
  responseJson: unknown;
  requestBody: string;
  url: string;
}

export interface ParamResult {
  params: Record<string, unknown>;
  /** Names of params whose value derives from private request material. */
  privateParamNames: string[];
}

function evalSelector(selector: TemplateSelector, index: number, sources: CaptureSources): unknown {
  const source = selector.source ?? 'responseBody';
  if (source === 'responseBody') {
    return jsonPathWithIndex(sources.responseJson, selector.value, index);
  }
  const haystack = source === 'requestBody' ? sources.requestBody : sources.url;
  if (selector.type === 'regex') {
    const pattern = selector.value.replace(/\{\{INDEX\}\}/g, String(index));
    const match = new RegExp(pattern).exec(haystack);
    return match?.[1] ?? match?.[0] ?? null;
  }
  // jsonPath against a string source isn't meaningful; return raw.
  return haystack;
}

export function buildParams(
  template: ProviderTemplate,
  index: number,
  sources: CaptureSources,
): ParamResult {
  const params: Record<string, unknown> = {};
  const privateParamNames: string[] = [];
  const names = template.paramNames ?? [];
  const selectors = template.paramSelectors ?? [];

  for (let i = 0; i < selectors.length; i += 1) {
    const selector = selectors[i];
    const name = names[i] ?? `param_${i}`;
    if (!selector) continue;
    params[name] = evalSelector(selector, index, sources);
    if (selector.source === 'requestBody') privateParamNames.push(name);
  }
  // index is required by platforms that key proofs by list position.
  params.index = index;
  return { params, privateParamNames };
}

/** Interpolate {{PARAM}} placeholders in a string with built param values. */
export function interpolate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => {
    const value = params[key];
    return value == null ? whole : String(value);
  });
}
