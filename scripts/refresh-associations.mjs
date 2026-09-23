// Keeps public/data/associations.json current — the industry bodies Kusumgar should join / attend,
// per segment. For each association it reads that body's OWN website and pulls (1) the single next /
// upcoming event + its date and (2) a short membership / how-to-join note — SOURCE-BACKED, never invented.
//
// WEBSITE-FIRST + FREE-READER-FIRST (same discipline as verify-research-targets.mjs), so we lean on
// Firecrawl credits as little as possible:
//
//   Read each page cheapest-first:
//     a. a plain browser fetch (FREE, no API), then
//     b. Scrape.do (SCRAPEDO_API_KEY) for bot-walled sites, then
//     c. Firecrawl scrape (credits) as the last resort.
//   Then ask Claude (Bedrock) using the READ TEXT ONLY to extract the upcoming event + date and a
//   membership note. If the homepage names no event, we try a couple of common events pages (same
//   cheapest-first reader) and record whichever page we actually read the event from.
//
// Stores next_event, next_event_date, membership_note, verify_source_url, last_checked, verified:true.
// Records honestly even when nothing is found (verified:true + blank fields + the source URL we read),
// so the UI can say "event not listed yet" instead of guessing.
//
// HARD RULE: never invent or infer beyond the text we actually read. If the text doesn't say it,
// leave it blank — and always keep the source URL we read.
//
// Requires BEDROCK_API_KEY (the extractor). Firecrawl + Scrape.do are OPTIONAL boosters. Best-effort,
// capped by MAX, graceful (no Bedrock -> exit 0, writes nothing), never throws. Commit is handled by
// the workflow (kgr-bot). Test hook: KGR_ASSOCIATIONS_PATH.
//
// OPTIONAL: when a search provider (Firecrawl search) is available it may also propose NEW associations
// (source:"engine proposed"); this is skipped cleanly when search is unavailable, and never invents —
// a proposal is only added after Bedrock confirms the fetched page is a real association's site.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { firecrawlSearch, firecrawlScrape, apiKey as firecrawlKey, scrapedoGet, haveScrapedo } from './lib/firecrawl.mjs';
import { askClaude, haveBedrock } from './lib/llm.mjs';

const ASSOCIATIONS_PATH = process.env.KGR_ASSOCIATIONS_PATH || fileURLToPath(new URL('../public/data/associations.json', import.meta.url));
const MAX = Math.max(1, parseInt(process.env.MAX || process.argv[2] || '30', 10) || 30);
const TODAY = new Date().toISOString().slice(0, 10);

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

const asUrl = (v) => { const s = String(v || '').trim(); if (!s) return ''; return s.startsWith('http') ? s : 'https://' + s; };
function hostOf(v) {
  try { return v ? new URL(asUrl(v)).hostname.replace(/^www\./, '').toLowerCase() : ''; } catch { return ''; }
}

// FREE reader: a plain browser fetch. Follows redirects, returns { text, finalUrl } or null. No API cost.
async function freeFetch(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'accept': 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) { console.log(`[associations]   free fetch ${res.status} for ${url}`); return null; }
    const text = htmlToText(await res.text());
    return text ? { text, finalUrl: res.url || url } : null;
  } catch (e) { console.log(`[associations]   free fetch failed for ${url}: ${e.message}`); return null; }
}

// Read a page cheapest-first: free browser fetch -> Scrape.do -> Firecrawl scrape. Returns {text,sourceUrl,reader}.
async function readPage(url, stats) {
  const free = await freeFetch(url);
  if (free && free.text.trim()) { if (stats) stats.reader.free = (stats.reader.free || 0) + 1; return { text: free.text.slice(0, 6000), sourceUrl: free.finalUrl, reader: 'free' }; }

  if (haveScrapedo()) {
    const html = await scrapedoGet(url);
    const text = htmlToText(html);
    if (text.trim()) { if (stats) stats.reader.scrapedo = (stats.reader.scrapedo || 0) + 1; return { text: text.slice(0, 6000), sourceUrl: url, reader: 'scrapedo' }; }
  }

  if (firecrawlKey()) {
    const data = await firecrawlScrape(url, { formats: ['markdown'] });
    const text = (data && data.markdown ? data.markdown : '').trim();
    if (text) { if (stats) stats.reader.firecrawl = (stats.reader.firecrawl || 0) + 1; return { text: text.slice(0, 6000), sourceUrl: url, reader: 'firecrawl' }; }
  }
  if (stats) stats.reader.none = (stats.reader.none || 0) + 1;
  return { text: '', sourceUrl: url, reader: 'none' };
}

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

