// Pulls the REAL global coated-fabric trade market from UN Comtrade (free, keyless) and writes
// public/data/market_intel.json. Every figure is a value the API actually returned, and every block
// keeps the exact query URL it came from as its source.
//
// HARD RULE: real trade data ONLY. Never model, estimate, interpolate, or invent a market number.
// Store only what the API returns; keep the source URL on every block; on any fetch error keep the
// previous file untouched and exit 0. Nothing here is a guess.
//
// Two layers, both real:
//   1) HEADLINE = the latest *complete* annual year, auto-detected (no hardcoded year). Trade data
//      takes 12–18 months to fill in, so a naive "newest year" understates the market (e.g. 2025
//      annual is missing China, which is ~45% of world exports). A year Y is accepted only if the
//      bellwether reporters China (156) AND USA (842) each reported a plausible full-year value
//      (> $50M for HS 5903) AND Y's world import total is >= 60% of (Y-1)'s. This self-upgrades to
//      2025, 2026, … automatically as each year fills in. For HS 5903 and HS 5903.20.
//   2) RECENT (MONTHLY) = the last 12 available months of world imports/exports, labelled provisional
//      (recent months get revised; China does not report monthly). Kept SEPARATE so it never
//      contaminates the reliable complete-year headline.
//
// The preview endpoint caps at 500 rows, so we request the fully-aggregated row per reporter
// (partner2Code=0 & customsCode=C00 & motCode=0) — ONE total row per country, well under the cap.
// It also rate-limits, so every request is throttled and retried on 429/5xx.
//
// Optional COMTRADE_KEY (Ocp-Apim-Subscription-Key) lifts the cap; not required — keyless is default.
// Test hook: KGR_MARKET_PATH points the writer at an alternate file.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const MARKET_PATH = process.env.KGR_MARKET_PATH || fileURLToPath(new URL('../public/data/market_intel.json', import.meta.url));
const KEY = process.env.COMTRADE_KEY || '';
const AGG = 'partner2Code=0&customsCode=C00&motCode=0'; // one clean aggregate row per reporting country
const REPORTERS_URL = 'https://comtradeapi.un.org/files/v1/app/reference/Reporters.json';

const CHINA = 156, USA = 842;            // bellwether reporters for "is this annual year complete?"
const BELLWETHER_MIN = 50e6;             // each must report > $50M for HS 5903 to count the year complete
const YEAR_COVERAGE_MIN = 0.60;          // Y's world import total must be >= 60% of (Y-1)'s
const MONTH_REPORTERS_MIN = 30;          // a month needs this many reporters to be "covered"
const MONTHS_BACK = 12;                  // size of the recent monthly window

const COMMODITIES = [
  { key: 'hs5903', code: '5903', label: 'All coated fabric (HS 5903)' },
  { key: 'hs590320', code: '590320', label: 'Polyurethane-coated (HS 5903.20) — closest to Kusumgar 600D PU' },
];

