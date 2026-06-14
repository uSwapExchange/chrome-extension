import { createModuleContext, startBusRouter } from '../core/bus/router.js';
import { registerModules } from '../core/modules/registry.js';
import { lockSessionStorageToTrustedContexts } from '../core/storage/session-state.js';
import { coreModule } from '../modules/core-module.js';
import { peerCaptureModule } from '../modules/peer-capture/index.js';

// MV3 rule: every chrome.* event listener must be registered synchronously in
// the first event-loop turn so events wake the service worker.

startBusRouter();
registerModules(createModuleContext(), [coreModule, peerCaptureModule]);

// Toolbar icon opens the side panel (the embedded uSwap app).
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => { /* pre-114 Chrome: side panel unavailable */ });

void lockSessionStorageToTrustedContexts();
