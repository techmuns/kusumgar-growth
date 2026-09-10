// Category finder — grows leads.json + competitors.json by searching the OPEN WEB for
// companies that make specific products, independent of any trade show.
//
// Why: most pure-defence shows (DSEI, Eurosatory, IDEX…) never publish exhibitor lists,
// so the show-scraper finds nothing there. But the *companies* we want (makers of tactical
// bags, body-armour carriers, tents, parachutes, FR uniforms…) are all over the open web.
// This finds them by PRODUCT CATEGORY instead of by show roster.
//
// Flow (per run):
//   1. Take category queries (CATEGORIES env, "|"-separated, or the defence defaults). Cap a few.
//   2. For each, web-search + read the best pages to get a block of company text.
//   3. askClaude to extract clean company names.
//   4. askClaude to classify each (same rubric as the show scraper) → strict JSON.
//   5. Append potential_customer → leads.json, competitor → competitors.json.
//      DEDUPE by normalized name; NEVER modify/delete seed rows; not_relevant → skip.
//
// Graceful: missing FIRECRAWL_API_KEY or BEDROCK_API_KEY → log and exit 0, files untouched.
// Writes a file only when it gains rows (so the workflow commits only on change). Never hard-fails.
//
// Test hooks: KGR_LEADS_PATH / KGR_COMPETITORS_PATH / KGR_PRODUCTS_PATH.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { firecrawlSearch, firecrawlScrape, scrapedoGet, apiKey as firecrawlKey, haveScrapedo } from './lib/firecrawl.mjs';
import { askClaude, haveBedrock } from './lib/llm.mjs';

const p = (envName, rel) => process.env[envName] || fileURLToPath(new URL(rel, import.meta.url));
const LEADS_PATH = p('KGR_LEADS_PATH', '../public/data/leads.json');
const COMPETITORS_PATH = p('KGR_COMPETITORS_PATH', '../public/data/competitors.json');
const PRODUCTS_PATH = p('KGR_PRODUCTS_PATH', '../public/data/products.json');

// Defence-textile buyer categories (editable via the CATEGORIES workflow input).
const DEFAULT_CATEGORIES = [
  'military tactical bag and pack manufacturers',
  'ballistic vest and body armour plate carrier manufacturers',
  'military tent and shelter system manufacturers',
  'parachute and aerial delivery equipment manufacturers',
  'flame-resistant military combat uniform manufacturers',
  'load-bearing MOLLE webbing and pouch manufacturers',
  'military inflatable boat and RIB manufacturers',
  'tactical backpack and rucksack manufacturers',
];

const CATEGORIES = (process.env.CATEGORIES || DEFAULT_CATEGORIES.join('|'))
  .split('|').map((s) => s.trim()).filter(Boolean);
const MAX_CATEGORIES = Math.max(1, parseInt(process.env.MAX_CATEGORIES || '4', 10) || 4);
const MAX_COMPANIES = Math.max(1, parseInt(process.env.MAX_COMPANIES || '40', 10) || 40);
const LEAD_SEGMENTS = ['Tool & Equipment Bags', 'Medical & Emergency', 'Marine Covers', 'Pool & Outdoor Covers', 'Protective Covers & Industrial', 'Automotive Seating'];

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => norm(s).replace(/\s+/g, '-').slice(0, 60);

async function loadArr(path, key) {
  try {
    const raw = JSON.parse(await readFile(path, 'utf8'));
    return Array.isArray(raw) ? raw : (raw[key] || []);
  } catch (err) {
    console.error(`[find-buyers] could not read ${path}: ${err.message}`);
    return [];
  }
}

// Gather company-listing text for a category: web-search, then read the best few pages.
async function categoryText(query, debug) {
  let text = '';
  const seen = new Set();
  const candidates = [];
  for (const q of [query, `${query} directory`]) {
    const results = await firecrawlSearch(q, debug);
    if (Array.isArray(results)) {
      for (const r of results) {
        const url = r.url || r.link;
        if (url && !seen.has(url)) { seen.add(url); candidates.push({ url, title: r.title || '', description: r.description || '' }); }
      }
    }
    if (candidates.length >= 10) break;
  }
  text += candidates.map((c) => `${c.title} — ${c.description}`).join('\n');
  for (const c of candidates.slice(0, 4)) {
    let pageText = '';
    const data = await firecrawlScrape(c.url, { formats: ['markdown'] }, debug);
    if (data && data.markdown) pageText = data.markdown;
    else if (haveScrapedo()) { const html = await scrapedoGet(c.url); if (html) pageText = html.slice(0, 6000); }
    if (pageText) text += '\n\n' + pageText;
    if (text.length > 12000) break;
  }
  return text.slice(0, 12000);
}

