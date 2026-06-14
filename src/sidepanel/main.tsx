import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * The side panel IS the uSwap app: a full-bleed iframe of the real web app.
 * The peer-relay content scripts run inside the iframe (all_frames: true),
 * so window.peer and capture flows work identically here and in a tab.
 */

const APP_URL: string = import.meta.env.VITE_USWAP_APP_URL
  ?? (import.meta.env.DEV ? 'http://localhost:5173' : 'https://app.uswap.net');

function appSrc(): string {
  const url = new URL(APP_URL);
  url.searchParams.set('ctx', 'extension');
  return url.toString();
}

function SidePanel(): React.ReactElement {
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {!loaded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: 'rgba(255,255,255,0.55)',
            fontFamily: 'system-ui, sans-serif',
            fontSize: 13,
          }}
        >
          Loading uSwap…
        </div>
      )}
      <iframe
        src={appSrc()}
        title="uSwap"
        onLoad={() => setLoaded(true)}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        allow="clipboard-write"
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<SidePanel />);
