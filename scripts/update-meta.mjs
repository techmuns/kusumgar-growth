// Recompute public/data/meta.json (live counts + a fresh updated_at) from the current data files.
//
// Aggregation/labeling ONLY — it never touches leads/outreach content or how any finder works.
// Run at the END of each engine (right before committing) so the dashboard's header totals and
// "Updated" date always reflect the last real refresh instead of a stale hardcoded value.
//
// Test hook: KGR_DATA_DIR points the reader/writer at an alternate data directory.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = process.env.KGR_DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');

const load = async (file, fallback) => {
  try { return JSON.parse(await readFile(path.join(DATA_DIR, file), 'utf8')); }
  catch { return fallback; }
};
const arr = (raw, key) => (Array.isArray(raw) ? raw : (raw && raw[key]) || []);

// Mirror the dashboard's email classification exactly, so meta's counts match what Nishad sees.
const REAL = new Set(['verified', 'verified (manual)', 'published']);
const GENERIC = new Set(['info', 'sales', 'contact', 'support', 'service', 'admin', 'hello', 'enquiries', 'enquiry', 'dealers', 'orders', 'marketing', 'pr', 'help', 'team', 'office', 'mail', 'careers']);
const local = (email) => String(email || '').toLowerCase().trim().split('@')[0] || '';
const has = (email) => typeof email === 'string' && email.includes('@');
const isCompany = (email) => {
  const lp = local(email); if (!lp) return false;
  const base = lp.replace(/[._+-].*$/, '').replace(/\d+$/, '');
  return GENERIC.has(lp) || GENERIC.has(base);
};
const looksPersonal = (email, name) => {
  const lp = local(email); if (!lp) return false;
  if (/^[a-z]+[._-][a-z]{2,}/.test(lp)) return true;
  if (name) {
    const toks = String(name).toLowerCase().match(/[a-z]{2,}/g) || [];
    const bare = lp.replace(/[^a-z]/g, '');
    if (toks.some((t) => t.length >= 3 && bare.includes(t))) return true;
    if (toks.length >= 2 && bare.startsWith(toks[0][0]) && bare.includes(toks[toks.length - 1])) return true;
  }
  return false;
};
function classify(c) {
  const email = c && c.email; const st = c && c.email_status;
  if (!has(email) || !REAL.has(st)) return 'none';
  if (isCompany(email)) return 'company';
  if (st === 'verified' || st === 'verified (manual)') return 'verified';
  if (looksPersonal(email, c.name)) return 'personal';
  return 'company';
}

async function main() {
  const exhibitions = arr(await load('exhibitions.json', []), 'exhibitions');
  const products = arr(await load('products.json', []), 'products');
  const leads = arr(await load('leads.json', []), 'leads');
  const competitors = arr(await load('competitors.json', []), 'competitors');
  const outreachRaw = await load('outreach.json', {});
  const outreach = (outreachRaw && typeof outreachRaw === 'object' && !Array.isArray(outreachRaw)) ? outreachRaw : {};
  const research = arr(await load('research_targets.json', {}), 'targets');
  const ids = new Set(leads.map((l) => l && l.id).filter(Boolean));

  let drafted = 0, contacts = 0, personalVerified = 0, companyInbox = 0, needContact = 0;
  for (const id of ids) {
    const v = outreach[id] || {};
    if (v.email && v.email.subject) drafted++;
    const c = v.contact || null;
    if (c && c.name) contacts++;
    const cls = classify(c || {});
    if (cls === 'verified' || cls === 'personal') personalVerified++;
    else if (cls === 'company') companyInbox++;
    else needContact++;
  }

  // "Sources" = distinct engine source tags (exhibition:<id> / category:<slug>) that fed leads/competitors.
  const srcs = new Set();
  const addSrc = (row) => { const s = String(row && row.source || ''); if (s.startsWith('exhibition') || s.startsWith('category')) srcs.add(s); };
  leads.forEach(addSrc); competitors.forEach(addSrc);

  const meta = {
    updated_at: new Date().toISOString(),
    exhibitions_total: exhibitions.length,
    products_total: products.length,
    leads_total: leads.length,
    competitors_total: competitors.length,
    drafted_count: drafted,
    contacts_found_count: contacts,
    personal_verified_count: personalVerified,
    company_inbox_count: companyInbox,
    need_contact_count: needContact,
    sources_total: srcs.size,
    research_targets_total: research.length,
    research_verified_count: research.filter((t) => t && t.verified === true && t.product_confirmed === true).length,
  };

  await writeFile(path.join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  console.log(`[update-meta] wrote meta.json — ${JSON.stringify(meta)}`);
}

main().catch((err) => { console.error('[update-meta] error (exiting 0):', err); }).finally(() => process.exit(0));