async function main() {
  const [products, seedLeads, seedComps] = await Promise.all([
    loadArr(PRODUCTS_PATH, 'products'),
    loadArr(LEADS_PATH, 'leads'),
    loadArr(COMPETITORS_PATH, 'competitors'),
  ]);

  if (!firecrawlKey() || !haveBedrock()) {
    console.log(`[find-buyers] FIRECRAWL_API_KEY and/or BEDROCK_API_KEY missing — leaving ${seedLeads.length} leads / ${seedComps.length} competitors untouched. Exiting 0.`);
    return;
  }

  const targets = CATEGORIES.slice(0, MAX_CATEGORIES);
  console.log(`[find-buyers] categories: ${targets.join(' | ')}`);

  const debug = [];
  const seen = new Set([...seedLeads, ...seedComps].map((r) => norm(r.company)));
  const addedLeads = [];
  const addedComps = [];
  let classified = 0;

  const catalog = products.map((pr) => `- ${pr.name} (${pr.family}; serves ${(pr.segments || []).join(', ')})`).join('\n');
  const system = `You classify companies for Kusumgar, a 50-year Indian technical-textile manufacturer of nylon/polyester technical fabrics, aramid/FR fabrics, coated & laminated fabrics and industrial tapes.\n\nKusumgar's product catalog:\n${catalog}\n\nClassify each company as exactly one of:\n- "potential_customer": could BUY Kusumgar fabric — brands, OEMs, converters or fabricators that USE finished technical fabric as an input.\n- "competitor": MANUFACTURES finished technical fabric that competes with Kusumgar (woven/knitted/nonwoven, coated, laminated, FR/aramid). The company must make the fabric itself.\n- "not_relevant": everyone else (chemical/dye/machinery/fibre/yarn suppliers, testing labs, software, associations, retailers, distributors). When unsure, choose "not_relevant".\nFor a potential_customer pick "segment" from: ${LEAD_SEGMENTS.join(', ')}.\nFor a competitor set "positioning" to one of: "Cost / Scale", "Premium", "Technology / Technical", "Regional".\nSet "country" to the company's own home country (or "-" if unknown). Return STRICT JSON only, no prose.`;

  try {
    for (const query of targets) {
      if (classified >= MAX_COMPANIES) break;
      const text = await categoryText(query, debug);
      if (!text.trim()) { console.log(`[find-buyers] no text for "${query}"`); continue; }

      const extracted = await askClaude({
        system: 'You extract company/manufacturer names from web pages and directories. Ignore navigation, ads and boilerplate. Return STRICT JSON of the form {"companies":["Company One","Company Two"]} and nothing else.',
        user: `Product category: ${query}\n\nPage text:\n${text}\n\nReturn up to 25 distinct manufacturer/brand names that make products in this category, as {"companies":[...]}.`,
        json: true, maxTokens: 800,
      });
      const list = Array.isArray(extracted?.companies) ? extracted.companies.filter((n) => typeof n === 'string' && n.trim()) : [];
      const catSlug = slug(query);
      console.log(`[find-buyers] "${query}": extracted ${list.length} candidate names`);

      for (const name of list) {
        if (classified >= MAX_COMPANIES) break;
        const nm = norm(name);
        if (!nm || seen.has(nm)) continue;
        classified++;

        const c = await askClaude({
          system,
          user: `Company: ${name}\nContext: found while searching for "${query}".\nReturn JSON: {"classification":"potential_customer|competitor|not_relevant","country":"<home country or ->","segment":"<one of the listed segments or ->","fabric_fit":"<closest Kusumgar fabric or ->","priority":"High|Medium|Low","positioning":"Cost / Scale|Premium|Technology / Technical|Regional","reasoning":"<one short sentence>"}`,
          json: true, maxTokens: 400,
        });
        if (!c || !c.classification) continue;
        const cc = (typeof c.country === 'string' && c.country.trim() && !/^-+$/.test(c.country.trim())) ? c.country.trim() : null;

        if (c.classification === 'potential_customer') {
          seen.add(nm);
          addedLeads.push({
            id: slug(name), company: String(name).trim(),
            segment: c.segment && c.segment !== '-' ? c.segment : 'Protective Covers & Industrial',
            country: cc, website: null,
            application: null, fabric_fit: c.fabric_fit && c.fabric_fit !== '-' ? c.fabric_fit : null,
            est_consumption: null, sourcing_model: null, contact_role: null,
            priority: ['High', 'Medium', 'Low'].includes(c.priority) ? c.priority : 'Medium',
            detail: 'basic', source: `category:${catSlug}`, type: 'potential_customer',
          });
        } else if (c.classification === 'competitor') {
          seen.add(nm);
          const POS_ALLOWED = ['Cost / Scale', 'Premium', 'Technology / Technical', 'Regional'];
          addedComps.push({
            id: slug(name), company: String(name).trim(), country: cc,
            focus: c.reasoning || '—',
            positioning: POS_ALLOWED.includes(c.positioning) ? c.positioning : 'Regional',
            segments: c.segment && c.segment !== '-' ? [c.segment] : [],
            source: `category:${catSlug}`,
          });
        }
        // not_relevant → skip
      }
    }
  } catch (err) {
    console.error(`[find-buyers] pipeline error (continuing): ${err.message}`);
  }

  const meta = { scraped_at: new Date().toISOString(), categories: targets, classified, added_leads: addedLeads.length, added_competitors: addedComps.length };

  if (addedLeads.length) {
    await writeFile(LEADS_PATH, JSON.stringify({ leads: [...seedLeads, ...addedLeads], _meta: meta, _debug: debug.slice(-20) }, null, 2) + '\n');
    console.log(`[find-buyers] added ${addedLeads.length} lead(s).`);
  }
  if (addedComps.length) {
    await writeFile(COMPETITORS_PATH, JSON.stringify({ competitors: [...seedComps, ...addedComps], _meta: meta, _debug: debug.slice(-20) }, null, 2) + '\n');
    console.log(`[find-buyers] added ${addedComps.length} competitor(s).`);
  }
  if (!addedLeads.length && !addedComps.length) {
    console.log(`[find-buyers] no new companies after classifying ${classified}; files unchanged.`);
  }
}

main()
  .catch((err) => { console.error('[find-buyers] unexpected error (exiting 0):', err); })
  .finally(() => process.exit(0));
