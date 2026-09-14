// Fully-automated contact discovery per lead — written into outreach.json[id].contact.
//
// Layer A (automated), best-first with graceful fallback (no logins, no Playwright):
//   PERSON: PDL_API_KEY → People Data Labs person search (accurate); else Firecrawl (+ Scrape.do)
//           public web-search "<company> <role> site:linkedin.com/in" → askClaude picks best.
//   EMAIL (stop at first REAL, VERIFIED address): HUNTER → Hunter verified; else PROSPEO → Prospeo
//           Email Finder (LinkedIn URL or name+domain → verified); else PDL work email IF it is a
//           real "@" address; else Firecrawl the company page (published); else guess common
//           patterns and keep only one REOON marks "safe" (verified). Never store an unverified guess.
//           No verified email → email_status "none". PDL free returns email as a boolean flag → ignored.
// The UI (Layer B) keeps any MANUAL contact in localStorage that WINS over this auto contact, so
// this script never effectively overwrites a manual entry.
//
// Writes {name,title,linkedin_url,email,email_status,source,confidence}. Best-effort, capped,
// graceful (missing keys → exit 0, writes nothing), NEVER deletes existing entries, never throws.
//
// Test hooks: KGR_OUTREACH_PATH / KGR_LEADS_PATH.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { firecrawlScrape, firecrawlSearch, scrapedoGet, apiKey as firecrawlKey, haveScrapedo } from './lib/firecrawl.mjs';
import { askClaude } from './lib/llm.mjs';

const p = (env, rel) => process.env[env] || fileURLToPath(new URL(rel, import.meta.url));
const LEADS_PATH = p('KGR_LEADS_PATH', '../public/data/leads.json');
const OUTREACH_PATH = p('KGR_OUTREACH_PATH', '../public/data/outreach.json');

const MAX = Math.max(1, parseInt(process.env.MAX || '25', 10) || 25);
const PRIORITY_ONLY = /^(1|true|yes)$/i.test(process.env.PRIORITY_ONLY || '');
const HUNTER = process.env.HUNTER_API_KEY || '';
const PDL = process.env.PDL_API_KEY || '';
const PROSPEO = process.env.PROSPEO_API_KEY || '';   // email finder (LinkedIn URL → email, or name+domain → email)
const REOON = process.env.REOON_API_KEY || '';       // email verifier (used to verify guessed addresses)

const domainOf = (l) => { try { return l.website ? new URL(l.website).hostname.replace(/^www\./, '') : ''; } catch { return ''; } };
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
// A usable email is a STRING containing "@". PDL's free tier returns work_email / emails as a
// boolean flag ("exists but hidden"); those must NEVER be stored as the address or marked verified.
const realEmail = (e) => (typeof e === 'string' && e.includes('@')) ? e.trim() : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Split a display name into first/last (drops middle names / initials).
function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter((w) => /[a-z]/i.test(w));
  return parts.length >= 2 ? { first: parts[0], last: parts[parts.length - 1] } : null;
}
// Prospeo free tier ≈ 1 request/second and ~50/day — space calls out and stop after ~45 per run.
let prospeoCalls = 0;
const PROSPEO_CAP = 45;

async function loadOutreach() {
  try { const o = JSON.parse(await readFile(OUTREACH_PATH, 'utf8')); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {}; }
  catch { return {}; }
}
async function loadLeads() {
  try { const raw = JSON.parse(await readFile(LEADS_PATH, 'utf8')); return Array.isArray(raw) ? raw : (raw.leads || []); }
  catch (e) { console.error(`[find-contacts] cannot read leads: ${e.message}`); return []; }
}