// Ask Bedrock to extract event + membership from a page's TEXT ONLY. Returns {next_event,next_event_date,membership_note}.
async function extract(a, text, sourceUrl, wantMembership) {
  const fields = wantMembership
    ? '{"next_event":"<name of the single next/upcoming event, conference or expo this body runs or hosts, else empty>","next_event_date":"<its date or date range exactly as written on the page, else empty>","membership_note":"<one short factual sentence on how to join or what membership offers, drawn from the page, else empty>"}'
    : '{"next_event":"<name of the single next/upcoming event, conference or expo, else empty>","next_event_date":"<its date or date range exactly as written on the page, else empty>"}';
  const res = await askClaude({
    system: `You extract facts from an industry-association website using ONLY the text provided — never outside knowledge, never guesses. Prefer a FUTURE / upcoming event over a past one. If the text does not state something, use an empty string. Return STRICT JSON ${fields}.`,
    user: `Association: ${a.name}${a.acronym ? ` (${a.acronym})` : ''}\nSource URL: ${sourceUrl}\n\nWEBSITE TEXT (the only source you may use):\n${text}`,
    json: true, maxTokens: 400,
  });
  if (!res) return { next_event: '', next_event_date: '', membership_note: '' };
  return {
    next_event: clean(res.next_event).slice(0, 160),
    next_event_date: clean(res.next_event_date).slice(0, 80),
    membership_note: clean(res.membership_note).slice(0, 300),
  };
}

// Common paths where an association lists its flagship event, tried only if the homepage names none.
const EVENT_PATHS = ['/events', '/events/', '/event', '/calendar', '/conference', '/conferences', '/expo', '/tradeshows', '/education/events'];

async function refreshOne(a, stats) {
  const home = asUrl(a.website);
  if (!home) return null;

  const page = await readPage(home, stats);
  if (!page.text.trim()) {
    // Visited but nothing readable — record the check honestly, keep the source URL, blank the rest.
    return { next_event: '', next_event_date: '', membership_note: '', verify_source_url: page.sourceUrl || home };
  }

  const first = await extract(a, page.text, page.sourceUrl || home, true);
  let next_event = first.next_event, next_event_date = first.next_event_date;
  let eventSource = next_event ? (page.sourceUrl || home) : '';

  // Homepage named no event -> try a couple of likely events pages (same cheapest-first reader).
  if (!next_event) {
    const base = home.replace(/\/+$/, '');
    for (const p of EVENT_PATHS) {
      const evPage = await readPage(base + p, stats);
      if (!evPage.text.trim()) continue;
      const ev = await extract(a, evPage.text, evPage.sourceUrl || (base + p), false);
      if (ev.next_event) { next_event = ev.next_event; next_event_date = ev.next_event_date; eventSource = evPage.sourceUrl || (base + p); break; }
    }
  }

  return {
    next_event,
    next_event_date,
    membership_note: first.membership_note,
    verify_source_url: eventSource || page.sourceUrl || home,
  };
}

