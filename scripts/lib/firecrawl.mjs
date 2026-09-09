// Reusable Firecrawl wrapper for the Kusumgar Growth Engine pipelines.
//
// Design goals:
//   - Reads FIRECRAWL_API_KEY from env.
//   - Never throws: returns null on any failure (missing key, network, timeout, bad JSON).
//   - 45s timeout, 1 retry.
//   - Logs status + a body sample so CI logs are debuggable.
//
// Later phases (Leads, Competitors) reuse firecrawlScrape / firecrawlMap.

const API_BASE = process.env.FIRECRAWL_API_BASE || 'https://api.firecrawl.dev';
const TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 2; // initial + 1 retry

function apiKey() {
  return process.env.FIRECRAWL_API_KEY || '';
}

async function callFirecrawl(path, body, debug) {
  const key = apiKey();
  if (!key) return null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_BASE + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const text = await res.text();
      const sample = text.slice(0, 240);
      if (debug) debug.push({ path, attempt, status: res.status, sample });
      console.log(`[firecrawl] ${path} attempt ${attempt} -> ${res.status}`);

      if (!res.ok) {
        console.error(`[firecrawl] ${path} error ${res.status}: ${sample}`);
        if (attempt === MAX_ATTEMPTS) return null;
        continue;
      }
      try {
        return JSON.parse(text);
      } catch (err) {
        console.error(`[firecrawl] ${path} bad JSON: ${err.message} :: ${sample}`);
        return null;
      }
    } catch (err) {
      clearTimeout(timer);
      const msg = err && err.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : (err && err.message) || String(err);
      console.error(`[firecrawl] ${path} attempt ${attempt} failed: ${msg}`);
      if (debug) debug.push({ path, attempt, error: msg });
      if (attempt === MAX_ATTEMPTS) return null;
    }
  }
  return null;
}

/**
 * Scrape a single URL. Returns Firecrawl's `data` object ({ markdown, json, metadata, ... })
 * or null. Pass { jsonSchema } (and optionally { prompt }) to use structured extraction.
 */
export async function firecrawlScrape(url, { formats = ['markdown'], jsonSchema, prompt } = {}, debug) {
  const body = { url, formats };
  if (jsonSchema || prompt) {
    if (!formats.includes('json')) body.formats = [...formats, 'json'];
    body.jsonOptions = {};
    if (jsonSchema) body.jsonOptions.schema = jsonSchema;
    if (prompt) body.jsonOptions.prompt = prompt;
  }
  const data = await callFirecrawl('/v1/scrape', body, debug);
  if (!data) return null;
  return data.data || data; // v1 wraps payload in `data`
}

/**
 * Map a site to a list of URLs. Returns an array of URL strings (or {url,title} objects,
 * depending on the Firecrawl version) or null.
 */
export async function firecrawlMap(url, debug) {
  const data = await callFirecrawl('/v1/map', { url }, debug);
  if (!data) return null;
  return data.links || data.data || null;
}

export { apiKey };
