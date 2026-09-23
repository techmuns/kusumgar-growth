// Right-person contact discovery — hunts the TECHNICAL / R&D / OPERATIONS decision-maker
// (NOT purchasing) for each target company, with their LinkedIn and a real verified email
// where free tools can get one.
//
// WHY: technical / R&D people convert; purchasing just asks price and stalls. So we rank the
// person we find by role tier and always keep the HIGHEST-tier person available:
//   Tier A (best): R&D / Research & Development, Technology or Technical Director/Head/Manager,
//                  VP/Chief Technology (CTO), Product Development, Engineering, Innovation.
//   Tier B:        Operations (also Plant / Manufacturing / Production) Head/Director/Manager.
//   Tier C (weak): Purchasing / Procurement / Sourcing / Buyer — used ONLY when no A/B exists,
//                  and flagged as weaker.
//
// FREE-FIRST + SOURCE-BACKED (mirrors verify-research-targets.mjs), Firecrawl is a booster:
//   PERSON: free web search (DuckDuckGo) for "<company> (R&D OR technical director OR …)
//           site:linkedin.com/in" → then Firecrawl search as a booster → askClaude picks the
//           highest-tier person from the REAL result snippets (snippet text ONLY, never invented).
//           PDL person search is an accuracy booster used only to upgrade a weak/empty result.
//   EMAIL (only a real "@", verified where possible; NEVER a boolean/placeholder/guess-unverified):
//           Hunter (verified) → Prospeo finder (verified) → PDL work email IF a real "@" → published
//           address on the company site → guess common patterns kept ONLY if Reoon marks it "safe".
//           No real address → email_status "none". We do NOT fabricate emails.
//
// HONEST LIMIT: finding the right PERSON + LinkedIn is free and reliable; a VERIFIED PERSONAL
// EMAIL at scale needs a paid finder (Hunter/ContactOut). So expect most rows to get a person +
// LinkedIn, a subset to also get a verified email, and the rest "LinkedIn ready — email needs a
// paid finder / manual ContactOut".
//
// WRITES the right-person onto BOTH:
//   - research_targets.json[t]: person_name, person_title, person_linkedin, person_role_tier (A/B/C),
//     person_match_reason, person_email, person_email_status, person_source, person_checked_at.
//   - outreach.json[id].contact: { name, title, linkedin_url, email, email_status, source,
//     confidence, role_tier, match_reason } — so the Outreach compose panel auto-uses this person
//     (name in the greeting, email in To). The UI's manual localStorage contact still wins over this.
//
// Scope: research_targets first (the curated hunt list), then leads already in the outreach pipeline,
// then broader leads. Capped by MAX (default 30). Graceful: needs BEDROCK_API_KEY or PDL_API_KEY for
// person selection — without both it writes nothing and exits 0. Never throws.
//
// Test hooks: KGR_OUTREACH_PATH / KGR_LEADS_PATH / KGR_RESEARCH_PATH, and KGR_FAKE_SEARCH /
// KGR_FAKE_PICK for offline logic tests (see scripts/… tests).

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { firecrawlScrape, firecrawlSearch, freeSearch, freeFetchText, scrapedoGet, apiKey as firecrawlKey, haveScrapedo } from './lib/firecrawl.mjs';
import { askClaude, haveBedrock } from './lib/llm.mjs';

const p = (env, rel) => process.env[env] || fileURLToPath(new URL(rel, import.meta.url));
const LEADS_PATH = p('KGR_LEADS_PATH', '../public/data/leads.json');
const OUTREACH_PATH = p('KGR_OUTREACH_PATH', '../public/data/outreach.json');
const RESEARCH_PATH = p('KGR_RESEARCH_PATH', '../public/data/research_targets.json');

