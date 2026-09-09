// Reusable Amazon Bedrock (Claude) wrapper for the Kusumgar Growth Engine pipelines.
//
// Design goals (later phases reuse this):
//   - Reads env: BEDROCK_API_KEY (bearer token), BEDROCK_REGION (default "us-east-1"),
//     BEDROCK_MODEL_ID (REQUIRED — never hardcode a model id; if unset, log and return null).
//   - askClaude({system, user, json, maxTokens}) invokes the Bedrock Runtime endpoint and
//     returns content[0].text (parsed JSON when json=true).
//   - Never throws: returns null on any error / missing key. 30s timeout, 1 retry.

const REGION = process.env.BEDROCK_REGION || 'us-east-1';
const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2; // initial + 1 retry

function apiKey() { return process.env.BEDROCK_API_KEY || ''; }
function modelId() { return process.env.BEDROCK_MODEL_ID || ''; }
// Base override exists only for testing; production uses the regional Bedrock host.
function endpointFor(model) {
  const base = process.env.BEDROCK_ENDPOINT || `https://bedrock-runtime.${REGION}.amazonaws.com`;
  return `${base.replace(/\/$/, '')}/model/${encodeURIComponent(model)}/invoke`;
}

// Best-effort JSON extraction from a model text response.
function parseJson(text) {
  if (text == null) return null;
  let t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/,'');
  try { return JSON.parse(t); } catch { /* fall through */ }
  const m = t.match(/[[{][\s\S]*[\]}]/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* ignore */ } }
  return null;
}

/**
 * Ask Claude on Bedrock. Returns the assistant text (or parsed JSON when json=true),
 * or null on any failure. Never throws.
 */
export async function askClaude({ system, user, json = false, maxTokens = 1024 } = {}) {
  const key = apiKey();
  const model = modelId();
  if (!key) { console.error('[llm] BEDROCK_API_KEY not set — returning null.'); return null; }
  if (!model) { console.error('[llm] BEDROCK_MODEL_ID not set (required) — returning null.'); return null; }

  const body = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: [{ role: 'user', content: user }],
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(endpointFor(model), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const text = await res.text();
      console.log(`[llm] invoke ${model} attempt ${attempt} -> ${res.status}`);
      if (!res.ok) {
        console.error(`[llm] error ${res.status}: ${text.slice(0, 240)}`);
        if (attempt === MAX_ATTEMPTS) return null;
        continue;
      }

      let payload;
      try { payload = JSON.parse(text); } catch { console.error('[llm] non-JSON response'); return null; }
      const content = payload && Array.isArray(payload.content) ? payload.content : [];
      const out = content.map((b) => (b && typeof b.text === 'string' ? b.text : '')).join('').trim();
      if (!out) return null;
      return json ? parseJson(out) : out;
    } catch (err) {
      clearTimeout(timer);
      const msg = err && err.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : (err && err.message) || String(err);
      console.error(`[llm] attempt ${attempt} failed: ${msg}`);
      if (attempt === MAX_ATTEMPTS) return null;
    }
  }
  return null;
}

export { apiKey as bedrockKey, modelId };
