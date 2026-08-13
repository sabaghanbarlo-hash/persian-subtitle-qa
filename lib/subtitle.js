// SRT parsing / export / pairing. MVP scope: SRT only.

function timeToMs(str) {
  const m = str.trim().match(/(\d+):(\d{2}):(\d{2})[.,](\d+)/);
  if (!m) return 0;
  const h = parseInt(m[1], 10), mi = parseInt(m[2], 10), se = parseInt(m[3], 10);
  const frac = m[4].padEnd(3, '0').slice(0, 3);
  return ((h * 3600 + mi * 60 + se) * 1000) + parseInt(frac, 10);
}

function msToSrtTime(ms) {
  ms = Math.max(0, Math.round(ms));
  const h = Math.floor(ms / 3600000); ms -= h * 3600000;
  const mi = Math.floor(ms / 60000); ms -= mi * 60000;
  const se = Math.floor(ms / 1000); ms -= se * 1000;
  const pad = (n, l) => String(n).padStart(l || 2, '0');
  return `${pad(h)}:${pad(mi)}:${pad(se)},${pad(ms, 3)}`;
}

export function parseSRT(text) {
  const clean = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!clean) return [];
  const blocks = clean.split(/\n\s*\n/);
  const entries = [];
  blocks.forEach((block, i) => {
    const lines = block.split('\n');
    if (lines.length < 2) return;
    let indexLine = lines[0].trim();
    let idx, timeLine, textLines;
    if (/^\d+$/.test(indexLine)) {
      idx = parseInt(indexLine, 10);
      timeLine = lines[1];
      textLines = lines.slice(2);
    } else {
      idx = i + 1;
      timeLine = lines[0];
      textLines = lines.slice(1);
    }
    const timeMatch = timeLine && timeLine.match(/(\d+:\d{2}:\d{2}[.,]\d+)\s*-+>\s*(\d+:\d{2}:\d{2}[.,]\d+)/);
    if (!timeMatch) return;
    entries.push({
      index: idx,
      start: timeToMs(timeMatch[1]),
      end: timeToMs(timeMatch[2]),
      text: textLines.join('\n').trim(),
    });
  });
  return entries;
}

export function exportSRT(entries, textField) {
  textField = textField || 'text';
  return entries.map((e, i) => (
    `${i + 1}\n${msToSrtTime(e.start)} --> ${msToSrtTime(e.end)}\n${(e[textField] || '').trim()}\n`
  )).join('\n');
}

// Pair by subtitle index. Anything that doesn't line up is reported, never
// silently paired.
export function pairSubtitles(enEntries, faEntries) {
  const enByIndex = new Map(enEntries.map(e => [e.index, e]));
  const faByIndex = new Map(faEntries.map(e => [e.index, e]));
  const allIndices = Array.from(new Set([...enByIndex.keys(), ...faByIndex.keys()])).sort((a, b) => a - b);

  const paired = [];
  const unmatchedEn = [];
  const unmatchedFa = [];
  let countMismatch = enEntries.length !== faEntries.length;

  allIndices.forEach((idx) => {
    const en = enByIndex.get(idx);
    const fa = faByIndex.get(idx);
    if (en && fa) {
      paired.push({
        id: `sub_${idx}`,
        index: idx,
        start: en.start,
        end: en.end,
        en: en.text,
        fa: fa.text,
        originalFa: fa.text,
        status: 'unreviewed',
        review: null,
        userDecision: null,
      });
    } else if (en && !fa) {
      unmatchedEn.push(en);
    } else if (fa && !en) {
      unmatchedFa.push(fa);
    }
  });

  return { paired, unmatchedEn, unmatchedFa, countMismatch };
}
