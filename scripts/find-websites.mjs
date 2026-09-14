// Fills each lead's missing `website` so the email engine has a company domain to work with.
//
// Without a website, find-contacts.mjs cannot run its domain-based email steps (Prospeo name
// finder, published-site scrape, or guess-then-Reoon-verify) — so this step runs FIRST and
// web-searches each company's OFFICIAL site, then saves the domain onto the lead in leads.json.
//
// Best-effort, capped by MAX, graceful (no FIRECRAWL key → exit 0, writes nothing), never deletes
// data, never overwrites a website a lead already has, never throws. Conservative on purpose: a
// WRONG website would poison the email engine (guessing emails at the wrong domain), so it only
// saves a domain that actually appeared in real search results and looks like the company's own.
//
// Test hooks: KGR_LEADS_PATH / KGR_OUTREACH_PATH.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { firecrawlSearch, apiKey as firecrawlKey } from './lib/firecrawl.mjs';
import { askClaude } from './lib/llm.mjs';

const p = (env, rel) => process.env[env] || fileURLToPath(new URL(rel, import.meta.url));
const LEADS_PATH = p('KGR_LEADS_PATH', '../public/data/leads.json');
const OUTREACH_PATH = p('KGR_OUTREACH_PATH', '../public/data/outreach.json');

const MAX = Math.max(1, parseInt(process.env.MAX || '25', 10) || 25);
const PRIORITY_ONLY = /^(1|true|yes)$/i.test(process.env.PRIORITY_ONLY || '');

// Hostnames that are never a company's OWN official website (directories, social, news, markets).
const JUNK = /(^|\.)(linkedin|facebook|twitter|x|instagram|youtube|wikipedia|wikimedia|bloomberg|reuters|forbes|zoominfo|crunchbase|dnb|rocketreach|apollo|lusha|glassdoor|indeed|amazon|alibaba|made-in-china|tradeindia|indiamart|exportersindia|europages|kompass|pitchbook|owler|tofler|zaubacorp|justdial|yelp|mapquest|google|bing|medium|wordpress|blogspot|github|slideshare|scribd|issuu|pinterest|tiktok|threads|reddit|quora|marketscreener|stockanalysis)\./i;

// Company-name noise words (legal suffixes / generic descriptors) dropped before token matching.
const STOP = new Set(['inc', 'llc', 'ltd', 'limited', 'corp', 'corporation', 'co', 'company', 'group',
  'gmbh', 'sa', 'ag', 'plc', 'the', 'and', 'of', 'industries', 'industry', 'international', 'global',
  'technologies', 'technology', 'systems', 'solutions', 'holdings', 'holding', 'pvt', 'private', 'bv',
  'srl', 'spa', 'as', 'oy', 'ab', 'kg', 'nv', 'llp']);

function hostOf(v) {
  try { return v ? new URL(String(v).startsWith('http') ? v : 'https://' + v).hostname.replace(/^www\./, '').toLowerCase() : ''; }
  catch { return ''; }
}
const hasSite = (l) => !!hostOf(l.website);

// Clean an LLM/heuristic domain down to a bare, non-junk registrable hostname (or '').
function cleanDomain(d) {
  const h = hostOf(d);
  if (!h || !h.includes('.') || /\s/.test(h)) return '';
  if (JUNK.test(h)) return '';
  return h;
}
function tokens(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}
// Heuristic used when Bedrock is unavailable: accept a candidate only when a company token appears
// in the domain's registrable label — a wrong site is worse than no site, so require a real overlap.
function heuristicPick(company, candidates) {
  const toks = tokens(company);
  if (!toks.length) return '';
  for (const c of candidates) {
    const label = c.split('.')[0];
    if (toks.some((t) => label.includes(t) || t.includes(label))) return c;
  }
  return '';
}