const MAX = Math.max(1, parseInt(process.env.MAX || '30', 10) || 30);
const PRIORITY_ONLY = /^(1|true|yes)$/i.test(process.env.PRIORITY_ONLY || '');
const HUNTER = process.env.HUNTER_API_KEY || '';
const PDL = process.env.PDL_API_KEY || '';
const PROSPEO = process.env.PROSPEO_API_KEY || '';   // email finder (LinkedIn URL / name+domain → verified email)
const REOON = process.env.REOON_API_KEY || '';       // email verifier (guessed addresses)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const domainOf = (l) => { try { return l && l.website ? new URL(String(l.website).startsWith('http') ? l.website : 'https://' + l.website).hostname.replace(/^www\./, '') : ''; } catch { return ''; } };
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
// A usable email is a STRING containing "@". PDL's free tier returns a boolean flag ("exists but
// hidden") for emails — those must NEVER be stored as the address or marked verified.
const realEmail = (e) => (typeof e === 'string' && e.includes('@')) ? e.trim() : null;
function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter((w) => /[a-z]/i.test(w));
  return parts.length >= 2 ? { first: parts[0], last: parts[parts.length - 1] } : null;
}
// Generic/role inboxes (info@, sales@ …) are real & usable but NOT a person — labelled, never "verified".
const GENERIC_INBOX = new Set(['info', 'sales', 'contact', 'support', 'service', 'admin', 'hello', 'enquiries', 'enquiry', 'dealers', 'orders', 'marketing', 'pr', 'help', 'team', 'office', 'mail', 'careers', 'general']);
function isCompanyInbox(email) {
  const lp = String(email || '').toLowerCase().split('@')[0] || '';
  if (!lp) return false;
  const base = lp.replace(/[._+-].*$/, '').replace(/\d+$/, '');
  return GENERIC_INBOX.has(lp) || GENERIC_INBOX.has(base);
}

