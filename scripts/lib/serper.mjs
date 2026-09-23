// Serper.dev — Google Search API. The PRIMARY web-search provider for the right-person finder,
// replacing bot-walled DuckDuckGo on CI. Reads SERPER_API_KEY.
//
// Contract (mirrors firecrawlSearch): never throws.
//   - returns an ARRAY of { title, link, snippet } on success (possibly empty — "worked, no hits")
//   - returns null on any FAILURE (missing key, network, timeout, non-2xx, bad JSON) so the caller
//     can tell a dead/credit-less provider apart from a genuinely empty result and trip its breaker.
// Real Google results only — nothing is invented here; the caller passes these snippets to the LLM.

const ENDPOINT = process.env.SERPER_API_BASE || 'https://google.serper.dev/search';

export function haveSerper() { return !!process.env.SERPER_API_KEY; }

export async function serperSearch(query, debug) {
  const key = process.env.SERPER_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 10 }),
      signal: AbortSignal.timeout(30_000),
    });
    if (debug) debug.push({ serper: String(query).slice(0, 80), status: res.status });
    if (!res.ok) { console.error(`[serper] ${res.status} for "${String(query).slice(0, 60)}"`); return null; }
    const data = await res.json();
    const organic = Array.isArray(data && data.organic) ? data.organic : [];
    return organic
      .map((r) => ({ title: r.title || '', link: r.link || '', snippet: r.snippet || '' }))
      .filter((r) => r.link);
  } catch (e) { console.error(`[serper] failed (ok): ${e.message}`); return null; }
}
