'use client';

import { useEffect, useState } from 'react';

export default function AIModelsPage() {
  const [provider, setProvider] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/provider-info')
      .then((r) => r.json())
      .then(setProvider)
      .catch(() => setError(true));
  }, []);

  return (
    <div>
      <div className="page-head">
        <div className="page-eyebrow">AI Models</div>
        <h1 className="page-title">AI models</h1>
        <p className="page-sub">
          The MVP calls one AI provider, configured server-side via environment variables so the
          key never reaches the browser.
        </p>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        {error && <p style={{ color: 'var(--critical)' }}>Couldn't reach the server.</p>}
        {!error && !provider && <p style={{ color: 'var(--text-dim)' }}>Checking…</p>}
        {provider && (
          <div style={{ fontSize: 14 }}>
            <Row label="Provider" value={provider.providerName} />
            <Row label="Model" value={provider.modelName} mono />
            <Row
              label="Status"
              value={provider.configured ? 'Connected (API key set)' : 'Not configured'}
              color={provider.configured ? 'var(--correct)' : 'var(--critical)'}
            />
          </div>
        )}
        <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 16 }}>
          Change AI_PROVIDER and the matching *_API_KEY in your environment variables to switch
          providers (groq, openai, anthropic, gemini, deepseek, openrouter), then redeploy.
        </p>
      </div>

      <div className="empty-state" style={{ marginTop: 20 }}>
        <h3>Multi-model review comes later</h3>
        <p>Running several models per line, comparing their opinions, and an optional judge model are planned for phase 2.</p>
      </div>
    </div>
  );
}

function Row({ label, value, mono, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border-soft)' }}>
      <span style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ fontFamily: mono ? 'var(--font-mono)' : 'inherit', color: color || 'var(--text)' }}>{value}</span>
    </div>
  );
}