/* ---------------- Role tiers (the heart of this brick) ---------------- */
// Ordered keyword → human label. First match wins within a tier.
const TIER_A = [['research and development', 'R&D'], ['research & development', 'R&D'], ['r&d', 'R&D'], ['r & d', 'R&D'], ['chief technology', 'Chief Technology'], ['cto', 'CTO'], ['product development', 'Product Development'], ['new product development', 'Product Development'], ['technology', 'Technology'], ['technical', 'Technical'], ['engineering', 'Engineering'], ['innovation', 'Innovation']];
const TIER_B = [['operations', 'Operations'], ['plant manager', 'Plant Manager'], ['manufacturing', 'Manufacturing'], ['production', 'Production']];
const TIER_C = [['purchasing', 'Purchasing'], ['procurement', 'Procurement'], ['sourcing', 'Sourcing'], ['supply chain', 'Supply Chain'], ['buyer', 'Buyer']];
const TIER_RANK = { A: 3, B: 2, C: 1 };
// Classify a job title → { tier:'A'|'B'|'C'|null, reason:'<matched keyword>' }. Deterministic; the LLM
// only selects the person, this decides the tier from the real title.
function roleTier(title) {
  const t = ' ' + String(title || '').toLowerCase().replace(/&/g, ' & ').replace(/[^a-z& ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  const has = (kw) => t.includes(' ' + kw + ' ');   // whole-token match (so "cto" ≠ "director")
  const isSales = /\b(sales|marketing|business development|commercial|account)\b/.test(t);
  const isIT = /information technology|\bit\b|software|cyber|digital|data /.test(t);
  for (const [kw, label] of TIER_A) {
    if (!has(kw)) continue;
    if (kw === 'technology' && isIT) continue;                       // IT ≠ R&D
    if ((kw === 'technical' || kw === 'technology') && isSales) continue; // "technical sales" ≠ decision-maker
    return { tier: 'A', reason: label };
  }
  for (const [kw, label] of TIER_B) if (has(kw)) return { tier: 'B', reason: label };
  for (const [kw, label] of TIER_C) if (has(kw)) return { tier: 'C', reason: label };
  return { tier: null, reason: '' };
}
const PERSON_QUERY = (company) => `"${company}" (R&D OR "research and development" OR "technical director" OR "head of technology" OR "technology manager" OR "R&D manager" OR "product development" OR "operations manager" OR "operations director" OR "head of operations") site:linkedin.com/in`;

/* ---------------- Data IO ---------------- */
async function loadJson(path, fallback) { try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; } }
async function loadLeads() {
  const raw = await loadJson(LEADS_PATH, []);
  return Array.isArray(raw) ? raw : (raw.leads || []);
}

/* ---------------- Person finders ---------------- */
// Gather REAL result snippets for the tiered query — free search first, Firecrawl as a booster.
async function personSnippets(company, debug) {
  let rows = [];
  try { rows = await freeSearch(PERSON_QUERY(company)); } catch { rows = []; }
  if ((!rows || rows.length < 3) && firecrawlKey()) {
    const fc = await firecrawlSearch(PERSON_QUERY(company), debug);
    if (Array.isArray(fc)) rows = rows.concat(fc);
  }
  // de-dupe by url, keep only real result rows
  const seen = new Set(); const out = [];
  for (const r of (rows || [])) {
    const url = (r && r.url) || ''; if (!url || seen.has(url)) continue; seen.add(url);
    out.push({ title: r.title || '', url, description: r.description || '' });
  }
  return out.slice(0, 12);
}

// Fake-search hook for offline logic tests (KGR_FAKE_SEARCH = JSON array of {title,url,description}).
function fakeSnippets(company) {
  try { const all = JSON.parse(process.env.KGR_FAKE_SEARCH || '{}'); return all[company] || all['*'] || null; } catch { return null; }
}

// Pick the highest-tier person from real snippets. Uses ONLY snippet text; returns {name,title,linkedin_url} or null.
async function pickFromSnippets(company, snippets) {
  if (process.env.KGR_FAKE_PICK) { try { const m = JSON.parse(process.env.KGR_FAKE_PICK); return m[company] || m['*'] || null; } catch { /* ignore */ } }
  if (!snippets.length || !haveBedrock()) {
    // No LLM: a light, honest fallback — take the first linkedin/in result and parse "Name - Title"
    const li = snippets.find((s) => /linkedin\.com\/in\//i.test(s.url));
    if (!li) return null;
    const m = String(li.title || '').split(/\s[-–|]\s/);
    const name = (m[0] || '').replace(/\s*\|\s*linkedin.*$/i, '').trim();
    const title = (m[1] || '').replace(/\s*\|\s*linkedin.*$/i, '').trim();
    return name ? { name, title, linkedin_url: li.url.split('?')[0] } : null;
  }
  const text = snippets.map((r) => `${r.title} | ${r.url} | ${r.description}`).join('\n').slice(0, 4000);
  const pick = await askClaude({
    system: 'From REAL LinkedIn/web search snippets, pick the ONE person who is the most senior TECHNICAL / R&D / OPERATIONS decision-maker at the target company. Prefer, best→worst: R&D / Technology / Technical / Product Development / Engineering leaders; then Operations leaders; ONLY if none of those appear, a Purchasing/Procurement lead. Avoid pure Sales, Marketing, HR and Finance people. Use ONLY the snippet text — never invent a name, title or URL. Return STRICT JSON {"name","title","linkedin_url"} or {} if no suitable person is present.',
    user: `Company: ${company}\nSnippets:\n${text}`,
    json: true, maxTokens: 300,
  });
  if (pick && pick.name) return { name: String(pick.name).trim(), title: String(pick.title || '').trim(), linkedin_url: pick.linkedin_url ? String(pick.linkedin_url).split('?')[0] : null };
  return null;
}

// PDL person search (accuracy booster) — returns the highest-tier person at the company, or null.
async function pdlPerson(company) {
  if (!PDL) return null;
  try {
    const res = await fetch('https://api.peopledatalabs.com/v5/person/search', {
      method: 'POST',
      headers: { 'X-Api-Key': PDL, 'content-type': 'application/json' },
      body: JSON.stringify({ query: { bool: { must: [{ match: { job_company_name: company } }] } }, size: 10 }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) { console.error(`[find-contacts] PDL ${res.status}`); return null; }
    const data = await res.json();
    const people = (data && data.data) || [];
    let best = null, bestRank = -1;
    for (const r of people) {
      const title = r.job_title || '';
      const { tier } = roleTier(title);
      const rank = tier ? TIER_RANK[tier] : 0;
      if (rank > bestRank) {
        const name = r.full_name || [r.first_name, r.last_name].filter(Boolean).join(' ');
        if (!name) continue;
        const li = r.linkedin_url ? (String(r.linkedin_url).startsWith('http') ? r.linkedin_url : 'https://' + r.linkedin_url) : null;
        const emailRaw = r.work_email || (Array.isArray(r.emails) && r.emails[0] && (r.emails[0].address || r.emails[0])) || null;
        best = { name, title, linkedin_url: li, email: realEmail(emailRaw) }; bestRank = rank;
      }
    }
    return best;
  } catch (e) { console.error(`[find-contacts] PDL failed (ok): ${e.message}`); return null; }
}

// Find the best right-person for a company. Returns { name,title,linkedin_url,tier,reason,source,pdlEmail } or null.
async function findPerson(company, debug) {
  const snippets = fakeSnippets(company) || await personSnippets(company, debug);
  let web = await pickFromSnippets(company, snippets);
  let webTier = web ? roleTier(web.title) : { tier: null };
  let pdlEmail = null;

  // PDL booster only to UPGRADE a weak (no A/B) or empty web result.
  if (PDL && (!web || !(webTier.tier === 'A' || webTier.tier === 'B'))) {
    const pdl = await pdlPerson(company);
    if (pdl) {
      const pdlTier = roleTier(pdl.title);
      const webRank = web && webTier.tier ? TIER_RANK[webTier.tier] : (web ? 0.5 : 0);
      const pdlRank = pdlTier.tier ? TIER_RANK[pdlTier.tier] : (pdl ? 0.5 : 0);
      if (pdlRank >= webRank) { web = { name: pdl.name, title: pdl.title, linkedin_url: pdl.linkedin_url }; webTier = pdlTier; pdlEmail = pdl.email; return { ...web, tier: webTier.tier, reason: webTier.reason, source: 'pdl', pdlEmail }; }
    }
  }
  if (!web) return null;
  return { ...web, tier: webTier.tier, reason: webTier.reason, source: 'web', pdlEmail };
}

/* ---------------- Email finders (real, verified where possible) ---------------- */
async function hunterEmail(role, domain) {
  try {
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(HUNTER)}`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) { console.error(`[find-contacts] Hunter ${res.status}`); return null; }
    const data = await res.json();
    const emails = (data && data.data && data.data.emails) || [];
    if (!emails.length) return null;
    // Prefer a technical/ops person's address over a generic inbox.
    const ranked = emails.map((e) => ({ e, rank: TIER_RANK[roleTier(e.position || '').tier] || 0 })).sort((a, b) => b.rank - a.rank);
    const v = ranked.find((x) => x.e.verification && x.e.verification.status === 'valid') || ranked[0];
    return v ? { email: v.e.value, name: [v.e.first_name, v.e.last_name].filter(Boolean).join(' '), title: v.e.position || '' } : null;
  } catch (e) { console.error(`[find-contacts] Hunter failed (ok): ${e.message}`); return null; }
}
let prospeoCalls = 0; const PROSPEO_CAP = 45;
async function prospeo(path, body) {
  if (!PROSPEO || prospeoCalls >= PROSPEO_CAP) return null;
  prospeoCalls++; await sleep(1100);
  try {
    const res = await fetch(`https://api.prospeo.io/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'X-KEY': PROSPEO }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
    if (!res.ok) { console.error(`[find-contacts] Prospeo ${path} ${res.status}`); return null; }
    const data = await res.json();
    if (data && data.error) return null;
    const r = (data && data.response) || data || {};
    return realEmail(r.email);
  } catch (e) { console.error(`[find-contacts] Prospeo ${path} failed (ok): ${e.message}`); return null; }
}
const prospeoFromLinkedin = (url) => (url ? prospeo('social-url-enrichment', { url }) : Promise.resolve(null));
async function prospeoFromName(name, domain) { const n = splitName(name); return (n && domain) ? prospeo('email-finder', { first_name: n.first, last_name: n.last, company: domain }) : null; }

async function reoonSafe(email) {
  if (!REOON || !realEmail(email)) return false;
  try {
    const res = await fetch(`https://emailverifier.reoon.com/api/v1/verify?email=${encodeURIComponent(email)}&key=${encodeURIComponent(REOON)}&mode=power`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return false;
    const data = await res.json();
    return String((data && data.status) || '').toLowerCase() === 'safe';
  } catch { return false; }
}
function emailPatterns(name, domain) {
  const n = splitName(name); if (!n || !domain) return [];
  const f = n.first.toLowerCase().replace(/[^a-z]/g, ''); const l = n.last.toLowerCase().replace(/[^a-z]/g, '');
  if (!f || !l) return [];
  return [`${f}.${l}@${domain}`, `${f[0]}${l}@${domain}`, `${f}@${domain}`, `${f[0]}.${l}@${domain}`, `${f}${l}@${domain}`];
}
async function guessAndVerify(name, domain) {
  if (!REOON) return null;
  for (const e of emailPatterns(name, domain)) if (await reoonSafe(e)) return e;
  return null;
}
// Published address on the company website — free fetch first, Scrape.do, then Firecrawl.
async function websiteEmail(website, debug) {
  const base = String(website).replace(/\/$/, '');
  let text = '';
  for (const u of [`${base}/contact`, `${base}/about`, base]) {
    const html = await freeFetchText(u);
    if (html) { text += ' ' + html; if (text.length > 6000) break; }
  }
  if (!text && haveScrapedo()) { const html = await scrapedoGet(base); if (html) text += html.slice(0, 6000); }
  if (!text && firecrawlKey()) { const d = await firecrawlScrape(base, { formats: ['markdown'] }, debug); if (d && d.markdown) text += d.markdown; }
  const m = text.match(EMAIL_RE);
  if (m && !/example\.|sentry|wixpress|\.png|\.jpg|\.gif|@sentry/i.test(m[0])) return m[0];
  return null;
}

// Find the best real email for a chosen person. Returns { email, email_status, via } — status ∈ verified|published|none.
async function findEmail(person, domain, debug) {
  if (!domain) return { email: null, email_status: 'none', via: '' };
  // 1) Hunter (verified)
  if (HUNTER) { const h = await hunterEmail(person.title, domain); const he = realEmail(h && h.email); if (he) return { email: he, email_status: isCompanyInbox(he) ? 'published' : 'verified', via: 'hunter' }; }
  // 2) Prospeo (verified) — LinkedIn URL, else name + domain
  if (PROSPEO) { const pp = (await prospeoFromLinkedin(person.linkedin_url)) || (person.name ? await prospeoFromName(person.name, domain) : null); if (pp) return { email: pp, email_status: isCompanyInbox(pp) ? 'published' : 'verified', via: 'prospeo' }; }
  // 3) PDL work email (only a real "@")
  const pe = realEmail(person.pdlEmail); if (pe) return { email: pe, email_status: isCompanyInbox(pe) ? 'published' : 'verified', via: 'pdl' };
  // 4) Published website address (may be a role inbox → "published"; UI shows the 📪 badge)
  if ((firecrawlKey() || haveScrapedo() || true) && domain) { const pub = realEmail(await websiteEmail('https://' + domain, debug)); if (pub) return { email: pub, email_status: 'published', via: 'website' }; }
  // 5) Guess a pattern, keep only if Reoon marks it "safe"
  if (person.name) { const g = await guessAndVerify(person.name, domain); if (g) return { email: g, email_status: isCompanyInbox(g) ? 'published' : 'verified', via: 'guess' }; }
  return { email: null, email_status: 'none', via: '' };
}

/* ---------------- Main ---------------- */
async function main() {
  if (!haveBedrock() && !PDL) {
    console.log('[find-contacts] needs BEDROCK_API_KEY or PDL_API_KEY to select the right person — writing nothing. Exiting 0.');
    return;
  }
  console.log(`[find-contacts] readers: free=yes firecrawl=${firecrawlKey() ? 'yes' : 'no'} scrapedo=${haveScrapedo() ? 'yes' : 'no'} | person: bedrock=${haveBedrock() ? 'yes' : 'no'} pdl=${PDL ? 'yes' : 'no'} | email: hunter=${HUNTER ? 'yes' : 'no'} prospeo=${PROSPEO ? 'yes' : 'no'} reoon=${REOON ? 'yes' : 'no'}`);

  const leads = await loadLeads();
  const outreach = await loadJson(OUTREACH_PATH, {});
  const researchRaw = await loadJson(RESEARCH_PATH, { targets: [] });
  const targets = Array.isArray(researchRaw) ? researchRaw : (researchRaw.targets || []);
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const outreachContactName = (id) => outreach[id] && outreach[id].contact && outreach[id].contact.name;

  // QUEUE — research targets first (curated hunt list; confirmed/verified first, un-checked first),
  // then leads already in the outreach pipeline, then broader leads. Cap at MAX.
  const tRank = (t) => (t.product_confirmed === true ? 0 : t.verified ? 1 : 2);
  const targetQueue = targets
    .filter((t) => t && t.company && !t.person_checked_at)
    .filter((t) => !PRIORITY_ONLY || t.product_confirmed === true)
    .sort((a, b) => tRank(a) - tRank(b) || String(a.company).localeCompare(String(b.company)))
    .map((t) => ({ kind: 'target', id: t.id, company: t.company, website: t.website || (leadById.get(t.id) || {}).website || '', target: t }));

  const targetIds = new Set(targetQueue.map((q) => q.id));
  const lRank = (l) => (outreach[l.id] ? 0 : 2) + (l.priority === 'High' ? 0 : 1);
  const leadQueue = leads
    .filter((l) => l && l.company && !targetIds.has(l.id) && !outreachContactName(l.id))
    .filter((l) => !PRIORITY_ONLY || l.priority === 'High')
    .sort((a, b) => lRank(a) - lRank(b) || String(a.company).localeCompare(String(b.company)))
    .map((l) => ({ kind: 'lead', id: l.id, company: l.company, website: l.website || '', target: null }));

  const queue = targetQueue.concat(leadQueue).slice(0, MAX);
  console.log(`[find-contacts] processing ${queue.length} (targets=${Math.min(targetQueue.length, MAX)} of ${targetQueue.length}, then leads)`);

  const debug = [];
  const tally = { people: 0, A: 0, B: 0, C: 0, none: 0, emails: 0 };
  let changedOutreach = false, changedResearch = false;
  try {
    for (const item of queue) {
      const domain = domainOf(item);
      const person = await findPerson(item.company, debug);
      const nowISO = new Date().toISOString().slice(0, 10);

      if (item.target) { item.target.person_checked_at = nowISO; changedResearch = true; }

      if (!person || !person.name) { tally.none++; continue; }
      tally.people++;
      if (person.tier) tally[person.tier]++; else tally.none++;

      const em = await findEmail(person, domain, debug);
      if (em.email) tally.emails++;

      const contact = {
        name: person.name,
        title: person.title || '',
        linkedin_url: person.linkedin_url || null,
        email: em.email,
        email_status: em.email_status,
        source: [person.source, em.via].filter(Boolean).join('+') || 'web',
        confidence: person.source === 'pdl' ? 'high' : (person.tier ? 'medium' : 'low'),
        role_tier: person.tier || null,
        match_reason: person.reason || '',
      };
      outreach[item.id] = { ...(outreach[item.id] || {}), contact };
      changedOutreach = true;

      if (item.target) {
        const t = item.target;
        t.person_name = person.name;
        t.person_title = person.title || '';
        t.person_linkedin = person.linkedin_url || null;
        t.person_role_tier = person.tier || null;
        t.person_match_reason = person.reason || '';
        t.person_email = em.email;
        t.person_email_status = em.email_status;
        t.person_source = contact.source;
      }
      console.log(`[find-contacts] ${item.company}: ${person.name} · ${person.title || '?'} · tier ${person.tier || '-'} · email ${em.email_status}${em.email ? ' (' + em.via + ')' : ''}`);
    }
  } catch (e) { console.error(`[find-contacts] pipeline error (continuing): ${e.message}`); }

  console.log(`[find-contacts] found people=${tally.people} (A=${tally.A} B=${tally.B} C=${tally.C}) · verified/real emails=${tally.emails} · no-person=${tally.none}`);
  if (changedOutreach) { await writeFile(OUTREACH_PATH, JSON.stringify(outreach, null, 2) + '\n'); console.log('[find-contacts] wrote outreach.json'); }
  if (changedResearch) { await writeFile(RESEARCH_PATH, JSON.stringify(researchRaw, null, 1) + '\n'); console.log('[find-contacts] wrote research_targets.json'); }
  if (!changedOutreach && !changedResearch) console.log('[find-contacts] nothing found; files unchanged.');
}

// Run only when invoked directly (not when imported by a test that wants roleTier()).
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main()
    .catch((err) => { console.error('[find-contacts] unexpected error (exiting 0):', err); })
    .finally(() => process.exit(0));
}

export { roleTier, isCompanyInbox, splitName, emailPatterns };
