import { NextResponse } from 'next/server';
import { callConfiguredModelWithRetry } from '../../../lib/aiProvider';
import { REVIEW_SYSTEM_PROMPT, buildReviewUserPrompt, parseAndValidateReview } from '../../../lib/reviewPrompt';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { en, fa, prevEn, prevFa, nextEn, nextFa } = body || {};

  if (typeof en !== 'string' || typeof fa !== 'string' || !en.trim() || !fa.trim()) {
    return NextResponse.json({ error: 'Both "en" and "fa" are required non-empty strings.' }, { status: 400 });
  }

  const userPrompt = buildReviewUserPrompt({ en, fa, prevEn, prevFa, nextEn, nextFa });

  let rawText;
  try {
    rawText = await callConfiguredModelWithRetry(REVIEW_SYSTEM_PROMPT, userPrompt, 2);
  } catch (e) {
    const message = e && e.message ? e.message : 'AI request failed';
    const status = /timeout/i.test(message) ? 504 : /rate|429/i.test(message) ? 429 : 502;
    return NextResponse.json({ error: message }, { status });
  }

  const result = parseAndValidateReview(rawText);
  if (!result.valid) {
    return NextResponse.json({ error: result.error, rawModelOutput: result.raw || null }, { status: 502 });
  }

  return NextResponse.json(result.data, { status: 200 });
}
