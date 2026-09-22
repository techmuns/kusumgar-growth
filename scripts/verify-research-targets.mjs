// Verifies each curated target company against its OWN website — source-backed, never invents.
//
// WEBSITE-FIRST + FREE-READER-FIRST, so we lean on Firecrawl credits as little as possible:
//
//   1) Find the site WITHOUT spending credits when we can:
//        a. the row's own `website` (from a prior verify), then
//        b. the matching lead's `website` in leads.json (most targets already have one), then
//        c. only if neither exists AND a Firecrawl key is present -> a Firecrawl search.
//   2) Read the page cheapest-first:
//        a. a plain browser fetch (FREE, no API), then
//        b. Scrape.do (SCRAPEDO_API_KEY) for bot-walled sites, then
//        c. Firecrawl scrape (credits) as the last resort.
//   3) Ask Claude (Bedrock) using the READ TEXT ONLY to confirm the product fit and pull an exact
//      evidence quote, HQ country, and a buyer role if named.
//
// Stores website, product_confirmed, product_evidence, verify_source_url, verified:true, verified_at
// (and country/buyer_role only when currently empty). Records honestly even when product_confirmed
// is false/null (we checked but the page didn't say -> the tab shows "checked, couldn't confirm").
//
// HARD RULE: never invent or infer beyond the text we actually read. If the text doesn't say it,
// leave it blank/null — and always keep the source URL we read.
//
// Requires BEDROCK_API_KEY (the honesty classifier). Firecrawl + Scrape.do are OPTIONAL boosters.
// Best-effort, capped by MAX, graceful (no Bedrock -> exit 0, writes nothing), never throws.
// Commit is handled by the workflow (kgr-bot). Test hook: KGR_RESEARCH_PATH.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { firecrawlSearch, firecrawlScrape, apiKey as firecrawlKey, scrapedoGet, haveScrapedo } from './lib/firecrawl.mjs';
import { askClaude, haveBedrock } from './lib/llm.mjs';

const RESEARCH_PATH = process.env.KGR_RESEARCH_PATH || fileURLToPath(new URL('../public/data/research_targets.json', import.meta.url));
const LEADS_PATH = process.env.KGR_LEADS_PATH || path.join(path.dirname(RESEARCH_PATH), 'leads.json');
const MAX = Math.max(1, parseInt(process.env.MAX || process.argv[2] || '40', 10) || 40);

// Hostnames that are never a company's OWN official website (directories, social, news, marketplaces).
const JUNK = /(^|\.)(linkedin|facebook|twitter|x|instagram|youtube|wikipedia|wikimedia|bloomberg|reuters|forbes|zoominfo|crunchbase|dnb|rocketreach|apollo|lusha|glassdoor|indeed|amazon|alibaba|made-in-china|tradeindia|indiamart|exportersindia|europages|kompass|pitchbook|owler|justdial|yelp|mapquest|google|bing|medium|wordpress|blogspot|github|slideshare|scribd|issuu|pinterest|tiktok|threads|reddit|quora|marketscreener|stockanalysis)\./i;

function hostOf(v) {
  try { return v ? new URL(String(v).startsWith('http') ? v : 'https://' + v).hostname.replace(/^www\./, '').toLowerCase() : ''; }
  catch { return ''; }
}
const cleanHost = (u) => { const h = hostOf(u); return (!h || !h.includes('.') || /\s/.test(h) || JUNK.test(h)) ? '' : h; };
const asUrl = (v) => { const s = String(v || '').trim(); if (!s) return ''; return s.startsWith('http') ? s : 'https://' + s; };

// Segment → a product phrase (from the curated segment label, not invented) to sharpen the site search.
const SEG_PRODUCT = {
  'Automotive Seating': 'automotive seat fabric seating',
  'Medical & Emergency': 'medical emergency equipment bags',
  'Tool & Equipment Bags': 'tool bags equipment bags',
  'Pool & Outdoor Covers': 'pool covers outdoor covers',
  'Marine Covers': 'boat covers marine canvas',
  'Protective & Industrial Covers': 'industrial protective covers tarps',
};

