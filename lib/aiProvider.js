// Server-only module. Never import this from a "use client" component.
// API keys are read from process.env and never returned in any response body.

const OPENAI_COMPATIBLE = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', keyEnv: 'GROQ_API_KEY', modelEnv: 'GROQ_MODEL', defaultModel: 'llama-3.3-70b-versatile' },
  openai: { baseUrl: 'https://api.openai.com/v1', keyEnv: 'OPENAI_API_KEY', modelEnv: 'OPENAI_MODEL', defaultModel: 'gpt-5.1-mini' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', keyEnv: 'DEEPSEEK_API_KEY', modelEnv: 'DEEPSEEK_MODEL', defaultModel: 'deepseek-chat' },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1', keyEnv: 'OPENROUTER_API_KEY', modelEnv: 'OPENROUTER_MODEL',
    defaultModel: 'anthropic/claude-sonnet-4.6',
    extraHeaders: { 'HTTP-Referer': 'https://persian-subtitle-qa.local', 'X-Title': 'Persian Subtitle QA' },
  },
};

async function callOpenAICompatible(cfg, apiKey, model, systemPrompt, userPrompt) {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: Object.assign(
      { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      cfg.extraHeaders || {}
    ),
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && data.error && (data.error.message || JSON.stringify(data.error))) || `HTTP ${res.status}`);
  }
  const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) throw new Error('Empty response from model');
  return text;
}

async function callAnthropic(apiKey, model, systemPrompt, userPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && data.error && data.error.message) || `HTTP ${res.status}`);
  }
  const block = (data.content || []).find((b) => b.type === 'text');
  if (!block) throw new Error('Empty response from model');
  return block.text;
}

async function callGemini(apiKey, model, systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && data.error && data.error.message) || `HTTP ${res.status}`);
  }
  const cand = data.candidates && data.candidates[0];
  const text = cand && cand.content && cand.content.parts && cand.content.parts.map((p) => p.text || '').join('');
  if (!text) throw new Error('Empty response from model');
  return text;
}

// Returns { providerName, modelName } for display purposes (no secrets).
export function getActiveProviderInfo() {
  const kind = (process.env.AI_PROVIDER || 'groq').toLowerCase();
  if (kind === 'anthropic') {
    return { providerName: 'Anthropic', modelName: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6', configured: !!process.env.ANTHROPIC_API_KEY };
  }
  if (kind === 'gemini') {
    return { providerName: 'Google Gemini', modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash', configured: !!process.env.GEMINI_API_KEY };
  }
  const cfg = OPENAI_COMPATIBLE[kind] || OPENAI_COMPATIBLE.groq;
  const label = { groq: 'Groq', openai: 'OpenAI', deepseek: 'DeepSeek', openrouter: 'OpenRouter' }[kind] || kind;
  return { providerName: label, modelName: process.env[cfg.modelEnv] || cfg.defaultModel, configured: !!process.env[cfg.keyEnv] };
}

// Calls whichever provider is configured via AI_PROVIDER env var.
export async function callConfiguredModel(systemPrompt, userPrompt) {
  const kind = (process.env.AI_PROVIDER || 'groq').toLowerCase();

  if (kind === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set on the server.');
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
    return callAnthropic(apiKey, model, systemPrompt, userPrompt);
  }

  if (kind === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set on the server.');
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    return callGemini(apiKey, model, systemPrompt, userPrompt);
  }

  const cfg = OPENAI_COMPATIBLE[kind];
  if (!cfg) throw new Error(`Unknown AI_PROVIDER "${kind}". Use one of: groq, openai, anthropic, gemini, deepseek, openrouter.`);
  const apiKey = process.env[cfg.keyEnv];
  if (!apiKey) throw new Error(`${cfg.keyEnv} is not set on the server.`);
  const model = process.env[cfg.modelEnv] || cfg.defaultModel;
  return callOpenAICompatible(cfg, apiKey, model, systemPrompt, userPrompt);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retries transient failures (rate limits, timeouts) with backoff.
export async function callConfiguredModelWithRetry(systemPrompt, userPrompt, maxRetries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callConfiguredModel(systemPrompt, userPrompt);
    } catch (e) {
      lastErr = e;
      const msg = (e.message || '').toLowerCase();
      const retryable = msg.includes('429') || msg.includes('rate') || msg.includes('timeout') || msg.includes('503') || msg.includes('overloaded');
      if (!retryable || attempt === maxRetries) throw e;
      await sleep(600 * Math.pow(2, attempt));
    }
  }
  throw lastErr;
}
