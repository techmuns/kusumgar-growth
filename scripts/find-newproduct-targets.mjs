// Finds source-backed target companies for NEW-development products (kind:"new" in products.json)
// and stores them in research_targets.json with the product's id — so a new line like Carbon Fibre
// gets its own verified supply-chain map, exactly like the 600D PU list.
//
// Same honesty engine as verify-research-targets.mjs: for each of the product's applications we
// search the open web for candidate makers, then VERIFY each against its OWN website —
//   read cheapest-first (free browser fetch → Scrape.do → Firecrawl), and let Claude (Bedrock) judge
//   ONLY from the page text: is this really a maker/supplier for this product+application? It pulls an
//   exact evidence quote, the company's own name, HQ country and a buyer role if named. Blank if the
//   page does not say. Never invents. Keeps the source URL we read on every row.
//
// Requires BEDROCK_API_KEY (the classifier). Search uses Firecrawl when a key is present, else a free
// DuckDuckGo HTML fallback; reading always starts with a free fetch. All optional boosters degrade
// gracefully. Best-effort, capped by MAX, never throws; on no keys → exit 0, writes nothing.
// Commit is handled by the workflow (kgr-bot). Test hooks: KGR_RESEARCH_PATH, KGR_PRODUCTS_PATH.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { firecrawlSearch, firecrawlScrape, scrapedoGet, apiKey as firecrawlKey, haveScrapedo } from './lib/firecrawl.mjs';
import { askClaude, haveBedrock } from './lib/llm.mjs';

const p = (env, rel) => process.env[env] || fileURLToPath(new URL(rel, import.meta.url));
const RESEARCH_PATH = p('KGR_RESEARCH_PATH', '../public/data/research_targets.json');
const PRODUCTS_PATH = p('KGR_PRODUCTS_PATH', '../public/data/products.json');
const MAX = Math.max(1, parseInt(process.env.MAX || process.argv[2] || '30', 10) || 30);
const TARGET_MIN = Math.max(1, parseInt(process.env.TARGET_MIN || '20', 10) || 20); // stop growing a product once it has this many
const PER_APP = 6; // candidate companies to try per application

const JUNK = /(^|\.)(linkedin|facebook|twitter|x|instagram|youtube|wikipedia|wikimedia|bloomberg|reuters|forbes|zoominfo|crunchbase|dnb|rocketreach|apollo|lusha|glassdoor|indeed|amazon|alibaba|made-in-china|tradeindia|indiamart|exportersindia|europages|kompass|pitchbook|owler|justdial|yelp|mapquest|google|bing|duckduckgo|medium|wordpress|blogspot|github|slideshare|scribd|issuu|pinterest|tiktok|threads|reddit|quora|marketscreener|stockanalysis|thomasnet|globalspec|statista)\./i;
const hostOf = (v) => { try { return v ? new URL(String(v).startsWith('http') ? v : 'https://' + v).hostname.replace(/^www\./, '').toLowerCase() : ''; } catch { return ''; } };
const cleanHost = (u) => { const h = hostOf(u); return (!h || !h.includes('.') || /\s/.test(h) || JUNK.test(h)) ? '' : h; };
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => norm(s).replace(/\s+/g, '-').slice(0, 60);
const titleCase = (s) => String(s || '').replace(/\b\w/g, (c) => c.toUpperCase());

function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<title[^>]*>([\s\S]*?)<\/title>/gi, ' $1 ')
    .replace(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/gi, ' $1 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#0?39;|&rsquo;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

async function freeFetch(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', accept: 'text/html,application/xhtml+xml' }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const text = htmlToText(await res.text());
    return text ? { text, finalUrl: res.url || url } : null;
  } catch { return null; }
}

// Read a page cheapest-first: free fetch → Scrape.do → Firecrawl.
async function readPage(url, debug) {
  const free = await freeFetch(url);
  if (free && free.text.trim()) return { text: free.text.slice(0, 6000), sourceUrl: free.finalUrl };
  if (haveScrapedo()) { const html = await scrapedoGet(url); const text = htmlToText(html); if (text.trim()) return { text: text.slice(0, 6000), sourceUrl: url }; }
  if (firecrawlKey()) { const data = await firecrawlScrape(url, { formats: ['markdown'] }, debug); const text = (data && data.markdown ? data.markdown : '').trim(); if (text) return { text: text.slice(0, 6000), sourceUrl: url }; }
  return { text: '', sourceUrl: url };
}

// Free web search fallback (DuckDuckGo HTML). Returns [{url,title}] or [].
async function freeSearch(query) {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', accept: 'text/html' }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return [];
    const html = await res.text();
    const out = [];
    const re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) && out.length < 20) {
      let href = m[1];
      const uddg = href.match(/[?&]uddg=([^&]+)/);
      if (uddg) { try { href = decodeURIComponent(uddg[1]); } catch { /* keep */ } }
      if (href.startsWith('//')) href = 'https:' + href;
      const title = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (href.startsWith('http')) out.push({ url: href, title });
    }
    return out;
  } catch { return []; }
}

async function search(query, debug) {
  if (firecrawlKey()) {
    const r = await firecrawlSearch(query, debug);
    if (Array.isArray(r) && r.length) return r.map((x) => ({ url: x.url || x.link, title: x.title || '' })).filter((x) => x.url);
  }
  return freeSearch(query);
}

