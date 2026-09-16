// Backfills each exhibition's missing dates (and city) by web-searching the show's NEXT edition.
//
// The discovery engine now captures dates/place from the directory listing when present; this step
// fills whatever is still missing by searching the web. From REAL results it extracts the next
// edition happening on/after today and writes start (ISO), end (ISO), a display `dates` range, and
// place (city). It also fills a place on its own when a date can't be confirmed.
//
// Conservative (a wrong date is worse than none): a date is saved ONLY when it validates as a real
// calendar date, is today-or-later, and its YEAR appears in the fetched results (anti-hallucination).
// Anything unsure stays null. Best-effort, capped by MAX, graceful (no Firecrawl/Bedrock → exit 0),
// never overwrites an existing date/place, never throws.
//
// Test hooks: KGR_EXHIBITIONS_PATH.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { firecrawlSearch, firecrawlScrape, apiKey as firecrawlKey } from './lib/firecrawl.mjs';
import { askClaude, haveBedrock } from './lib/llm.mjs';
import { normalizeEdition } from './lib/showdates.mjs';

const p = (env, rel) => process.env[env] || fileURLToPath(new URL(rel, import.meta.url));
const EXHIBITIONS_PATH = p('KGR_EXHIBITIONS_PATH', '../public/data/exhibitions.json');
const MAX = Math.max(1, parseInt(process.env.MAX || '25', 10) || 25);

async function loadExhibitionsRaw() {
  try {
    const raw = JSON.parse(await readFile(EXHIBITIONS_PATH, 'utf8'));
    const list = Array.isArray(raw) ? raw : (raw.exhibitions || []);
    return { raw, list };
  } catch (e) { console.error(`[find-show-dates] cannot read exhibitions: ${e.message}`); return { raw: null, list: [] }; }
}

// Search + (optionally) scrape the top hit to get text describing the show's next edition.
async function gatherText(show, debug) {
  const q = `${show.name} ${show.country || ''} trade show exhibition dates venue`.trim();
  const results = await firecrawlSearch(q, debug);
  let text = Array.isArray(results)
    ? results.map((r) => `${r.title || ''} | ${r.url || ''} | ${r.description || ''}`).join('\n')
    : '';
  if (text.length < 400 && Array.isArray(results) && results[0] && results[0].url) {
    const d = await firecrawlScrape(results[0].url, { formats: ['markdown'] }, debug);
    if (d && d.markdown) text += '\n' + d.markdown;
  }
  return text.slice(0, 3800);
}

// Returns {start,end,dates,place} (each may be null), or null when nothing usable was found.
async function findEdition(show, todayISO, debug) {
  const text = await gatherText(show, debug);
  if (!text.trim()) return null;
  const res = await askClaude({
    system: `You are given REAL web-search results about a trade show/exhibition. From ONLY this text, extract the single NEXT edition happening on or after ${todayISO} and its host city. Never guess or infer dates. Return STRICT JSON: {"start":"YYYY-MM-DD"|null,"end":"YYYY-MM-DD"|null,"city":string|null}. Use null for anything not clearly stated in the text.`,
    user: `Show: ${show.name}\nCountry: ${show.country || 'unknown'}\nToday: ${todayISO}\n\nResults:\n${text}`,
    json: true, maxTokens: 150,
  });
  if (!res) return null;
  const norm = normalizeEdition(res, todayISO, text);
  return (norm.start || norm.place) ? norm : null;
}

async function main() {
  if (!firecrawlKey()) { console.log('[find-show-dates] no FIRECRAWL_API_KEY — cannot search; writing nothing. Exiting 0.'); return; }
  if (!haveBedrock()) { console.log('[find-show-dates] no BEDROCK_API_KEY — cannot extract; writing nothing. Exiting 0.'); return; }

  const { raw, list } = await loadExhibitionsRaw();
  if (!raw || !list.length) { console.log('[find-show-dates] no exhibitions; nothing to do.'); return; }

  const todayISO = new Date().toISOString().slice(0, 10);
  // Target shows still missing a date OR a place.
  const queue = list.filter((e) => e && (!e.start || !e.place))
    .sort((a, b) => String(a.name).localeCompare(String(b.name))).slice(0, MAX);
  console.log(`[find-show-dates] looking up details for ${queue.length} show(s)`);

  const debug = [];
  let filled = 0;
  try {
    for (const show of queue) {
      const found = await findEdition(show, todayISO, debug);
      if (!found) continue;
      let changed = false;
      if (found.start && !show.start) {
        show.start = found.start;
        if (found.end) show.end = found.end;
        show.dates = found.dates;
        changed = true;
      }
      if (found.place && !show.place) { show.place = found.place; changed = true; }
      if (changed) { filled++; console.log(`[find-show-dates] ${show.name} -> ${show.dates || '(no date)'}${show.place ? ` · ${show.place}` : ''}`); }
    }
  } catch (e) { console.error(`[find-show-dates] pipeline error (continuing): ${e.message}`); }

  if (!filled) { console.log('[find-show-dates] nothing new found; exhibitions.json unchanged.'); return; }
  await writeFile(EXHIBITIONS_PATH, JSON.stringify(raw, null, 1) + '\n');
  console.log(`[find-show-dates] updated ${filled} show(s).`);
}

main()
  .catch((err) => { console.error('[find-show-dates] unexpected error (exiting 0):', err); })
  .finally(() => process.exit(0));
