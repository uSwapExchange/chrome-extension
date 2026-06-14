import { describe, expect, it } from 'bun:test';
import venmoTemplate from './fixtures/venmo_transfer_venmo.json';
import cashappTemplate from './fixtures/cashapp_transfer_cashapp.json';
import { parseProviderTemplate } from '../src/modules/peer-capture/templates/types.js';
import { extractJsonRows, jsonPathWithIndex } from '../src/modules/peer-capture/capture/extract.js';
import { buildParams } from '../src/modules/peer-capture/capture/selectors.js';
import { assertNoPrivateLeak, PrivateMaterialLeak } from '../src/modules/peer-capture/capture/redact.js';

const VENMO_RESPONSE = {
  stories: [
    {
      paymentId: 'pid-aaa',
      amount: '- $25.00',
      currency: 'USD',
      date: '2026-06-01T12:00:00Z',
      title: { receiver: { username: 'maker-one' }, sender: { id: 'sender-123' } },
    },
    {
      paymentId: 'pid-bbb',
      amount: '- $40.00',
      currency: 'USD',
      date: '2026-06-02T12:00:00Z',
      title: { receiver: { username: 'maker-two' }, sender: { id: 'sender-123' } },
    },
  ],
};

describe('provider template parsing', () => {
  it('parses the real venmo template', () => {
    const template = parseProviderTemplate(venmoTemplate);
    expect(template.metadata.platform).toBe('venmo');
    expect(template.authLink).toContain('venmo.com');
    expect(template.paramNames).toEqual(['SENDER_ID']);
  });

  it('parses the real cashapp template', () => {
    const template = parseProviderTemplate(cashappTemplate);
    expect(template.metadata.platform).toBe('cashapp');
    expect(template.metadata.transactionsExtraction?.transactionJsonPathListSelector).toBe('$.activity_rows');
  });

  it('rejects a template missing required fields', () => {
    expect(() => parseProviderTemplate({ authLink: 'not-a-url' })).toThrow();
  });
});

describe('extractJsonRows', () => {
  it('extracts venmo rows preserving originalIndex', () => {
    const template = parseProviderTemplate(venmoTemplate);
    const rows = extractJsonRows(template, VENMO_RESPONSE);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ originalIndex: 0, recipient: 'maker-one', paymentId: 'pid-aaa', amount: '- $25.00' });
    expect(rows[1]!.originalIndex).toBe(1);
  });

  it('returns empty when the list selector misses', () => {
    const template = parseProviderTemplate(venmoTemplate);
    expect(extractJsonRows(template, { stories: 'not-an-array' })).toEqual([]);
    expect(extractJsonRows(template, {})).toEqual([]);
  });
});

describe('jsonPathWithIndex', () => {
  it('binds {{INDEX}} before evaluating', () => {
    expect(jsonPathWithIndex(VENMO_RESPONSE, '$.stories[{{INDEX}}].paymentId', 1)).toBe('pid-bbb');
    expect(jsonPathWithIndex(VENMO_RESPONSE, '$.stories[{{INDEX}}].title.sender.id', 0)).toBe('sender-123');
  });
});

describe('buildParams', () => {
  it('builds SENDER_ID from the response and includes index', () => {
    const template = parseProviderTemplate(venmoTemplate);
    const result = buildParams(template, 1, {
      responseJson: VENMO_RESPONSE,
      requestBody: '',
      url: 'https://account.venmo.com/api/stories?feedType=me&externalId=sender-123',
    });
    expect(result.params).toMatchObject({ SENDER_ID: 'sender-123', index: 1 });
    expect(result.privateParamNames).toEqual([]);
  });

  it('flags requestBody-sourced params as private', () => {
    const template = parseProviderTemplate({
      ...venmoTemplate,
      paramNames: ['SECRET'],
      paramSelectors: [{ type: 'regex', value: 'token=(\\w+)', source: 'requestBody' }],
    });
    const result = buildParams(template, 0, {
      responseJson: VENMO_RESPONSE,
      requestBody: 'token=supersecret&x=1',
      url: 'https://account.venmo.com/api/stories',
    });
    expect(result.params.SECRET).toBe('supersecret');
    expect(result.privateParamNames).toEqual(['SECRET']);
  });
});

describe('assertNoPrivateLeak', () => {
  it('passes when no private value appears in metadata', () => {
    const rows = extractJsonRows(parseProviderTemplate(venmoTemplate), VENMO_RESPONSE);
    expect(() => assertNoPrivateLeak(rows, ['supersecret-cookie-value'])).not.toThrow();
  });

  it('throws when a private value leaks into a metadata field', () => {
    const rows = [{ originalIndex: 0, recipient: 'leaked-secret' }];
    expect(() => assertNoPrivateLeak(rows, ['leaked-secret'])).toThrow(PrivateMaterialLeak);
  });

  it('ignores short private values to avoid false positives', () => {
    const rows = [{ originalIndex: 0, currency: 'USD' }];
    expect(() => assertNoPrivateLeak(rows, ['US'])).not.toThrow();
  });
});
