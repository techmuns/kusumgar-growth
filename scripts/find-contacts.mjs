// Fully-automated contact discovery per lead — written into outreach.json[id].contact.
//
// Layer A (automated), best-first with graceful fallback (no logins, no Playwright):
//   PERSON: PDL_API_KEY → People Data Labs person search (accurate); else Firecrawl (+ Scrape.do)
//           public web-search "<company> <role> site:linkedin.com/in" → askClaude picks best.
//   EMAIL:  HUNTER_API_KEY → Hunter verified; else PDL work email (verified); else Firecrawl the
//           company contact/about/team page (published); else askClaude infers from name+domain
//           (guessed).
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

const domainOf = (l) => { try { return l.website ? new URL(l.website).hostname.replace(/^www\./, '') : ''; } catch { return ''; } };
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

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
    const email = r.work_email || (Array.isArray(r.emails) && r.emails[0] && (r.emails[0].address || r.emails[0])) || null;
    return name ? { name, title: r.job_title || '', linkedin_url: li, email } : null;
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

// Step 3b — infer likely address from name + domain.
async function guessEmail(name, domain) {
  const g = await askClaude({
    system: 'Infer the single most likely corporate work email for this person using common patterns (first.last@, flast@, first@). Return STRICT JSON {"email":"..."} only.',
    user: `Name: ${name}\nDomain: ${domain}`,
    json: true, maxTokens: 120,
  });
  return (g && g.email && EMAIL_RE.test(g.email)) ? g.email : null;
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

      // EMAIL — Hunter (verified) → PDL work email (verified) → website (published) → guess.
      if (HUNTER && domain) {
        const h = await hunterEmail(l, domain);
        if (h && h.email) {
          contact.email = h.email; contact.email_status = 'verified';
          if (!contact.name) contact.name = h.name || null;
          if (!contact.title) contact.title = h.title || '';
          contact.source = /pdl|web/.test(contact.source) ? contact.source + '+hunter' : 'hunter';
          contact.confidence = 'high';
        }
      }
      if (!contact.email && pdlEmail) {
        contact.email = pdlEmail; contact.email_status = 'verified';
        if (!/pdl/.test(contact.source)) contact.source = contact.source ? contact.source + '+pdl' : 'pdl';
      }

      if (!contact.email && (firecrawlKey() || haveScrapedo()) && l.website) {
        const pub = await websiteEmail(l, debug);
        if (pub) { contact.email = pub; contact.email_status = 'published'; if (!contact.source) contact.source = 'website'; }
      }
      if (!contact.email && domain && contact.name) {
        const g = await guessEmail(contact.name, domain);
        if (g) { contact.email = g; contact.email_status = 'guessed'; if (!contact.source) contact.source = 'guess'; }
      }

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
