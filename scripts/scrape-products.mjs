// Refresh the product catalog from kusumgar.com via Firecrawl.
//
// Behaviour:
//   - No FIRECRAWL_API_KEY  -> print a notice and exit 0 WITHOUT touching products.json
//     (the committed seed is preserved).
//   - With a key            -> map the site, scrape product-ish pages, and MERGE any newly
//     found products into the catalog. Seed entries are NEVER deleted. The file is only
//     rewritten when at least one genuinely new product is added, so the workflow commits
//     only on real change.
//   - Never hard-fails: any error is logged and the process still exits 0.
//
// Test hook: set KGR_PRODUCTS_PATH to point at a scratch copy of products.json.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { firecrawlScrape, firecrawlMap, apiKey } from './lib/firecrawl.mjs';

const PRODUCTS_PATH = process.env.KGR_PRODUCTS_PATH
  || fileURLToPath(new URL('../public/data/products.json', import.meta.url));

const FAMILY_ORDER = ['Nylon Fabrics', 'Polyester Fabrics', 'Aramid & FR Fabrics', 'Coated & Laminated', 'Industrial Textiles & Tapes'];
const SEGMENTS = ['Aeronautical', 'Military & Tactical', 'Industrial', 'Workwear & Safety', 'Automotive', 'Medical & Emergency', 'Outdoor', 'Marine'];
const OTHER_FAMILY = 'Other Kusumgar Fabrics';

const MAX_PAGES = 15;
const URL_KEYWORDS = ['product', 'fabric', 'coat', 'laminat', 'aramid', 'nylon', 'polyester', 'tape', 'application', 'capabilit'];

const PRODUCT_SCHEMA = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          base_material: { type: 'string' },
          coatings: { type: 'array', items: { type: 'string' } },
          applications: { type: 'array', items: { type: 'string' } },
          segments: { type: 'array', items: { type: 'string' } },
          description: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => norm(s).replace(/\s+/g, '-').slice(0, 60);
const segShort = (s) => s.split(' & ')[0];
const familyRank = (f) => { const i = FAMILY_ORDER.indexOf(f); return i < 0 ? FAMILY_ORDER.length : i; };

// Map free text to the closest fabric family (order matters: FR/aramid & tapes win first).
function mapFamily(text) {
  const t = text.toLowerCase();
  if (/aramid|modacrylic|flame|\bfr\b|fire.?retard|nomex|kevlar/.test(t)) return 'Aramid & FR Fabrics';
  if (/tape|belt|harness|webbing|\bdip\b|\brfl\b|reinforce/.test(t)) return 'Industrial Textiles & Tapes';
  if (/coat|laminat|calender|silicone|pvc/.test(t)) return 'Coated & Laminated';
  if (/nylon/.test(t)) return 'Nylon Fabrics';
  if (/polyester|\bpet\b/.test(t)) return 'Polyester Fabrics';
  return OTHER_FAMILY;
}

// Map raw segment hints + free text to the 8-segment taxonomy.
function mapSegments(raw, text) {
  const out = new Set();
  const hay = `${(raw || []).join(' ')} ${text}`.toLowerCase();
  SEGMENTS.forEach((s) => {
    if (hay.includes(s.toLowerCase()) || hay.includes(segShort(s).toLowerCase())) out.add(s);
  });
  const rules = [
    ['Aeronautical', /aero|avia|parachute|balloon|paraglid|\bkite\b|aircraft|drogue/],
    ['Military & Tactical', /militar|defen[cs]e|tactical|\barmy\b|ballistic|armou?r|combat/],
    ['Industrial', /industr|conveyor|tarpaul|hose|equipment/],
    ['Workwear & Safety', /workwear|hi-?vis|coverall|\bppe\b|uniform|arc.?flash/],
    ['Automotive', /automotiv|vehicle|seat|wire.?harness|ty[re]e|railway|rolling.?stock/],
    ['Medical & Emergency', /medic|hospital|mattress|emergency|ambulance/],
    ['Outdoor', /outdoor|camp|tent|backpack|\bsport/],
    ['Marine', /marine|\bboat\b|raft|nautical|\bsail\b/],
  ];
  rules.forEach(([seg, re]) => { if (re.test(hay)) out.add(seg); });
  return [...out];
}

async function loadExisting() {
  try {
    const raw = JSON.parse(await readFile(PRODUCTS_PATH, 'utf8'));
    return Array.isArray(raw) ? raw : (raw.products || []);
  } catch (err) {
    console.error(`[scrape-products] could not read ${PRODUCTS_PATH}: ${err.message}`);
    return [];
  }
}

function looksProductish(entry) {
  const hay = `${entry.url || ''} ${entry.title || ''}`.toLowerCase();
  return URL_KEYWORDS.some((k) => hay.includes(k));
}

async function main() {
  const existing = await loadExisting();

  if (!apiKey()) {
    console.log('[scrape-products] FIRECRAWL_API_KEY not set — keeping seed catalog untouched (' + existing.length + ' products). Exiting 0.');
    return;
  }

  const debug = [];
  let pagesUsed = 0;
  const added = [];
  const seen = new Set(existing.map((p) => norm(p.name)));

  try {
    // 1) Map the site to candidate URLs.
    const links = (await firecrawlMap('https://www.kusumgar.com', debug)) || [];
    const candidates = links
      .map((l) => (typeof l === 'string' ? { url: l } : { url: l.url, title: l.title }))
      .filter((l) => l.url && looksProductish(l))
      .slice(0, MAX_PAGES);
    console.log(`[scrape-products] mapped ${links.length} URLs, ${candidates.length} look product-ish`);

    // 2) Scrape each candidate for structured products.
    for (const c of candidates) {
      const data = await firecrawlScrape(c.url, { formats: ['json'], jsonSchema: PRODUCT_SCHEMA }, debug);
      pagesUsed++;
      const found = (data && data.json && Array.isArray(data.json.products)) ? data.json.products : [];
      for (const f of found) {
        const nm = norm(f.name);
        if (!nm || seen.has(nm)) continue;
        seen.add(nm);
        const text = [f.name, f.base_material, f.description, (f.applications || []).join(' '), (f.segments || []).join(' ')].join(' ');
        added.push({
          id: slug(f.name),
          family: mapFamily(text),
          name: String(f.name).trim(),
          base: f.base_material || '',
          deniers: '—',
          coatings: Array.isArray(f.coatings) ? f.coatings : [],
          properties: [],
          segments: mapSegments(f.segments, text),
          applications: Array.isArray(f.applications) ? f.applications : [],
          source: 'kusumgar.com',
        });
      }
    }
  } catch (err) {
    console.error(`[scrape-products] pipeline error (continuing): ${err.message}`);
  }

  if (added.length === 0) {
    console.log(`[scrape-products] no new products found across ${pagesUsed} page(s); leaving products.json unchanged.`);
    return;
  }

  // 3) Merge (seed always kept), sort by family then name, write with pipeline meta.
  const merged = [...existing, ...added].sort(
    (a, b) => (familyRank(a.family) - familyRank(b.family)) || a.name.localeCompare(b.name),
  );
  const out = {
    products: merged,
    _meta: { scraped_at: new Date().toISOString(), pages_used: pagesUsed, added_count: added.length },
    _debug: debug.slice(-20),
  };
  await writeFile(PRODUCTS_PATH, JSON.stringify(out, null, 2) + '\n');
  console.log(`[scrape-products] added ${added.length} product(s): ${added.map((p) => p.name).join(', ')}`);
}

main()
  .catch((err) => { console.error('[scrape-products] unexpected error (exiting 0):', err); })
  .finally(() => process.exit(0));
