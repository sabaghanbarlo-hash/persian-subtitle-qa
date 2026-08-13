'use client';

import { useState } from 'react';
import { wordDiff } from '../lib/diff';

function msToClock(ms) {
  ms = Math.max(0, Math.round(ms));
  const h = Math.floor(ms / 3600000); ms -= h * 3600000;
  const mi = Math.floor(ms / 60000); ms -= mi * 60000;
  const se = Math.floor(ms / 1000); ms -= se * 1000;
  const pad = (n, l) => String(n).padStart(l || 2, '0');
  return `${pad(h)}:${pad(mi)}:${pad(se)},${pad(ms, 3)}`;
}

const SEVERITY_LABEL = {
  correct: '✓ Correct',
  minor: '⚠ Minor',
  major: '⚠ Major',
  critical: '🔴 Critical',
  consistency: 'Consistency',
  error: 'Failed',
  unreviewed: 'Unreviewed',
};

export default function SubtitleCard({ item, derivedStatus, onApply, onIgnore, onSaveEdit, onRevert }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const hasIssue = item.review && item.review.status === 'issue';
  const wasEdited = item.fa !== item.originalFa;

  function startEdit() {
    setEditValue((hasIssue && item.review.suggested_translation) || item.fa);
    setEditing(true);
  }

  function saveEdit() {
    onSaveEdit(item.id, editValue);
    setEditing(false);
  }

  return (
    <div className={`subtitle-card sev-${derivedStatus}`}>
      <div className="sub-head">
        <span className="sub-id">#{item.index}</span>
        <span className={`badge badge-${derivedStatus}`}>{SEVERITY_LABEL[derivedStatus] || derivedStatus}</span>
        <span className="sub-time">{msToClock(item.start)} → {msToClock(item.end)}</span>
      </div>

      <div className="sub-lang-grid">
        <div className="lang-block">
          <div className="lang-label">English</div>
          <div className="en-text">{item.en}</div>
        </div>
        <div className="lang-block">
          <div className="lang-label">Persian {wasEdited && '· corrected'}</div>
          <div className={`fa-text${wasEdited ? ' edited' : ''}`}>{item.fa}</div>
        </div>
      </div>

      {item.status === 'error' && (
        <div className="review-block">
          <div className="review-error">Review failed: {item.error}</div>
        </div>
      )}

      {item.review && (
        <div className="review-block">
          <p className="review-explanation">{item.review.explanation}</p>

          {hasIssue && !editing && (
            <>
              <div className="suggestion-box">
                <div className="suggestion-label">Suggested correction</div>
                <div className="diff-line">
                  {wordDiff(item.fa, item.review.suggested_translation).map((tok, i) => {
                    if (tok.type === 'same') return <span key={i}>{tok.text}</span>;
                    if (tok.type === 'add') return <span key={i} className="diff-add">{tok.text}</span>;
                    return <span key={i} className="diff-del">{tok.text}</span>;
                  })}
                </div>
              </div>
              <div className="action-row">
                <button className="btn btn-primary btn-sm" onClick={() => onApply(item.id)}>Apply correction</button>
                <button className="btn btn-sm" onClick={startEdit}>Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => onIgnore(item.id)}>Ignore</button>
                <span className="confidence-pill">confidence {Math.round((item.review.confidence || 0) * 100)}%</span>
              </div>
            </>
          )}

          {editing && (
            <>
              <textarea className="edit-textarea" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
              <div className="action-row">
                <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </>
          )}

          {!hasIssue && !editing && (
            <div className="action-row">
              <button className="btn btn-sm" onClick={startEdit}>Edit anyway</button>
              <span className="confidence-pill">confidence {Math.round((item.review.confidence || 0) * 100)}%</span>
            </div>
          )}

          {item.userDecision === 'applied' && <div className="applied-tag" style={{ marginTop: 8 }}>✓ Correction applied</div>}
          {item.userDecision === 'ignored' && <div className="ignored-tag" style={{ marginTop: 8 }}>Issue ignored, original kept</div>}
          {item.userDecision === 'edited' && <div className="applied-tag" style={{ marginTop: 8 }}>✓ Manually edited</div>}

          {wasEdited && (
            <div className="action-row" style={{ marginTop: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => onRevert(item.id)}>Revert to original</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