// Step 1 (best) — People Data Labs person search (accurate). Returns {name,title,linkedin_url,email} or null.
async function pdlPerson(lead) {
  if (!PDL) return null;
  try {
    const must = [{ match: { job_company_name: lead.company } }];
    if (lead.contact_role) must.push({ match: { job_title: lead.contact_role } });
    const res = await fetch('https://api.peopledatalabs.com/v5/person/search', {
      method: 'POST',
      headers: { 'X-Api-Key': PDL, 'content-type': 'application/json' },
      body: JSON.stringify({ query: { bool: { must } }, size: 5 }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) { console.error(`[find-contacts] PDL ${res.status}`); return null; }
    const data = await res.json();
    const r = ((data && data.data) || [])[0];
    if (!r) return null;
    const name = r.full_name || [r.first_name, r.last_name].filter(Boolean).join(' ');
    const li = r.linkedin_url ? (String(r.linkedin_url).startsWith('http') ? r.linkedin_url : 'https://' + r.linkedin_url) : null;
    const emailRaw = r.work_email || (Array.isArray(r.emails) && r.emails[0] && (r.emails[0].address || r.emails[0])) || null;
    return name ? { name, title: r.job_title || '', linkedin_url: li, email: realEmail(emailRaw) } : null;
  } catch (e) { console.error(`[find-contacts] PDL failed (ok): ${e.message}`); return null; }
}

// Step 2 — public web search for the person (name/title/linkedin). No login.
async function webPerson(lead, debug) {
  const results = await firecrawlSearch(`${lead.company} ${lead.contact_role || 'purchasing buyer'} site:linkedin.com/in`, debug);
  const text = Array.isArray(results) ? results.map((r) => `${r.title || ''} | ${r.url || ''} | ${r.description || ''}`).join('\n') : '';
  if (text) {
    const pick = await askClaude({
      system: 'From LinkedIn/web search results, pick the ONE person best matching the target role. Return STRICT JSON single object {"name","title","linkedin_url"} or {}.',
      user: `Company: ${lead.company}\nTarget role: ${lead.contact_role || ''}\nResults:\n${text.slice(0, 4000)}`,
      json: true, maxTokens: 300,
    });
    if (pick && pick.name) return { name: pick.name, title: pick.title || '', linkedin_url: pick.linkedin_url || null };
    const li = Array.isArray(results) ? results.find((r) => /linkedin\.com\/in\//.test(r.url || '')) : null;
    if (li) return { name: null, title: null, linkedin_url: li.url.split('?')[0] };
  }
  return null;
}

// Step 1 — Hunter verified email.
async function hunterEmail(lead, domain) {
  try {
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(HUNTER)}`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) { console.error(`[find-contacts] Hunter ${res.status}`); return null; }
    const data = await res.json();
    const emails = (data && data.data && data.data.emails) || [];
    if (!emails.length) return null;
    const pick = await askClaude({
      system: 'Pick the person best matching the target role. Return STRICT JSON {"email","name","title"} or {}.',
      user: `Target role: ${lead.contact_role || ''}\nPeople JSON:\n${JSON.stringify(emails.slice(0, 15)).slice(0, 4000)}`,
      json: true, maxTokens: 300,
    });
    if (pick && pick.email) return { email: pick.email, name: pick.name || '', title: pick.title || '' };
    const v = emails.find((e) => e.verification && e.verification.status === 'valid') || emails[0];
    return v ? { email: v.value, name: [v.first_name, v.last_name].filter(Boolean).join(' '), title: v.position || '' } : null;
  } catch (e) { console.error(`[find-contacts] Hunter failed (ok): ${e.message}`); return null; }
}

// Step 3a — published email on the company website.
async function websiteEmail(lead, debug) {
  const base = String(lead.website).replace(/\/$/, '');
  let text = '';
  for (const u of [`${base}/contact`, `${base}/about`, base]) {
    const d = await firecrawlScrape(u, { formats: ['markdown'] }, debug);
    if (d && d.markdown) { text += '\n' + d.markdown; if (text.length > 4000) break; }
  }
  if (!text && haveScrapedo()) { const html = await scrapedoGet(base); if (html) text += html.slice(0, 5000); }
  const m = text.match(EMAIL_RE);
  if (m && !/example\.|sentry|wixpress|\.png|\.jpg/i.test(m[0])) return m[0];
  return null;
}

// Step 2 — Prospeo Email Finder (returns verified work emails). https://prospeo.io/api
// Shared caller: POST https://api.prospeo.io/<path> with the X-KEY header; body varies by path.
// Response is { error, response: { email, email_status, ... } }. Respects the free-tier rate cap.
async function prospeo(path, body) {
  if (!PROSPEO) return null;
  if (prospeoCalls >= PROSPEO_CAP) { console.log('[find-contacts] Prospeo daily cap reached — skipping.'); return null; }
  prospeoCalls++;
  await sleep(1100); // ~1 request/second
  try {
    const res = await fetch(`https://api.prospeo.io/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-KEY': PROSPEO },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) { console.error(`[find-contacts] Prospeo ${path} ${res.status}`); return null; }
    const data = await res.json();
    if (data && data.error) return null;
    const r = (data && data.response) || data || {};
    return realEmail(r.email);
  } catch (e) { console.error(`[find-contacts] Prospeo ${path} failed (ok): ${e.message}`); return null; }
}
const prospeoFromLinkedin = (url) => (url ? prospeo('social-url-enrichment', { url }) : Promise.resolve(null));
async function prospeoFromName(name, domain) {
  const n = splitName(name);
  return (n && domain) ? prospeo('email-finder', { first_name: n.first, last_name: n.last, company: domain }) : null;
}

// Step 4 — verified GUESS. Generate common patterns and verify each with Reoon; keep the FIRST
// address Reoon marks "safe". Never keep an unverified guess (needs a REOON key).
async function reoonSafe(email) {
  if (!REOON || !realEmail(email)) return false;
  try {
    const url = `https://emailverifier.reoon.com/api/v1/verify?email=${encodeURIComponent(email)}&key=${encodeURIComponent(REOON)}&mode=power`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) { console.error(`[find-contacts] Reoon ${res.status}`); return false; }
    const data = await res.json();
    return String((data && data.status) || '').toLowerCase() === 'safe';
  } catch (e) { console.error(`[find-contacts] Reoon failed (ok): ${e.message}`); return false; }
}
function emailPatterns(name, domain) {
  const n = splitName(name); if (!n || !domain) return [];
  const f = n.first.toLowerCase().replace(/[^a-z]/g, '');
  const l = n.last.toLowerCase().replace(/[^a-z]/g, '');
  if (!f || !l) return [];
  return [`${f}.${l}@${domain}`, `${f[0]}${l}@${domain}`, `${f}@${domain}`, `${f[0]}.${l}@${domain}`, `${f}${l}@${domain}`];
}
async function guessAndVerify(name, domain) {
  if (!REOON) return null; // verification is mandatory — without it we never keep a guess
  for (const e of emailPatterns(name, domain)) {
    if (await reoonSafe(e)) return e;
  }
  return null;
}

async function main() {
  if (!PDL && !HUNTER && !firecrawlKey() && !haveScrapedo()) {
    console.log('[find-contacts] no discovery keys (PDL / HUNTER / FIRECRAWL / SCRAPEDO) — writing nothing. Exiting 0.');
    return;
  }
  const leads = await loadLeads();
  const outreach = await loadOutreach();
  const rank = (l) => (l.priority === 'High' ? 0 : 2) + (l.detail === 'full' ? 0 : 1);

  let queue = leads.filter((l) => !outreach[l.id]?.contact);
  if (PRIORITY_ONLY) queue = queue.filter((l) => l.priority === 'High');
  queue.sort((a, b) => rank(a) - rank(b) || a.company.localeCompare(b.company));
  queue = queue.slice(0, MAX);
  console.log(`[find-contacts] searching contacts for ${queue.length} lead(s)`);

  const debug = [];
  let found = 0;
  try {
    for (const l of queue) {
      const domain = domainOf(l);
      const contact = { name: null, title: null, linkedin_url: null, email: null, email_status: null, source: '', confidence: 'low' };
      let pdlEmail = null;

      // PERSON — best-first: PDL, else public web search.
      if (PDL) {
        const person = await pdlPerson(l);
        if (person) { contact.name = person.name; contact.title = person.title; contact.linkedin_url = person.linkedin_url; contact.source = 'pdl'; contact.confidence = 'high'; pdlEmail = person.email || null; }
      }
      if (!contact.name && (firecrawlKey() || haveScrapedo())) {
        const person = await webPerson(l, debug);
        if (person) { contact.name = person.name; contact.title = person.title; contact.linkedin_url = person.linkedin_url; if (!contact.source) contact.source = 'web'; if (contact.confidence === 'low') contact.confidence = 'medium'; }
      }

      // EMAIL — stop at the FIRST real, VERIFIED address:
      //   Hunter → Prospeo → PDL work email → website (published) → guess-then-Reoon-verify.
      // 1) Hunter (verified)
      if (HUNTER && domain) {
        const h = await hunterEmail(l, domain);
        const he = realEmail(h && h.email);
        if (he) {
          contact.email = he; contact.email_status = 'verified';
          if (!contact.name) contact.name = h.name || null;
          if (!contact.title) contact.title = h.title || '';
          contact.source = /pdl|web/.test(contact.source) ? contact.source + '+hunter' : 'hunter';
          contact.confidence = 'high';
        }
      }
      // 2) Prospeo Email Finder (verified): LinkedIn URL → email, else name + domain → email.
      if (!contact.email && PROSPEO) {
        const pp = (await prospeoFromLinkedin(contact.linkedin_url)) || (contact.name ? await prospeoFromName(contact.name, domain) : null);
        if (pp) {
          contact.email = pp; contact.email_status = 'verified';
          contact.source = contact.source ? contact.source + '+prospeo' : 'prospeo';
          contact.confidence = 'high';
        }
      }
      // PDL work email (verified) — only when it is a real "@" address (free tier returns a flag → ignored).
      const pe = realEmail(pdlEmail);
      if (!contact.email && pe) {
        contact.email = pe; contact.email_status = 'verified';
        if (!/pdl/.test(contact.source)) contact.source = contact.source ? contact.source + '+pdl' : 'pdl';
      }
      // 3) Published email on the company website.
      if (!contact.email && (firecrawlKey() || haveScrapedo()) && l.website) {
        const pub = realEmail(await websiteEmail(l, debug));
        if (pub) { contact.email = pub; contact.email_status = 'published'; if (!contact.source) contact.source = 'website'; }
      }
      // 4) Guess common patterns, keep only one Reoon marks "safe" (verified). Never keep an unverified guess.
      if (!contact.email && domain && contact.name) {
        const g = await guessAndVerify(contact.name, domain);
        if (g) { contact.email = g; contact.email_status = 'verified'; contact.source = contact.source ? contact.source + '+guess' : 'guess'; }
      }
      // Nothing verified → explicit "none" (grey badge); the person (if any) is still saved.
      if (!contact.email) contact.email_status = 'none';

      if (!contact.name && !contact.email) continue;
      outreach[l.id] = { ...(outreach[l.id] || {}), contact };
      found++;
    }
  } catch (e) { console.error(`[find-contacts] pipeline error (continuing): ${e.message}`); }

  if (!found) { console.log('[find-contacts] no contacts found; outreach.json unchanged.'); return; }
  await writeFile(OUTREACH_PATH, JSON.stringify(outreach, null, 2) + '\n');
  console.log(`[find-contacts] found ${found} contact(s).`);
}

main()
  .catch((err) => { console.error('[find-contacts] unexpected error (exiting 0):', err); })
  .finally(() => process.exit(0));
