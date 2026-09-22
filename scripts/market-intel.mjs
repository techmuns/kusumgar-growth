// Pulls the REAL global coated-fabric trade market from UN Comtrade (free, keyless) and writes
// public/data/market_intel.json. Every figure is a value the API actually returned, and every block
// keeps the exact query URL it came from as its source.
//
// HARD RULE: real trade data ONLY. Never model, estimate, interpolate, or invent a market number.
// Store only what the API returns; keep the source URL on every block; on any fetch error keep the
// previous file untouched and exit 0. Nothing here is a guess.
//
// What it pulls, for the newest year with data, for BOTH HS 5903 (all coated fabric) and HS 5903.20
// (polyurethane-coated — closest to Kusumgar's 600D PU):
//   • imports by reporter (flowCode=M, partner=World) → each country's import value = demand
//   • exports by reporter (flowCode=X, partner=World) → each country's export value = supply
// Country code → name + ISO2 comes from Comtrade's own Reporters.json.
//
// The preview endpoint caps at 500 rows, so we request the fully-aggregated row per reporter
// (partner2Code=0 & customsCode=C00 & motCode=0) — that is ONE total row per country (~150–200
// countries), well under the cap. Without those filters the API returns mode-of-transport /
// second-partner breakdowns that both blow the cap and double-count.
//
// Optional: if a COMTRADE_KEY secret is present we send Ocp-Apim-Subscription-Key (lifts the cap).
// Not required — keyless is the default and is what runs in CI.
//
// Test hook: KGR_MARKET_PATH points the writer at an alternate file.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const MARKET_PATH = process.env.KGR_MARKET_PATH || fileURLToPath(new URL('../public/data/market_intel.json', import.meta.url));
const KEY = process.env.COMTRADE_KEY || '';
const PREVIEW = 'https://comtradeapi.un.org/public/v1/preview/C/A/HS';
const REPORTERS_URL = 'https://comtradeapi.un.org/files/v1/app/reference/Reporters.json';

// Newest year first. We use the newest that returns a real spread of reporting countries.
const YEARS = [2024, 2023, 2022];
const MIN_REPORTERS = 20; // a year with fewer reporting countries than this is treated as "not yet populated"

const COMMODITIES = [
  { key: 'hs5903', code: '5903', label: 'All coated fabric (HS 5903)' },
  { key: 'hs590320', code: '590320', label: 'Polyurethane-coated (HS 5903.20) — closest to Kusumgar 600D PU' },
];

// The one aggregate row per reporter: all secondary partners, all customs procedures, all transport modes.
function queryUrl(code, flow, year) {
  return `${PREVIEW}?cmdCode=${code}&flowCode=${flow}&partnerCode=0&partner2Code=0&customsCode=C00&motCode=0&period=${year}`;
}

async function fetchJson(url, label) {
  const headers = { accept: 'application/json' };
  if (KEY) headers['Ocp-Apim-Subscription-Key'] = KEY;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(45_000) });
      console.log(`[market-intel] ${label} attempt ${attempt} -> ${res.status}`);
      if (!res.ok) { if (attempt === 2) return null; continue; }
      return await res.json();
    } catch (e) {
      console.error(`[market-intel] ${label} attempt ${attempt} failed: ${e.message}`);
      if (attempt === 2) return null;
    }
  }
  return null;
}

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

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

// Reduce a raw preview payload to one clean {code,country,iso2,value,netWgt} per reporting country.
function rowsFrom(payload, reporters) {
  const data = (payload && payload.data) || [];
  const out = [];
  for (const r of data) {
    const code = r.reporterCode;
    if (code === 0 || code == null) continue;         // 0 = "World" reporter — would double-count
    const value = num(r.primaryValue);
    if (value <= 0) continue;                          // keep only reporters with a real reported value
    const ref = reporters.get(code);
    out.push({
      code,
      country: (ref && ref.name) || String(r.reporterDesc || `#${code}`),
      iso2: (ref && ref.iso2) || String(r.reporterISO || ''),
      value,
      netWgt: num(r.netWgt),
    });
  }
  out.sort((a, b) => b.value - a.value);
  return out;
}

function regionSplit(importers, worldValue) {
  const by = new Map();
  for (const it of importers) {
    const region = regionOf(it.iso2);
    by.set(region, (by.get(region) || 0) + it.value);
  }
  const total = worldValue || [...by.values()].reduce((s, v) => s + v, 0) || 1;
  return [...by.entries()]
    .map(([region, value]) => ({ region, value, pct: Math.round((value / total) * 1000) / 10 }))
    .sort((a, b) => b.value - a.value);
}

