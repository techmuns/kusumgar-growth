// Fills each exhibition's missing dates (and city) by web-searching the show's NEXT edition.
//
// The discovery engine captures a show's name/country/segment but never its dates, so most shows
// land with dates:null. This step web-searches each undated show and, from REAL results, extracts
// the next edition happening on/after today — writing start (ISO), end (ISO), a display `dates`
// range, and place (city) onto the show in exhibitions.json.
//
// Conservative on purpose (a wrong date is worse than none): it saves ONLY a date that validates as
// a real calendar date, is today-or-later, and whose YEAR actually appears in the fetched results
// (guards against a hallucinated date). Anything unsure stays null.
//
// Best-effort, capped by MAX, graceful (no Firecrawl or no Bedrock → exit 0, writes nothing), never
// deletes data, never overwrites a date a show already has, never throws.
//
// Test hooks: KGR_EXHIBITIONS_PATH.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { firecrawlSearch, firecrawlScrape, apiKey as firecrawlKey } from './lib/firecrawl.mjs';
import { askClaude, haveBedrock } from './lib/llm.mjs';

const p = (env, rel) => process.env[env] || fileURLToPath(new URL(rel, import.meta.url));
const EXHIBITIONS_PATH = p('KGR_EXHIBITIONS_PATH', '../public/data/exhibitions.json');
const MAX = Math.max(1, parseInt(process.env.MAX || '25', 10) || 25);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const parseISO = (s) => (ISO_RE.test(String(s || '')) ? new Date(String(s) + 'T00:00:00Z') : null);
const validDate = (d) => d instanceof Date && !isNaN(d.getTime());

// Build the display range in the exact "D–D Mon YYYY" family the UI parses.
function displayDates(startISO, endISO) {
  const s = parseISO(startISO); if (!validDate(s)) return null;
  const e = parseISO(endISO);
  const sd = s.getUTCDate(), sm = s.getUTCMonth(), sy = s.getUTCFullYear();
  if (!validDate(e) || endISO === startISO) return `${sd} ${MONTHS[sm]} ${sy}`;
  const ed = e.getUTCDate(), em = e.getUTCMonth(), ey = e.getUTCFullYear();
  if (sy === ey && sm === em) return `${sd}–${ed} ${MONTHS[sm]} ${sy}`;
  if (sy === ey) return `${sd} ${MONTHS[sm]}–${ed} ${MONTHS[em]} ${sy}`;
  return `${sd} ${MONTHS[sm]} ${sy}–${ed} ${MONTHS[em]} ${ey}`;
}

async function loadExhibitionsRaw() {
  try {
    const raw = JSON.parse(await readFile(EXHIBITIONS_PATH, 'utf8'));
    const list = Array.isArray(raw) ? raw : (raw.exhibitions || []);
    return { raw, list };
  } catch (e) { console.error(`[find-show-dates] cannot read exhibitions: ${e.message}`); return { raw: null, list: [] }; }
}

// Search + (optionally) scrape the top hit to get a text blob describing the show's next edition.
async function gatherText(show, debug) {
  const q = `${show.name} ${show.country || ''} trade show exhibition dates venue`.trim();
  const results = await firecrawlSearch(q, debug);
  let text = Array.isArray(results)
    ? results.map((r) => `${r.title || ''} | ${r.url || ''} | ${r.description || ''}`).join('\n')
    : '';
  // If the snippets are thin, scrape the most promising (non-directory) result for its markdown.
  if (text.length < 400 && Array.isArray(results) && results[0] && results[0].url) {
    const d = await firecrawlScrape(results[0].url, { formats: ['markdown'] }, debug);
    if (d && d.markdown) text += '\n' + d.markdown;
  }
  return text.slice(0, 3800);
}

async function findDates(show, todayISO, debug) {
  const text = await gatherText(show, debug);
  if (!text.trim()) return null;
  const res = await askClaude({
    system: `You are given REAL web-search results about a trade show/exhibition. Extract ONLY the single NEXT edition happening on or after ${todayISO}. Use ONLY dates clearly stated in the provided text — never guess or infer. Return STRICT JSON: {"start":"YYYY-MM-DD"|null,"end":"YYYY-MM-DD"|null,"city":string|null}. If the next edition's dates are not clearly stated in the text, return {"start":null,"end":null,"city":null}.`,
    user: `Show: ${show.name}\nCountry: ${show.country || 'unknown'}\nToday: ${todayISO}\n\nResults:\n${text}`,
    json: true, maxTokens: 150,
  });
  if (!res || !res.start) return null;
  const s = parseISO(res.start);
  if (!validDate(s)) return null;
  // Must be today-or-later (small grace for a show that started in the last few days / is ongoing).
  const today = parseISO(todayISO);
  if (validDate(today) && (today - s) / 86400000 > 3) return null;
  // Anti-hallucination: the start YEAR must actually appear in the fetched text.
  if (!text.includes(String(s.getUTCFullYear()))) return null;
  let endISO = null;
  const e = parseISO(res.end);
  if (validDate(e) && e >= s && (e - s) / 86400000 <= 21) endISO = res.end; // sane span (<= 3 weeks)
  const city = (typeof res.city === 'string' && res.city.trim() && res.city.trim().length <= 60) ? res.city.trim() : null;
  return { start: res.start, end: endISO, dates: displayDates(res.start, endISO), city };
}

async function main() {
  if (!firecrawlKey()) { console.log('[find-show-dates] no FIRECRAWL_API_KEY — cannot search; writing nothing. Exiting 0.'); return; }
  if (!haveBedrock()) { console.log('[find-show-dates] no BEDROCK_API_KEY — cannot extract; writing nothing. Exiting 0.'); return; }

  const { raw, list } = await loadExhibitionsRaw();
  if (!raw || !list.length) { console.log('[find-show-dates] no exhibitions; nothing to do.'); return; }

  const todayISO = new Date().toISOString().slice(0, 10);
  let queue = list.filter((e) => e && !e.start).sort((a, b) => String(a.name).localeCompare(String(b.name))).slice(0, MAX);
  console.log(`[find-show-dates] looking up dates for ${queue.length} undated show(s)`);

  const debug = [];
  let filled = 0;
  try {
    for (const show of queue) {
      const found = await findDates(show, todayISO, debug);
      if (found) {
        show.start = found.start;
        if (found.end) show.end = found.end;
        show.dates = found.dates;
        if (found.city && !show.place) show.place = found.city;
        filled++;
        console.log(`[find-show-dates] ${show.name} -> ${found.dates}${found.city ? ` (${found.city})` : ''}`);
      }
    }
  } catch (e) { console.error(`[find-show-dates] pipeline error (continuing): ${e.message}`); }

  if (!filled) { console.log('[find-show-dates] no new dates found; exhibitions.json unchanged.'); return; }
  await writeFile(EXHIBITIONS_PATH, JSON.stringify(raw, null, 1) + '\n');
  console.log(`[find-show-dates] filled ${filled} show date(s).`);
}

main()
  .catch((err) => { console.error('[find-show-dates] unexpected error (exiting 0):', err); })
  .finally(() => process.exit(0));
