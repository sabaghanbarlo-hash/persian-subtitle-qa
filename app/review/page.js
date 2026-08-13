'use client';

import { useMemo, useState } from 'react';
import { parseSRT, exportSRT, pairSubtitles } from '../../lib/subtitle';
import SubtitleCard from '../../components/SubtitleCard';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unreviewed', label: 'Unreviewed' },
  { key: 'correct', label: 'Correct' },
  { key: 'minor', label: 'Minor' },
  { key: 'major', label: 'Major' },
  { key: 'critical', label: 'Critical' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'error', label: 'Errors' },
];

const CONCURRENCY = 2;

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function deriveStatus(item) {
  if (item.status === 'error') return 'error';
  if (!item.review) return 'unreviewed';
  if (item.review.status === 'correct') return 'correct';
  return item.review.severity || 'minor';
}

export default function ReviewPage() {
  const [enName, setEnName] = useState('');
  const [faName, setFaName] = useState('');
  const [enEntries, setEnEntries] = useState(null);
  const [faEntries, setFaEntries] = useState(null);
  const [pairInfo, setPairInfo] = useState(null);
  const [subtitles, setSubtitles] = useState([]);
  const [filter, setFilter] = useState('all');
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [parseError, setParseError] = useState('');

  async function handleUpload(side, file) {
    setParseError('');
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const entries = parseSRT(text);
      if (!entries.length) {
        setParseError(`Couldn't find any valid subtitle entries in ${file.name}. Make sure it's a well-formed .srt file.`);
        return;
      }
      if (side === 'en') { setEnName(file.name); setEnEntries(entries); }
      else { setFaName(file.name); setFaEntries(entries); }
    } catch (e) {
      setParseError(`Failed to read ${file.name}: ${e.message}`);
    }
  }

  function buildSession() {
    if (!enEntries || !faEntries) return;
    const result = pairSubtitles(enEntries, faEntries);
    setPairInfo(result);
    setSubtitles(result.paired.map((p) => ({ ...p, status: 'unreviewed' })));
  }

  const counts = useMemo(() => {
    const c = { all: subtitles.length, unreviewed: 0, correct: 0, minor: 0, major: 0, critical: 0, consistency: 0, error: 0 };
    subtitles.forEach((s) => { c[deriveStatus(s)] = (c[deriveStatus(s)] || 0) + 1; });
    return c;
  }, [subtitles]);

  const visible = useMemo(() => {
    if (filter === 'all') return subtitles;
    return subtitles.filter((s) => deriveStatus(s) === filter);
  }, [subtitles, filter]);

  function updateSubtitle(id, updates) {
    setSubtitles((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }

  function saveSummary(list) {
    const summary = { total: list.length, correct: 0, minor: 0, major: 0, critical: 0, errors: 0 };
    list.forEach((s) => {
      const st = deriveStatus(s);
      if (st === 'correct') summary.correct++;
      else if (st === 'minor') summary.minor++;
      else if (st === 'major') summary.major++;
      else if (st === 'critical') summary.critical++;
      else if (st === 'error') summary.errors++;
    });
    try { localStorage.setItem('sqa_last_session', JSON.stringify(summary)); } catch (e) { /* ignore */ }
  }

  async function reviewOne(item, index, snapshot) {
    const prevEn = snapshot.slice(Math.max(0, index - 2), index).map((s) => s.en);
    const prevFa = snapshot.slice(Math.max(0, index - 2), index).map((s) => s.fa);
    const nextEn = snapshot.slice(index + 1, index + 3).map((s) => s.en);
    const nextFa = snapshot.slice(index + 1, index + 3).map((s) => s.fa);

    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ en: item.en, fa: item.fa, prevEn, prevFa, nextEn, nextFa }),
      });
      const data = await res.json();
      if (!res.ok) {
        updateSubtitle(item.id, { status: 'error', error: data.error || `HTTP ${res.status}` });
      } else {
        updateSubtitle(item.id, { status: 'reviewed', review: data });
      }
    } catch (e) {
      updateSubtitle(item.id, { status: 'error', error: e.message || 'Network error' });
    } finally {
      setProgress((p) => ({ ...p, completed: p.completed + 1 }));
    }
  }

  async function runAnalysis() {
    if (!subtitles.length || analyzing) return;
    setAnalyzing(true);
    setProgress({ completed: 0, total: subtitles.length });
    const snapshot = subtitles;

    let cursor = 0;
    async function worker() {
      while (cursor < snapshot.length) {
        const myIndex = cursor;
        cursor += 1;
        await reviewOne(snapshot[myIndex], myIndex, snapshot);
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, snapshot.length) }, worker));
    setAnalyzing(false);
  }

  function applyCorrection(id) {
    setSubtitles((prev) => prev.map((s) => {
      if (s.id !== id || !s.review || s.review.status !== 'issue') return s;
      const updated = { ...s, fa: s.review.suggested_translation, userDecision: 'applied' };
      return updated;
    }));
  }

  function ignoreIssue(id) {
    updateSubtitle(id, { userDecision: 'ignored' });
  }

  function saveEdit(id, value) {
    updateSubtitle(id, { fa: value, userDecision: 'edited' });
  }

  function revertOriginal(id) {
    setSubtitles((prev) => prev.map((s) => (s.id === id ? { ...s, fa: s.originalFa, userDecision: null } : s)));
  }

  function downloadCorrectedSRT() {
    const srt = exportSRT(subtitles, 'fa');
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'corrected.srt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Persist a session summary whenever review results change meaningfully.
  useMemo(() => { if (subtitles.length) saveSummary(subtitles); }, [subtitles]);

  const hasSession = subtitles.length > 0;

  return (
    <div>
      <div className="page-head">
        <div className="page-eyebrow">New Review</div>
        <h1 className="page-title">Subtitle review</h1>
        <p className="page-sub">
          Upload the English and Persian .srt files for one episode. Lines are paired by subtitle
          number, then reviewed one by one with 2 lines of context on either side.
        </p>
      </div>

      {!hasSession && (
        <>
          <div className="upload-grid">
            <div className={`dropzone${enEntries ? ' filled' : ''}`}>
              <label>English .srt</label>
              <input type="file" accept=".srt" onChange={(e) => handleUpload('en', e.target.files[0])} />
              {enEntries && (
                <>
                  <div className="filename">{enName}</div>
                  <div className="count">{enEntries.length} subtitle lines parsed</div>
                </>
              )}
            </div>
            <div className={`dropzone${faEntries ? ' filled' : ''}`}>
              <label>Persian .srt</label>
              <input type="file" accept=".srt" onChange={(e) => handleUpload('fa', e.target.files[0])} />
              {faEntries && (
                <>
                  <div className="filename">{faName}</div>
                  <div className="count">{faEntries.length} subtitle lines parsed</div>
                </>
              )}
            </div>
          </div>

          {parseError && <div className="warning-banner">{parseError}</div>}

          <button className="btn btn-primary" disabled={!enEntries || !faEntries} onClick={buildSession}>
            Pair subtitles →
          </button>
        </>
      )}

      {pairInfo && hasSession && (pairInfo.countMismatch || pairInfo.unmatchedEn.length > 0 || pairInfo.unmatchedFa.length > 0) && (
        <div className="warning-banner">
          English has {enEntries.length} lines, Persian has {faEntries.length} lines.{' '}
          {pairInfo.unmatchedEn.length > 0 && `${pairInfo.unmatchedEn.length} English line(s) had no matching Persian number. `}
          {pairInfo.unmatchedFa.length > 0 && `${pairInfo.unmatchedFa.length} Persian line(s) had no matching English number. `}
          These were left out rather than guessed — only the {subtitles.length} lines that matched by subtitle number are shown below.
        </div>
      )}

      {hasSession && (
        <>
          <div className="toolbar">
            <div className="filter-row">
              {FILTERS.map((f) => (
                <button key={f.key} className={`filter-chip${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>
                  {f.label} <span className="count">{counts[f.key] || 0}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={runAnalysis} disabled={analyzing}>
                {analyzing ? 'Analyzing…' : counts.unreviewed === subtitles.length ? 'Analyze episode' : 'Re-run analysis'}
              </button>
              <button className="btn" onClick={downloadCorrectedSRT}>Download corrected SRT</button>
            </div>
          </div>

          {analyzing && (
            <div className="progress-wrap">
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` }} />
              </div>
              <div className="progress-meta">
                <span>Analyzing subtitle {Math.min(progress.completed + 1, progress.total)} / {progress.total}</span>
                <span>completed {progress.completed}</span>
                <span style={{ color: 'var(--major)' }}>issues found {counts.minor + counts.major + counts.critical + counts.consistency}</span>
                <span style={{ color: 'var(--critical)' }}>errors {counts.error}</span>
              </div>
            </div>
          )}

          {visible.length === 0 ? (
            <div className="empty-state">
              <h3>Nothing matches this filter</h3>
              <p>Try a different filter, or run the analysis if you haven't yet.</p>
            </div>
          ) : (
            <div className="subtitle-list">
              {visible.map((item) => (
                <SubtitleCard
                  key={item.id}
                  item={item}
                  derivedStatus={deriveStatus(item)}
                  onApply={applyCorrection}
                  onIgnore={ignoreIssue}
                  onSaveEdit={saveEdit}
                  onRevert={revertOriginal}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
