// Discovery engine — auto-find NEW relevant exhibitions from event directories.
//
// - Reads sources.json + exhibitions.json + products.json.
// - For each directory (capped via MAX, default 3): fetch listings via Firecrawl search/scrape
//   (+ Scrape.do if SCRAPEDO_API_KEY), then askClaude (Bedrock) judges which are relevant to
//   Kusumgar's segments and returns {name, country, segment, reason}.
// - Appends NEW relevant shows to exhibitions.json (dedupe by normalized name) with
//   source:"discovered", discovered_at, relevance_reason, status:"Not yet". NEVER modifies or
//   deletes existing shows. Writes only when shows are added (kept a plain array for the UI).
// - Graceful: needs (Firecrawl or Scrape.do) AND Bedrock; otherwise logs and exits 0. Never throws.
//
// Test hooks: KGR_EXHIBITIONS_PATH / KGR_SOURCES_PATH / KGR_PRODUCTS_PATH.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { firecrawlScrape, firecrawlSearch, scrapedoGet, apiKey as firecrawlKey, haveScrapedo } from './lib/firecrawl.mjs';
import { askClaude, haveBedrock } from './lib/llm.mjs';

const p = (env, rel) => process.env[env] || fileURLToPath(new URL(rel, import.meta.url));
const EXHIBITIONS_PATH = p('KGR_EXHIBITIONS_PATH', '../public/data/exhibitions.json');
const SOURCES_PATH = p('KGR_SOURCES_PATH', '../public/data/sources.json');
const PRODUCTS_PATH = p('KGR_PRODUCTS_PATH', '../public/data/products.json');

const MAX = Math.max(1, parseInt(process.env.MAX || '3', 10) || 3);
const SEGMENTS = ['Aeronautical', 'Military & Tactical', 'Industrial', 'Workwear', 'Automotive', 'Medical', 'Outdoor', 'Marine'];

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => norm(s).replace(/\s+/g, '-').slice(0, 60);

async function loadArr(path, key) {
  try { const raw = JSON.parse(await readFile(path, 'utf8')); return Array.isArray(raw) ? raw : (raw[key] || []); }
  catch (e) { console.error(`[discover] cannot read ${path}: ${e.message}`); return []; }
}

async function sourceText(source, debug) {
  let text = '';
  try {
    const domain = new URL(source.website).hostname;
    const sr = await firecrawlSearch(`technical textile defence industrial workwear marine trade shows 2026 site:${domain}`, debug);
    if (Array.isArray(sr)) text += sr.map((r) => `${r.title || ''} — ${r.url || ''} — ${r.description || ''}`).join('\n');
  } catch { /* ignore bad URL */ }
  if (text.length < 200) {
    const d = await firecrawlScrape(source.website, { formats: ['markdown'] }, debug);
    if (d && d.markdown) text += '\n' + d.markdown;
  }
  if (text.length < 200 && haveScrapedo()) {
    const html = await scrapedoGet(source.website);
    if (html) text += '\n' + html.slice(0, 6000);
  }
  return text.slice(0, 8000);
}

async function main() {
  const [sources, exhibitions, products] = await Promise.all([
    loadArr(SOURCES_PATH, 'sources'), loadArr(EXHIBITIONS_PATH, 'exhibitions'), loadArr(PRODUCTS_PATH, 'products'),
  ]);

  if (!(firecrawlKey() || haveScrapedo()) || !haveBedrock()) {
    console.log(`[discover] needs (FIRECRAWL_API_KEY or SCRAPEDO_API_KEY) AND BEDROCK_API_KEY — leaving ${exhibitions.length} shows untouched. Exiting 0.`);
    return;
  }

  const targets = sources.slice(0, MAX);
  console.log(`[discover] scanning ${targets.length} source(s): ${targets.map((t) => t.id).join(', ')}`);
  const seen = new Set(exhibitions.map((e) => norm(e.name)));
  const productSummary = products.slice(0, 8).map((pr) => pr.name).join(', ');
  const debug = [];
  const added = [];

  try {
    for (const source of targets) {
      const text = await sourceText(source, debug);
      if (!text.trim()) { console.log(`[discover] no text from ${source.id}`); continue; }
      const res = await askClaude({
        system: `You find trade shows/exhibitions relevant to Kusumgar, an Indian technical-textile manufacturer (fabrics: ${productSummary}) serving segments: ${SEGMENTS.join(', ')}. From directory text, return ONLY genuinely relevant, real shows. Return STRICT JSON: {"shows":[{"name","country","segment","reason"}]} — segment must be one of the listed segments.`,
        user: `Directory: ${source.name} (${source.website})\n\nListing text:\n${text}\n\nReturn up to 12 relevant shows as {"shows":[...]}.`,
        json: true, maxTokens: 1400,
      });
      const shows = res && Array.isArray(res.shows) ? res.shows : [];
      console.log(`[discover] ${source.id}: ${shows.length} candidate show(s)`);
      for (const s of shows) {
        const nm = norm(s.name);
        if (!nm || seen.has(nm)) continue;
        seen.add(nm);
        added.push({
          id: slug(s.name), segment: SEGMENTS.includes(s.segment) ? s.segment : 'Industrial',
          name: String(s.name).trim(), country: s.country || null, place: null, dates: null, start: null,
          status: 'Not yet', source: 'discovered', discovered_at: new Date().toISOString(),
          relevance_reason: s.reason || `Found via ${source.name}`,
        });
      }
    }
  } catch (e) { console.error(`[discover] pipeline error (continuing): ${e.message}`); }

  if (!added.length) { console.log('[discover] no new shows; exhibitions.json unchanged.'); return; }
  await writeFile(EXHIBITIONS_PATH, JSON.stringify([...exhibitions, ...added], null, 1) + '\n');
  console.log(`[discover] added ${added.length} show(s): ${added.map((a) => a.name).join(', ')}`);
}

main()
  .catch((err) => { console.error('[discover] unexpected error (exiting 0):', err); })
  .finally(() => process.exit(0));
