// scripts/lib/llm.mjs — Bedrock Claude via the Converse API (proven pattern).
const REGION = process.env.AWS_REGION || 'us-east-1';
const BKEY   = process.env.BEDROCK_API_KEY || '';
const MODELS = (process.env.BEDROCK_MODEL_IDS ||
  'anthropic.claude-sonnet-5,us.anthropic.claude-sonnet-5,us.anthropic.claude-sonnet-4-5-20250929-v1:0')
  .split(',').map(s => s.trim()).filter(Boolean);

export function haveBedrock() { return !!BKEY; }

// askClaude({system, user, json, maxTokens}) -> string | parsed-JSON | null.
// Never throws. Returns null if no key or all models exhausted.
export async function askClaude({ system, user, json = false, maxTokens = 1024 }) {
  if (!BKEY) return null;
  const body = JSON.stringify({
    system: [{ text: system }],
    messages: [{ role: 'user', content: [{ text: user }] }],
    inferenceConfig: { temperature: 0, maxTokens },
  });
  let lastErr = '';
  const ROUNDS = 4;                       // a few patient waves; classification isn't time-critical
  for (let round = 0; round < ROUNDS; round++) {
    for (const model of MODELS) {
      try {
        const res = await fetch(`https://bedrock-runtime.${REGION}.amazonaws.com/model/${encodeURIComponent(model)}/converse`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${BKEY}`, 'content-type': 'application/json', accept: 'application/json' },
          body,
          signal: AbortSignal.timeout(120_000),
        });
        if (res.status === 429 || res.status >= 500) { lastErr = `HTTP ${res.status} busy`; continue; }   // busy -> next model/wave
        if ([400,403,404].includes(res.status)) { lastErr = `HTTP ${res.status} ${(await res.text()).slice(0,160)}`; continue; } // model unusable -> next id
        if (res.status !== 200) { lastErr = `HTTP ${res.status}`; continue; }
        const data = await res.json();
        const parts = data?.output?.message?.content;
        const text = Array.isArray(parts) ? parts.map(p => p?.text || '').join('') : '';
        if (!text) { lastErr = 'empty'; continue; }
        if (json) { const m = text.match(/\{[\s\S]*\}/); try { return JSON.parse(m ? m[0] : text); } catch { return null; } }
        return text;
      } catch (e) { lastErr = `net: ${e.message}`; }
    }
    if (round < ROUNDS - 1) await new Promise(r => setTimeout(r, 30_000));
  }
  console.log(`Bedrock exhausted: ${lastErr}`);
  return null;
}
