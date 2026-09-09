// Classify engine — grows leads.json and competitors.json from exhibition exhibitor lists.
//
// Flow (per run):
//   1. Pick target exhibitions (TARGET ids, or "auto" = shows Kusumgar already engages). Cap a few.
//   2. For each, use Firecrawl to fetch exhibitor-list text (10times.com / eventseye.com search).
//   3. askClaude to extract a clean company-name list from that text.
//   4. askClaude to classify each company (with Kusumgar's product catalog as context) →
//      strict JSON {classification, segment, fabric_fit, priority, reasoning}.
//   5. Append potential_customer → leads.json, competitor → competitors.json.
//      DEDUPE by normalized company name; NEVER modify/delete seed rows; not_relevant → skip.
//
// Graceful: missing FIRECRAWL_API_KEY or BEDROCK_API_KEY → log and exit 0, files untouched.
// Writes a file only when it actually gains rows (so the workflow commits only on change).
// Never hard-fails.
//
// Test hooks: KGR_LEADS_PATH / KGR_COMPETITORS_PATH / KGR_EXHIBITIONS_PATH / KGR_PRODUCTS_PATH.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { firecrawlScrape, apiKey as firecrawlKey } from './lib/firecrawl.mjs';
import { askClaude, haveBedrock } from './lib/llm.mjs';

const p = (envName, rel) => process.env[envName] || fileURLToPath(new URL(rel, import.meta.url));
const LEADS_PATH = p('KGR_LEADS_PATH', '../public/data/leads.json');
const COMPETITORS_PATH = p('KGR_COMPETITORS_PATH', '../public/data/competitors.json');
const EXHIBITIONS_PATH = p('KGR_EXHIBITIONS_PATH', '../public/data/exhibitions.json');
const PRODUCTS_PATH = p('KGR_PRODUCTS_PATH', '../public/data/products.json');

const TARGET = process.env.TARGET || 'auto';
const MAX_COMPANIES = Math.max(1, parseInt(process.env.MAX_COMPANIES || '40', 10) || 40);
const MAX_TARGETS = 3;              // a few exhibitions per run (cost control)
const ENGAGED = new Set(['Exhibited', 'Visited', 'Attended']);
const LEAD_SEGMENTS = ['Tool & Equipment Bags', 'Medical & Emergency', 'Marine Covers', 'Pool & Outdoor Covers', 'Protective Covers & Industrial', 'Automotive Seating'];

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => norm(s).replace(/\s+/g, '-').slice(0, 60);

async function loadArr(path, key) {
  try {
    const raw = JSON.parse(await readFile(path, 'utf8'));
    return Array.isArray(raw) ? raw : (raw[key] || []);
  } catch (err) {
    console.error(`[scrape-exhibitors] could not read ${path}: ${err.message}`);
    return [];
  }
}

async function exhibitorText(show, debug) {
  const queries = [
    `https://10times.com/search?kw=${encodeURIComponent(show.name)}`,
    `https://www.eventseye.com/fairs/searchresult.php?keyword=${encodeURIComponent(show.name)}`,
  ];
  let text = '';
  for (const url of queries) {
    const data = await firecrawlScrape(url, { formats: ['markdown'] }, debug);
    if (data && data.markdown) {
      text += '\n' + data.markdown;
      if (text.length > 6000) break;
    }
  }
  return text.slice(0, 8000);
}