// Candidate official-site URLs for one (product, application), deduped by host, non-junk.
async function candidates(product, app, debug) {
  const results = await search(`${app} ${product.name} manufacturer supplier`.trim(), debug);
  const seen = new Set();
  const out = [];
  for (const r of results) {
    const h = cleanHost(r.url || '');
    if (!h || seen.has(h)) continue;
    seen.add(h);
    out.push({ url: r.url, host: h, title: r.title || '' });
    if (out.length >= PER_APP) break;
  }
  return out;
}

async function verify(product, app, cand, debug) {
  const page = await readPage(cand.url, debug);
  if (!page.text.trim()) return null; // couldn't read — skip (try again next run)
  const res = await askClaude({
    system: 'You verify a company from ONLY the website text provided — never outside knowledge. If the text does not say, use null/empty. Return STRICT JSON {"is_relevant":true|false,"company":"<the company\'s own name from the text, or empty>","product_confirmed":true|false|null,"evidence":"<short exact quote from the text, or empty>","country":"<HQ country if stated, else empty>","buyer_role_hint":"<a purchasing/technical role if named, else empty>"}.',
    user: `We are mapping the supply chain for: ${product.name} (application: ${app}).\nIs this company a real maker/supplier/user relevant to that product and application? Confirm ONLY from the text.\nSource URL: ${page.sourceUrl}\n\nWEBSITE TEXT (the only source you may use):\n${page.text}`,
    json: true, maxTokens: 400,
  });
  if (!res || res.is_relevant !== true) return null;
  const clean = (v) => (typeof v === 'string' ? v.trim() : '');
  const company = clean(res.company) || cand.title || cand.host;
  if (!company) return null;
  return {
    company,
    country: clean(res.country),
    product_confirmed: res.product_confirmed === true || res.product_confirmed === false ? res.product_confirmed : null,
    product_evidence: clean(res.evidence).slice(0, 400),
    buyer_role: clean(res.buyer_role_hint),
    website: 'https://' + (hostOf(page.sourceUrl || cand.url) || cand.host),
    verify_source_url: page.sourceUrl || cand.url,
  };
}

async function main() {
  if (!haveBedrock()) { console.log('[newproduct] needs BEDROCK_API_KEY (the classifier) — writing nothing. Exiting 0.'); return; }
  console.log(`[newproduct] search: firecrawl=${firecrawlKey() ? 'yes' : 'no'} (free fallback on) · readers: free + scrapedo=${haveScrapedo() ? 'yes' : 'no'} + firecrawl=${firecrawlKey() ? 'yes' : 'no'}`);

  let rawR, products;
  try { rawR = JSON.parse(await readFile(RESEARCH_PATH, 'utf8')); } catch (e) { console.error(`[newproduct] cannot read research targets: ${e.message}`); return; }
  try { const rp = JSON.parse(await readFile(PRODUCTS_PATH, 'utf8')); products = Array.isArray(rp) ? rp : (rp.products || []); } catch (e) { console.error(`[newproduct] cannot read products: ${e.message}`); return; }

  const targets = Array.isArray(rawR) ? rawR : (rawR.targets || []);
  const newProducts = products.filter((p2) => p2 && p2.kind === 'new' && Array.isArray(p2.applications) && p2.applications.length);
  if (!newProducts.length) { console.log('[newproduct] no kind:"new" products; nothing to do.'); return; }

  const seenIds = new Set(targets.map((t) => t.id));
  const seenHosts = new Set(targets.map((t) => hostOf(t.website)).filter(Boolean));
  const debug = [];
  let added = 0;

  try {
    for (const product of newProducts) {
      const have = targets.filter((t) => t.product_id === product.id).length;
      if (have >= TARGET_MIN) { console.log(`[newproduct] ${product.name}: already ${have} targets (>= ${TARGET_MIN}); skipping.`); continue; }
      console.log(`[newproduct] ${product.name}: ${have} targets — searching ${product.applications.length} application(s)`);
      for (const app of product.applications) {
        if (added >= MAX) break;
        const cands = await candidates(product, app, debug);
        for (const cand of cands) {
          if (added >= MAX) break;
          if (seenHosts.has(cand.host)) continue;
          const r = await verify(product, app, cand, debug);
          if (!r) continue;
          const id = slug(r.company);
          if (!id || seenIds.has(id) || seenHosts.has(hostOf(r.website))) continue;
          seenIds.add(id); seenHosts.add(cand.host); seenHosts.add(hostOf(r.website));
          targets.push({
            id, segment: titleCase(app), company: r.company, country: r.country || '',
            application: '', est_fabric_consumption: '', sourcing_model: '', buyer_role: r.buyer_role || '',
            source: 'New-product research engine', verified: true, website: r.website,
            product_confirmed: r.product_confirmed, product_evidence: r.product_evidence || '',
            verify_source_url: r.verify_source_url || '', verified_at: new Date().toISOString().slice(0, 10),
            product_id: product.id,
          });
          added++;
          console.log(`[newproduct] + ${r.company} (${product.id} / ${app}) confirmed=${r.product_confirmed} · ${r.verify_source_url}`);
        }
      }
    }
  } catch (e) { console.error(`[newproduct] pipeline error (continuing): ${e.message}`); }

  if (!added) { console.log('[newproduct] nothing added this run; file unchanged.'); return; }
  if (rawR._meta) rawR._meta.total = targets.length;
  await writeFile(RESEARCH_PATH, JSON.stringify(rawR, null, 1) + '\n');
  console.log(`[newproduct] added ${added} target(s) across new products.`);
}

main().catch((err) => { console.error('[newproduct] unexpected error (exiting 0):', err); }).finally(() => process.exit(0));