const annualUrl = (code, flow, year) => `https://comtradeapi.un.org/public/v1/preview/C/A/HS?cmdCode=${code}&flowCode=${flow}&partnerCode=0&${AGG}&period=${year}`;
const monthlyUrl = (code, flow, period) => `https://comtradeapi.un.org/public/v1/preview/C/M/HS?cmdCode=${code}&flowCode=${flow}&partnerCode=0&${AGG}&period=${period}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastReq = 0;
const MIN_GAP = 700; // ms between requests — the preview endpoint rate-limits bursts
async function throttle() { const gap = Date.now() - lastReq; if (gap < MIN_GAP) await sleep(MIN_GAP - gap); lastReq = Date.now(); }

async function fetchJson(url, label) {
  const headers = { accept: 'application/json' };
  if (KEY) headers['Ocp-Apim-Subscription-Key'] = KEY;
  for (let attempt = 1; attempt <= 5; attempt++) {
    await throttle();
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(45_000) });
      if (res.status === 429 || res.status >= 500) {
        console.log(`[market-intel] ${label} -> ${res.status} (retry ${attempt})`);
        if (attempt === 5) return null;
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      if (!res.ok) { console.log(`[market-intel] ${label} -> ${res.status} (giving up)`); return null; }
      return await res.json();
    } catch (e) {
      console.error(`[market-intel] ${label} attempt ${attempt} failed: ${e.message}`);
      if (attempt === 5) return null;
      await sleep(1000 * 2 ** (attempt - 1));
    }
  }
  return null;
}

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

// ISO alpha-2 → region. Standard reference data (6-region model; Central America + Caribbean under
// North America). Used only to group the API's own import values — it never creates a value.
const REGION_ISO2 = {};
const addRegion = (region, codes) => codes.trim().split(/\s+/).forEach((c) => { REGION_ISO2[c] = region; });
addRegion('Asia', 'AF AM AZ BH BD BT BN KH CN CY GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE');
addRegion('Europe', 'AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR HU IS IE IM IT XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA GG JE');
addRegion('North America', 'AG BS BB BZ BM CA CR CU DM DO SV GL GD GT HT HN JM MX NI PA KN LC VC TT US AW KY PR VG VI TC CW SX BQ MQ GP BL MF AI MS');
addRegion('South America', 'AR BO BR CL CO EC FK GF GY PY PE SR UY VE');
addRegion('Africa', 'DZ AO BJ BW BF BI CM CV CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW');
addRegion('Oceania', 'AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV VU WF');
const regionOf = (iso2) => REGION_ISO2[String(iso2 || '').toUpperCase()] || 'Other';

// One clean {code,country,iso2,value,netWgt} per reporting country (0 = World reporter is dropped).
function rowsFrom(payload, reporters) {
  const data = (payload && payload.data) || [];
  const out = [];
  for (const r of data) {
    const code = r.reporterCode;
    if (code === 0 || code == null) continue;
    const value = num(r.primaryValue);
    if (value <= 0) continue;
    const ref = reporters.get(code);
    out.push({ code, country: (ref && ref.name) || String(r.reporterDesc || `#${code}`), iso2: (ref && ref.iso2) || String(r.reporterISO || ''), value, netWgt: num(r.netWgt) });
  }
  out.sort((a, b) => b.value - a.value);
  return out;
}

// World totals from a raw payload (per-reporter values summed; used for year detection + monthly).
function worldTotal(payload) {
  const data = (payload && payload.data) || [];
  const byCode = {}; let value = 0, netWgt = 0; const reps = new Set();
  for (const r of data) {
    if (r.reporterCode === 0 || r.reporterCode == null) continue;
    const v = num(r.primaryValue); if (v <= 0) continue;
    byCode[r.reporterCode] = (byCode[r.reporterCode] || 0) + v; value += v; netWgt += num(r.netWgt); reps.add(r.reporterCode);
  }
  return { value, netWgt, reporters: reps.size, byCode };
}

function regionSplit(importers, worldValue) {
  const by = new Map();
  for (const it of importers) { const region = regionOf(it.iso2); by.set(region, (by.get(region) || 0) + it.value); }
  const total = worldValue || [...by.values()].reduce((s, v) => s + v, 0) || 1;
  return [...by.entries()].map(([region, value]) => ({ region, value, pct: Math.round((value / total) * 1000) / 10 })).sort((a, b) => b.value - a.value);
}

async function loadReporters() {
  const payload = await fetchJson(REPORTERS_URL, 'Reporters.json');
  const list = payload && (payload.results || payload.data || (Array.isArray(payload) ? payload : null));
  if (!Array.isArray(list) || !list.length) return null;
  const map = new Map();
  for (const r of list) { const code = r.reporterCode ?? r.id; if (code == null) continue; map.set(Number(code), { name: r.text || r.reporterDesc || `#${code}`, iso2: r.reporterCodeIsoAlpha2 || '', iso3: r.reporterCodeIsoAlpha3 || '' }); }
  return map;
}