async function main() {
  const [exhibitions, products, seedLeads, seedComps] = await Promise.all([
    loadArr(EXHIBITIONS_PATH, 'exhibitions'),
    loadArr(PRODUCTS_PATH, 'products'),
    loadArr(LEADS_PATH, 'leads'),
    loadArr(COMPETITORS_PATH, 'competitors'),
  ]);

  if (!firecrawlKey() || !haveBedrock()) {
    console.log(`[scrape-exhibitors] FIRECRAWL_API_KEY and/or BEDROCK_API_KEY missing — leaving ${seedLeads.length} leads / ${seedComps.length} competitors untouched. Exiting 0.`);
    return;
  }

  // 1) Choose targets.
  let targets;
  if (TARGET && TARGET !== 'auto') {
    const ids = TARGET.split(',').map((s) => s.trim()).filter(Boolean);
    targets = exhibitions.filter((e) => ids.includes(e.id));
  } else {
    targets = exhibitions.filter((e) => ENGAGED.has(e.status));
  }
  targets = targets.slice(0, MAX_TARGETS);
  console.log(`[scrape-exhibitors] targets: ${targets.map((t) => t.id).join(', ') || '(none)'}`);

  const debug = [];
  const seen = new Set([...seedLeads, ...seedComps].map((r) => norm(r.company)));
  const addedLeads = [];
  const addedComps = [];
  let classified = 0;
  let pagesUsed = 0;

  const catalog = products.map((pr) => `- ${pr.name} (${pr.family}; serves ${(pr.segments || []).join(', ')})`).join('\n');
  const system = `You classify companies for Kusumgar, a 50-year Indian technical-textile manufacturer of nylon/polyester technical fabrics, aramid/FR fabrics, coated & laminated fabrics and industrial tapes.\n\nKusumgar's product catalog:\n${catalog}\n\nClassify each company as:\n- "potential_customer": could BUY Kusumgar fabric (brands/OEMs/converters that use technical fabric).\n- "competitor": makes similar technical/coated/laminated fabric.\n- "not_relevant": neither.\nFor a potential_customer, pick "segment" from: ${LEAD_SEGMENTS.join(', ')}. Return STRICT JSON only, no prose.`;

  try {
    for (const show of targets) {
      if (classified >= MAX_COMPANIES) break;
      const text = await exhibitorText(show, debug);
      pagesUsed += 2;
      if (!text.trim()) { console.log(`[scrape-exhibitors] no exhibitor text for ${show.id}`); continue; }

      const names = await askClaude({
        system: 'You extract exhibitor/company names from trade-show pages. Return ONLY a JSON array of distinct company-name strings.',
        user: `Show: ${show.name}\n\nPage text:\n${text}\n\nReturn a JSON array of up to 30 company names.`,
        json: true, maxTokens: 800,
      });
      const list = Array.isArray(names) ? names.filter((n) => typeof n === 'string' && n.trim()) : [];
      console.log(`[scrape-exhibitors] ${show.id}: extracted ${list.length} candidate names`);

      for (const name of list) {
        if (classified >= MAX_COMPANIES) break;
        const nm = norm(name);
        if (!nm || seen.has(nm)) continue;
        classified++;

        const c = await askClaude({
          system,
          user: `Company: ${name}\nContext: exhibitor at ${show.name} (segment ${show.segment}, ${show.country}).\nReturn JSON: {"classification":"potential_customer|competitor|not_relevant","segment":"<one of the listed segments or ->","fabric_fit":"<closest Kusumgar fabric or ->","priority":"High|Medium|Low","reasoning":"<one short sentence>"}`,
          json: true, maxTokens: 400,
        });
        if (!c || !c.classification) continue;

        if (c.classification === 'potential_customer') {
          seen.add(nm);
          addedLeads.push({
            id: slug(name), company: String(name).trim(),
            segment: c.segment && c.segment !== '-' ? c.segment : 'Protective Covers & Industrial',
            country: show.country || null, website: null,
            application: null, fabric_fit: c.fabric_fit && c.fabric_fit !== '-' ? c.fabric_fit : null,
            est_consumption: null, sourcing_model: null, contact_role: null,
            priority: ['High', 'Medium', 'Low'].includes(c.priority) ? c.priority : 'Medium',
            detail: 'basic', source: `exhibition:${show.id}`, type: 'potential_customer',
          });
        } else if (c.classification === 'competitor') {
          seen.add(nm);
          addedComps.push({
            id: slug(name), company: String(name).trim(), country: show.country || null,
            focus: c.reasoning || '—', positioning: 'Regional',
            segments: c.segment && c.segment !== '-' ? [c.segment] : [],
            source: `exhibition:${show.id}`,
          });
        }
        // not_relevant → skip
      }
    }
  } catch (err) {
    console.error(`[scrape-exhibitors] pipeline error (continuing): ${err.message}`);
  }

  const meta = { scraped_at: new Date().toISOString(), targets: targets.map((t) => t.id), pages_used: pagesUsed, classified, added_leads: addedLeads.length, added_competitors: addedComps.length };
  const trimmedDebug = debug.slice(-20);

  if (addedLeads.length) {
    await writeFile(LEADS_PATH, JSON.stringify({ leads: [...seedLeads, ...addedLeads], _meta: meta, _debug: trimmedDebug }, null, 2) + '\n');
    console.log(`[scrape-exhibitors] added ${addedLeads.length} lead(s).`);
  }
  if (addedComps.length) {
    await writeFile(COMPETITORS_PATH, JSON.stringify({ competitors: [...seedComps, ...addedComps], _meta: meta, _debug: trimmedDebug }, null, 2) + '\n');
    console.log(`[scrape-exhibitors] added ${addedComps.length} competitor(s).`);
  }
  if (!addedLeads.length && !addedComps.length) {
    console.log(`[scrape-exhibitors] no new companies after classifying ${classified}; files unchanged.`);
  }
}

main()
  .catch((err) => { console.error('[scrape-exhibitors] unexpected error (exiting 0):', err); })
  .finally(() => process.exit(0));
