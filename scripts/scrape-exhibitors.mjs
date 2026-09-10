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
import { firecrawlScrape, firecrawlSearch, scrapedoGet, apiKey as firecrawlKey, haveScrapedo } from './lib/firecrawl.mjs';
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

// Score a candidate URL by how likely it is to be a real, readable exhibitor list.
function urlScore(u) {
  const s = `${u.url || ''} ${u.title || ''}`.toLowerCase();
  let n = 0;
  if (/exhibitor/.test(s)) n += 5;
  if (/exhibitors|exhibitor-list|exhibitor_list|exhibitorlist|exhibitor-directory/.test(s)) n += 4;
  // Official organizer / show sites render the full list and don't bot-block scrapers.
  if (/messefrankfurt|advancedtextiles|jeccomposites|texworld|premierevision|messe|expo|tradefair|fair|show/.test(s)) n += 3;
  if (/list|directory|catalogue|catalog/.test(s)) n += 1;
  // Aggregators frequently block automated reads (10times returned 403), so prefer them last.
  if (/10times|eventseye|expolista|visitorslist|tradefairdates/.test(s)) n -= 1;
  if (/login|signin|register|ticket|pdf$/.test(s)) n -= 3;
  return n;
}

// Find exhibitor-list text: web-search for real exhibitor-list pages, then read the best ones.
async function exhibitorText(show, debug) {
  let text = '';
  const seen = new Set();
  const candidates = [];
  const queries = [
    `${show.name} exhibitor list`,
    `${show.name} exhibitors ${show.country || ''}`.trim(),
  ];
  for (const q of queries) {
    const results = await firecrawlSearch(q, debug);
    if (Array.isArray(results)) {
      for (const r of results) {
        const url = r.url || r.link;
        if (url && !seen.has(url)) { seen.add(url); candidates.push({ url, title: r.title || '', description: r.description || '' }); }
      }
    }
    if (candidates.length >= 8) break;
  }
  // The search snippets themselves sometimes carry company names.
  text += candidates.map((c) => `${c.title} — ${c.description}`).join('\n');

  // Read the most exhibitor-list-looking pages (accumulate — don't stop on the first big page,
  // which may be a bot-wall/nav shell rather than the real list).
  const ranked = candidates.sort((a, b) => urlScore(b) - urlScore(a)).slice(0, 3);
  console.log(`[scrape-exhibitors] ${show.id}: ${candidates.length} candidate page(s); reading top ${ranked.length}: ${ranked.map((c) => c.url).join(' | ') || '(none)'}`);
  for (const c of ranked) {
    let pageText = '';
    const data = await firecrawlScrape(c.url, { formats: ['markdown'] }, debug);
    if (data && data.markdown) pageText = data.markdown;
    else if (haveScrapedo()) { const html = await scrapedoGet(c.url); if (html) pageText = html.slice(0, 6000); }
    console.log(`[scrape-exhibitors]   read ${c.url} -> ${pageText.length} chars`);
    if (pageText) text += '\n\n' + pageText;
    if (text.length > 12000) break;
  }

  // Fallback: the old direct directory search page if we still have almost nothing.
  if (text.trim().length < 400) {
    const url = `https://10times.com/search?kw=${encodeURIComponent(show.name)}`;
    const data = await firecrawlScrape(url, { formats: ['markdown'] }, debug);
    if (data && data.markdown) text += '\n' + data.markdown;
  }
  console.log(`[scrape-exhibitors] ${show.id}: total exhibitor text ${text.length} chars`);
  return text.slice(0, 12000);
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
  const system = `You classify companies for Kusumgar, a 50-year Indian technical-textile manufacturer of nylon/polyester technical fabrics, aramid/FR fabrics, coated & laminated fabrics and industrial tapes.\n\nKusumgar's product catalog:\n${catalog}\n\nClassify each company as exactly one of:\n- "potential_customer": could BUY Kusumgar fabric — brands, OEMs, converters or fabricators that USE finished technical fabric as an input (e.g. makers of bags, covers, tents, medical/emergency gear, marine or pool covers, automotive seating, protective/industrial products).\n- "competitor": MANUFACTURES finished technical fabric that competes with Kusumgar — woven/knitted/nonwoven, coated, laminated, or FR/aramid TECHNICAL FABRIC. The company must make the fabric itself.\n- "not_relevant": everyone else.\n\nIMPORTANT — these are NOT competitors; mark them "not_relevant" unless they clearly also weave/coat/laminate finished fabric:\n- chemical, dye, resin, coating or finishing-agent suppliers (e.g. Archroma, Sumitomo Chemical);\n- textile machinery / equipment / loom makers (e.g. Monforts, Starlinger);\n- fibre, filament or yarn raw-material suppliers;\n- testing labs, software, certification bodies, associations, logistics and consultancies.\nWhen unsure whether a company makes finished fabric or only supplies chemicals/machinery/fibre/services, choose "not_relevant" rather than "competitor".\n\nFor a potential_customer, pick "segment" from: ${LEAD_SEGMENTS.join(', ')}.\nFor a competitor, also judge HOW THEY COMPETE and set "positioning" to exactly one of: "Cost / Scale" (wins on low price / high volume — typical of large Chinese/South/South-East Asian mills), "Premium" (wins on high-end quality and brand), "Technology / Technical" (wins on specialised, technical or advanced-material capability), or "Regional" (a small or local player, or when you genuinely cannot tell). Base it on what you actually know about the company; use "Regional" only as a last resort.\nReturn STRICT JSON only, no prose.`;

  try {
    for (const show of targets) {
      if (classified >= MAX_COMPANIES) break;
      const text = await exhibitorText(show, debug);
      pagesUsed += 2;
      if (!text.trim()) { console.log(`[scrape-exhibitors] no exhibitor text for ${show.id}`); continue; }

      const extracted = await askClaude({
        system: 'You extract exhibitor/company names from trade-show exhibitor-list pages. Ignore navigation, menus, cookie notices and boilerplate. Return STRICT JSON of the form {"companies":["Company One","Company Two"]} and nothing else.',
        user: `Show: ${show.name}\n\nPage text:\n${text}\n\nReturn up to 30 distinct exhibitor company names as {"companies":[...]}.`,
        json: true, maxTokens: 800,
      });
      const list = Array.isArray(extracted?.companies) ? extracted.companies.filter((n) => typeof n === 'string' && n.trim()) : [];
      console.log(`[scrape-exhibitors] ${show.id}: extracted ${list.length} candidate names`);

      for (const name of list) {
        if (classified >= MAX_COMPANIES) break;
        const nm = norm(name);
        if (!nm || seen.has(nm)) continue;
        classified++;

        const c = await askClaude({
          system,
          user: `Company: ${name}\nContext: exhibitor at ${show.name} (a show held in ${show.country}; segment ${show.segment}).\nNote: the show's location is NOT the company's country — set "country" to where THIS company is actually headquartered (infer from its name/known HQ), or "-" if you truly cannot tell.\nReturn JSON: {"classification":"potential_customer|competitor|not_relevant","country":"<company's home country, or ->","segment":"<one of the listed segments or ->","fabric_fit":"<closest Kusumgar fabric or ->","priority":"High|Medium|Low","positioning":"Cost / Scale|Premium|Technology / Technical|Regional","reasoning":"<one short sentence>"}`,
          json: true, maxTokens: 400,
        });
        if (!c || !c.classification) continue;
        // Company's own HQ country (never the show's location); null when unknown.
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
            detail: 'basic', source: `exhibition:${show.id}`, type: 'potential_customer',
          });
        } else if (c.classification === 'competitor') {
          seen.add(nm);
          const POS_ALLOWED = ['Cost / Scale', 'Premium', 'Technology / Technical', 'Regional'];
          addedComps.push({
            id: slug(name), company: String(name).trim(), country: cc,
            focus: c.reasoning || '—',
            positioning: POS_ALLOWED.includes(c.positioning) ? c.positioning : 'Regional',
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