// OPTIONAL, conservative: propose NEW associations via search. No-ops cleanly when search is unavailable.
// Never invents — a candidate is added only after Bedrock, reading its fetched page, confirms it is the
// official site of a REAL industry association relevant to the segment.
const ASSOC_HOST = /(association|institute|alliance|federation|society|council|\.org($|\.))/i;
async function proposeNew(existing, stats, budget) {
  if (!firecrawlKey() || budget <= 0) return [];
  const haveHost = new Set(existing.map((a) => hostOf(a.website)).filter(Boolean));
  const queries = [
    'technical textiles industry association',
    'protective fabrics manufacturers association',
    'nonwovens medical textiles association',
  ];
  const added = [];
  try {
    for (const q of queries) {
      if (added.length >= budget) break;
      const results = await firecrawlSearch(q);
      if (!Array.isArray(results)) continue;
      for (const r of results) {
        if (added.length >= budget) break;
        const url = asUrl(r.url || '');
        const host = hostOf(url);
        if (!host || haveHost.has(host) || !ASSOC_HOST.test(host)) continue;
        const page = await readPage(url, stats);
        if (!page.text.trim()) continue;
        const res = await askClaude({
          system: 'You judge, using ONLY the provided website text, whether this is the official website of a REAL trade or professional ASSOCIATION for a textile / fabric / nonwovens / defence-materials industry (not a company, directory, news site or event-only page). Use ONLY the text. Return STRICT JSON {"is_association":true|false,"name":"<official name or empty>","acronym":"<acronym or empty>","why":"<one short sentence on who it represents, from the text, or empty>"}.',
          user: `URL: ${url}\n\nWEBSITE TEXT:\n${page.text}`,
          json: true, maxTokens: 300,
        });
        if (!res || res.is_association !== true || !clean(res.name)) continue;
        haveHost.add(host);
        const ev = await extract({ name: clean(res.name), acronym: clean(res.acronym) }, page.text, page.sourceUrl || url, true);
        added.push({
          id: host.replace(/\..*$/, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || host,
          name: clean(res.name), acronym: clean(res.acronym), segments: ['Technical textiles'],
          region: '', website: 'https://' + host + '/', why_relevant: clean(res.why).slice(0, 300),
          source: 'engine proposed',
          membership_note: ev.membership_note, next_event: ev.next_event, next_event_date: ev.next_event_date,
          verify_source_url: page.sourceUrl || url, last_checked: TODAY, verified: true,
        });
        console.log(`[associations] proposed NEW: ${clean(res.name)} (${host})`);
      }
    }
  } catch (e) { console.log(`[associations] propose-new skipped: ${e.message}`); }
  return added;
}

async function main() {
  if (!haveBedrock()) {
    console.log('[associations] needs BEDROCK_API_KEY (the extractor) — writing nothing. Exiting 0.');
    return;
  }
  console.log(`[associations] readers available: free=yes scrapedo=${haveScrapedo() ? 'yes' : 'no'} firecrawl=${firecrawlKey() ? 'yes' : 'no'}`);

  let raw;
  try { raw = JSON.parse(await readFile(ASSOCIATIONS_PATH, 'utf8')); }
  catch (e) { console.error(`[associations] cannot read ${ASSOCIATIONS_PATH}: ${e.message}`); return; }
  const list = Array.isArray(raw) ? raw : (raw.associations || []);
  if (!list.length) { console.log('[associations] no associations; nothing to do.'); return; }

  // Refresh the never-checked first, then the stalest (oldest last_checked), so the weekly cron keeps
  // every body current within a run or two.
  const queue = list.slice()
    .sort((a, b) => {
      const av = a.verified === true ? 1 : 0, bv = b.verified === true ? 1 : 0;
      if (av !== bv) return av - bv;                                  // unverified first
      return String(a.last_checked || '').localeCompare(String(b.last_checked || '')); // then stalest
    })
    .slice(0, MAX);
  console.log(`[associations] refreshing ${queue.length} of ${list.length} association(s)`);

  const stats = { reader: {} };
  let done = 0, withEvent = 0, withMembership = 0;
  try {
    for (const a of queue) {
      const r = await refreshOne(a, stats);
      if (!r) { console.log(`[associations] ${a.name}: no website on record (skipping)`); continue; }
      a.next_event = r.next_event || '';
      a.next_event_date = r.next_event_date || '';
      a.membership_note = r.membership_note || '';
      a.verify_source_url = r.verify_source_url || '';
      a.last_checked = TODAY;
      a.verified = true;
      done++;
      if (a.next_event) withEvent++;
      if (a.membership_note) withMembership++;
      console.log(`[associations] ${a.acronym || a.name}: event="${a.next_event || '—'}" (${a.next_event_date || 'no date'}) · membership=${a.membership_note ? 'yes' : '—'} · ${a.verify_source_url}`);
    }
  } catch (e) { console.error(`[associations] pipeline error (continuing): ${e.message}`); }

  // Optional: propose a few NEW associations (only if search credits exist; otherwise a clean no-op).
  let proposed = [];
  try { proposed = await proposeNew(list, stats, 3); } catch (e) { console.log(`[associations] propose-new error (ignored): ${e.message}`); }
  if (proposed.length) { list.push(...proposed); if (raw && raw._meta) raw._meta.total = list.length; }

  console.log(`[associations] readers: ${JSON.stringify(stats.reader)} · refreshed=${done} withEvent=${withEvent} withMembership=${withMembership} proposedNew=${proposed.length}`);
  if (!done && !proposed.length) { console.log('[associations] nothing changed this run; file unchanged.'); return; }
  if (raw && raw._meta) raw._meta.updated_at = TODAY;
  await writeFile(ASSOCIATIONS_PATH, JSON.stringify(raw, null, 1) + '\n'); // match the seed's 1-space indent
  console.log(`[associations] wrote ${ASSOCIATIONS_PATH} — refreshed ${done}, proposed ${proposed.length}.`);
}

main()
  .catch((err) => { console.error('[associations] unexpected error (exiting 0):', err); })
  .finally(() => process.exit(0));
