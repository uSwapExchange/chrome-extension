import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { busCall } from '../core/bus/client.js';

interface GrantRow {
  origin: string;
  grantedAt: number;
}

function Options(): React.ReactElement {
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    busCall<GrantRow[]>('core', 'listGrants')
      .then(setGrants)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const revoke = async (origin: string) => {
    await busCall('core', 'revokeGrant', { origin });
    refresh();
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <img src="/icons/48.png" width={32} height={32} alt="" />
        <h1 style={{ fontSize: 20, margin: 0 }}>uSwap Extension</h1>
        <span style={{ opacity: 0.5, fontSize: 13 }}>v{chrome.runtime.getManifest().version}</span>
      </div>

      <h2 style={{ fontSize: 14, opacity: 0.7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Connected sites
      </h2>
      <p style={{ fontSize: 13, opacity: 0.6, lineHeight: 1.5 }}>
        These sites can start payment capture flows and receive encrypted payment proofs.
        The extension never shares your plaintext payment session with any site.
      </p>

      {loading && <p style={{ opacity: 0.6, fontSize: 13 }}>Loading…</p>}
      {!loading && grants.length === 0 && (
        <p style={{ opacity: 0.6, fontSize: 13 }}>No sites connected yet.</p>
      )}
      {grants.map((grant) => (
        <div
          key={grant.origin}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{grant.origin}</div>
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
              Connected {new Date(grant.grantedAt).toLocaleString()}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void revoke(grant.origin)}
            style={{
              padding: '7px 14px',
              borderRadius: 9,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'transparent',
              color: '#f4f6fb',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Revoke
          </button>
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Options />);