// Auto-detect the latest COMPLETE annual year. Walks currentYear → currentYear-3, caches HS 5903
// imports per year, and returns { year, reason, importsByYear }.
async function detectYear() {
  const thisYear = new Date().getUTCFullYear();
  const cache = new Map(); // year -> { payload, world }
  const get = async (y) => {
    if (cache.has(y)) return cache.get(y);
    const payload = await fetchJson(annualUrl('5903', 'M', y), `annual 5903 M ${y}`);
    const world = payload ? worldTotal(payload) : null;
    const rec = { payload, world };
    cache.set(y, rec);
    return rec;
  };
  const skip = {}; // year -> why it was rejected
  for (let y = thisYear; y >= thisYear - 3; y--) {
    const cur = await get(y);
    if (!cur.world || cur.world.reporters === 0) { skip[y] = 'no data yet'; continue; }
    const china = cur.world.byCode[CHINA] || 0, usa = cur.world.byCode[USA] || 0;
    if (china < BELLWETHER_MIN) { skip[y] = 'China not yet reported'; continue; }
    if (usa < BELLWETHER_MIN) { skip[y] = 'USA not yet reported'; continue; }
    const prev = await get(y - 1);
    if (prev.world && prev.world.value > 0 && cur.world.value < YEAR_COVERAGE_MIN * prev.world.value) {
      skip[y] = `world total only ${Math.round((cur.world.value / prev.world.value) * 100)}% of ${y - 1} — still filling in`;
      continue;
    }
    const above = skip[y + 1] ? `; ${y + 1} still partial (${skip[y + 1]})` : '';
    return { year: y, reason: `${y} — latest complete year${above}`, importsByYear: cache };
  }
  return null;
}

async function buildCommodity(c, year, reporters, cachedImports) {
  const importsUrl = annualUrl(c.code, 'M', year);
  const exportsUrl = annualUrl(c.code, 'X', year);
  const impPayload = cachedImports || await fetchJson(importsUrl, `${c.key} imports ${year}`);
  const expPayload = await fetchJson(exportsUrl, `${c.key} exports ${year}`);
  if (!impPayload) return null;

  const importers = rowsFrom(impPayload, reporters);
  const exporters = expPayload ? rowsFrom(expPayload, reporters) : [];
  const worldImport = importers.reduce((s, r) => s + r.value, 0);
  const worldExport = exporters.reduce((s, r) => s + r.value, 0);
  return {
    label: c.label,
    query_urls: { imports: importsUrl, exports: exportsUrl },
    world_import_value: worldImport,
    world_export_value: worldExport,
    world_import_netWgt: importers.reduce((s, r) => s + r.netWgt, 0),
    world_export_netWgt: exporters.reduce((s, r) => s + r.netWgt, 0),
    reporting_importers: importers.length,
    reporting_exporters: exporters.length,
    top_importers: importers.slice(0, 15),
    top_exporters: exporters.slice(0, 15),
    region_split: regionSplit(importers, worldImport),
  };
}

const prevPeriod = (p) => { let y = Math.floor(p / 100), m = p % 100 - 1; if (m < 1) { m = 12; y -= 1; } return y * 100 + m; };