// Strip raw HTML to readable text (keeps <title> + meta description inline, drops scripts/styles/tags).
function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<title[^>]*>([\s\S]*?)<\/title>/gi, ' $1 ')
    .replace(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/gi, ' $1 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;|&rsquo;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

// FREE reader: a plain browser fetch. Follows redirects, returns { text, finalUrl } or null. No API cost.
async function freeFetch(url, debug) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'accept': 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(20_000),
    });
    if (debug) debug.push({ reader: 'free', url, status: res.status });
    if (!res.ok) { console.log(`[verify-research]   free fetch ${res.status} for ${url}`); return null; }
    const text = htmlToText(await res.text());
    return text ? { text, finalUrl: res.url || url } : null;
  } catch (e) { console.log(`[verify-research]   free fetch failed for ${url}: ${e.message}`); return null; }
}

// Read a page cheapest-first: free browser fetch -> Scrape.do -> Firecrawl scrape.
async function readPage(url, debug) {
  const free = await freeFetch(url, debug);
  if (free && free.text.trim()) return { text: free.text.slice(0, 6000), sourceUrl: free.finalUrl, reader: 'free' };

  if (haveScrapedo()) {
    const html = await scrapedoGet(url);
    const text = htmlToText(html);
    if (text.trim()) return { text: text.slice(0, 6000), sourceUrl: url, reader: 'scrapedo' };
  }

  if (firecrawlKey()) {
    const data = await firecrawlScrape(url, { formats: ['markdown'] }, debug);
    const text = (data && data.markdown ? data.markdown : '').trim();
    if (text) return { text: text.slice(0, 6000), sourceUrl: url, reader: 'firecrawl' };
  }
  return { text: '', sourceUrl: url, reader: 'none' };
}

// Resolve the company's site URL without spending credits when we can.
function resolveSite(t, knownWeb) {
  const own = asUrl(t.website);
  if (own) return { url: own, via: 'row' };
  const lead = asUrl(knownWeb[t.id]);
  if (lead) return { url: lead, via: 'leads' };
  return null; // caller may fall back to a Firecrawl search
}

async function searchSite(t, debug) {
  if (!firecrawlKey()) return '';
  const results = await firecrawlSearch(`"${t.company}" ${SEG_PRODUCT[t.segment] || ''} official site`.trim(), debug);
  if (!Array.isArray(results) || !results.length) return '';
  for (const r of results) { if (cleanHost(r.url || '')) return r.url; }
  return '';
}

async function classify(t, text, sourceUrl) {
  // HARD RULE also in the prompt: use ONLY the read text; leave blank if it doesn't say.
  const res = await askClaude({
    system: 'You verify a company using ONLY the website text provided. Use ONLY that text — never outside knowledge. If the text does not say, use null/empty. Return STRICT JSON {"product_confirmed":true|false|null,"evidence":"<short exact quote from the text, or empty>","country":"<HQ country if stated, else empty>","buyer_role_hint":"<a purchasing/technical role if named, else empty>"}.',
    user: `Company: ${t.company}\nConfirm whether they make or use products in: ${t.segment}${t.application ? ` (e.g. ${t.application})` : ''}.\nSource URL: ${sourceUrl}\n\nWEBSITE TEXT (the only source you may use):\n${text}`,
    json: true, maxTokens: 400,
  });
  const clean = (v) => (typeof v === 'string' ? v.trim() : '');
  return {
    product_confirmed: res && (res.product_confirmed === true || res.product_confirmed === false) ? res.product_confirmed : null,
    product_evidence: res ? clean(res.evidence).slice(0, 400) : '',
    country: res ? clean(res.country) : '',
    buyer_role_hint: res ? clean(res.buyer_role_hint) : '',
  };
}

