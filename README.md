# uSwap browser extension

The uSwap browser extension (Chrome MV3). The toolbar icon opens a **side panel
hosting the real uSwap web app** — users execute full uSwap flows inside the
panel. Feature modules add browser-integration superpowers on top.

Its job in one line: when you buy crypto with fiat on uSwap, the extension
confirms — privately, on your device — that you sent the payment, so the escrow
releases your crypto. **Plaintext session material never leaves your browser;
only a TEE-encrypted proof is relayed.** Because that's a claim you shouldn't
have to take on faith, this extension is open source.

## Install

A one-click **Chrome Web Store** listing is in review. Until it's approved, install
manually from the [latest release](https://github.com/uSwapExchange/chrome-extension/releases/latest):

1. **Download** `uswap-extension-<version>.zip` from the release Assets and **unzip** it.
2. Open **`chrome://extensions`** (Chrome, Brave, Edge, or any Chromium browser).
3. Toggle **Developer mode** on (top-right).
4. Click **Load unpacked** and select the unzipped folder.

The uSwap icon appears in your toolbar. Keep the unzipped folder where it is —
deleting it removes the extension. Chrome may occasionally ask you to confirm
developer-mode extensions; that's expected for a manual install.

## Build from source

```bash
bun install
bun run build      # → dist/  (the published zip is the contents of dist/)
bun run package    # → uswap-extension-<version>.zip
```

The release artifact is exactly the contents of `dist/`, so you can rebuild and
diff it against the published zip to verify what you're running.

## Security model

- The extension only executes code shipped in its package — **no remotely hosted
  code** — and Chrome's MV3 CSP (`script-src self`) enforces it.
- It reads your *own* payment confirmation using your *existing* logged-in
  session; it never asks for, sees, or stores your password or PIN.
- Values derived from private request material are blocked from leaving the
  extension by a defense-in-depth guard (`src/modules/peer-capture/capture/redact.ts`).
- Payment-platform host access is **optional**, requested only when you choose to
  pay — the install prompt never asks for your accounts.

Privacy policy: <https://uswap.net/privacy> · Support: <https://uswap.net/contact>

## License

[MIT](./LICENSE).

## Modules

| Module | Status | What it does |
|---|---|---|
| `peer-capture` | active | Whitelabeled [Peer](https://docs.peer.xyz/developer/build-your-own-extension) metadata bridge: implements `window.peer` for `@zkp2p/sdk`'s `createPeerExtensionSdk()`, drives fiat payment capture (buyer TEE + seller credential flows) for the uSwap onramp. |
| `checkout-pay` | planned | Bitwarden-style overlay on checkout pages (Stripe, Cryptomus, …): one click creates a uSwap pay-mode intent (`/pay/:id`) to buy a virtual card for the cart amount, then autofills card details. |
| `context-bridge` | planned | Right-click a selected crypto address → "Swap via uSwap" → opens bridge creation with that destination. |

### Module rules

- A module may only import from `src/core/*`. Modules never import each other.
- Every manifest permission is annotated with its owning module in
  `manifest.config.ts`.
- New modules: add an entry under `src/modules/<id>/`, export an
  `ExtensionModule`, register it in `src/background/index.ts`. Content scripts
  and permissions are added per-module in `manifest.config.ts`
  (prefer `optional_host_permissions` granted at first use).

## Architecture

```
page (window.peer, MAIN world)        src/content/peer-page-api.main.ts
  ⇅ window.postMessage (BusRequest/BusResponse/BusEvent)
relay (ISOLATED world)                src/content/peer-relay.content.ts
  ⇅ chrome.runtime sendMessage + long-lived Port (per-tab event push)
service worker                        src/background/index.ts
  ├─ bus router → module handlers    src/core/bus/router.ts
  ├─ origin grants                   src/core/storage/origin-grants.ts (chrome.storage.local)
  ├─ capture sessions                chrome.storage.session (TRUSTED_CONTEXTS, never disk)
  └─ offscreen doc                   @zkp2p/sdk crypto + DOM parsing (peer-capture)
extension pages
  ├─ side panel                      src/sidepanel/  — iframes the uSwap app
  ├─ consent prompts                 src/prompt/     — connect / inline-template approvals
  └─ options                        src/options/    — connected-sites management
```

The service worker treats `sender.origin` / `sender.tab` as authoritative;
nothing security-relevant is taken from page-supplied payloads.

## Security invariants (do not break)

- Plaintext payment session material (cookies, auth headers, request bodies)
  **never leaves the extension** — only TEE-encrypted blobs are posted to pages.
- Inline provider templates require an explicit post-extraction approval prompt.
- Capture is gated behind per-origin connection approval.
- `chrome.storage.local` holds only origin grants. Capture state lives in
  `chrome.storage.session` (memory-backed) and is wiped on completion/expiry.
- The extension holds no API keys; curator/maker logic stays in page/backend code.

## Develop

```bash
bun install
cd packages/extension
bun run dev        # vite dev server with CRXJS HMR
bun run build      # production build → dist/
bun run package    # dist → uswap-extension-<version>.zip
bun test           # unit tests (template engine, selectors, redaction)
```

Load `packages/extension/dist` via chrome://extensions → "Load unpacked".

The side panel embeds `VITE_USWAP_APP_URL` (default `https://app.uswap.net`,
dev default `http://localhost:5173`). The app must allow framing by the
extension: `Content-Security-Policy: frame-ancestors 'self' chrome-extension:`.