// Detect the latest month with real coverage, then pull the last 12 months of world imports/exports.
async function buildMonthly(reporters) {
  const now = new Date();
  let probe = now.getUTCFullYear() * 100 + (now.getUTCMonth() + 1);
  const impCache = new Map();
  let latest = null;
  for (let i = 0; i < 8 && !latest; i++) {
    const payload = await fetchJson(monthlyUrl('5903', 'M', probe), `monthly probe ${probe}`);
    impCache.set(probe, payload);
    const w = payload ? worldTotal(payload) : null;
    if (w && w.reporters >= MONTH_REPORTERS_MIN) latest = probe;
    else probe = prevPeriod(probe);
  }
  if (!latest) { console.log('[market-intel] no covered month found — skipping monthly layer'); return null; }

  const periods = [];
  let p = latest;
  for (let i = 0; i < MONTHS_BACK; i++) { periods.push(p); p = prevPeriod(p); }
  periods.reverse();

  const series = [];
  for (const per of periods) {
    const impPayload = impCache.has(per) ? impCache.get(per) : await fetchJson(monthlyUrl('5903', 'M', per), `monthly imports ${per}`);
    const expPayload = await fetchJson(monthlyUrl('5903', 'X', per), `monthly exports ${per}`);
    if (!impPayload && !expPayload) continue;
    const imp = worldTotal(impPayload), exp = worldTotal(expPayload);
    series.push({ period: String(per), import_value: imp.value, export_value: exp.value, import_netWgt: imp.netWgt });
  }
  if (series.length < 6) { console.log(`[market-intel] only ${series.length} monthly points — skipping monthly layer`); return null; }

  const last12 = series.slice(-12);
  return {
    label: 'Recent monthly activity (HS 5903) — provisional',
    note: 'Provisional: recent months are revised upward as more countries report, and China does not report monthly — so these totals run below the annual pace and must not be compared to the complete-year headline.',
    through: String(latest),
    query_urls: { imports: monthlyUrl('5903', 'M', latest), exports: monthlyUrl('5903', 'X', latest) },
    series,
    last12_import_value: last12.reduce((s, r) => s + r.import_value, 0),
    last12_export_value: last12.reduce((s, r) => s + r.export_value, 0),
    months_count: last12.length,
  };
}

async function main() {
  const reporters = await loadReporters();
  if (!reporters) { console.log('[market-intel] Reporters.json unavailable — keeping previous file. Exiting 0.'); return; }

  const resolved = await detectYear();
  if (!resolved) { console.log('[market-intel] no complete annual year found — keeping previous file. Exiting 0.'); return; }
  const { year, reason, importsByYear } = resolved;
  console.log(`[market-intel] headline year ${year} — ${reason}`);

  const out = {
    _meta: {
      source: 'UN Comtrade',
      year,
      year_reason: reason,
      latest_complete_year: year,
      updated_at: new Date().toISOString(),
      note: 'All figures are real UN Comtrade import/export values — nothing modeled.',
    },
  };

  let built = 0;
  for (const c of COMMODITIES) {
    const cached = c.code === '5903' && importsByYear.get(year) ? importsByYear.get(year).payload : null;
    const block = await buildCommodity(c, year, reporters, cached);
    if (block) { out[c.key] = block; built++; console.log(`[market-intel] ${c.key}: import $${(block.world_import_value / 1e9).toFixed(2)}B · export $${(block.world_export_value / 1e9).toFixed(2)}B`); }
    else console.log(`[market-intel] ${c.key}: no data this run (skipped)`);
  }
  if (!out.hs5903) { console.log('[market-intel] primary commodity (HS 5903) missing — keeping previous file. Exiting 0.'); return; }

  const monthly = await buildMonthly(reporters);
  if (monthly) {
    out.monthly = monthly;
    out._meta.monthly_through = monthly.through;
    console.log(`[market-intel] monthly through ${monthly.through} · ${monthly.months_count} months · last12 import $${(monthly.last12_import_value / 1e9).toFixed(2)}B`);
  }

  if (!built) { console.log('[market-intel] nothing built — keeping previous file. Exiting 0.'); return; }
  await writeFile(MARKET_PATH, JSON.stringify(out, null, 1) + '\n');
  console.log(`[market-intel] wrote ${MARKET_PATH} (year ${year}${monthly ? `, monthly through ${monthly.through}` : ''}).`);
}

main()
  .catch((err) => { console.error('[market-intel] unexpected error (exiting 0):', err); })
  .finally(() => process.exit(0));
