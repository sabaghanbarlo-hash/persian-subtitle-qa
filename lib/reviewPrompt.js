export const REVIEW_SYSTEM_PROMPT = `You are an expert English-to-Persian subtitle editor specializing in anime dialogue.

Review the existing Persian translation against the English source. Do not rewrite the translation unnecessarily.

Check:
- meaning
- missing information
- added information
- mistranslation
- terminology
- consistency
- natural Persian
- conversational tone
- slang
- idioms
- emotion
- character voice
- grammar
- punctuation

Do NOT automatically prefer formal Persian. Conversational Persian (e.g. "می‌خوام" instead of "می‌خواهم") is often preferable for anime dialogue and must not be flagged just for being informal.

Do not report an error merely because another Persian wording is also possible — only report a real, meaningful problem.

If the translation is already accurate and natural, mark it as correct.

If there is a real problem, explain it clearly and provide a corrected Persian translation.

Respond with ONLY a single JSON object, no markdown fences, no extra commentary, matching exactly this schema:
{
  "status": "correct" | "issue",
  "severity": "critical" | "major" | "minor" | "consistency" | null,
  "issue_type": string | null,
  "explanation": string,
  "suggested_translation": string | null,
  "confidence": number
}`;

export function buildReviewUserPrompt({ en, fa, prevEn, prevFa, nextEn, nextFa }) {
  const prevBlock = (prevEn || []).map((line, i) => `EN: ${line}\nFA: ${(prevFa || [])[i] || ''}`).join('\n');
  const nextBlock = (nextEn || []).map((line, i) => `EN: ${line}\nFA: ${(nextFa || [])[i] || ''}`).join('\n');

  return `CURRENT SUBTITLE
English source: "${en}"
Persian translation: "${fa}"

${prevBlock ? `PREVIOUS LINES (context only — do not review these):\n${prevBlock}\n` : ''}
${nextBlock ? `FOLLOWING LINES (context only — do not review these):\n${nextBlock}\n` : ''}

Review only the CURRENT SUBTITLE above and respond with the JSON object only.`;
}

const VALID_SEVERITIES = new Set(['critical', 'major', 'minor', 'consistency', null, undefined]);

export function parseAndValidateReview(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { valid: false, error: 'Empty response from model' };
  }
  let cleaned = rawText.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace >= firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { valid: false, error: 'Model did not return valid JSON', raw: rawText };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Model response was not a JSON object', raw: rawText };
  }
  if (parsed.status !== 'correct' && parsed.status !== 'issue') {
    return { valid: false, error: `Invalid "status" value: ${parsed.status}`, raw: rawText };
  }
  if (!VALID_SEVERITIES.has(parsed.severity)) {
    return { valid: false, error: `Invalid "severity" value: ${parsed.severity}`, raw: rawText };
  }
  if (typeof parsed.explanation !== 'string' || !parsed.explanation) {
    return { valid: false, error: 'Missing "explanation"', raw: rawText };
  }
  if (parsed.status === 'issue' && (typeof parsed.suggested_translation !== 'string' || !parsed.suggested_translation)) {
    return { valid: false, error: 'Issue reported but no "suggested_translation" provided', raw: rawText };
  }

  return {
    valid: true,
    data: {
      status: parsed.status,
      severity: parsed.status === 'correct' ? null : (parsed.severity || 'minor'),
      issue_type: parsed.issue_type || null,
      explanation: parsed.explanation,
      suggested_translation: parsed.status === 'issue' ? parsed.suggested_translation : null,
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.7,
    },
  };
}
