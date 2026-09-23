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

/**
 * Web search via Firecrawl. Returns a list of { url, title, description } or null.
 */
export async function firecrawlSearch(query, debug) {
  const data = await callFirecrawl('/v1/search', { query, limit: 8 }, debug);
  if (!data) return null;
  return data.data || data.results || null;
}

/**
 * Fetch a URL's raw HTML via Scrape.do (proxy scraper). Needs SCRAPEDO_API_KEY.
 * Returns text or null; never throws.
 */
export async function scrapedoGet(url) {
  const key = process.env.SCRAPEDO_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://api.scrape.do/?token=${encodeURIComponent(key)}&url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(45_000) });
    if (!res.ok) { console.error(`[scrapedo] ${res.status}`); return null; }
    return await res.text();
  } catch (e) { console.error(`[scrapedo] failed: ${e.message}`); return null; }
}
export function haveScrapedo() { return !!process.env.SCRAPEDO_API_KEY; }

/* ------------------------------------------------------------------ *
 * FREE web helpers (no API key, no cost). Used FIRST by the finders so
 * we only fall back to Firecrawl credits when the free path is blocked.
 * Both are best-effort and NEVER throw — they return null / [] on any
 * failure (bot-wall, network, timeout). Datacenter IPs are often
 * challenged by search engines, so callers must keep Firecrawl as the
 * booster fallback (firecrawlSearch).
 * ------------------------------------------------------------------ */

const FREE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

// Plain browser fetch of a URL's text. Returns the raw body string or null.
export async function freeFetchText(url, opts = {}) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': FREE_UA, 'accept': 'text/html,application/xhtml+xml', ...(opts.headers || {}) },
      signal: AbortSignal.timeout(opts.timeout || 20_000),
      ...(opts.method ? { method: opts.method, body: opts.body } : {}),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&#x27;|&#39;|&rsquo;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

// Decode a DuckDuckGo redirect href (//duckduckgo.com/l/?uddg=<encoded>&…) to the real URL.
function ddgHref(href) {
  const h = String(href || '');
  const m = h.match(/[?&]uddg=([^&]+)/);
  if (m) { try { return decodeURIComponent(m[1]); } catch { return ''; } }
  if (/^https?:\/\//i.test(h)) return h;
  return '';
}

// Parse DuckDuckGo HTML results into [{title,url,description}].
function parseDdgHtml(html) {
  const out = [];
  const aRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const sRe = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippets = []; let sm;
  while ((sm = sRe.exec(html))) snippets.push(stripTags(sm[1]));
  let am, i = 0;
  while ((am = aRe.exec(html))) {
    const url = ddgHref(am[1]);
    if (!url) { i++; continue; }
    out.push({ title: stripTags(am[2]), url, description: snippets[i] || '' });
    i++;
  }
  return out;
}

// Parse DuckDuckGo Lite results into [{title,url,description}].
function parseDdgLite(html) {
  const out = [];
  const aRe = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*class="[^"]*result-link[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  const sRe = /class="[^"]*result-snippet[^"]*"[^>]*>([\s\S]*?)<\/td>/gi;
  const snippets = []; let sm;
  while ((sm = sRe.exec(html))) snippets.push(stripTags(sm[1]));
  let am, i = 0;
  while ((am = aRe.exec(html))) { out.push({ title: stripTags(am[2]), url: am[1], description: snippets[i] || '' }); i++; }
  return out;
}

/**
 * FREE web search (no key). Tries DuckDuckGo HTML then Lite. Returns a list
 * of { title, url, description } (possibly empty) — never throws, never null.
 * Often bot-walled from datacenter IPs; callers fall back to firecrawlSearch.
 */
export async function freeSearch(query) {
  const q = encodeURIComponent(query);
  for (const [ep, parse] of [
    [`https://html.duckduckgo.com/html/?q=${q}`, parseDdgHtml],
    [`https://lite.duckduckgo.com/lite/?q=${q}`, parseDdgLite],
  ]) {
    const html = await freeFetchText(ep, { timeout: 20_000 });
    if (!html) continue;
    const rows = parse(html);
    if (rows.length) return rows;
  }
  return [];
}

export { apiKey };