async function verifyOne(t, knownWeb, stats, debug) {
  let site = resolveSite(t, knownWeb);
  if (!site) {
    const found = await searchSite(t, debug);
    if (!found) return null;               // no site known and search found none -> leave unverified for next time
    site = { url: found, via: 'search' };
    stats.search++;
  } else {
    stats[site.via]++;
  }

  const page = await readPage(site.url, debug);
  stats.reader[page.reader] = (stats.reader[page.reader] || 0) + 1;

  const website = 'https://' + (hostOf(page.sourceUrl || site.url) || '');
  if (!page.text.trim()) {
    // We visited the site but got no readable text — record the check honestly, keep the source URL.
    return { website, product_confirmed: null, product_evidence: '', verify_source_url: page.sourceUrl || site.url, country: '', buyer_role_hint: '' };
  }
  const res = await classify(t, page.text, page.sourceUrl || site.url);
  return { website, verify_source_url: page.sourceUrl || site.url, ...res };
}

async function loadKnownWebsites() {
  try {
    const raw = JSON.parse(await readFile(LEADS_PATH, 'utf8'));
    const leads = Array.isArray(raw) ? raw : (raw.leads || []);
    const map = {};
    for (const l of leads) { if (l && l.id && l.website) map[l.id] = l.website; }
    return map;
  } catch { return {}; }
}

async function main() {
  if (!haveBedrock()) {
    console.log('[verify-research] needs BEDROCK_API_KEY (the honesty classifier) — writing nothing. Exiting 0.');
    return;
  }
  console.log(`[verify-research] readers available: free=yes scrapedo=${haveScrapedo() ? 'yes' : 'no'} firecrawl=${firecrawlKey() ? 'yes' : 'no'}`);

  let raw;
  try { raw = JSON.parse(await readFile(RESEARCH_PATH, 'utf8')); }
  catch (e) { console.error(`[verify-research] cannot read ${RESEARCH_PATH}: ${e.message}`); return; }
  const targets = Array.isArray(raw) ? raw : (raw.targets || []);
  if (!targets.length) { console.log('[verify-research] no targets; nothing to do.'); return; }

  const knownWeb = await loadKnownWebsites();
  const queue = targets.filter((t) => t && t.verified === false).slice(0, MAX);
  console.log(`[verify-research] verifying ${queue.length} of ${targets.length} target(s) · ${Object.keys(knownWeb).length} known websites on hand`);

  const debug = [];
  const stats = { row: 0, leads: 0, search: 0, reader: {} };
  let done = 0;
  try {
    for (const t of queue) {
      const r = await verifyOne(t, knownWeb, stats, debug);
      if (!r) { console.log(`[verify-research] ${t.company}: no site known and none found (leaving unverified)`); continue; }
      t.website = r.website || t.website || '';
      t.product_confirmed = r.product_confirmed;
      t.product_evidence = r.product_evidence || '';
      t.verify_source_url = r.verify_source_url || '';
      if (!t.country && r.country) t.country = r.country;                       // only fill when currently empty
      if (!t.buyer_role && r.buyer_role_hint) t.buyer_role = r.buyer_role_hint; // only fill when currently empty
      t.verified = true;
      t.verified_at = new Date().toISOString().slice(0, 10);
      done++;
      console.log(`[verify-research] ${t.company}: product_confirmed=${t.product_confirmed} · ${t.verify_source_url}`);
    }
  } catch (e) { console.error(`[verify-research] pipeline error (continuing): ${e.message}`); }

  console.log(`[verify-research] site source: row=${stats.row} leads=${stats.leads} search=${stats.search} · readers: ${JSON.stringify(stats.reader)}`);
  if (!done) { console.log('[verify-research] nothing verified this run; file unchanged.'); return; }
  await writeFile(RESEARCH_PATH, JSON.stringify(raw, null, 1) + '\n'); // match the seed's 1-space indent
  console.log(`[verify-research] verified ${done} target(s).`);
}

main()
  .catch((err) => { console.error('[verify-research] unexpected error (exiting 0):', err); })
  .finally(() => process.exit(0));
