// Best-effort CONTACT discovery per lead's target role, written into outreach.json[id].contact.
//
// Source order (whichever secrets exist): ContactOut API → LinkedIn (Playwright login) →
// Firecrawl (company website). Bedrock (askClaude) picks the best-matching person for the role.
// Best-effort, capped, and GRACEFUL — LinkedIn WILL sometimes be blocked; that's fine, fall
// through. Never throws, never deletes existing outreach.json entries (merges per id).
//
// Graceful: if NONE of CONTACTOUT_API_KEY / (LINKEDIN_EMAIL+LINKEDIN_PASSWORD) / FIRECRAWL_API_KEY
// is set → logs and exits 0, writes nothing.
//
// Test hooks: KGR_OUTREACH_PATH / KGR_LEADS_PATH.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { firecrawlScrape, apiKey as firecrawlKey } from './lib/firecrawl.mjs';
import { askClaude } from './lib/llm.mjs';

const p = (env, rel) => process.env[env] || fileURLToPath(new URL(rel, import.meta.url));
const LEADS_PATH = p('KGR_LEADS_PATH', '../public/data/leads.json');
const OUTREACH_PATH = p('KGR_OUTREACH_PATH', '../public/data/outreach.json');

const MAX = Math.max(1, parseInt(process.env.MAX || '25', 10) || 25);
const PRIORITY_ONLY = /^(1|true|yes)$/i.test(process.env.PRIORITY_ONLY || '');
const CONTACTOUT = process.env.CONTACTOUT_API_KEY || '';
const LI_EMAIL = process.env.LINKEDIN_EMAIL || '';
const LI_PASS = process.env.LINKEDIN_PASSWORD || '';

const domainOf = (l) => { try { return l.website ? new URL(l.website).hostname.replace(/^www\./, '') : ''; } catch { return ''; } };

async function loadOutreach() {
  try { const o = JSON.parse(await readFile(OUTREACH_PATH, 'utf8')); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {}; }
  catch { return {}; }
}
async function loadLeads() {
  try { const raw = JSON.parse(await readFile(LEADS_PATH, 'utf8')); return Array.isArray(raw) ? raw : (raw.leads || []); }
  catch (e) { console.error(`[find-contacts] cannot read leads: ${e.message}`); return []; }
}

// ---- source: ContactOut ----
async function contactOut(lead) {
  if (!CONTACTOUT) return [];
  try {
    const res = await fetch('https://api.contactout.com/v1/people/search', {
      method: 'POST',
      headers: { authorization: CONTACTOUT, token: CONTACTOUT, 'content-type': 'application/json' },
      body: JSON.stringify({ company: [domainOf(lead) || lead.company], job_title: [lead.contact_role || ''].filter(Boolean), reveal_info: true, page: 1 }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) { console.error(`[find-contacts] ContactOut ${res.status}`); return []; }
    const data = await res.json();
    const raw = data?.profiles || data?.data || [];
    const list = Array.isArray(raw) ? raw : Object.values(raw || {});
    return list.map((pr) => ({
      name: pr.full_name || pr.name,
      title: pr.title || pr.headline || '',
      linkedin_url: pr.li_vanity || pr.linkedin_url || pr.url || null,
      email: pr.work_email || pr.email || (Array.isArray(pr.work_emails) && pr.work_emails[0]) || null,
    })).filter((x) => x.name);
  } catch (e) { console.error(`[find-contacts] ContactOut failed (ok): ${e.message}`); return []; }
}

// ---- source: LinkedIn via Playwright (best-effort; often blocked) ----
async function linkedIn(lead) {
  if (!LI_EMAIL || !LI_PASS) return [];
  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    const page = await (await browser.newContext()).newPage();
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.fill('#username', LI_EMAIL);
    await page.fill('#password', LI_PASS);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
    if (/checkpoint|challenge/i.test(page.url())) throw new Error('login checkpoint');
    const q = encodeURIComponent(`${lead.company} ${lead.contact_role || ''}`.trim());
    await page.goto(`https://www.linkedin.com/search/results/people/?keywords=${q}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(3500);
    const cands = await page.$$eval('a[href*="/in/"]', (as) => as.slice(0, 8).map((a) => ({
      name: (a.innerText || '').split('\n')[0].trim(),
      linkedin_url: a.href.split('?')[0],
    })).filter((x) => x.name && x.name.length > 1));
    await browser.close();
    return cands;
  } catch (e) {
    console.error(`[find-contacts] LinkedIn failed (ok, falling through): ${e.message}`);
    try { if (browser) await browser.close(); } catch { /* noop */ }
    return [];
  }
}

// ---- source: company website via Firecrawl ----
async function websiteContacts(lead, debug) {
  if (!firecrawlKey() || !lead.website) return [];
  const base = String(lead.website).replace(/\/$/, '');
  let text = '';
  for (const u of [`${base}/contact`, `${base}/about`, base]) {
    const data = await firecrawlScrape(u, { formats: ['markdown'] }, debug);
    if (data && data.markdown) { text += '\n' + data.markdown; if (text.length > 5000) break; }
  }
  if (!text.trim()) return [];
  const res = await askClaude({
    system: 'You extract named people (with titles and emails when present) from a company web page. Return ONLY a JSON array of {name,title,email}.',
    user: `Company: ${lead.company}\nTarget role: ${lead.contact_role || ''}\n\nPage text:\n${text.slice(0, 6000)}\n\nReturn up to 8 people as JSON array.`,
    json: true, maxTokens: 700,
  });
  return Array.isArray(res) ? res.filter((x) => x && x.name).map((x) => ({ ...x, linkedin_url: x.linkedin_url || null, email: x.email || null })) : [];
}

async function pickBest(lead, candidates) {
  const res = await askClaude({
    system: 'You pick the single best contact for a B2B fabric-sales outreach, matching the target role as closely as possible. Return STRICT JSON only.',
    user: `Target role: ${lead.contact_role || 'purchasing or technical buyer'}\nCompany: ${lead.company}\nCandidates JSON:\n${JSON.stringify(candidates).slice(0, 4000)}\n\nReturn {"name","title","linkedin_url","email","confidence":"high|medium|low"} for the best match, or {} if none fit.`,
    json: true, maxTokens: 400,
  });
  if (res && res.name) return res;
  const c = candidates[0];
  return c ? { name: c.name, title: c.title || '', linkedin_url: c.linkedin_url || null, email: c.email || null, confidence: 'low' } : null;
}

async function main() {
  if (!CONTACTOUT && !(LI_EMAIL && LI_PASS) && !firecrawlKey()) {
    console.log('[find-contacts] no contact-discovery keys set (ContactOut / LinkedIn / Firecrawl) — writing nothing. Exiting 0.');
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
      let candidates = [], source = '';
      if (CONTACTOUT) { candidates = await contactOut(l); if (candidates.length) source = 'contactout'; }
      if (!candidates.length && LI_EMAIL && LI_PASS) { candidates = await linkedIn(l); if (candidates.length) source = 'linkedin'; }
      if (!candidates.length && firecrawlKey()) { candidates = await websiteContacts(l, debug); if (candidates.length) source = 'website'; }
      if (!candidates.length) continue;

      const best = await pickBest(l, candidates);
      if (!best || !best.name) continue;
      outreach[l.id] = {
        ...(outreach[l.id] || {}),
        contact: { name: best.name, title: best.title || '', linkedin_url: best.linkedin_url || null, email: best.email || null, source, confidence: best.confidence || 'medium' },
      };
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
