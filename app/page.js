'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const [provider, setProvider] = useState(null);
  const [providerError, setProviderError] = useState(false);
  const [lastSession, setLastSession] = useState(null);

  useEffect(() => {
    fetch('/api/provider-info')
      .then((r) => r.json())
      .then(setProvider)
      .catch(() => setProviderError(true));

    try {
      const raw = localStorage.getItem('sqa_last_session');
      if (raw) setLastSession(JSON.parse(raw));
    } catch (e) {
      // ignore corrupt local state
    }
  }, []);

  return (
    <div>
      <div className="page-head">
        <div className="page-eyebrow">Dashboard</div>
        <h1 className="page-title">Subtitle QA overview</h1>
        <p className="page-sub">
          Upload an English/Persian subtitle pair, run an AI review, and work through the flagged
          lines. This MVP focuses on getting that core loop right end to end.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="card">
          <h3 style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontSize: 16 }}>
            Last review session
          </h3>
          {lastSession ? (
            <div style={{ display: 'flex', gap: 28, marginTop: 14, flexWrap: 'wrap' }}>
              <Stat label="Subtitles" value={lastSession.total} />
              <Stat label="Correct" value={lastSession.correct} color="var(--correct)" />
              <Stat label="Minor" value={lastSession.minor} color="var(--minor)" />
              <Stat label="Major" value={lastSession.major} color="var(--major)" />
              <Stat label="Critical" value={lastSession.critical} color="var(--critical)" />
              <Stat label="Errors" value={lastSession.errors} color="var(--text-faint)" />
            </div>
          ) : (
            <p style={{ color: 'var(--text-dim)', fontSize: 13.5, marginTop: 8 }}>
              No review has been run in this browser yet.
            </p>
          )}
          <div style={{ marginTop: 18 }}>
            <Link href="/review" className="btn btn-primary">
              Start a new review →
            </Link>
          </div>
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontSize: 16 }}>
            AI provider
          </h3>
          {providerError && (
            <p style={{ color: 'var(--critical)', fontSize: 13.5, marginTop: 8 }}>
              Couldn't reach the server to check provider status.
            </p>
          )}
          {!providerError && !provider && (
            <p style={{ color: 'var(--text-dim)', fontSize: 13.5, marginTop: 8 }}>Checking…</p>
          )}
          {provider && (
            <div style={{ marginTop: 10, fontSize: 13.5 }}>
              <Row label="Provider" value={provider.providerName} />
              <Row label="Model" value={provider.modelName} mono />
              <Row
                label="Status"
                value={provider.configured ? 'API key detected' : 'No API key set'}
                color={provider.configured ? 'var(--correct)' : 'var(--critical)'}
              />
            </div>
          )}
        </div>
      </div>

      <div className="empty-state">
        <h3>Projects, translation memory, and multi-model review are next</h3>
        <p>
          This MVP runs a single AI reviewer against one English/Persian subtitle pair at a time.
          Persistent projects, a glossary, a judge model, and ASS support come in later phases.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600, color: color || 'var(--text)' }}>
        {value ?? 0}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
    </div>
  );
}

function Row({ label, value, mono, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-soft)' }}>
      <span style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ fontFamily: mono ? 'var(--font-mono)' : 'inherit', color: color || 'var(--text)' }}>{value}</span>
    </div>
  );
}
