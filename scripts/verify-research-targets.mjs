// Verifies each curated target company against its OWN website — source-backed, never invents.
//
// For up to MAX unverified rows (verified===false): (a) find the official site via a Firecrawl
// search, (b) scrape the homepage via Firecrawl, (c) ask Claude (Bedrock) — using the SCRAPED TEXT
// ONLY — to confirm the product fit and pull an exact evidence quote, the HQ country, and a
// purchasing/technical buyer role if named. Stores website, product_confirmed, product_evidence,
// verify_source_url, verified:true, verified_at (and country/buyer_role only when currently empty).
// Records honestly even when product_confirmed is false/null.
//
// HARD RULE: never invent or infer beyond the scraped website text. If the text doesn't say it,
// leave it blank/null — and always keep the source URL we actually read.
//
// Best-effort, capped by MAX, graceful (missing FIRECRAWL/BEDROCK key -> exit 0, writes nothing),
// never deletes data, never throws. Commit is handled by the workflow (kgr-bot).
//
// Test hook: KGR_RESEARCH_PATH points the reader/writer at an alternate file.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { firecrawlSearch, firecrawlScrape, apiKey as firecrawlKey } from './lib/firecrawl.mjs';
import { askClaude, haveBedrock } from './lib/llm.mjs';

const p = (env, rel) => process.env[env] || fileURLToPath(new URL(rel, import.meta.url));
const RESEARCH_PATH = p('KGR_RESEARCH_PATH', '../public/data/research_targets.json');
const MAX = Math.max(1, parseInt(process.env.MAX || process.argv[2] || '40', 10) || 40);

// Hostnames that are never a company's OWN official website (directories, social, news, marketplaces).
const JUNK = /(^|\.)(linkedin|facebook|twitter|x|instagram|youtube|wikipedia|wikimedia|bloomberg|reuters|forbes|zoominfo|crunchbase|dnb|rocketreach|apollo|lusha|glassdoor|indeed|amazon|alibaba|made-in-china|tradeindia|indiamart|exportersindia|europages|kompass|pitchbook|owler|justdial|yelp|mapquest|google|bing|medium|wordpress|blogspot|github|slideshare|scribd|issuu|pinterest|tiktok|threads|reddit|quora|marketscreener|stockanalysis)\./i;

function hostOf(v) {
  try { return v ? new URL(String(v).startsWith('http') ? v : 'https://' + v).hostname.replace(/^www\./, '').toLowerCase() : ''; }
  catch { return ''; }
}
const cleanHost = (u) => { const h = hostOf(u); return (!h || !h.includes('.') || /\s/.test(h) || JUNK.test(h)) ? '' : h; };

// Segment → a product phrase (from the curated segment label, not invented) to sharpen the site search.
const SEG_PRODUCT = {
  'Automotive Seating': 'automotive seat fabric seating',
  'Medical & Emergency': 'medical emergency equipment bags',
  'Tool & Equipment Bags': 'tool bags equipment bags',
  'Pool & Outdoor Covers': 'pool covers outdoor covers',
  'Marine Covers': 'boat covers marine canvas',
  'Protective & Industrial Covers': 'industrial protective covers tarps',
};

// Find the company's official website URL from real search results (first non-junk result).
async function findSiteUrl(t, debug) {
  const results = await firecrawlSearch(`"${t.company}" ${SEG_PRODUCT[t.segment] || ''} official site`.trim(), debug);
  if (!Array.isArray(results) || !results.length) return '';
  for (const r of results) { if (cleanHost(r.url || '')) return r.url; }
  return '';
}

async function verifyOne(t, debug) {
  const url = await findSiteUrl(t, debug);
  if (!url) return null;                                   // no site found this run — leave unverified for next time
  const data = await firecrawlScrape(url, { formats: ['markdown'] }, debug);
  const text = (data && data.markdown ? data.markdown : '').slice(0, 6000);
  if (!text.trim()) {
    // We visited the site but got no readable text — record the check honestly, keep the source URL.
    return { website: 'https://' + (hostOf(url) || ''), product_confirmed: null, product_evidence: '', verify_source_url: url, country: '', buyer_role_hint: '' };
  }
  // HARD RULE also in the prompt: use ONLY the scraped text; leave blank if it doesn't say.
  const res = await askClaude({
    system: 'You verify a company using ONLY the website text provided. Use ONLY that text — never outside knowledge. If the text does not say, use null/empty. Return STRICT JSON {"product_confirmed":true|false|null,"evidence":"<short exact quote from the text, or empty>","country":"<HQ country if stated, else empty>","buyer_role_hint":"<a purchasing/technical role if named, else empty>"}.',
    user: `Company: ${t.company}\nConfirm whether they make or use products in: ${t.segment}${t.application ? ` (e.g. ${t.application})` : ''}.\nSource URL: ${url}\n\nWEBSITE TEXT (the only source you may use):\n${text}`,
    json: true, maxTokens: 400,
  });
  const clean = (v) => (typeof v === 'string' ? v.trim() : '');
  return {
    website: 'https://' + (hostOf(url) || ''),
    product_confirmed: res && (res.product_confirmed === true || res.product_confirmed === false) ? res.product_confirmed : null,
    product_evidence: res ? clean(res.evidence).slice(0, 400) : '',
    verify_source_url: url,
    country: res ? clean(res.country) : '',
    buyer_role_hint: res ? clean(res.buyer_role_hint) : '',
  };
}

async function main() {
  if (!firecrawlKey() || !haveBedrock()) {
    console.log('[verify-research] needs FIRECRAWL_API_KEY and BEDROCK_API_KEY — writing nothing. Exiting 0.');
    return;
  }
  let raw;
  try { raw = JSON.parse(await readFile(RESEARCH_PATH, 'utf8')); }
  catch (e) { console.error(`[verify-research] cannot read ${RESEARCH_PATH}: ${e.message}`); return; }
  const targets = Array.isArray(raw) ? raw : (raw.targets || []);
  if (!targets.length) { console.log('[verify-research] no targets; nothing to do.'); return; }

  const queue = targets.filter((t) => t && t.verified === false).slice(0, MAX);
  console.log(`[verify-research] verifying ${queue.length} of ${targets.length} target(s)`);

  const debug = [];
  let done = 0;
  try {
    for (const t of queue) {
      const r = await verifyOne(t, debug);
      if (!r) { console.log(`[verify-research] ${t.company}: no official site found (leaving unverified)`); continue; }
      t.website = r.website || t.website || '';
      t.product_confirmed = r.product_confirmed;
      t.product_evidence = r.product_evidence || '';
      t.verify_source_url = r.verify_source_url || '';
      if (!t.country && r.country) t.country = r.country;                 // only fill when currently empty
      if (!t.buyer_role && r.buyer_role_hint) t.buyer_role = r.buyer_role_hint; // only fill when currently empty
      t.verified = true;
      t.verified_at = new Date().toISOString().slice(0, 10);
      done++;
      console.log(`[verify-research] ${t.company}: product_confirmed=${t.product_confirmed} · ${t.verify_source_url}`);
    }
  } catch (e) { console.error(`[verify-research] pipeline error (continuing): ${e.message}`); }

  if (!done) { console.log('[verify-research] nothing verified this run; file unchanged.'); return; }
  await writeFile(RESEARCH_PATH, JSON.stringify(raw, null, 1) + '\n'); // match the seed's 1-space indent
  console.log(`[verify-research] verified ${done} target(s).`);
}

main()
  .catch((err) => { console.error('[verify-research] unexpected error (exiting 0):', err); })
  .finally(() => process.exit(0));
