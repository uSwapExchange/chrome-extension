import { createPeerExtensionSdk } from '@zkp2p/sdk';
import type { PeerAuthenticateParams } from '../modules/peer-capture/api-contract.js';

/**
 * Manual capture harness. Uses the published @zkp2p/sdk extension client
 * against our window.peer implementation — exercises the full chain without
 * the uSwap web app.
 */

const sdk = createPeerExtensionSdk();
const root = document.getElementById('root')!;

function log(label: string, value: unknown): void {
  const pre = document.createElement('pre');
  pre.textContent = `${label}\n${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`;
  root.appendChild(pre);
}

const form = document.createElement('div');
form.innerHTML = `
  <label>Platform</label><input id="platform" value="venmo" />
  <label>Action type</label><input id="actionType" value="transfer_venmo" />
  <label>Capture mode</label>
  <select id="captureMode"><option>buyerTee</option><option>sellerCredential</option></select>
  <label>Attestation service URL</label>
  <input id="attestationServiceUrl" value="https://attestation-service.zkp2p.xyz" />
  <label>Inline providerConfig (optional JSON)</label>
  <textarea id="providerConfig" placeholder="leave empty to fetch the published template"></textarea>
  <button id="connect">1. Connect</button>
  <button id="go">2. Authenticate</button>
`;
root.appendChild(form);

const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement).value;

document.getElementById('connect')!.addEventListener('click', () => {
  void (async () => {
    const version = await sdk.getVersion();
    log('version', version);
    const status = await sdk.checkConnectionStatus();
    log('status', status);
    if (status !== 'connected') {
      const ok = await sdk.requestConnection();
      log('requestConnection', ok);
    }
  })();
});

sdk.onMetadataMessage((message) => log('metadataMessage', message));

document.getElementById('go')!.addEventListener('click', () => {
  const providerConfigRaw = val('providerConfig').trim();
  const params: PeerAuthenticateParams = {
    platform: val('platform'),
    actionType: val('actionType'),
    captureMode: val('captureMode') as PeerAuthenticateParams['captureMode'],
    attestationServiceUrl: val('attestationServiceUrl'),
    ...(providerConfigRaw ? { providerConfig: JSON.parse(providerConfigRaw) } : {}),
  };
  log('authenticate', params);
  sdk.authenticate(params as never);
});