async function loadLeadsRaw() {
  try {
    const raw = JSON.parse(await readFile(LEADS_PATH, 'utf8'));
    const leads = Array.isArray(raw) ? raw : (raw.leads || []);
    return { raw, leads };
  } catch (e) { console.error(`[find-websites] cannot read leads: ${e.message}`); return { raw: null, leads: [] }; }
}
async function loadOutreach() {
  try { const o = JSON.parse(await readFile(OUTREACH_PATH, 'utf8')); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {}; }
  catch { return {}; }
}

// Web-search a company's official website; return a bare domain or ''.
async function findWebsite(lead, debug) {
  const results = await firecrawlSearch(`${lead.company} ${lead.country || ''} official website`.trim(), debug);
  if (!Array.isArray(results) || !results.length) return '';
  const candidates = [];
  for (const r of results) {
    const h = cleanDomain(r.url || '');
    if (h && !candidates.includes(h)) candidates.push(h);
  }
  if (!candidates.length) return '';
  // Best: let Claude pick the company's OWN homepage from the REAL results.
  const text = results.map((r) => `${r.title || ''} | ${r.url || ''} | ${r.description || ''}`).join('\n').slice(0, 3500);
  const pick = await askClaude({
    system: 'You are given real web-search results for a company. Return the company\'s OWN official website domain (its homepage) — NOT directories, social media, news, marketplaces, resellers or investor portals. Return STRICT JSON {"domain":"example.com"} using a bare hostname (no http, no path, no www). If none of the results is clearly the company\'s own site, return {"domain":null}.',
    user: `Company: ${lead.company}\nCountry: ${lead.country || 'unknown'}\nResults:\n${text}`,
    json: true, maxTokens: 120,
  });
  const llm = pick ? cleanDomain(pick.domain || '') : '';
  // Trust the LLM domain only if it (or its parent/subdomain) actually appeared in the results —
  // guards against a hallucinated site.
  if (llm && candidates.some((c) => c === llm || c.endsWith('.' + llm) || llm.endsWith('.' + c))) return llm;
  // Fallback (Bedrock unavailable / unsure): conservative name-match heuristic.
  return heuristicPick(lead.company, candidates);
}

async function main() {
  if (!firecrawlKey()) {
    console.log('[find-websites] no FIRECRAWL_API_KEY — cannot search; writing nothing. Exiting 0.');
    return;
  }
  const { raw, leads } = await loadLeadsRaw();
  if (!raw || !leads.length) { console.log('[find-websites] no leads; nothing to do.'); return; }
  const rank = (l) => (l.priority === 'High' ? 0 : 2) + (l.detail === 'full' ? 0 : 1);

  // Target exactly the leads find-contacts is about to process: missing a website, no contact yet.
  const outreach = await loadOutreach();
  let queue = leads.filter((l) => !hasSite(l) && !outreach[l.id]?.contact);
  if (PRIORITY_ONLY) queue = queue.filter((l) => l.priority === 'High');
  queue.sort((a, b) => rank(a) - rank(b) || String(a.company).localeCompare(String(b.company)));
  queue = queue.slice(0, MAX);
  console.log(`[find-websites] looking up websites for ${queue.length} lead(s)`);

  const debug = [];
  let filled = 0;
  try {
    for (const l of queue) {
      const domain = await findWebsite(l, debug);
      if (domain) { l.website = 'https://' + domain; filled++; console.log(`[find-websites] ${l.company} -> ${l.website}`); }
    }
  } catch (e) { console.error(`[find-websites] pipeline error (continuing): ${e.message}`); }

  if (!filled) { console.log('[find-websites] no new websites found; leads.json unchanged.'); return; }
  await writeFile(LEADS_PATH, JSON.stringify(raw, null, 2) + '\n');
  console.log(`[find-websites] filled ${filled} website(s).`);
}

main()
  .catch((err) => { console.error('[find-websites] unexpected error (exiting 0):', err); })
  .finally(() => process.exit(0));