async function loadReporters() {
  const payload = await fetchJson(REPORTERS_URL, 'Reporters.json');
  const list = payload && (payload.results || payload.data || (Array.isArray(payload) ? payload : null));
  if (!Array.isArray(list) || !list.length) return null;
  const map = new Map();
  for (const r of list) {
    const code = r.reporterCode ?? r.id;
    if (code == null) continue;
    map.set(Number(code), { name: r.text || r.reporterDesc || `#${code}`, iso2: r.reporterCodeIsoAlpha2 || '', iso3: r.reporterCodeIsoAlpha3 || '' });
  }
  return map;
}

// Pick the newest year that actually returns a real spread of importers for HS 5903.
async function resolveYear() {
  for (const year of YEARS) {
    const payload = await fetchJson(queryUrl('5903', 'M', year), `year-probe ${year}`);
    const n = payload && Array.isArray(payload.data)
      ? new Set(payload.data.filter((r) => r.reporterCode && r.reporterCode !== 0 && num(r.primaryValue) > 0).map((r) => r.reporterCode)).size
      : 0;
    console.log(`[market-intel] ${year}: ${n} reporting countries`);
    if (n >= MIN_REPORTERS) return { year, firstPayload: payload };
  }
  return null;
}

async function buildCommodity(c, year, reporters, firstImportPayload) {
  const importsUrl = queryUrl(c.code, 'M', year);
  const exportsUrl = queryUrl(c.code, 'X', year);
  // Reuse the year-probe payload for HS 5903 imports so we don't fetch it twice.
  const impPayload = firstImportPayload || await fetchJson(importsUrl, `${c.key} imports`);
  const expPayload = await fetchJson(exportsUrl, `${c.key} exports`);
  if (!impPayload) return null; // no imports = can't describe demand; skip this commodity honestly

  const importers = rowsFrom(impPayload, reporters);
  const exporters = expPayload ? rowsFrom(expPayload, reporters) : [];
  const worldImport = importers.reduce((s, r) => s + r.value, 0);
  const worldExport = exporters.reduce((s, r) => s + r.value, 0);
  const worldImportWgt = importers.reduce((s, r) => s + r.netWgt, 0);
  const worldExportWgt = exporters.reduce((s, r) => s + r.netWgt, 0);

  return {
    label: c.label,
    query_urls: { imports: importsUrl, exports: exportsUrl },
    world_import_value: worldImport,
    world_export_value: worldExport,
    world_import_netWgt: worldImportWgt,
    world_export_netWgt: worldExportWgt,
    reporting_importers: importers.length,
    reporting_exporters: exporters.length,
    top_importers: importers.slice(0, 15),
    top_exporters: exporters.slice(0, 15),
    region_split: regionSplit(importers, worldImport),
  };
}

async function main() {
  const reporters = await loadReporters();
  if (!reporters) { console.log('[market-intel] Reporters.json unavailable — keeping previous file. Exiting 0.'); return; }

  const resolved = await resolveYear();
  if (!resolved) { console.log('[market-intel] no year returned enough data — keeping previous file. Exiting 0.'); return; }
  const { year, firstPayload } = resolved;
  console.log(`[market-intel] using year ${year}`);

  const out = {
    _meta: {
      source: 'UN Comtrade',
      year,
      updated_at: new Date().toISOString(),
      note: 'All figures are real UN Comtrade import/export values — nothing modeled.',
    },
  };

  let built = 0;
  for (const c of COMMODITIES) {
    const block = await buildCommodity(c, year, reporters, c.code === '5903' ? firstPayload : null);
    if (block) { out[c.key] = block; built++; console.log(`[market-intel] ${c.key}: world import $${(block.world_import_value / 1e9).toFixed(2)}B · world export $${(block.world_export_value / 1e9).toFixed(2)}B`); }
    else console.log(`[market-intel] ${c.key}: no data this run (skipped)`);
  }

  // Never write a half-empty file over a good one: require at least the primary commodity.
  if (!out.hs5903) { console.log('[market-intel] primary commodity (HS 5903) missing — keeping previous file. Exiting 0.'); return; }
  if (!built) { console.log('[market-intel] nothing built — keeping previous file. Exiting 0.'); return; }

  await writeFile(MARKET_PATH, JSON.stringify(out, null, 1) + '\n');
  console.log(`[market-intel] wrote ${MARKET_PATH} (${built} commodit${built === 1 ? 'y' : 'ies'}, year ${year}).`);
}

main()
  .catch((err) => { console.error('[market-intel] unexpected error (exiting 0):', err); })
  .finally(() => process.exit(0));
