// Kusumgar Growth Engine — Phase 1
// Foundation shell + Exhibitions tab. Pure ES module, no framework, no build step.
// Charts are hand-built inline SVG (no chart library). Data is read from committed JSON.

/* ------------------------------------------------------------------ *
 * Design tokens
 * ------------------------------------------------------------------ */

// Segment colors — one consistent map across Exhibitions (Phase 1) and Products (Phase 2).
const SEGMENT_COLORS = {
  'Aeronautical': '#0ea5e9',         // sky
  'Industrial': '#f59e0b',           // amber
  'Military & Tactical': '#6366f1',  // indigo
  'Workwear': '#10b981',             // emerald (Phase-1 exhibitions segment)
  'Workwear & Safety': '#10b981',    // emerald (Phase-2 products segment)
  'Automotive': '#8b5cf6',           // violet
  'Medical & Emergency': '#f43f5e',  // rose
  'Medical': '#f43f5e',              // rose (alias)
  'Outdoor': '#14b8a6',              // teal
  'Marine': '#3b82f6',               // blue
};

// The 8 market segments products are mapped against (column order for the coverage matrix).
const PRODUCT_SEGMENTS = [
  'Aeronautical', 'Military & Tactical', 'Industrial', 'Workwear & Safety',
  'Automotive', 'Medical & Emergency', 'Outdoor', 'Marine',
];

// Fabric-family display order + icons for the catalog section headers.
const FAMILY_ORDER = ['Nylon Fabrics', 'Polyester Fabrics', 'Aramid & FR Fabrics', 'Coated & Laminated', 'Industrial Textiles & Tapes'];
const FAMILY_ICONS = {
  'Nylon Fabrics': '🪶', 'Polyester Fabrics': '🧵', 'Aramid & FR Fabrics': '🔥',
  'Coated & Laminated': '🧴', 'Industrial Textiles & Tapes': '🏭', 'Other Kusumgar Fabrics': '🧩',
};

// Product-segment → Exhibitions-segment mapping for the live "N shows" badges.
// Segments not listed here have no exhibition segment yet (→ 0 shows).
const SEG_TO_EXHIB = {
  'Aeronautical': 'Aeronautical',
  'Military & Tactical': 'Military & Tactical',
  'Industrial': 'Industrial',
  'Workwear & Safety': 'Workwear',
};

// Lead-segment colors (Phase 3) — distinct customer-facing segmentation.
const LEAD_SEGMENT_COLORS = {
  'Tool & Equipment Bags': '#f59e0b',        // amber
  'Medical & Emergency': '#f43f5e',          // rose
  'Marine Covers': '#3b82f6',                // blue
  'Pool & Outdoor Covers': '#14b8a6',        // teal
  'Protective Covers & Industrial': '#f97316', // orange
  'Protective & Industrial Covers': '#f97316', // orange (Industry-Research segment label)
  'Automotive Seating': '#8b5cf6',           // violet
};
// Resolve a color for any segment string across all maps.
const anyColor = (s) => LEAD_SEGMENT_COLORS[s] || SEGMENT_COLORS[s] || '#64748b';
const leadSegColor = (s) => LEAD_SEGMENT_COLORS[s] || anyColor(s);

const PRIORITY_COLORS = { High: '#10b981', Medium: '#94a3b8', Low: '#94a3b8' };

// How each competitor competes (first match wins; note Premium beats Technical).
// Labels are plain-English so a non-technical reader gets them at a glance.
const POSITION_BUCKETS = [
  { label: 'Low cost, high volume', color: '#f59e0b', test: (p) => /cost|scale/.test(p) },
  { label: 'Premium quality', color: '#6366f1', test: (p) => /premium/.test(p) },
  { label: 'Tech & specialised', color: '#0ea5e9', test: (p) => /techn/.test(p) },
  { label: 'Local / regional', color: '#94a3b8', test: (p) => /regional/.test(p) },
];
function positionBucket(pos) {
  const p = String(pos || '').toLowerCase();
  return POSITION_BUCKETS.find((b) => b.test(p)) || POSITION_BUCKETS[3];
}

// Plain-English display names for the vaguer industry labels (display only —
// the underlying values stay the same so colors, filters and data don't change).
const SEG_LABELS = {
  'Aeronautical': 'Aviation & Aerospace',
  'Military & Tactical': 'Military & Defence',
  'Outdoor': 'Outdoor & Recreation',
  'Marine': 'Marine & Boating',
};
const segLabel = (s) => SEG_LABELS[s] || s;

// Outreach pipeline (Phase 4) — Nishad's real flow, in order, each with a color.
const OUTREACH_STAGES = [
  { key: 'To contact', color: '#94a3b8' },       // slate
  { key: 'Connected', color: '#0ea5e9' },        // sky
  { key: 'Email sent', color: '#6366f1' },       // indigo
  { key: 'No reply', color: '#f59e0b' },         // amber
  { key: 'Meeting set', color: '#8b5cf6' },      // violet
  { key: 'Sample requested', color: '#14b8a6' }, // teal
  { key: 'Quoted', color: '#0891b2' },           // cyan
  { key: 'Negotiating', color: '#d946ef' },      // fuchsia
  { key: 'Won', color: '#10b981' },              // emerald
  { key: 'Lost', color: '#f43f5e' },             // rose
];
const STAGE_KEYS = OUTREACH_STAGES.map((s) => s.key);
const STAGE_COLOR = Object.fromEntries(OUTREACH_STAGES.map((s) => [s.key, s.color]));
const DEAL_TYPES = ['current', 'potential'];
const MFG_TYPES = ['own', 'jobwork', 'agency'];

// Engagement status colors + display order.
const STATUS_COLORS = {
  'Exhibited': '#10b981', // emerald
  'Visited': '#f59e0b',   // amber
  'Attended': '#14b8a6',  // teal
  'Not yet': '#94a3b8',   // slate
};
const STATUS_ORDER = ['Exhibited', 'Visited', 'Attended', 'Not yet'];
const ENGAGED = new Set(['Exhibited', 'Visited', 'Attended']);

const TABS = [
  { id: 'today', label: 'Home', icon: '🏠', live: true },
  { id: 'research', label: 'Industry Research', icon: '🔬', live: true },   // curated target universe, verified vs each site
  { id: 'exhibitions', label: 'Exhibitions', icon: '🎪', live: true },
  { id: 'leads', label: 'Exhibitors', icon: '🏢', live: true },   // companies exhibiting at the shows
  { id: 'competitors', label: 'Competitors', icon: '🛡️', live: true },
  { id: 'outreach', label: 'Outreach', icon: '📮', live: true },
  // Products live behind a header button (reference catalog), not a primary tab.
];

const FLAGS = {
  'France': '🇫🇷', 'Spain': '🇪🇸', 'USA': '🇺🇸', 'Japan': '🇯🇵', 'India': '🇮🇳',
  'Germany': '🇩🇪', 'Canada': '🇨🇦', 'Qatar': '🇶🇦', 'Malaysia': '🇲🇾', 'UK': '🇬🇧',
  'South Korea': '🇰🇷', 'Israel': '🇮🇱', 'Poland': '🇵🇱', 'Egypt': '🇪🇬', 'Chile': '🇨🇱',
  'Czechia': '🇨🇿', 'UAE': '🇦🇪', 'Australia': '🇦🇺', 'Indonesia': '🇮🇩', 'Brazil': '🇧🇷',
  'Singapore': '🇸🇬', 'Saudi Arabia': '🇸🇦',
  'Taiwan': '🇹🇼', 'Italy': '🇮🇹', 'Netherlands': '🇳🇱', 'Denmark': '🇩🇰', 'Norway': '🇳🇴',
  'Ireland': '🇮🇪', 'Liechtenstein': '🇱🇮', 'China': '🇨🇳', 'Austria': '🇦🇹', 'Sweden': '🇸🇪',
  'Switzerland': '🇨🇭', 'Belgium': '🇧🇪', 'Vietnam': '🇻🇳',
};

// Country → ISO-2, so flags render as real images everywhere (emoji flags show as "AU"/"FR"
// letters on Windows). Covers every country in the data, incl. name variants (UK/United Kingdom).
const COUNTRY_ISO = {
  'Australia': 'au', 'Austria': 'at', 'Belgium': 'be', 'Bosnia and Herzegovina': 'ba', 'Brazil': 'br',
  'Bulgaria': 'bg', 'Canada': 'ca', 'Chile': 'cl', 'China': 'cn', 'Czech Republic': 'cz', 'Czechia': 'cz',
  'Denmark': 'dk', 'Egypt': 'eg', 'Estonia': 'ee', 'France': 'fr', 'Germany': 'de', 'Hungary': 'hu',
  'India': 'in', 'Indonesia': 'id', 'Ireland': 'ie', 'Israel': 'il', 'Italy': 'it', 'Japan': 'jp',
  'Liechtenstein': 'li', 'Lithuania': 'lt', 'Malaysia': 'my', 'Netherlands': 'nl', 'Norway': 'no',
  'Pakistan': 'pk', 'Poland': 'pl', 'Qatar': 'qa', 'Russia': 'ru', 'Saudi Arabia': 'sa', 'Singapore': 'sg',
  'Slovenia': 'si', 'South Africa': 'za', 'South Korea': 'kr', 'Spain': 'es', 'Sweden': 'se',
  'Switzerland': 'ch', 'Taiwan': 'tw', 'Thailand': 'th', 'Turkey': 'tr', 'UAE': 'ae', 'UK': 'gb',
  'USA': 'us', 'United Kingdom': 'gb', 'United States': 'us', 'Vietnam': 'vn',
};
// Small flag image for a country (graceful: renders nothing if the country is unknown or the CDN is blocked).
function flagImg(country) {
  const iso = COUNTRY_ISO[country];
  if (!iso) return '';
  return `<img src="https://flagcdn.com/32x24/${iso}.png" srcset="https://flagcdn.com/64x48/${iso}.png 2x" width="20" height="15" alt="" loading="lazy" class="mr-1.5 inline-block h-3.5 w-auto rounded-[2px] align-[-2px] ring-1 ring-slate-200/70" />`;
}
// Flag + country name for a table/detail cell.
const countryCell = (country) => `${flagImg(country)}${escapeHtml(dash(country))}`;

// Flag image straight from an ISO alpha-2 (the UN Comtrade market data already carries ISO2).
function flagImgIso(iso2) {
  const iso = String(iso2 || '').toLowerCase();
  if (!/^[a-z]{2}$/.test(iso)) return '';
  return `<img src="https://flagcdn.com/32x24/${iso}.png" srcset="https://flagcdn.com/64x48/${iso}.png 2x" width="20" height="15" alt="" loading="lazy" class="mr-1.5 inline-block h-3.5 w-auto rounded-[2px] align-[-2px] ring-1 ring-slate-200/70" />`;
}
// Real-money + volume formatters for the UN Comtrade market view (values are USD / kg, exactly as reported).
function fmtUSD(v) {
  const n = Number(v) || 0;
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
  return '$' + Math.round(n);
}
function fmtTonnes(kg) {
  const t = (Number(kg) || 0) / 1000;
  if (t >= 1e6) return (t / 1e6).toFixed(1).replace(/\.0$/, '') + ' Mt';
  if (t >= 1e3) return (t / 1e3).toFixed(t >= 1e4 ? 0 : 1).replace(/\.0$/, '') + ' kt';
  if (t >= 1) return Math.round(t) + ' t';
  return t > 0 ? '<1 t' : '—';
}

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */

const state = {
  tab: 'today',
  sub: 'overview',        // 'overview' | 'list'
  meta: null,
  exhibitions: [],
  products: [],
  leads: [],
  competitors: [],
  outreach: {},           // leadId -> { contact, email }  (from outreach.json)
  pipeline: {},           // leadId -> { stage, dealType, mfg }  (localStorage)
  relevance: {},          // id -> 'yes' | 'no'   (undecided = absent)
  onlyFound: (() => { try { return localStorage.getItem('kgr.onlyfound') === '1'; } catch { return false; } })(),
  master: null,           // full unfiltered {leads,competitors,exhibitions} — for the "only found" toggle
  filters: { search: '', segment: 'all', country: 'all', status: 'all', relevantOnly: false, discoveredOnly: false, timing: 'all', from: '', to: '' },
  productsSub: 'catalog', // 'catalog' | 'coverage'
  productFilters: { search: '', industry: 'all', family: 'all' },
  leadsSub: 'list',       // exhibitors are one comprehensive table now
  leadFilters: { search: '', segment: 'all', country: 'all', priority: 'all', emailClass: 'all', view: 'all', show: 'all' },
  leadSort: { key: 'company', dir: 'asc' },
  stars: {},              // leadId -> true  (⭐ "my leads", localStorage)
  competitorsSub: 'landscape', // 'landscape' | 'list'
  outreachSub: 'pipeline',     // 'pipeline' | 'tracker' | 'followups' (tracker + followups live under one "Tracker" view)
  trackerFilters: { search: '', stage: 'all' },
  composeId: null,             // lead currently open in the Pipeline compose panel
  pipeSearch: '',              // search box in the Pipeline "My leads" column
  prodModalSearch: '',         // search box in the Products catalog modal
  research: [],                // curated target companies (research_targets.json)
  researchSub: 'market',       // 'market' | 'targets'  (Market shown first — the industry-mapping step)
  researchFilters: { segment: 'all', search: '', country: 'all' },
  researchSent: new Set(),     // target ids sent to the Growth Engine (localStorage)
  market: null,                // UN Comtrade market intel (market_intel.json)
  marketCommodity: 'hs5903',   // 'hs5903' | 'hs590320'
};

const PIPE_KEY = (id) => `kgr.outreach.${id}`;

const REL_KEY = (id) => `kgr.relevant.${id}`;
const REL_COLORS = { yes: '#10b981', no: '#f43f5e', undecided: '#94a3b8' };

/* ---- Round-1 helpers: ⭐ my-leads, exhibition date-sort, priority reasons ---- */
const STAR_KEY = (id) => `kgr.star.${id}`;
function loadStars(ids) { ids.forEach((id) => { try { if (localStorage.getItem(STAR_KEY(id)) === '1') state.stars[id] = true; } catch { /* storage unavailable */ } }); }
const isStarred = (id) => !!state.stars[id];
function toggleStar(id) {
  const on = !state.stars[id];
  try { if (on) localStorage.setItem(STAR_KEY(id), '1'); else localStorage.removeItem(STAR_KEY(id)); } catch { /* in-memory only */ }
  if (on) state.stars[id] = true; else delete state.stars[id];
}
// The exhibition a lead/competitor came from: source "exhibition:<id>" → the show record (else null).
function sourceShow(src) {
  const s = String(src || '');
  if (!s.startsWith('exhibition:')) return null;
  return state.exhibitions.find((e) => e.id === s.slice('exhibition:'.length)) || null;
}
// Sort exhibitions: upcoming/ongoing first (soonest→latest), then past (most-recent→oldest), then undated.
function exhibitionsByDate(list) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const endTs = (e) => { const d = showEndDate(e); return d ? +d : null; };
  const startTs = (e) => { const s = String(e.start || ''); const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00' : s); return isNaN(t) ? null : t; };
  const bucket = (e) => { const end = endTs(e); if (end == null) return 2; return end >= +today ? 0 : 1; };
  return list.slice().sort((a, b) => {
    const ba = bucket(a), bb = bucket(b);
    if (ba !== bb) return ba - bb;
    if (ba === 2) return String(a.name).localeCompare(String(b.name));
    const sa = startTs(a) ?? endTs(a) ?? 0, sb = startTs(b) ?? endTs(b) ?? 0;
    return ba === 0 ? sa - sb : sb - sa;   // upcoming ascending, past most-recent-first
  });
}
// Plain-English fabric per segment — used to explain a lead's priority without jargon.
const PLAIN_FABRIC = {
  'Military & Tactical': 'strong coated nylon for gear, vests and packs',
  'Industrial': 'tough coated polyester and nylon for covers and protective gear',
  'Tool & Equipment Bags': 'strong coated polyester for tool bags and cases',
  'Medical & Emergency': 'coated, easy-to-clean fabrics for medical bags and covers',
  'Outdoor': 'lightweight, water-repellent nylon for outdoor gear',
  'Automotive': 'coated technical fabrics for interiors and covers',
  'Marine': 'coated marine fabrics for boat covers and canvas',
  'Aeronautical': 'ripstop nylon for parachutes and canopies',
  'Workwear': 'flame-retardant, water-repellent workwear fabrics',
};
const plainFabric = (seg) => PLAIN_FABRIC[seg] || 'our coated technical fabrics';
// A plain, source-backed reason for a lead's priority (based on what the company makes + our fabric fit).
// Every lead gets one; jargon-free so anyone can read it at a glance.
function priorityReason(l) {
  const seg = l.segment || 'technical textiles';
  const fab = l.fabric_fit ? l.fabric_fit : plainFabric(seg);
  const makes = l.application ? `They make ${String(l.application).toLowerCase()}` : `They work in ${seg.toLowerCase()}`;
  const pr = l.priority || 'Medium';
  if (pr === 'High') return `${makes} — a strong match for our ${fab}.`;
  if (pr === 'Low') return `${makes}. Lighter fit — ${seg.toLowerCase()} only sometimes needs fabrics like ours.`;
  return `${makes} — likely a good use for our ${fab}.`;
}
// AI "Recommended": High priority OR an explicit fabric match — the strongest-fit exhibitors.
const isRecommended = (l) => l.priority === 'High' || !!l.fabric_fit;

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

const $ = (sel, root = document) => root.querySelector(sel);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
function rgbToHex(r, g, b) {
  const c = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
// Mix a color toward black by amount (0..1).
function darken(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amt), g * (1 - amt), b * (1 - amt));
}
// Linear interpolate between two hex colors.
function lerpColor(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
}
// Choose a readable text color for a colored background.
function textOn(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#0f172a' : '#ffffff';
}
const segColor = (seg) => SEGMENT_COLORS[seg] || '#64748b';

// Compact label for timeline pills (keeps them narrow so they don't stack too deep).
function shortName(name) {
  let n = name.includes('/') ? name.split('/')[0].trim() : name;
  if (n.length <= 12) return n;
  const words = n.split(' ');
  let s = words[0];
  for (let i = 1; i < words.length; i++) {
    if ((s + ' ' + words[i]).length <= 12) s += ' ' + words[i]; else break;
  }
  return s.length > 12 ? s.slice(0, 11) + '…' : s;
}

/* ------------------------------------------------------------------ *
 * Tooltip (shared by all charts, follows the cursor)
 * ------------------------------------------------------------------ */

const tooltip = $('#tooltip');

function showTooltip(el) {
  const title = el.getAttribute('data-tip-title');
  if (!title) return;
  const sub = el.getAttribute('data-tip-sub') || '';
  const color = el.getAttribute('data-tip-color') || '#6366f1';
  tooltip.innerHTML =
    `<div class="flex items-center gap-1.5">
       <span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${color}"></span>
       <span class="tt-title">${escapeHtml(title)}</span>
     </div>` +
    (sub ? `<div class="tt-sub">${escapeHtml(sub)}</div>` : '');
  tooltip.classList.add('show');
}
function moveTooltip(e) {
  if (!tooltip.classList.contains('show')) return;
  const pad = 14;
  let x = e.clientX + pad, y = e.clientY + pad;
  const r = tooltip.getBoundingClientRect();
  if (x + r.width + 8 > window.innerWidth) x = e.clientX - r.width - pad;
  if (y + r.height + 8 > window.innerHeight) y = e.clientY - r.height - pad;
  tooltip.style.left = `${Math.max(6, x)}px`;
  tooltip.style.top = `${Math.max(6, y)}px`;
}
function hideTooltip() { tooltip.classList.remove('show'); }

// Cross-highlight: dim other elements in the same chart, highlight matching keys.
function highlight(el) {
  const chart = el.closest('[data-chart]');
  if (!chart) return;
  chart.classList.add('dimming');
  const key = el.getAttribute('data-key');
  const matches = key ? chart.querySelectorAll(`[data-key="${CSS.escape(key)}"]`) : [el];
  matches.forEach((m) => m.classList.add('active'));
}
function unhighlight(el) {
  const chart = el.closest('[data-chart]');
  if (!chart) return;
  chart.classList.remove('dimming');
  chart.querySelectorAll('.active').forEach((m) => m.classList.remove('active'));
}

/* ------------------------------------------------------------------ *
 * Chart builders (return SVG/HTML strings)
 * ------------------------------------------------------------------ */

// Donut — items: [{label, value, color, key}]
function buildDonut(items, { centerNum, centerLabel, unit = 'show' }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const cx = 80, cy = 80, r = 56, sw = 22;
  const C = 2 * Math.PI * r;
  const gap = 2.5; // visual gap between arcs (px along circumference)
  let accum = 0;
  const arcs = items.filter((i) => i.value > 0).map((i) => {
    const len = (i.value / total) * C;
    const drawLen = Math.max(len - gap, 0.6);
    const offset = -accum;
    accum += len;
    const pct = Math.round((i.value / total) * 100);
    return `<circle class="arc-seg reveal-arc hovable" data-key="${escapeHtml(i.key)}"
        cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${i.color}" stroke-width="${sw}"
        stroke-dasharray="0 ${C.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
        data-arc="${drawLen.toFixed(2)} ${(C - drawLen).toFixed(2)}"
        data-tip-title="${escapeHtml(i.label)}" data-tip-color="${i.color}"
        data-tip-sub="${plural(i.value, unit)} • ${pct}%"></circle>`;
  }).join('');
  return `
    <svg viewBox="0 0 160 160" width="144" height="144" class="h-36 w-36 shrink-0" role="img" aria-label="${escapeHtml(centerLabel)}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="${sw}"></circle>
      <g transform="rotate(-90 ${cx} ${cy})" style="transform-box:view-box;">${arcs}</g>
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="tnum" style="font-size:26px;font-weight:800;fill:#0f172a;font-family:'Plus Jakarta Sans',sans-serif;">${centerNum}</text>
      <text x="${cx}" y="${cy + 15}" text-anchor="middle" style="font-size:11px;font-weight:600;fill:#94a3b8;">${escapeHtml(centerLabel)}</text>
    </svg>`;
}

// Legend rows (also cross-highlight the chart when hovered).
function buildLegend(items, { total, unit = 'show' } = {}) {
  return `<ul class="flex-1 space-y-1.5 min-w-0">` + items.map((i) => {
    const pct = total ? Math.round((i.value / total) * 100) : null;
    return `<li class="hovable flex items-center gap-2 rounded-lg px-1.5 py-0.5" data-key="${escapeHtml(i.key)}"
        data-tip-title="${escapeHtml(i.label)}" data-tip-color="${i.color}"
        data-tip-sub="${plural(i.value, unit)}${pct != null ? ` • ${pct}%` : ''}">
      <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:${i.color}"></span>
      <span class="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-600">${escapeHtml(i.label)}</span>
      <span class="tnum text-[13px] font-bold text-slate-900">${i.value}</span>
    </li>`;
  }).join('') + `</ul>`;
}

// Horizontal bars — items: [{label, value, color, key, flag}]
function buildBars(items, { unit = 'show' } = {}) {
  const W = 460, x0 = 132, valW = 28;    // wide viewBox keeps bars from magnifying vertically
  const barMax = W - x0 - valW;
  const rowH = 30, padTop = 6, barH = 14;
  const H = items.length * rowH + padTop;
  const max = Math.max(...items.map((i) => i.value), 1);
  const rows = items.map((i, idx) => {
    const y = padTop + idx * rowH;
    const cy = y + rowH / 2;
    const w = Math.max((i.value / max) * barMax, 5);
    const flag = i.flag ? i.flag + ' ' : '';
    return `<g class="hovable" data-key="${escapeHtml(i.key)}"
        data-tip-title="${escapeHtml(i.label)}" data-tip-color="${i.color}"
        data-tip-sub="${plural(i.value, unit)}">
      <rect x="0" y="${y}" width="${W}" height="${rowH}" fill="transparent"></rect>
      <text x="${x0 - 8}" y="${cy}" text-anchor="end" dominant-baseline="central"
        style="font-size:11.5px;font-weight:600;fill:#475569;">${escapeHtml(flag + (i.short || i.label))}</text>
      <rect x="${x0}" y="${cy - barH / 2}" width="${barMax}" height="${barH}" rx="7" fill="#f1f5f9"></rect>
      <rect class="reveal-scale" x="${x0}" y="${cy - barH / 2}" width="${w.toFixed(1)}" height="${barH}" rx="7"
        fill="${i.color}" style="transition-delay:${idx * 55}ms"></rect>
      <text x="${x0 + w + 6}" y="${cy}" dominant-baseline="central" class="tnum"
        style="font-size:11.5px;font-weight:700;fill:#0f172a;">${i.value}</text>
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Top countries by number of shows">${rows}</svg>`;
}

// Money horizontal bars — items: [{key,label,short,iso2,value,valueText,tipSub,color}].
// Same hand-built style as buildBars (flag + name + track + reveal-scale fill + value); NO chart library.
function buildValueBars(items) {
  if (!items || !items.length) return '<div class="py-6 text-center text-[12px] text-slate-400">No data.</div>';
  const W = 460, x0 = 150, valReserve = 58;
  const barMax = W - x0 - valReserve;
  const rowH = 30, padTop = 6, barH = 14;
  const H = items.length * rowH + padTop;
  const max = Math.max(...items.map((i) => i.value), 1);
  const rows = items.map((i, idx) => {
    const y = padTop + idx * rowH;
    const cy = y + rowH / 2;
    const w = Math.max((i.value / max) * barMax, 4);
    const iso = String(i.iso2 || '').toLowerCase();
    const flag = /^[a-z]{2}$/.test(iso)
      ? `<image href="https://flagcdn.com/32x24/${iso}.png" x="0" y="${(cy - 7).toFixed(1)}" width="18" height="13" preserveAspectRatio="xMidYMid slice"></image>`
      : '';
    return `<g class="hovable" data-key="${escapeHtml(i.key)}" data-tip-title="${escapeHtml(i.label)}" data-tip-color="${i.color}" data-tip-sub="${escapeHtml(i.tipSub || i.valueText)}">
      <rect x="0" y="${y}" width="${W}" height="${rowH}" fill="transparent"></rect>
      ${flag}
      <text x="24" y="${cy}" dominant-baseline="central" style="font-size:11.5px;font-weight:600;fill:#475569;">${escapeHtml(i.short || i.label)}</text>
      <rect x="${x0}" y="${(cy - barH / 2).toFixed(1)}" width="${barMax}" height="${barH}" rx="7" fill="#f1f5f9"></rect>
      <rect class="reveal-scale" x="${x0}" y="${(cy - barH / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${barH}" rx="7" fill="${i.color}" style="transition-delay:${idx * 55}ms"></rect>
      <text x="${W - 4}" y="${cy}" text-anchor="end" dominant-baseline="central" class="tnum" style="font-size:11.5px;font-weight:700;fill:#0f172a;">${escapeHtml(i.valueText)}</text>
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Top countries by trade value">${rows}</svg>`;
}

// Money donut — items: [{key,label,value,valueText,pct,tipSub,color}] (mirrors buildDonut, currency tooltip).
function buildValueDonut(items, { centerNum, centerLabel }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const cx = 80, cy = 80, r = 56, sw = 22;
  const C = 2 * Math.PI * r;
  const gap = 2.5;
  let accum = 0;
  const arcs = items.filter((i) => i.value > 0).map((i) => {
    const len = (i.value / total) * C;
    const drawLen = Math.max(len - gap, 0.6);
    const offset = -accum;
    accum += len;
    return `<circle class="arc-seg reveal-arc hovable" data-key="${escapeHtml(i.key)}"
        cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${i.color}" stroke-width="${sw}"
        stroke-dasharray="0 ${C.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
        data-arc="${drawLen.toFixed(2)} ${(C - drawLen).toFixed(2)}"
        data-tip-title="${escapeHtml(i.label)}" data-tip-color="${i.color}"
        data-tip-sub="${escapeHtml(i.tipSub || '')}"></circle>`;
  }).join('');
  return `
    <svg viewBox="0 0 160 160" width="132" height="132" class="h-32 w-32 shrink-0" role="img" aria-label="${escapeHtml(centerLabel)}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="${sw}"></circle>
      <g transform="rotate(-90 ${cx} ${cy})" style="transform-box:view-box;">${arcs}</g>
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="tnum" style="font-size:19px;font-weight:800;fill:#0f172a;font-family:'Plus Jakarta Sans',sans-serif;">${escapeHtml(centerNum)}</text>
      <text x="${cx}" y="${cy + 15}" text-anchor="middle" style="font-size:11px;font-weight:600;fill:#94a3b8;">${escapeHtml(centerLabel)}</text>
    </svg>`;
}

// Money legend — items: [{key,label,valueText,pct,tipSub,color}] (mirrors buildLegend, shows $ + %).
function buildValueLegend(items) {
  return `<ul class="flex-1 space-y-1.5 min-w-0">` + items.map((i) => `
    <li class="hovable flex items-center gap-2 rounded-lg px-1.5 py-0.5" data-key="${escapeHtml(i.key)}"
        data-tip-title="${escapeHtml(i.label)}" data-tip-color="${i.color}" data-tip-sub="${escapeHtml(i.tipSub || '')}">
      <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:${i.color}"></span>
      <span class="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-600">${escapeHtml(i.label)}</span>
      <span class="tnum text-[13px] font-bold text-slate-900">${escapeHtml(i.valueText)}</span>
      <span class="tnum w-9 text-right text-[11px] font-medium text-slate-400">${escapeHtml(String(i.pct))}%</span>
    </li>`).join('') + `</ul>`;
}

// Stacked bar — items: [{label, value, color, key}]
function buildStackedBar(items, { unit = 'show' } = {}) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const W = 340, H = 30, r = 8;
  let x = 0;
  const gap = 2;
  const segs = items.filter((i) => i.value > 0).map((i) => {
    const w = (i.value / total) * W;
    const drawW = Math.max(w - gap, 1);
    const pct = Math.round((i.value / total) * 100);
    const rect = `<rect class="hovable" data-key="${escapeHtml(i.key)}" x="${x.toFixed(2)}" y="0"
        width="${drawW.toFixed(2)}" height="${H}" rx="${r}" fill="${i.color}"
        data-tip-title="${escapeHtml(i.label)}" data-tip-color="${i.color}"
        data-tip-sub="${plural(i.value, unit)} • ${pct}%"></rect>`;
    x += w;
    return rect;
  }).join('');
  return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="30" role="img" aria-label="Engagement status split">
      <defs><clipPath id="wipe-status"><rect class="reveal-scale" x="0" y="0" width="${W}" height="${H}"></rect></clipPath></defs>
      <g clip-path="url(#wipe-status)">${segs}</g>
    </svg>`;
}

// Upcoming timeline on a 2026 month strip (Feb…Nov).
function buildTimeline(shows) {
  const W = 560, PADL = 18, PADR = 18;
  const RANGE_START = Date.UTC(2026, 1, 1);   // Feb 1
  const RANGE_END = Date.UTC(2026, 10, 30);   // Nov 30
  const xFor = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    const t = Date.UTC(y, m - 1, d);
    const f = clamp((t - RANGE_START) / (RANGE_END - RANGE_START), 0, 1);
    return PADL + f * (W - PADL - PADR);
  };

  const PILL_H = 20, LANE_GAP = 27, TOP_PAD = 8, AXIS_GAP = 14, LABEL_H = 18;

  // Compact pills + lane packing (stack when they'd overlap horizontally).
  const items = shows.slice().sort((a, b) => a.start.localeCompare(b.start)).map((s) => {
    const label = shortName(s.name);
    const w = clamp(label.length * 6.3 + 22, 54, 98);
    const dateX = xFor(s.start);
    const cx = clamp(dateX, PADL + w / 2, W - PADR - w / 2);
    return { s, label, w, dateX, cx, left: cx - w / 2, right: cx + w / 2 };
  });
  const laneRight = [];
  items.forEach((it) => {
    let lane = 0;
    while (lane < laneRight.length && laneRight[lane] + 10 > it.left) lane++;
    laneRight[lane] = it.right;
    it.lane = lane;
  });
  const maxLane = Math.max(0, laneRight.length - 1);
  const baselineY = TOP_PAD + maxLane * LANE_GAP + PILL_H + AXIS_GAP;
  const H = baselineY + LABEL_H;
  const pillTop = (lane) => TOP_PAD + (maxLane - lane) * LANE_GAP;

  // Month gridlines + labels (Feb..Nov), kept very light — no clutter.
  let grid = '';
  for (let m = 2; m <= 11; m++) {
    const gx = xFor(`2026-${String(m).padStart(2, '0')}-01`);
    grid += `<line x1="${gx.toFixed(1)}" y1="${TOP_PAD - 2}" x2="${gx.toFixed(1)}" y2="${baselineY}" stroke="#f1f5f9" stroke-width="1"></line>`;
    const lx = xFor(`2026-${String(m).padStart(2, '0')}-15`);
    grid += `<text x="${lx.toFixed(1)}" y="${(baselineY + 13).toFixed(1)}" text-anchor="middle" style="font-size:10px;font-weight:600;fill:#94a3b8;">${MONTHS[m]}</text>`;
  }
  const axis = `<line x1="${PADL}" y1="${baselineY}" x2="${W - PADR}" y2="${baselineY}" stroke="#e2e8f0" stroke-width="1.5"></line>`;

  // Pass 1: connectors + date dots (decorative, behind pills).
  const connectors = items.map((it) => {
    const color = segColor(it.s.segment);
    const top = pillTop(it.lane);
    return `<line x1="${it.cx.toFixed(1)}" y1="${(top + PILL_H).toFixed(1)}" x2="${it.dateX.toFixed(1)}" y2="${baselineY}" stroke="${color}" stroke-width="1" opacity="0.35"></line>
      <circle cx="${it.dateX.toFixed(1)}" cy="${baselineY}" r="3" fill="${color}"></circle>`;
  }).join('');

  // Pass 2: pills (hoverable, on top of every connector).
  const pills = items.map((it, idx) => {
    const color = segColor(it.s.segment);
    const top = pillTop(it.lane);
    const tc = textOn(color);
    const place = it.s.place ? `${it.s.place} · ` : '';
    return `<g class="reveal-pill hovable" data-key="${escapeHtml(it.s.id)}" style="transition-delay:${idx * 70}ms"
        data-tip-title="${escapeHtml(it.s.name)}" data-tip-color="${color}"
        data-tip-sub="${escapeHtml(place + (it.s.dates || ''))}">
      <rect x="${it.left.toFixed(1)}" y="${top}" width="${it.w.toFixed(1)}" height="${PILL_H}" rx="10" fill="${color}" stroke="${darken(color, 0.12)}" stroke-width="1"></rect>
      <text x="${it.cx.toFixed(1)}" y="${top + PILL_H / 2 + 0.5}" text-anchor="middle" dominant-baseline="central"
        style="font-size:10.5px;font-weight:700;fill:${tc};">${escapeHtml(it.label)}</text>
    </g>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Upcoming shows timeline">${grid}${axis}${connectors}${pills}</svg>`;
}

/* ------------------------------------------------------------------ *
 * Card + chip components
 * ------------------------------------------------------------------ */

function chartCard(icon, title, hint, bodyHtml) {
  return `
    <section class="fade-in rounded-2xl bg-white p-4 sm:p-5 shadow-sm ring-1 ring-slate-100">
      <div class="mb-3 flex items-center justify-between gap-2">
        <h3 class="font-display text-sm font-bold text-slate-800">${icon} ${escapeHtml(title)}</h3>
        <span class="text-[11px] font-medium text-slate-400">${escapeHtml(hint)}</span>
      </div>
      ${bodyHtml}
    </section>`;
}

function statChip(emoji, num, label, color) {
  return `
    <div class="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
      <div class="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base" style="background:${color}1a;color:${color}">${emoji}</div>
      <div class="min-w-0">
        <div class="tnum text-lg font-extrabold leading-none text-slate-900">${num}</div>
        <div class="mt-1 truncate text-[11px] font-medium text-slate-500">${escapeHtml(label)}</div>
      </div>
    </div>`;
}

function coloredChip(label, color) {
  return `<span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
    style="background:${color}1f;color:${darken(color, 0.35)}">
    <span class="h-1.5 w-1.5 rounded-full" style="background:${color}"></span>${escapeHtml(label)}</span>`;
}

/* ------------------------------------------------------------------ *
 * Overview sub-view
 * ------------------------------------------------------------------ */

function countBy(arr, keyFn) {
  const m = new Map();
  arr.forEach((x) => { const k = keyFn(x); m.set(k, (m.get(k) || 0) + 1); });
  return m;
}

// A show's END date, so an in-progress multi-day show still counts as "upcoming" until it finishes.
// Exhibitions carry only `start` (ISO) + a display range like "15–20 Sep 2026" — parse the end day
// from that range; fall back to `start` when there's no range.
function showEndDate(d) {
  const iso = (s) => { const t = Date.parse(String(s).length === 10 ? s + 'T00:00:00' : s); return isNaN(t) ? null : new Date(t); };
  // Prefer a real ISO end date when the date-finder captured one.
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(String(d.end || ''))) { const e = iso(d.end); if (e) return e; }
  // Else parse the end day out of the "D–D Mon YYYY" display range.
  const m = String(d && d.dates || '').match(/^\s*\d{1,2}\s*[–—-]\s*(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
  if (m) { const t = Date.parse(`${m[1]} ${m[2]} ${m[3]}`); if (!isNaN(t)) return new Date(t); }
  // Else fall back to the start date.
  if (d && d.start) { const e = iso(d.start); if (e) return e; }
  return null;
}
// True when a dated show hasn't finished yet (end date is today or later).
function showUpcoming(d) {
  const e = showEndDate(d);
  if (!e) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return e >= today;
}

function renderOverview() {
  const data = state.exhibitions;
  const total = data.length;
  const segCounts = countBy(data, (d) => d.segment);
  const engaged = data.filter((d) => ENGAGED.has(d.status)).length;
  const upcoming = data.filter(showUpcoming).length;
  const segments = [...segCounts.keys()].length;

  // 1) Segment donut
  const segItems = [...segCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([seg, v]) => ({ label: segLabel(seg), value: v, color: segColor(seg), key: 'seg:' + seg }));
  const donutSeg = `<div class="flex items-center gap-3 sm:gap-4">${buildDonut(segItems, { centerNum: total, centerLabel: 'shows' })}${buildLegend(segItems, { total })}</div>`;

  // 2) Country bars (top 7)
  const countryCounts = [...countBy(data, (d) => d.country || 'Unknown').entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = countryCounts.slice(0, 7);
  const maxC = top[0] ? top[0][1] : 1, minC = top[top.length - 1] ? top[top.length - 1][1] : 0;
  const barItems = top.map(([c, v]) => ({
    label: c, value: v, flag: FLAGS[c] || '', key: 'ctry:' + c,
    color: lerpColor('#818cf8', '#db2777', maxC === minC ? 0.5 : (v - minC) / (maxC - minC)),
  }));
  const barsLegend = `
    <div class="mt-3 flex items-center gap-2 text-[11px] font-medium text-slate-400">
      <span>fewer</span>
      <span class="h-2 flex-1 rounded-full" style="background:linear-gradient(to right,#818cf8,#db2777)"></span>
      <span>more shows</span>
    </div>`;

  // 3) Engagement stacked bar
  const statusItems = STATUS_ORDER
    .map((st) => ({ label: st, value: data.filter((d) => d.status === st).length, color: STATUS_COLORS[st], key: 'st:' + st }))
    .filter((i) => i.value > 0);
  const statusTotal = statusItems.reduce((s, i) => s + i.value, 0);
  const statusLegend = `<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">` + statusItems.map((i) =>
    `<div class="hovable flex items-center gap-1.5" data-key="${i.key}"
       data-tip-title="${escapeHtml(i.label)}" data-tip-color="${i.color}" data-tip-sub="${plural(i.value, 'show')}">
      <span class="h-2.5 w-2.5 rounded-full" style="background:${i.color}"></span>
      <span class="text-[13px] font-medium text-slate-600">${escapeHtml(i.label)}</span>
      <span class="tnum text-[13px] font-bold text-slate-900">${i.value}</span>
    </div>`).join('') + `</div>`;

  // 4) Upcoming timeline + its segment legend
  const upcomingShows = data.filter(showUpcoming);
  const tlSegs = [...new Set(upcomingShows.map((d) => d.segment))];
  const tlLegend = `<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">` + tlSegs.map((seg) =>
    `<div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full" style="background:${segColor(seg)}"></span>
      <span class="text-[13px] font-medium text-slate-600">${escapeHtml(seg)}</span></div>`).join('') + `</div>`;

  const chips = `
    <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      ${statChip('🎪', total, 'Total shows', '#6366f1')}
      ${statChip('🧩', segments, 'Industries', '#0ea5e9')}
      ${statChip('✅', engaged, 'Already been to', '#10b981')}
      ${statChip('🗓️', upcoming, 'Upcoming', '#ec4899')}
    </div>`;

  // Independent column stacks: no coupled-row gaps, balanced heights, and on
  // mobile they collapse to one column in this order (donut leads).
  const donutCard = `<div data-chart>${chartCard('🧩', 'Shows by industry', 'which markets they cover', donutSeg)}</div>`;
  const timelineCard = `<div data-chart>${chartCard('🗓️', 'Upcoming in 2026', plural(upcomingShows.length, 'dated show'), buildTimeline(upcomingShows) + tlLegend)}</div>`;
  const countriesCard = `<div data-chart>${chartCard('🌍', 'Top countries', 'by number of shows', buildBars(barItems) + barsLegend)}</div>`;
  const engagementCard = `<div data-chart>${chartCard('📈', 'Our involvement', `been to ${engaged} of ${statusTotal}`, buildStackedBar(statusItems) + statusLegend)}</div>`;

  const grid = `
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <div class="space-y-4">${donutCard}${timelineCard}</div>
      <div class="space-y-4">${countriesCard}${engagementCard}</div>
    </div>`;

  return chips + grid;
}

/* ------------------------------------------------------------------ *
 * List sub-view
 * ------------------------------------------------------------------ */

function relCount() {
  return Object.values(state.relevance).filter((v) => v === 'yes').length;
}

function filteredRows() {
  const f = state.filters;
  const q = f.search.trim().toLowerCase();
  return state.exhibitions.filter((d) => {
    if (f.segment !== 'all' && d.segment !== f.segment) return false;
    if (f.country !== 'all' && (d.country || 'Unknown') !== f.country) return false;
    if (f.status !== 'all' && d.status !== f.status) return false;
    if (f.relevantOnly && state.relevance[d.id] !== 'yes') return false;
    if (f.discoveredOnly && d.source !== 'discovered') return false;
    if (q) {
      const hay = `${d.name} ${d.country} ${d.place || ''} ${d.segment}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function relControl(id) {
  const cur = state.relevance[id] || 'undecided';
  const btn = (val, glyph, title) => {
    const active = cur === val;
    const col = REL_COLORS[val];
    const style = active ? `background:${col};color:#fff` : '';
    const cls = active ? '' : 'text-slate-400 hover:bg-slate-50';
    return `<button type="button" data-rel="${val}" title="${title}" aria-pressed="${active}"
      class="rel-btn px-2 py-1 leading-none transition-colors ${cls}" style="${style}">${glyph}</button>`;
  };
  return `<div class="inline-flex overflow-hidden rounded-lg text-[12px] font-bold ring-1 ring-slate-200" data-rel-group="${id}" role="group" aria-label="Relevance">
    ${btn('yes', '✓', 'Relevant')}${btn('no', '✗', 'Skip')}${btn('undecided', '—', 'Undecided')}
  </div>`;
}

function rowsHtml() {
  const rows = filteredRows();
  if (!rows.length) {
    return `<tr><td colspan="7" class="px-4 py-10 text-center text-sm text-slate-400">No exhibitions match these filters.</td></tr>`;
  }
  return rows.map((d) => `
    <tr class="border-t border-slate-100 hover:bg-slate-50/60">
      <td class="whitespace-nowrap px-3 py-2.5">${relControl(d.id)}</td>
      <td class="whitespace-nowrap px-3 py-2.5">${coloredChip(segLabel(d.segment), segColor(d.segment))}</td>
      <td class="px-3 py-2.5 text-sm font-semibold text-slate-800">${escapeHtml(d.name)}${d.source === 'discovered' ? ` <span class="ml-1 inline-flex items-center rounded-full bg-fuchsia-100 px-1.5 py-0.5 align-middle text-[10px] font-bold text-fuchsia-600" title="${escapeHtml(d.relevance_reason || 'Auto-discovered')}">✨ New</span>` : ''}</td>
      <td class="whitespace-nowrap px-3 py-2.5 text-sm text-slate-600">${d.country ? (FLAGS[d.country] || '') + ' ' : ''}${escapeHtml(d.country)}</td>
      <td class="whitespace-nowrap px-3 py-2.5 text-sm text-slate-500">${escapeHtml(d.place || '—')}</td>
      <td class="whitespace-nowrap px-3 py-2.5 text-sm text-slate-500 tnum">${escapeHtml(d.dates || '—')}</td>
      <td class="whitespace-nowrap px-3 py-2.5">${coloredChip(d.status, STATUS_COLORS[d.status] || '#94a3b8')}</td>
    </tr>`).join('');
}

function selectHtml(id, label, value, options) {
  const opts = [`<option value="all">${label}</option>`]
    .concat(options.map((o) => `<option value="${escapeHtml(o)}"${o === value ? ' selected' : ''}>${escapeHtml(o)}</option>`))
    .join('');
  return `<select id="${id}" class="rounded-xl border-0 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none">${opts}</select>`;
}

function renderList() {
  const f = state.filters;
  const segments = [...new Set(state.exhibitions.map((d) => d.segment))].sort();
  const countries = [...new Set(state.exhibitions.map((d) => d.country || 'Unknown'))].sort();
  const statuses = STATUS_ORDER.filter((s) => state.exhibitions.some((d) => d.status === s));

  const toggleOn = f.relevantOnly;
  const toggleCls = toggleOn
    ? 'bg-indigo-600 text-white ring-indigo-600'
    : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50';
  const discovered = state.exhibitions.filter((d) => d.source === 'discovered').length;
  const disCls = f.discoveredOnly
    ? 'bg-fuchsia-600 text-white ring-fuchsia-600'
    : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50';

  return `
    <div class="fade-in">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <div class="relative min-w-[180px] flex-1">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
          <input id="f-search" type="search" value="${escapeHtml(f.search)}" placeholder="Search exhibitions…"
            class="w-full rounded-xl border-0 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
        </div>
        ${selectHtml('f-seg', 'All segments', f.segment, segments)}
        ${selectHtml('f-country', 'All countries', f.country, countries)}
        ${selectHtml('f-status', 'All statuses', f.status, statuses)}
        <button type="button" data-toggle="relevantOnly" aria-pressed="${toggleOn}"
          class="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold shadow-sm ring-1 transition-colors ${toggleCls}">
          ⭐ Relevant only
        </button>
        <button type="button" data-distoggle aria-pressed="${f.discoveredOnly}"
          class="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold shadow-sm ring-1 transition-colors ${disCls}">
          ✨ Newly discovered${discovered ? ` <span class="tnum">${discovered}</span>` : ''}
        </button>
      </div>

      <div class="mb-2 flex items-center justify-between px-0.5 text-[12px] text-slate-500">
        <span><span id="rowCount" class="tnum font-semibold text-slate-700">${filteredRows().length}</span> shown</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span><span id="relCount" class="tnum font-semibold text-emerald-600">${relCount()}</span> marked relevant</span>
      </div>

      <div class="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
        <table class="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <th class="px-3 py-2.5 font-semibold">Relevant?</th>
              <th class="px-3 py-2.5 font-semibold">Industry</th>
              <th class="px-3 py-2.5 font-semibold">Exhibition</th>
              <th class="px-3 py-2.5 font-semibold">Country</th>
              <th class="px-3 py-2.5 font-semibold">Place</th>
              <th class="px-3 py-2.5 font-semibold">Dates</th>
              <th class="px-3 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody id="rows">${rowsHtml()}</tbody>
        </table>
      </div>
    </div>`;
}

// Re-render only the table body + counters (keeps filter inputs & focus).
function refreshRows() {
  const body = $('#rows');
  if (body) body.innerHTML = rowsHtml();
  const rc = $('#rowCount'); if (rc) rc.textContent = filteredRows().length;
  const relc = $('#relCount'); if (relc) relc.textContent = relCount();
}

/* ------------------------------------------------------------------ *
 * Exhibitions tab shell (sub-toggle + body)
 * ------------------------------------------------------------------ */

// External link cell (opens in a new tab) or a muted em-dash when unknown.
const extLink = (url, label) => (url
  ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="text-indigo-600 hover:underline">${label} ↗</a>`
  : '<span class="text-slate-300">—</span>');

const parseShowDate = (s) => { const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s + 'T00:00:00' : s); return isNaN(t) ? null : new Date(t); };

function exhibitionFiltered() {
  const f = state.filters;
  const q = f.search.trim().toLowerCase();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fromD = f.from ? parseShowDate(f.from) : null;
  const toD = f.to ? parseShowDate(f.to) : null;
  const list = state.exhibitions.filter((d) => {
    if (q && !`${d.name} ${d.country || ''} ${d.place || ''} ${d.segment || ''}`.toLowerCase().includes(q)) return false;
    if (f.segment !== 'all' && d.segment !== f.segment) return false;
    const end = showEndDate(d);
    const start = parseShowDate(d.start) || end;
    if (f.timing === 'upcoming' && !(end && end >= today)) return false;
    if (f.timing === 'past' && !(end && end < today)) return false;
    if (fromD || toD) {                                   // "how many shows between these dates"
      if (!start && !end) return false;                  // undated shows can't be placed in a range
      const s = start || end, e = end || start;
      if (toD && s > toD) return false;                  // begins after the window
      if (fromD && e < fromD) return false;              // ended before the window
    }
    return true;
  });
  return exhibitionsByDate(list);
}

function exhibitionRowsHtml() {
  const rows = exhibitionFiltered();
  if (!rows.length) return `<tr><td colspan="8" class="px-4 py-10 text-center text-sm text-slate-400">No exhibitions match your search.</td></tr>`;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return rows.map((d) => {
    const end = showEndDate(d); const past = end && end < today;
    const ended = past ? ' <span class="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-400">ended</span>' : '';
    return `<tr class="cursor-pointer border-t border-slate-100 align-middle hover:bg-slate-50/60" data-exh-id="${escapeHtml(d.id)}" title="See exhibitors from ${escapeHtml(d.name)}">
      <td class="whitespace-nowrap px-3 py-3">${coloredChip(segLabel(d.segment), segColor(d.segment))}</td>
      <td class="px-3 py-3 text-sm font-semibold text-slate-800"><div class="min-w-[150px] max-w-[280px]">${escapeHtml(d.name)}</div></td>
      <td class="whitespace-nowrap px-3 py-3 text-sm text-slate-600">${countryCell(d.country)}</td>
      <td class="whitespace-nowrap px-3 py-3 text-sm text-slate-500">${escapeHtml(dash(d.place))}</td>
      <td class="whitespace-nowrap px-3 py-3 text-sm text-slate-500 tnum">${d.dates ? escapeHtml(d.dates) + ended : '<span class="text-slate-300">—</span>'}</td>
      <td class="whitespace-nowrap px-3 py-3 text-sm">${extLink(d.website, 'Website')}</td>
      <td class="whitespace-nowrap px-3 py-3 text-sm">${extLink(d.registration, 'Register')}</td>
      <td class="whitespace-nowrap px-3 py-3">${coloredChip(d.status, STATUS_COLORS[d.status] || '#94a3b8')}</td>
    </tr>`;
  }).join('');
}

function refreshExhibitionsTable() {
  const b = $('#exhRows'); if (b) b.innerHTML = exhibitionRowsHtml();
  const c = $('#exhCount'); if (c) c.textContent = exhibitionFiltered().length;
}

// One comprehensive, date-sorted table of ALL exhibitions (never hides any). Row → its exhibitors.
function renderExhibitions() {
  if (!state.exhibitions.length) {
    return `<div class="fade-in rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">No exhibitions loaded.</div>`;
  }
  const f = state.filters;
  const total = state.exhibitions.length;
  const upcoming = state.exhibitions.filter(showUpcoming).length;
  const shown = exhibitionFiltered().length;
  const segs = [...new Set(state.exhibitions.map((d) => d.segment))].sort();
  const timingSel = `<select id="f-timing" class="rounded-xl border-0 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none">
      <option value="all"${f.timing === 'all' ? ' selected' : ''}>All dates</option>
      <option value="upcoming"${f.timing === 'upcoming' ? ' selected' : ''}>Upcoming only</option>
      <option value="past"${f.timing === 'past' ? ' selected' : ''}>Completed only</option>
    </select>`;
  const dateBox = `<div class="flex items-center gap-1.5 rounded-xl bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200">
      <span>From</span>
      <input type="date" id="f-from" value="${escapeHtml(f.from)}" aria-label="From date" class="rounded-lg border-0 bg-slate-50 px-2 py-1 text-[12px] text-slate-700 ring-1 ring-slate-200 focus:outline-none" />
      <span>to</span>
      <input type="date" id="f-to" value="${escapeHtml(f.to)}" aria-label="To date" class="rounded-lg border-0 bg-slate-50 px-2 py-1 text-[12px] text-slate-700 ring-1 ring-slate-200 focus:outline-none" />
      ${(f.from || f.to) ? '<button type="button" data-cleardates class="ml-0.5 font-semibold text-indigo-600 hover:underline">clear</button>' : ''}
    </div>`;
  const plain = f.timing === 'all' && !f.from && !f.to;
  return `<div class="fade-in">
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <div class="relative min-w-[160px] flex-1">
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
        <input id="f-search" type="search" value="${escapeHtml(f.search)}" placeholder="Search exhibitions…"
          class="w-full rounded-xl border-0 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
      </div>
      ${selectHtml('f-seg', 'All industries', f.segment, segs)}
      ${timingSel}
      ${dateBox}
    </div>
    <div class="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-0.5 text-[12px] text-slate-500">
      <span><span id="exhCount" class="tnum font-semibold text-slate-700">${shown}</span> of ${total} shows${plain ? ` · <span class="tnum font-semibold text-emerald-600">${upcoming}</span> upcoming` : ''}</span>
      <span class="text-slate-400">Tap a show to see its exhibitors →</span>
    </div>
    <div class="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
      <table class="w-full min-w-[880px] border-collapse text-left">
        <thead><tr class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <th class="px-3 py-2.5 font-semibold">Industry</th>
          <th class="px-3 py-2.5 font-semibold">Exhibition</th>
          <th class="px-3 py-2.5 font-semibold">Country</th>
          <th class="px-3 py-2.5 font-semibold">Place</th>
          <th class="px-3 py-2.5 font-semibold">Date</th>
          <th class="px-3 py-2.5 font-semibold">Website</th>
          <th class="px-3 py-2.5 font-semibold">Registration</th>
          <th class="px-3 py-2.5 font-semibold">Status</th>
        </tr></thead>
        <tbody id="exhRows">${exhibitionRowsHtml()}</tbody>
      </table>
    </div>
  </div>`;
}

function renderPlaceholder(tab) {
  return `
    <div class="fade-in grid place-items-center py-14 sm:py-20">
      <div class="text-center rounded-2xl bg-white px-8 py-12 shadow-sm ring-1 ring-slate-100 sm:px-14">
        <div class="mb-3 text-5xl sm:text-6xl">${tab.icon}</div>
        <div class="font-display text-lg font-extrabold text-slate-800">${escapeHtml(tab.label)}</div>
        <div class="mt-1.5 text-sm text-slate-500">Coming in the next build ✨</div>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * Products tab — Catalog + Where-it-sells (both computed live from JSON)
 * ------------------------------------------------------------------ */

// Pick a property icon by keyword.
function iconForProperty(prop) {
  const p = String(prop).toLowerCase();
  if (/(water|repellent|waterproof|dwr)/.test(p)) return '💧';
  if (/abrasion/.test(p)) return '🛡️';
  if (/(flame|fire|retardant|arc|\bfr\b)/.test(p)) return '🔥';
  if (/uv/.test(p)) return '☀️';
  if (/light/.test(p)) return '🪶';
  if (/(heat|temp|thermal)/.test(p)) return '🌡️';
  if (/(permeab|porosity|airtight|air perme)/.test(p)) return '✈️';
  if (/ballistic/.test(p)) return '🎯';
  if (/(antimicrob|wipe|clean|hygien)/.test(p)) return '🧼';
  if (/breath/.test(p)) return '🌬️';
  if (/(colorfast|printable)/.test(p)) return '🎨';
  if (/(tear|tensile|tenacity|strength|impact|rigid|structured|heavy|durable|fatigue|adhesion|stable|stability|dimensional)/.test(p)) return '💪';
  return '✦';
}

const segShort = (seg) => seg.split(' & ')[0];

// Live count of exhibitions in the segment (via the product→exhibition mapping).
function showsForSegment(seg) {
  const ex = SEG_TO_EXHIB[seg];
  return ex ? state.exhibitions.filter((d) => d.segment === ex).length : 0;
}

function familiesPresent(list) {
  const present = [...new Set(list.map((p) => p.family))];
  const ordered = FAMILY_ORDER.filter((f) => present.includes(f));
  const extras = present.filter((f) => !FAMILY_ORDER.includes(f)).sort();
  return [...ordered, ...extras];
}

function filteredProducts() {
  const f = state.productFilters;
  const q = f.search.trim().toLowerCase();
  return state.products.filter((p) => {
    if (f.industry !== 'all' && !(p.segments || []).includes(f.industry)) return false;
    if (f.family !== 'all' && p.family !== f.family) return false;
    if (q) {
      const hay = `${p.name} ${p.base || ''} ${p.family} ${(p.coatings || []).join(' ')} ${(p.properties || []).join(' ')} ${(p.segments || []).join(' ')} ${(p.applications || []).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function productRow(p) {
  const coatings = (p.coatings || []).map((c) =>
    `<span class="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">${escapeHtml(c)}</span>`).join(' ') || '<span class="text-slate-300">—</span>';
  const props = (p.properties || []).slice(0, 4).map((pr) =>
    `<span class="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-100"><span aria-hidden="true">${iconForProperty(pr)}</span>${escapeHtml(pr)}</span>`).join(' ') || '<span class="text-slate-300">—</span>';
  const segs = (p.segments || []).map((s) => coloredChip(segLabel(s), segColor(s))).join(' ') || '<span class="text-slate-300">—</span>';
  const deniers = p.deniers && p.deniers !== '—' ? ` · ${escapeHtml(p.deniers)}` : '';
  const apps = (p.applications || []).join(', ');
  const srcBadge = p.source && p.source !== 'seed'
    ? `<span class="ml-1 rounded bg-indigo-50 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-indigo-500" title="Found on ${escapeHtml(p.source)}">↗</span>` : '';
  return `
    <tr class="border-t border-slate-100 align-top hover:bg-slate-50/60">
      <td class="px-3 py-2.5"><div class="font-display text-sm font-bold leading-tight text-slate-800">${escapeHtml(p.name)}${srcBadge}</div></td>
      <td class="whitespace-nowrap px-3 py-2.5 text-[13px] text-slate-500">${escapeHtml(p.base || '—')}${deniers}</td>
      <td class="px-3 py-2.5"><div class="flex flex-wrap gap-1">${coatings}</div></td>
      <td class="px-3 py-2.5"><div class="flex flex-wrap gap-1.5">${props}</div></td>
      <td class="px-3 py-2.5"><div class="flex flex-wrap gap-1.5">${segs}</div></td>
      <td class="px-3 py-2.5"><div class="max-w-[240px] truncate text-[12px] text-slate-400" title="${escapeHtml(apps)}">${apps ? escapeHtml(apps) : '—'}</div></td>
    </tr>`;
}

function renderCatalogGrid() {
  const list = filteredProducts();
  if (!list.length) {
    return `<div class="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">No products match these filters.</div>`;
  }
  const thead = `<tr class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
    <th class="px-3 py-2.5">Fabric</th>
    <th class="px-3 py-2.5">Material &amp; weight</th>
    <th class="px-3 py-2.5">Coatings</th>
    <th class="px-3 py-2.5">Key features</th>
    <th class="px-3 py-2.5">Industries</th>
    <th class="px-3 py-2.5">Used for</th>
  </tr>`;
  const groups = familiesPresent(list).map((fam) => {
    const items = list.filter((p) => p.family === fam);
    const header = `<tr class="bg-slate-50/70"><td colspan="6" class="px-3 py-2 text-[12px] font-bold text-slate-600">${FAMILY_ICONS[fam] || '🧵'} ${escapeHtml(fam)}<span class="tnum ml-1.5 font-semibold text-slate-400">${items.length}</span></td></tr>`;
    return header + items.map(productRow).join('');
  }).join('');
  return `<div class="fade-in overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
    <table class="w-full min-w-[900px] border-collapse text-left"><thead>${thead}</thead><tbody>${groups}</tbody></table>
  </div>`;
}

function refreshCatalog() {
  const grid = $('#catalogGrid');
  if (grid) grid.innerHTML = renderCatalogGrid();
  const c = $('#pCount'); if (c) c.textContent = filteredProducts().length;
}

function renderCatalog() {
  const f = state.productFilters;
  const families = familiesPresent(state.products);
  return `
    <div class="fade-in">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <div class="relative min-w-[180px] flex-1">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
          <input id="p-search" type="search" value="${escapeHtml(f.search)}" placeholder="Search products…"
            class="w-full rounded-xl border-0 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
        </div>
        ${selectHtml('p-industry', 'All industries', f.industry, PRODUCT_SEGMENTS)}
        ${selectHtml('p-family', 'All fabric families', f.family, families)}
      </div>
      <div class="mb-3 px-0.5 text-[12px] text-slate-500"><span id="pCount" class="tnum font-semibold text-slate-700">${filteredProducts().length}</span> products</div>
      <div id="catalogGrid">${renderCatalogGrid()}</div>
    </div>`;
}

function renderCoverage() {
  const families = familiesPresent(state.products);
  const cell = (fam, seg) => state.products.filter((p) => p.family === fam && (p.segments || []).includes(seg));

  // Column headers: segment color, short name, and a LIVE "N shows" badge from exhibitions.json.
  const headerRow = `<div></div>` + PRODUCT_SEGMENTS.map((seg) => {
    const color = segColor(seg), n = showsForSegment(seg);
    const badge = n > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400';
    return `<div class="px-1 pb-2 text-center">
      <div class="mx-auto mb-1 h-1.5 w-6 rounded-full" style="background:${color}"></div>
      <div class="text-[11px] font-semibold leading-tight text-slate-600">${escapeHtml(segShort(seg))}</div>
      <div class="mt-1 inline-block rounded-full ${badge} px-1.5 py-0.5 text-[10px] font-semibold tnum">${n} shows</div>
    </div>`;
  }).join('');

  let stagger = 0;
  const rows = families.map((fam) => {
    const cells = PRODUCT_SEGMENTS.map((seg) => {
      const items = cell(fam, seg);
      if (!items.length) return `<div class="grid place-items-center py-2"><span class="h-1 w-1 rounded-full bg-slate-200"></span></div>`;
      const color = segColor(seg);
      const d = Math.min(18 + (items.length - 1) * 7, 34);
      const sub = items.map((p) => `${p.name} — ${(p.applications || []).slice(0, 2).join(', ')}`).join('  ·  ');
      stagger += 24;
      return `<div class="grid place-items-center py-2">
        <div class="mx-dot reveal-pop grid place-items-center rounded-full font-bold text-white"
          data-tip-title="${escapeHtml(segShort(fam) + ' → ' + seg)}" data-tip-color="${color}" data-tip-sub="${escapeHtml(sub)}"
          style="width:${d}px;height:${d}px;background:${color};font-size:11px;transition-delay:${stagger}ms">${items.length}</div>
      </div>`;
    }).join('');
    return `<div class="flex items-center overflow-hidden pr-2 text-[12px] font-semibold text-slate-600">${FAMILY_ICONS[fam] || '🧵'}<span class="ml-1 truncate">${escapeHtml(fam)}</span></div>${cells}`;
  }).join('');

  const gridStyle = `grid-template-columns: minmax(120px,1.4fr) repeat(${PRODUCT_SEGMENTS.length}, minmax(58px,1fr));`;
  const matrix = `
    <div class="overflow-x-auto">
      <div class="grid min-w-[660px] items-center gap-y-1" style="${gridStyle}">${headerRow}${rows}</div>
    </div>`;

  const legend = `<div class="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">` + PRODUCT_SEGMENTS.map((seg) =>
    `<div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full" style="background:${segColor(seg)}"></span>
      <span class="text-[12px] font-medium text-slate-600">${escapeHtml(segLabel(seg))}</span></div>`).join('') + `</div>`;

  // Auto-computed insight chips (NOT hand-written): served / with-shows / whitespace.
  const served = [...new Set(state.products.flatMap((p) => p.segments || []))];
  const withShows = served.filter((s) => showsForSegment(s) > 0).length;
  const whitespace = PRODUCT_SEGMENTS.filter((s) => served.includes(s) && showsForSegment(s) === 0);
  const wsShort = whitespace.map(segShort).join(', ');
  const insight = `
    <div class="mt-4 flex flex-wrap gap-2">
      <span class="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-100">
        <span class="grid h-6 w-6 place-items-center rounded-lg" style="background:#6366f11a;color:#6366f1">🌐</span>
        <span class="font-medium text-slate-600">Industries served</span>
        <span class="tnum font-bold text-slate-900">${served.length}</span>
      </span>
      <span class="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-100">
        <span class="grid h-6 w-6 place-items-center rounded-lg" style="background:#10b9811a;color:#10b981">🎪</span>
        <span class="font-medium text-slate-600">With exhibitions</span>
        <span class="tnum font-bold text-slate-900">${withShows}</span>
      </span>
      ${whitespace.length ? `<span class="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm shadow-sm ring-1 ring-amber-200">
        <span aria-hidden="true">🔍</span><span class="font-semibold text-amber-700">Untapped:</span>
        <span class="font-medium text-amber-700">${escapeHtml(wsShort)}</span>
        <span class="hidden text-[12px] text-amber-600 sm:inline">— we make fabric for these, but attend no shows yet</span>
      </span>` : ''}
    </div>`;

  return `<div class="fade-in">${chartCard('🧭', 'Which industries we serve', 'bigger dot = more of our fabrics fit that industry', matrix + legend)}${insight}</div>`;
}

function renderProducts() {
  if (!state.products.length) {
    return `<div class="fade-in rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">No product catalog loaded.</div>`;
  }
  const subBtn = (id, label) => {
    const active = state.productsSub === id;
    const cls = active ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700';
    return `<button type="button" data-psub="${id}" class="rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${cls}">${label}</button>`;
  };
  const toggle = `<div class="inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">${subBtn('catalog', '📦 Catalog')}${subBtn('coverage', '🎯 Where it sells')}</div>`;
  const body = state.productsSub === 'catalog' ? renderCatalog() : renderCoverage();
  return `<div class="mb-4">${toggle}</div>${body}`;
}

/* ------------------------------------------------------------------ *
 * Leads tab — Overview + sortable list + drill-panel
 * ------------------------------------------------------------------ */

const dash = (v) => (v == null || v === '' ? '—' : v);

function fmtNum(n) {
  n = Number(n);
  if (!isFinite(n)) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(n);
}
function fmtConsumption(v) {
  if (v == null || v === '') return '—';
  const m = String(v).match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) return `${fmtNum(m[1])}–${fmtNum(m[2])}`;
  const single = String(v).match(/\d+/);
  return single ? fmtNum(single[0]) : String(v);
}
const consumptionSortVal = (v) => { const m = String(v || '').match(/\d+/); return m ? Number(m[0]) : -1; };
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return String(iso); } };

function priorityChip(pri) {
  if (pri === 'High') return `<span class="inline-flex items-center rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-semibold text-white">High</span>`;
  return `<span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">${escapeHtml(pri || '—')}</span>`;
}

function renderLeadsOverview() {
  const leads = state.leads;
  const total = leads.length;
  const segCounts = countBy(leads, (d) => d.segment);
  const high = leads.filter((d) => d.priority === 'High').length;
  const withSite = leads.filter((d) => d.website).length;
  // Honest email reality (who you can actually reach), computed live from the classifier.
  const ec = { good: 0, company: 0, need: 0 };
  leads.forEach((l) => { ec[leadEmailClass(l.id)]++; });

  const chips = `
    <div class="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      ${statChip('🎯', total, 'Total leads', '#6366f1')}
      ${statChip('🧩', segCounts.size, 'Segments', '#0ea5e9')}
      ${statChip('⭐', high, 'High priority', '#10b981')}
      ${statChip('🌐', withSite, 'With website', '#f59e0b')}
    </div>`;

  // Headline: the email split in plain terms — never a vague single "verified emails" number.
  const emailLine = `
    <div class="mb-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
      <div class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">📧 Emails — who you can actually reach</div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full" style="background:#10b981"></span><span class="tnum font-bold text-slate-900">${ec.good}</span><span class="text-slate-600">real people (verified / personal)</span></span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full" style="background:#f59e0b"></span><span class="tnum font-bold text-slate-900">${ec.company}</span><span class="text-slate-600">company inboxes (info@ / sales@)</span></span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full" style="background:#94a3b8"></span><span class="tnum font-bold text-slate-900">${ec.need}</span><span class="text-slate-600">still need a contact</span></span>
      </div>
    </div>`;

  // Live source split (grows once the classify engine appends exhibition leads).
  const found = leads.filter((d) => isEngineSource(d.source)).length;
  const research = total - found;
  const sourceLine = `
    <div class="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
      <span class="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-medium text-slate-600 shadow-sm ring-1 ring-slate-100"><span class="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>Starting research <span class="tnum font-bold text-slate-900">${research}</span></span>
      <span class="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-medium text-slate-600 shadow-sm ring-1 ring-slate-100"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>AI-found <span class="tnum font-bold text-slate-900">${found}</span></span>
    </div>`;

  const segItems = [...segCounts.entries()].sort((a, b) => b[1] - a[1])
    .map(([s, v]) => ({ label: s, value: v, color: leadSegColor(s), key: 'lseg:' + s }));
  const donut = `<div class="flex items-center gap-3 sm:gap-4">${buildDonut(segItems, { centerNum: total, centerLabel: 'leads', unit: 'lead' })}${buildLegend(segItems, { total, unit: 'lead' })}</div>`;

  const countryCounts = [...countBy(leads, (d) => d.country || 'Unknown').entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10);
  const maxC = countryCounts[0] ? countryCounts[0][1] : 1, minC = countryCounts.length ? countryCounts[countryCounts.length - 1][1] : 0;
  const countryItems = countryCounts.map(([c, v]) => ({ label: c, value: v, flag: FLAGS[c] || '', key: 'lc:' + c, color: lerpColor('#818cf8', '#db2777', maxC === minC ? 0.5 : (v - minC) / (maxC - minC)) }));
  const countryLegend = `<div class="mt-3 flex items-center gap-2 text-[11px] font-medium text-slate-400"><span>fewer</span><span class="h-2 flex-1 rounded-full" style="background:linear-gradient(to right,#818cf8,#db2777)"></span><span>more leads</span></div>`;

  const priItems = ['High', 'Medium'].map((p) => ({ label: p, value: leads.filter((d) => d.priority === p).length, color: PRIORITY_COLORS[p], key: 'pri:' + p })).filter((i) => i.value > 0);
  const priLegend = `<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">` + priItems.map((i) =>
    `<div class="hovable flex items-center gap-1.5" data-key="${i.key}" data-tip-title="${escapeHtml(i.label)} priority" data-tip-color="${i.color}" data-tip-sub="${plural(i.value, 'lead')}"><span class="h-2.5 w-2.5 rounded-full" style="background:${i.color}"></span><span class="text-[13px] font-medium text-slate-600">${i.label}</span><span class="tnum text-[13px] font-bold text-slate-900">${i.value}</span></div>`).join('') + `</div>`;

  // Source-backed outreach progress (replaces the old best-fit-fabric estimate chart).
  const statusItems = [
    { label: 'Website found', value: withSite, key: 'st:site', color: '#6366f1' },
    { label: 'Personal / verified email', value: ec.good, key: 'st:good', color: '#10b981' },
    { label: 'Company inbox only', value: ec.company, key: 'st:company', color: '#f59e0b' },
    { label: 'Need contact', value: ec.need, key: 'st:need', color: '#94a3b8' },
  ].filter((i) => i.value > 0);

  const grid = `
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <div class="space-y-4">
        <div data-chart>${chartCard('🧩', 'Leads by industry', 'what they make', donut)}</div>
        <div data-chart>${chartCard('📇', 'Outreach readiness', 'source-backed progress', buildBars(statusItems, { unit: 'lead' }))}</div>
      </div>
      <div class="space-y-4">
        <div data-chart>${chartCard('🌍', 'Top countries', 'by number of leads', buildBars(countryItems, { unit: 'lead' }) + countryLegend)}</div>
        <div data-chart>${chartCard('⭐', 'Priority split', 'high vs medium', buildStackedBar(priItems, { unit: 'lead' }) + priLegend)}</div>
      </div>
    </div>`;

  return chips + emailLine + sourceLine + grid;
}

function filteredLeads() {
  const f = state.leadFilters;
  const q = f.search.trim().toLowerCase();
  return state.leads.filter((l) => {
    if (f.view === 'mine' && !isStarred(l.id)) return false;
    if (f.show !== 'all' && l.source !== 'exhibition:' + f.show) return false;
    if (f.segment !== 'all' && l.segment !== f.segment) return false;
    if (f.country !== 'all' && (l.country || 'Unknown') !== f.country) return false;
    if (f.priority !== 'all' && l.priority !== f.priority) return false;
    if (f.emailClass !== 'all' && leadEmailClass(l.id) !== f.emailClass) return false;
    if (q) {
      const hay = `${l.company} ${l.country} ${l.segment} ${l.application || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
// Email bucket for a lead, for the Leads summary + filter:
//   'good' = personal or verified · 'company' = generic/role inbox · 'need' = no email yet.
function leadEmailClass(id) {
  const cls = classifyEmail(displayContact(id));
  return (cls === 'verified' || cls === 'personal') ? 'good' : cls === 'company' ? 'company' : 'need';
}

function sortedLeads(list) {
  const { key, dir } = state.leadSort;
  const s = dir === 'asc' ? 1 : -1;
  const val = (l) => {
    if (key === 'priority') return l.priority === 'High' ? 0 : 1;
    if (key === 'contact') { const c = displayContact(l.id); return ((c && (c.name || c.email)) || '~').toLowerCase(); }
    return String(l[key] ?? '').toLowerCase();
  };
  return [...list].sort((a, b) => {
    const va = val(a), vb = val(b);
    if (va < vb) return -s;
    if (va > vb) return s;
    return a.company.localeCompare(b.company);
  });
}

// Exhibitors-table cells (merge leads.json + outreach.json contacts live; graceful "—").
function leadContactCell(l) {
  const c = displayContact(l.id);
  if (!c || (!c.name && !c.linkedin_url)) return '<span class="text-sm text-slate-300">—</span>';
  const name = c.name
    ? `<div class="truncate text-sm text-slate-700" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>`
    : '<div class="text-sm text-slate-400">—</div>';
  const role = c.title ? `<div class="truncate text-[11px] text-slate-400" title="${escapeHtml(c.title)}">${escapeHtml(c.title)}</div>` : '';
  const li = c.linkedin_url ? `<a href="${escapeHtml(c.linkedin_url)}" target="_blank" rel="noopener" class="mt-0.5 inline-block text-[11px] font-semibold text-[#0a66c2] hover:underline">in ↗</a>` : '';
  return `<div class="max-w-[150px]">${name}${role}${li}</div>`;
}
function leadLinkedinCell(l) {
  const c = displayContact(l.id);
  return (c && c.linkedin_url)
    ? `<a href="${escapeHtml(c.linkedin_url)}" target="_blank" rel="noopener" class="font-semibold text-[#0a66c2] hover:underline">in ↗</a>`
    : '<span class="text-slate-300">—</span>';
}
function leadEmailCell(l) {
  const c = displayContact(l.id);
  if (c && c.email) return `<div class="max-w-[170px]"><a href="mailto:${escapeHtml(c.email)}" class="block truncate text-[13px] text-indigo-600 hover:underline" title="${escapeHtml(c.email)}">${escapeHtml(c.email)}</a><div class="mt-0.5">${emailClassBadge(c)}</div></div>`;
  return emailClassBadge(c, true); // grey "No email"
}
// Table cell: just the chip — tap the row to see the full plain-English reason in the detail panel.
function leadPriorityCell(l) {
  return `<div class="whitespace-nowrap" title="${escapeHtml(priorityReason(l))}">${priorityChip(l.priority)}</div>`;
}
function leadShowCell(l) {
  const show = sourceShow(l.source);
  if (show) return `<div class="max-w-[130px] truncate text-[12px] text-slate-600" title="${escapeHtml(show.name)}">🎪 ${escapeHtml(show.name)}</div>`;
  return '<span class="text-slate-300">—</span>';
}
const leadStarCell = (l) => {
  const on = isStarred(l.id);
  return `<button type="button" data-star="${escapeHtml(l.id)}" aria-pressed="${on}" title="${on ? 'Remove from my leads' : 'Move to my leads'}" class="text-lg leading-none ${on ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'}">${on ? '★' : '☆'}</button>`;
};

function leadsTableHtml() {
  const { key: sk, dir } = state.leadSort;
  const arrow = (k) => (sk === k ? (dir === 'asc' ? ' ▲' : ' ▼') : '');
  const sortTh = (k, label) => `<th class="cursor-pointer whitespace-nowrap px-3 py-2.5 font-semibold hover:text-slate-600 ${sk === k ? 'text-indigo-600' : ''}" data-sort="${k}">${escapeHtml(label)}<span class="tnum">${arrow(k)}</span></th>`;
  const plainTh = (label) => `<th class="whitespace-nowrap px-3 py-2.5 font-semibold">${escapeHtml(label)}</th>`;
  const thead = `<tr class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
    <th class="px-2 py-2.5"></th>${sortTh('company', 'Company')}${sortTh('segment', 'Industry')}${sortTh('country', 'Country')}${sortTh('contact', 'Contact')}${plainTh('Email')}${sortTh('priority', 'Priority')}${plainTh('Show')}
  </tr>`;
  const rows = sortedLeads(filteredLeads());
  const body = rows.length ? rows.map((l) => `
    <tr class="cursor-pointer border-t border-slate-100 align-middle hover:bg-slate-50/60" data-lead-id="${escapeHtml(l.id)}" title="Open ${escapeHtml(l.company)} — full details">
      <td class="px-2 py-3 text-center">${leadStarCell(l)}</td>
      <td class="px-3 py-3"><div class="flex max-w-[220px] items-center gap-1.5"><span class="truncate text-sm font-semibold text-slate-800" title="${escapeHtml(l.company)}">${escapeHtml(l.company)}</span>${isRecommended(l) ? '<span class="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600" title="Recommended lead">★ Rec</span>' : ''}</div></td>
      <td class="whitespace-nowrap px-3 py-3">${coloredChip(l.segment, leadSegColor(l.segment))}</td>
      <td class="whitespace-nowrap px-3 py-3 text-sm text-slate-600">${countryCell(l.country)}</td>
      <td class="px-3 py-3">${leadContactCell(l)}</td>
      <td class="px-3 py-3">${leadEmailCell(l)}</td>
      <td class="px-3 py-3">${leadPriorityCell(l)}</td>
      <td class="px-3 py-3">${leadShowCell(l)}</td>
    </tr>`).join('') : `<tr><td colspan="8" class="px-4 py-10 text-center text-sm text-slate-400">No exhibitors match these filters.</td></tr>`;
  return `<table class="w-full min-w-[900px] border-collapse text-left"><thead>${thead}</thead><tbody>${body}</tbody></table>`;
}

function refreshLeadsTable() {
  const w = $('#leadsTableWrap'); if (w) w.innerHTML = leadsTableHtml();
  const c = $('#lCount'); if (c) c.textContent = filteredLeads().length;
}

function renderLeadsList() {
  const f = state.leadFilters;
  const segs = [...new Set(state.leads.map((l) => l.segment))].sort();
  const countries = [...new Set(state.leads.map((l) => l.country || 'Unknown'))].sort();
  // Live email-class split across ALL leads (not just the current filtered view).
  const ec = { good: 0, company: 0, need: 0 };
  state.leads.forEach((l) => { ec[leadEmailClass(l.id)]++; });
  const classChip = (key, label, color, n) => {
    const on = f.emailClass === key;
    return `<button type="button" data-lclass="${key}" aria-pressed="${on}"
      class="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold shadow-sm ring-1 transition-colors ${on ? 'text-white ring-transparent' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}"
      style="${on ? `background:${color}` : ''}">${label} <span class="tnum">${n}</span></button>`;
  };
  const starCount = state.leads.filter((l) => isStarred(l.id)).length;
  const viewBtn = (key, label) => {
    const on = f.view === key;
    return `<button type="button" data-leadview="${key}" aria-pressed="${on}" class="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${on ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">${label}</button>`;
  };
  const viewToggle = `<div class="inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">${viewBtn('all', 'All exhibitors')}${viewBtn('mine', `⭐ My leads${starCount ? ` (${starCount})` : ''}`)}</div>`;
  const showEx = f.show !== 'all' ? state.exhibitions.find((e) => e.id === f.show) : null;
  const showBanner = f.show !== 'all'
    ? `<div class="mb-3 flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-[13px] text-indigo-700 ring-1 ring-indigo-100"><span>🎪 Showing exhibitors from <span class="font-semibold">${escapeHtml(showEx ? showEx.name : f.show)}</span></span><button type="button" data-clearshow class="font-semibold underline">clear</button></div>`
    : '';
  return `
    <div class="fade-in">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        ${viewToggle}
        <div class="relative min-w-[160px] flex-1">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
          <input id="l-search" type="search" value="${escapeHtml(f.search)}" placeholder="Search exhibitors…"
            class="w-full rounded-xl border-0 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
        </div>
        ${selectHtml('l-seg', 'All segments', f.segment, segs)}
        ${selectHtml('l-country', 'All countries', f.country, countries)}
        ${selectHtml('l-priority', 'All priorities', f.priority, ['High', 'Medium'])}
      </div>
      ${showBanner}
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <span class="text-[12px] font-medium text-slate-400">Email:</span>
        ${classChip('good', '✅ Personal / verified', '#10b981', ec.good)}
        ${classChip('company', '🏢 Company inbox', '#f59e0b', ec.company)}
        ${classChip('need', '📮 Need contact', '#64748b', ec.need)}
        ${f.emailClass !== 'all' ? `<button type="button" data-lclass="${f.emailClass}" class="text-[12px] font-semibold text-indigo-600 hover:underline">clear filter</button>` : ''}
      </div>
      <div class="mb-2 px-0.5 text-[12px] text-slate-500"><span id="lCount" class="tnum font-semibold text-slate-700">${filteredLeads().length}</span> shown · ⭐ ${starCount} my leads</div>
      <div class="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"><div id="leadsTableWrap">${leadsTableHtml()}</div></div>
    </div>`;
}

// Exhibitors tab — one comprehensive table (companies exhibiting at the shows).
function renderLeads() {
  if (!state.leads.length) {
    return `<div class="fade-in rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">No exhibitors loaded.</div>`;
  }
  return renderLeadsList();
}

// Drill-panel (right slide-over) for a single lead.
function openLeadDrawer(id) {
  const l = state.leads.find((x) => x.id === id);
  if (!l) return;
  const row = (label, val) => `<div class="flex justify-between gap-4 border-b border-slate-100 py-2.5"><span class="shrink-0 text-[12px] font-medium text-slate-400">${escapeHtml(label)}</span><span class="text-right text-[13px] font-semibold text-slate-700">${val}</span></div>`;
  const website = l.website ? `<a href="${escapeHtml(l.website)}" target="_blank" rel="noopener" class="text-indigo-600 hover:underline">${escapeHtml(String(l.website).replace(/^https?:\/\//, ''))}</a>` : '—';
  const show = sourceShow(l.source);
  const why = priorityReason(l);
  const body = `
    <div class="flex flex-wrap items-center gap-2">${coloredChip(l.segment, leadSegColor(l.segment))}${priorityChip(l.priority)}${isRecommended(l) ? '<span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">★ Recommended</span>' : ''}</div>
    ${why ? `<p class="mt-2 text-[13px] leading-snug text-slate-500">${escapeHtml(why)}</p>` : ''}
    <div class="mt-4">
      ${row('Country', countryCell(l.country))}
      ${row('Fabric fit', escapeHtml(dash(l.fabric_fit)))}
      ${row('Used for', escapeHtml(dash(l.application)))}
      ${row('Website', website)}
      ${show ? row('Exhibiting at', '🎪 ' + escapeHtml(show.name)) : ''}
    </div>`;
  // Layer B — manual contact bridge (Nishad's real ContactOut-extension workflow).
  // Only a source-backed, relevant contact is shown; a mismatched person is hidden.
  const rc = displayContact(l.id);
  const rcHas = rc && (rc.name || rc.email);
  const bridge = `
    <div class="mb-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <div class="mb-1.5 flex items-center justify-between gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Contact</span>
        ${emailClassBadge(rc, true)}
      </div>
      ${rcHas
        ? `<div class="text-sm font-bold text-slate-800">${escapeHtml(rc.name || rc.email)}</div>${rc.title ? `<div class="text-[12px] text-slate-500">${escapeHtml(rc.title)}</div>` : ''}${rc.email ? `<div class="mt-0.5 text-[12px]"><a href="mailto:${escapeHtml(rc.email)}" class="text-indigo-600 hover:underline">${escapeHtml(rc.email)}</a></div>` : ''}`
        : `<div class="text-[13px] text-slate-500">No verified contact yet — find one on LinkedIn below.</div>`}
      <div class="mt-2 flex flex-wrap gap-2">
        <a href="${escapeHtml(linkedinSearchUrl(l))}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 rounded-lg bg-[#0a66c2] px-2.5 py-1.5 text-[12px] font-semibold text-white hover:opacity-90">🔗 Find contact on LinkedIn ↗</a>
        ${rc && rc.linkedin_url ? `<a href="${escapeHtml(rc.linkedin_url)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#0a66c2] ring-1 ring-slate-200 hover:bg-slate-50">Open profile ↗</a>` : ''}
      </div>
      <div class="mt-2 flex gap-2">
        <input type="email" data-manual-email="${escapeHtml(l.id)}" value="${escapeHtml(rc && rc.email ? rc.email : '')}" placeholder="paste email from LinkedIn…" class="min-w-0 flex-1 rounded-lg border-0 bg-white px-3 py-1.5 text-[13px] text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
        <button type="button" data-action="save-draft" data-lead-id="${escapeHtml(l.id)}" class="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700">Save &amp; draft</button>
      </div>
    </div>`;
  const html = `
    <div data-drawer-backdrop class="absolute inset-0 bg-slate-900/30"></div>
    <aside class="drawer-panel absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
      <div class="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
        <div><h3 class="font-display text-lg font-extrabold leading-tight text-slate-900">${escapeHtml(l.company)}</h3><p class="mt-0.5 text-[12px] text-slate-500">Potential customer</p></div>
        <button type="button" data-drawer-close aria-label="Close" class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
      </div>
      <div class="flex-1 overflow-y-auto p-5">${body}</div>
      <div class="border-t border-slate-100 p-5">
        ${bridge}
        <button type="button" data-action="draft-email" data-lead-id="${escapeHtml(l.id)}" class="w-full rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95">✉️ Draft outreach email</button>
      </div>
    </aside>`;
  const d = $('#drawer');
  d.innerHTML = html;
  requestAnimationFrame(() => d.classList.add('open'));
  try { document.body.style.overflow = 'hidden'; } catch { /* noop */ }
}
function closeDrawer() {
  const d = $('#drawer');
  if (!d || !d.classList.contains('open')) return;
  d.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => { if (!d.classList.contains('open')) d.innerHTML = ''; }, 260);
}

// Right-side detail panel for a competitor (same style as the lead drawer).
function openCompetitorDrawer(id) {
  const c = state.competitors.find((x) => x.id === id);
  if (!c) return;
  const b = positionBucket(c.positioning);
  const show = sourceShow(c.source);
  const whichShow = show ? '🎪 ' + escapeHtml(show.name) : '—';
  const row = (label, val) => `<div class="flex justify-between gap-4 border-b border-slate-100 py-2.5"><span class="shrink-0 text-[12px] font-medium text-slate-400">${escapeHtml(label)}</span><span class="text-right text-[13px] font-semibold text-slate-700">${val}</span></div>`;
  const segs = (c.segments || []).map((s) => coloredChip(segLabel(s), anyColor(s))).join(' ') || '<span class="text-slate-300">—</span>';
  const body = `
    <div class="flex flex-wrap items-center gap-2">${coloredChip(b.label, b.color)}</div>
    <div class="mt-4">
      ${row('Country', countryCell(c.country))}
      ${row('How they compete', escapeHtml(b.label))}
      ${row('Which show', whichShow)}
    </div>
    <div class="mt-4">
      <div class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">What they sell</div>
      <div class="rounded-xl bg-slate-50 p-3 text-[13px] text-slate-700 ring-1 ring-slate-100">${escapeHtml(dash(c.focus))}</div>
    </div>
    <div class="mt-4">
      <div class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Industries</div>
      <div class="flex flex-wrap gap-1.5">${segs}</div>
    </div>`;
  const html = `
    <div data-drawer-backdrop class="absolute inset-0 bg-slate-900/30"></div>
    <aside class="drawer-panel absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
      <div class="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
        <div><h3 class="font-display text-lg font-extrabold leading-tight text-slate-900">${escapeHtml(c.company)}</h3><p class="mt-0.5 text-[12px] text-slate-500">Competitor</p></div>
        <button type="button" data-drawer-close aria-label="Close" class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
      </div>
      <div class="flex-1 overflow-y-auto p-5">${body}</div>
    </aside>`;
  const d = $('#drawer');
  d.innerHTML = html;
  requestAnimationFrame(() => d.classList.add('open'));
  try { document.body.style.overflow = 'hidden'; } catch { /* noop */ }
}

/* ------------------------------------------------------------------ *
 * Competitors tab — Landscape + list
 * ------------------------------------------------------------------ */

function renderCompetitorsLandscape() {
  const comps = state.competitors;
  const total = comps.length;

  const supply = [
    { country: 'China', flag: '🇨🇳', role: 'Low cost', color: '#f59e0b' },
    { country: 'Taiwan', flag: '🇹🇼', role: 'Premium', color: '#6366f1' },
    { country: 'South Korea', flag: '🇰🇷', role: 'High-tech', color: '#0ea5e9' },
    { country: 'Vietnam', flag: '🇻🇳', role: 'Volume making', color: '#10b981' },
  ];
  const supplyChips = supply.map((s) =>
    `<div class="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
      <span>${s.flag}</span><span class="text-sm font-semibold text-slate-700">${s.country}</span>
      <span class="rounded-full px-2 py-0.5 text-[11px] font-semibold" style="background:${s.color}1f;color:${darken(s.color, 0.35)}">${s.role}</span>
    </div>`).join('') +
    `<div class="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-3 py-2 text-white shadow-sm">
      <span>🇮🇳</span><span class="text-sm font-extrabold">India</span>
      <span class="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">Kusumgar</span>
    </div>`;
  const strip = `
    <section class="fade-in mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-5">
      <h3 class="mb-3 font-display text-sm font-bold text-slate-800">🌐 Where the competition comes from</h3>
      <div class="flex flex-wrap gap-2">${supplyChips}</div>
      <p class="mt-3 text-[13px] text-slate-500"><span class="font-semibold text-slate-700">Kusumgar's edge:</span> a reliable India-based alternative to China — wins on service and customisation, not just the lowest price.</p>
    </section>`;

  const countryCounts = [...countBy(comps, (d) => d.country || 'Unknown').entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const maxC = countryCounts[0] ? countryCounts[0][1] : 1, minC = countryCounts.length ? countryCounts[countryCounts.length - 1][1] : 0;
  const countryItems = countryCounts.map(([c, v]) => ({ label: c, value: v, flag: FLAGS[c] || '', key: 'cc:' + c, color: lerpColor('#818cf8', '#db2777', maxC === minC ? 0.5 : (v - minC) / (maxC - minC)) }));
  const countryLegend = `<div class="mt-3 flex items-center gap-2 text-[11px] font-medium text-slate-400"><span>fewer</span><span class="h-2 flex-1 rounded-full" style="background:linear-gradient(to right,#818cf8,#db2777)"></span><span>more competitors</span></div>`;

  const posMap = new Map();
  comps.forEach((c) => { const b = positionBucket(c.positioning); posMap.set(b.label, (posMap.get(b.label) || 0) + 1); });
  const posItems = [...posMap.entries()].sort((a, b) => b[1] - a[1]).map(([label, v]) => {
    const b = POSITION_BUCKETS.find((x) => x.label === label);
    return { label, value: v, color: b ? b.color : '#94a3b8', key: 'pos:' + label };
  });
  const posDonut = `<div class="flex items-center gap-3 sm:gap-4">${buildDonut(posItems, { centerNum: total, centerLabel: 'competitors', unit: 'competitor' })}${buildLegend(posItems, { total, unit: 'competitor' })}</div>`;

  const grid = `
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <div data-chart>${chartCard('🌍', 'Competitors by country', 'where they are based', buildBars(countryItems, { unit: 'competitor' }) + countryLegend)}</div>
      <div data-chart>${chartCard('🏷️', 'How they compete', 'their main strategy', posDonut)}</div>
    </div>`;

  return strip + grid;
}

function renderCompetitorsList() {
  const comps = state.competitors;
  if (!comps.length) {
    return `<div class="fade-in rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">No competitors loaded.</div>`;
  }
  const thead = `<tr class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
    <th class="px-3 py-2.5">Company</th>
    <th class="px-3 py-2.5">Country</th>
    <th class="px-3 py-2.5">How they compete</th>
    <th class="px-3 py-2.5">What they sell</th>
    <th class="px-3 py-2.5">Industries</th>
    <th class="px-3 py-2.5">Which show</th>
  </tr>`;
  const rows = comps.map((c) => {
    const b = positionBucket(c.positioning);
    const segs = (c.segments || []).map((s) => coloredChip(segLabel(s), anyColor(s))).join(' ') || '<span class="text-slate-300">—</span>';
    const show = sourceShow(c.source);
    const showCell = show ? `<div class="max-w-[150px] truncate text-[12px] text-slate-600" title="${escapeHtml(show.name)}">🎪 ${escapeHtml(show.name)}</div>` : '<span class="text-slate-300">—</span>';
    return `
      <tr class="cursor-pointer border-t border-slate-100 align-middle hover:bg-slate-50/60" data-comp-id="${escapeHtml(c.id)}" title="Open ${escapeHtml(c.company)} — full details">
        <td class="px-3 py-3 text-sm font-semibold text-slate-800"><div class="max-w-[190px] truncate" title="${escapeHtml(c.company)}">${escapeHtml(c.company)}</div></td>
        <td class="whitespace-nowrap px-3 py-3 text-sm text-slate-600">${countryCell(c.country)}</td>
        <td class="whitespace-nowrap px-3 py-3">${coloredChip(b.label, b.color)}</td>
        <td class="px-3 py-3"><div class="max-w-[320px] truncate text-[13px] text-slate-600" title="${escapeHtml(c.focus || '')}">${escapeHtml(dash(c.focus))}</div></td>
        <td class="px-3 py-3"><div class="flex flex-wrap gap-1.5">${segs}</div></td>
        <td class="whitespace-nowrap px-3 py-3">${showCell}</td>
      </tr>`;
  }).join('');
  return `<div class="fade-in overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
    <table class="w-full min-w-[960px] border-collapse text-left"><thead>${thead}</thead><tbody>${rows}</tbody></table>
  </div>`;
}

function renderCompetitors() {
  if (!state.competitors.length) {
    return `<div class="fade-in rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">No competitors loaded.</div>`;
  }
  const total = state.competitors.length;
  return `<div class="fade-in">
    <div class="mb-2 px-0.5 text-[12px] text-slate-500"><span class="tnum font-semibold text-slate-700">${total}</span> competitors · tap any to see full details</div>
    ${renderCompetitorsList()}
  </div>`;
}

/* ------------------------------------------------------------------ *
 * Outreach tab — contacts + email modal + pipeline tracker
 * ------------------------------------------------------------------ */

const outreachFor = (id) => state.outreach[id] || {};
const validStage = (s) => STAGE_KEYS.includes(s);

/* ---- Email classification (LABELING ONLY — never changes how the finders work) ----
 * Every found email is one of four honest buckets so Nishad sees who he can actually reach:
 *   verified — confirmed deliverable by Prospeo/Reoon (and tied to a person, not a role inbox)
 *   personal — address tied to a person's name (first.last@, flast@, name appears in the handle)
 *   company  — a generic/role inbox (info@, sales@, dealers@ …): real & usable, but NOT the buyer
 *   none     — no email yet (still needs the manual step)
 * A company/role inbox is NEVER shown as "verified" even if a provider confirmed it. */
const GENERIC_INBOX = new Set(['info', 'sales', 'contact', 'support', 'service', 'admin', 'hello', 'enquiries', 'enquiry', 'dealers', 'orders', 'marketing', 'pr', 'help', 'team', 'office', 'mail', 'careers']);
const emailLocal = (email) => String(email || '').toLowerCase().trim().split('@')[0] || '';
function isCompanyInbox(email) {
  const lp = emailLocal(email); if (!lp) return false;
  const base = lp.replace(/[._+-].*$/, '').replace(/\d+$/, ''); // token before a separator, minus trailing digits
  return GENERIC_INBOX.has(lp) || GENERIC_INBOX.has(base);
}
function looksPersonal(email, name) {
  const lp = emailLocal(email); if (!lp) return false;
  if (/^[a-z]+[._-][a-z]{2,}/.test(lp)) return true;              // first.last / first_last / first-last
  if (name) {
    const toks = String(name).toLowerCase().match(/[a-z]{2,}/g) || [];
    const bare = lp.replace(/[^a-z]/g, '');
    if (toks.some((t) => t.length >= 3 && bare.includes(t))) return true;                          // a real name token appears
    if (toks.length >= 2 && bare.startsWith(toks[0][0]) && bare.includes(toks[toks.length - 1])) return true; // first-initial + surname
  }
  return false;
}
// Returns 'verified' | 'personal' | 'company' | 'none' for a resolved/display contact.
function classifyEmail(c) {
  const email = c && c.email;
  if (!email || !String(email).includes('@')) return 'none';
  if (isCompanyInbox(email)) return 'company';                    // role inbox — never "verified"
  const st = c.email_status;
  if (st === 'verified' || st === 'verified (manual)') return 'verified';
  if (looksPersonal(email, c.name)) return 'personal';
  return 'company';                                               // real, but neither verified nor clearly a person
}
const EMAIL_CLASS = {
  verified: ['#10b981', 'Verified'],
  personal: ['#10b981', 'Personal'],
  company: ['#f59e0b', 'Company inbox'],
  none: ['#94a3b8', 'No email'],
};
// Colored email badge for a contact. In compact cells (big=false) a "No email" contact shows nothing.
function emailClassBadge(c, big = false) {
  const cls = classifyEmail(c);
  if (cls === 'none' && !big) return '';
  const [color, label] = EMAIL_CLASS[cls];
  return `<span class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold" style="background:${color}1f;color:${darken(color, 0.3)}">✉ ${label}</span>`;
}

/* ---- Two-layer contacts: manual (localStorage, Layer B) wins over auto (outreach.json, Layer A) ---- */
const MANUAL_KEY = (id) => `kgr.contact.${id}`;
function manualContact(id) {
  try { const r = localStorage.getItem(MANUAL_KEY(id)); return r ? JSON.parse(r) : null; } catch { return null; }
}
// Merged contact: manual email/status/source override auto; auto supplies name/title/linkedin.
function resolvedContact(id) {
  const a = outreachFor(id).contact || null;
  const m = manualContact(id);
  if (!m) return a;
  return {
    name: (a && a.name) || m.name || null,
    title: (a && a.title) || m.title || '',
    linkedin_url: (a && a.linkedin_url) || m.linkedin_url || null,
    email: m.email || (a && a.email) || null,
    email_status: m.email_status || (a && a.email_status) || null,
    source: m.source || (a && a.source) || '',
    confidence: (a && a.confidence) || 'manual',
  };
}

// A real, source-backed email (verified / published / manual) — not a legacy guess, not "none".
const REAL_EMAIL_STATUS = new Set(['verified', 'verified (manual)', 'published']);
const hasRealEmail = (c) => !!(c && c.email && REAL_EMAIL_STATUS.has(c.email_status));
// Show any REAL contact we actually found: the person's real name, real title and LinkedIn, plus a
// real email when we have one. It never invents a role — it only surfaces what was sourced (so an
// unprocessed lead, or one with nothing found, shows nothing rather than a guess).
function displayContact(id) {
  const c = resolvedContact(id);
  if (!c) return null;
  const realEmail = hasRealEmail(c);
  if (!c.name && !realEmail) return null;
  return {
    name: c.name || null,
    title: c.title || '',
    linkedin_url: c.linkedin_url || null,
    email: realEmail ? c.email : null,
    email_status: realEmail ? c.email_status : null,
    source: c.source, confidence: c.confidence,
  };
}
// Draft: engine draft (outreach.json) wins; else a manual template draft.
function resolvedEmail(id) {
  const e = outreachFor(id).email;
  if (e) return e;
  const m = manualContact(id);
  return (m && m.draft) ? m.draft : null;
}
const hasDraftFor = (id) => !!resolvedEmail(id);
const linkedinSearchUrl = (lead) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${lead.company} procurement purchasing sourcing`.trim())}`;

// Client-side Nishad-style template fill (Layer B — no LLM needed).
function draftFromTemplate(lead) {
  const industry = lead.segment || 'technical textiles';
  const c = resolvedContact(lead.id);
  const greeting = (c && c.name) ? `Dear ${c.name},` : 'Dear Sir/Madam,';
  const subject = `Technical Textiles for ${industry} / Kusumgar`;
  const body = `${greeting}\n\nLet me take this opportunity to briefly introduce Kusumgar Limited (www.kusumgar.com), one of India's leading manufacturers of high-performance technical textiles, with over 50 years of expertise. We operate a fully vertically integrated setup — weaving, dyeing, finishing, coating, lamination and cut-and-sew — producing synthetic multifilament fabrics in Nylon, Polyester and Aramids from 20D to 3000D, with in-house finishes and performance coatings.\n\nWe believe our capabilities align well with the ${industry} industry. Some of the solutions we can offer:\n- Nylon, Polyester and Aramid fabrics suited to ${industry.toLowerCase()} applications\n- Performance coatings and finishes — PU, PVC, silicone, FR, water-repellent, antimicrobial\n- Colour-matched, made-to-spec rolls with consistent, repeatable quality\nThese fabrics can be tailored with various colour, finish and coating options to meet your exact specifications.\n\nWe would be keen to support your fabric sourcing requirements, and I would welcome the opportunity to arrange a brief call — or share samples for your evaluation.\n\nLook forward to hearing from you.\n\nBest Regards,\nNishad Ansari\nDGM – Sales & Marketing\nKusumgar Limited | www.kusumgar.com`;
  return { subject, body, drafted_at: new Date().toISOString(), model: 'manual' };
}
function saveManualContact(id, email) {
  const l = state.leads.find((x) => x.id === id);
  if (!l || !email) return;
  const auto = outreachFor(id).contact || {};
  const rec = {
    name: auto.name || null, title: auto.title || '', linkedin_url: auto.linkedin_url || null,
    email, email_status: 'verified (manual)', source: 'contactout-extension', draft: draftFromTemplate(l),
  };
  try { localStorage.setItem(MANUAL_KEY(id), JSON.stringify(rec)); } catch { /* storage unavailable */ }
}

function loadPipeline(ids) {
  ids.forEach((id) => {
    try {
      const raw = localStorage.getItem(PIPE_KEY(id));
      if (raw) { const v = JSON.parse(raw); if (v && typeof v === 'object') state.pipeline[id] = v; }
    } catch { /* storage unavailable — ignore */ }
  });
}
// Follow-up date helpers (kept alongside the pipeline record, saved per lead in localStorage).
const isoToday = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = new Date((iso || isoToday()) + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const daysUntil = (iso) => Math.round((new Date(iso + 'T00:00:00') - new Date(isoToday() + 'T00:00:00')) / 86400000);
const dueLabel = (iso) => { const d = daysUntil(iso); return d < 0 ? `${-d}d overdue` : d === 0 ? 'due today' : d === 1 ? 'due tomorrow' : `in ${d} days`; };
const dueColor = (iso) => { const d = daysUntil(iso); return d < 0 ? '#f43f5e' : d === 0 ? '#f59e0b' : '#64748b'; };
const stageClosed = (s) => s === 'Won' || s === 'Lost';

function setPipeline(id, patch) {
  const rec = { ...(state.pipeline[id] || {}), ...patch };
  if (patch.stage && !rec.dealType) rec.dealType = 'current';
  if (patch.stage && !rec.mfg) rec.mfg = 'own';
  if (patch.stage) {                                       // stage moved: manage the follow-up date
    if (stageClosed(patch.stage)) rec.next = null;         // closed deal — no follow-up needed
    else if (!rec.next) rec.next = addDays(isoToday(), 7); // open deal — default reminder in a week
  }
  const removed = ('stage' in patch) && !patch.stage;
  try {
    if (removed) localStorage.removeItem(PIPE_KEY(id));
    else localStorage.setItem(PIPE_KEY(id), JSON.stringify(rec));
  } catch { /* storage unavailable — in-memory only */ }
  if (removed) delete state.pipeline[id];
  else state.pipeline[id] = rec;
}
const pipelinedLeads = () => state.leads.filter((l) => validStage(state.pipeline[l.id]?.stage));
// Open pipeline leads that carry a follow-up date, oldest (most overdue) first.
const followupLeads = () => state.leads
  .filter((l) => { const pl = state.pipeline[l.id]; return pl && validStage(pl.stage) && !stageClosed(pl.stage) && pl.next; })
  .sort((a, b) => String(state.pipeline[a.id].next).localeCompare(String(state.pipeline[b.id].next)));
const markFollowedUp = (id) => setPipeline(id, { last: isoToday(), next: addDays(isoToday(), 7) });
const snoozeFollowup = (id, n) => setPipeline(id, { next: addDays(state.pipeline[id]?.next || isoToday(), n) });

function contactBlock(lead) {
  const c = displayContact(lead.id);
  if (c && (c.name || c.email)) {
    const li = c.linkedin_url ? `<a href="${escapeHtml(c.linkedin_url)}" target="_blank" rel="noopener" class="text-indigo-600 hover:underline">LinkedIn ↗</a>` : '';
    const em = c.email ? `<a href="mailto:${escapeHtml(c.email)}" class="text-indigo-600 hover:underline">${escapeHtml(c.email)}</a>` : '';
    return `<div class="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Contact</div>
      <div class="mt-1 text-sm font-bold text-slate-800">${escapeHtml(c.name || '—')}</div>
      ${c.title ? `<div class="text-[12px] text-slate-500">${escapeHtml(c.title)}</div>` : ''}
      <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">${li}${em}${emailClassBadge(c, true)}</div>
      ${c.source ? `<div class="mt-1 text-[11px] text-slate-400">via ${escapeHtml(c.source)}${c.confidence ? ` · ${escapeHtml(String(c.confidence))} confidence` : ''}</div>` : ''}
    </div>`;
  }
  return `<div class="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
    <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Contact</div>
    <div class="mt-1 text-[13px] text-slate-500">No verified contact yet.</div>
    <div class="mt-1 text-[11px] text-slate-400">Use “🔗 Find contact on LinkedIn” in the lead panel, or run the Outreach refresh.</div>
  </div>`;
}

// Email + contact + add-to-outreach modal (opened from a lead's drill-panel or the tracker).
function openEmailModal(id) {
  const l = state.leads.find((x) => x.id === id);
  if (!l) return;
  const email = resolvedEmail(id);
  const pl = state.pipeline[id] || {};
  const emailText = email ? `Subject: ${email.subject}\n\n${email.body}` : '';

  const emailSection = email ? `
    <div class="rounded-xl ring-1 ring-slate-200">
      <div class="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <div class="min-w-0"><div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Subject</div><div class="truncate text-sm font-bold text-slate-800">${escapeHtml(email.subject)}</div></div>
        <button type="button" data-copy class="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-200">📋 Copy</button>
      </div>
      <div class="max-h-[38vh] overflow-y-auto whitespace-pre-wrap px-4 py-3 text-[13px] leading-relaxed text-slate-700">${escapeHtml(email.body)}</div>
      ${email.drafted_at ? `<div class="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">Drafted ${escapeHtml(fmtDate(email.drafted_at))}${email.model ? ` · ${escapeHtml(email.model)}` : ''}</div>` : ''}
    </div>`
    : `<div class="rounded-xl bg-amber-50 px-4 py-4 text-[13px] font-medium text-amber-700 ring-1 ring-amber-200">No draft yet — run the Outreach refresh workflow to generate a Nishad-style email for this lead.</div>`;

  const stageOptions = ['<option value="">— not in pipeline —</option>']
    .concat(STAGE_KEYS.map((s) => `<option value="${escapeHtml(s)}"${pl.stage === s ? ' selected' : ''}>${escapeHtml(s)}</option>`)).join('');
  const addSection = `
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-[12px] font-semibold text-slate-500">➕ Add to Outreach</span>
      <select data-modal-stage="${escapeHtml(id)}" class="rounded-xl border-0 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none">${stageOptions}</select>
      <span id="modalAdded" hidden class="text-[12px] font-semibold text-emerald-600"></span>
    </div>`;

  const html = `
    <div data-modal-backdrop class="absolute inset-0 bg-slate-900/40"></div>
    <div class="modal-card absolute left-1/2 top-1/2 flex max-h-[88vh] w-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div class="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div><h3 class="font-display text-base font-extrabold text-slate-900">Outreach — ${escapeHtml(l.company)}</h3><p class="text-[12px] text-slate-500">${escapeHtml(dash(l.segment))} · ${escapeHtml(dash(l.country))}</p></div>
        <button type="button" data-modal-close aria-label="Close" class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
      </div>
      <div class="flex-1 space-y-3 overflow-y-auto p-4">${contactBlock(l)}${emailSection}${addSection}</div>
    </div>
    <textarea id="modalEmailText" readonly aria-hidden="true" style="position:fixed;left:-9999px;top:0;opacity:0;">${escapeHtml(emailText)}</textarea>`;
  const m = $('#modal');
  m.innerHTML = html;
  requestAnimationFrame(() => m.classList.add('open'));
}
function closeModal() {
  const m = $('#modal');
  if (!m || !m.classList.contains('open')) return;
  m.classList.remove('open');
  setTimeout(() => { if (!m.classList.contains('open')) m.innerHTML = ''; }, 220);
}
function copyEmail(btn) {
  const ta = $('#modalEmailText');
  if (ta) {
    let done = false;
    try { ta.focus(); ta.select(); done = document.execCommand('copy'); } catch { /* noop */ }
    if (!done) { try { if (navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(() => {}); } catch { /* noop */ } }
  }
  btn.textContent = 'Copied ✓';
  setTimeout(() => { btn.textContent = '📋 Copy'; }, 1500);
}

/* ------------------------------------------------------------------ *
 * Centered modals: exhibition detail, products catalog, export picker
 * ------------------------------------------------------------------ */

function openModalHtml(html) {
  const m = $('#modal');
  m.innerHTML = html;
  requestAnimationFrame(() => m.classList.add('open'));
}

// One exhibitor row inside the exhibition modal — ☆ toggles it straight into "my leads".
function exhibitorMiniRow(l) {
  const c = displayContact(l.id) || {};
  const who = c.name ? escapeHtml(c.name) : '';
  const on = isStarred(l.id);
  return `<div class="flex items-center gap-2 border-t border-slate-100 py-2 first:border-t-0">
    <button type="button" data-star="${escapeHtml(l.id)}" aria-pressed="${on}" title="${on ? 'Remove from my leads' : 'Add to my leads'}" class="shrink-0 text-lg leading-none ${on ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'}">${on ? '★' : '☆'}</button>
    <div class="min-w-0 flex-1">
      <div class="truncate text-sm font-semibold text-slate-800">${escapeHtml(l.company)}${isRecommended(l) ? ' <span class="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">★ Rec</span>' : ''}</div>
      <div class="truncate text-[12px] text-slate-500">${escapeHtml(dash(l.segment))}${who ? ' · ' + who : ''}</div>
    </div>
    <div class="shrink-0">${priorityChip(l.priority)}</div>
  </div>`;
}

// Centered exhibition detail: full info + its exhibitors (add-to-lead inline) + its competitors.
function openExhibitionModal(id) {
  const d = state.exhibitions.find((x) => x.id === id);
  if (!d) return;
  const leads = state.leads.filter((l) => l.source === 'exhibition:' + id);
  const comps = state.competitors.filter((c) => c.source === 'exhibition:' + id);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = showEndDate(d); const past = end && end < today;
  const link = (url, label) => (url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="text-indigo-600 hover:underline">${label} ↗</a>` : '<span class="text-slate-400">—</span>');
  const info = (label, val) => `<div class="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0"><span class="shrink-0 text-[12px] font-medium text-slate-400">${label}</span><span class="text-right text-[13px] font-semibold text-slate-700">${val}</span></div>`;
  const CAP = 40;
  const leadRows = leads.length
    ? leads.slice(0, CAP).map(exhibitorMiniRow).join('') + (leads.length > CAP ? `<button type="button" data-exh-open-leads="${escapeHtml(id)}" class="mt-2 w-full rounded-lg bg-slate-100 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-200">See all ${leads.length} exhibitors →</button>` : '')
    : '<div class="py-4 text-center text-[13px] text-slate-400">No exhibitor list captured for this show yet.</div>';
  const compRows = comps.length
    ? comps.map((c) => `<div class="border-t border-slate-100 py-2 first:border-t-0"><div class="text-sm font-semibold text-slate-800">${escapeHtml(c.company)}</div><div class="text-[12px] text-slate-500">${countryCell(c.country)}${c.focus ? ' · ' + escapeHtml(c.focus) : ''}</div></div>`).join('')
    : '<div class="py-4 text-center text-[13px] text-slate-400">No competitors linked to this show.</div>';
  openModalHtml(`
    <div data-modal-backdrop class="absolute inset-0 bg-slate-900/40"></div>
    <div class="modal-card absolute left-1/2 top-1/2 flex max-h-[88vh] w-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" data-exh-modal="${escapeHtml(id)}">
      <div class="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div class="min-w-0">
          <div class="mb-1 flex flex-wrap items-center gap-2">${coloredChip(segLabel(d.segment), segColor(d.segment))}${coloredChip(d.status, STATUS_COLORS[d.status] || '#94a3b8')}${past ? '<span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">ended</span>' : ''}</div>
          <h3 class="font-display text-lg font-extrabold leading-tight text-slate-900">${escapeHtml(d.name)}</h3>
        </div>
        <button type="button" data-modal-close aria-label="Close" class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
      </div>
      <div class="flex-1 space-y-4 overflow-y-auto p-4">
        <div class="rounded-xl bg-slate-50 px-3 ring-1 ring-slate-100">
          ${info('Country', countryCell(d.country))}${info('Place', escapeHtml(dash(d.place)))}${info('Date', d.dates ? escapeHtml(d.dates) : '—')}${info('Website', link(d.website, 'Visit website'))}${info('Registration', link(d.registration, 'Register'))}
        </div>
        <div>
          <div class="mb-1 flex items-center justify-between"><h4 class="font-display text-sm font-bold text-slate-800">🏢 Exhibitors here</h4><span class="tnum text-[12px] text-slate-400">${leads.length}</span></div>
          <p class="mb-1.5 text-[11px] text-slate-400">Tap ☆ to add a company straight to your leads.</p>
          <div class="rounded-xl bg-white px-3 ring-1 ring-slate-200">${leadRows}</div>
        </div>
        <div>
          <div class="mb-1 flex items-center justify-between"><h4 class="font-display text-sm font-bold text-slate-800">🛡️ Competitors here</h4><span class="tnum text-[12px] text-slate-400">${comps.length}</span></div>
          <div class="rounded-xl bg-white px-3 ring-1 ring-slate-200">${compRows}</div>
        </div>
      </div>
    </div>`);
}

// Products catalog (behind the header 🧵 button).
function productMiniCard(p) {
  const props = (p.properties || []).slice(0, 6).map((x) => `<span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">${escapeHtml(x)}</span>`).join(' ');
  const segs = (p.segments || []).map((s) => coloredChip(segLabel(s), anyColor(s))).join(' ');
  return `<div class="rounded-xl bg-white p-3 ring-1 ring-slate-200">
    <div class="flex items-baseline justify-between gap-2"><div class="text-sm font-bold text-slate-800">${escapeHtml(p.name)}</div><div class="shrink-0 text-[11px] text-slate-400">${escapeHtml(p.family || '')}</div></div>
    <div class="mt-0.5 text-[12px] text-slate-500">${escapeHtml(p.base || '')}${p.deniers ? ' · ' + escapeHtml(p.deniers) : ''}${(p.coatings && p.coatings.length) ? ' · ' + escapeHtml(p.coatings.join(', ')) : ''}</div>
    ${props ? `<div class="mt-2 flex flex-wrap gap-1">${props}</div>` : ''}
    ${segs ? `<div class="mt-2 flex flex-wrap gap-1">${segs}</div>` : ''}
  </div>`;
}
function productsFiltered() {
  const q = state.prodModalSearch.trim().toLowerCase();
  if (!q) return state.products;
  return state.products.filter((p) => `${p.name} ${p.family || ''} ${(p.segments || []).join(' ')} ${(p.applications || []).join(' ')} ${(p.properties || []).join(' ')}`.toLowerCase().includes(q));
}
function productsModalListHtml() {
  const list = productsFiltered();
  return list.length
    ? `<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">${list.map(productMiniCard).join('')}</div>`
    : '<div class="py-8 text-center text-[13px] text-slate-400">No products match your search.</div>';
}
function openProductsModal() {
  openModalHtml(`
    <div data-modal-backdrop class="absolute inset-0 bg-slate-900/40"></div>
    <div class="modal-card absolute left-1/2 top-1/2 flex max-h-[88vh] w-[calc(100%-2rem)] max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div class="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
        <div><h3 class="font-display text-base font-extrabold text-slate-900">🧵 Kusumgar Products</h3><p class="text-[12px] text-slate-500">${state.products.length} fabrics in the catalog</p></div>
        <button type="button" data-modal-close aria-label="Close" class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
      </div>
      <div class="border-b border-slate-100 p-3">
        <div class="relative"><span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
          <input id="prod-modal-search" type="search" value="${escapeHtml(state.prodModalSearch)}" placeholder="Search products…" class="w-full rounded-xl border-0 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none" /></div>
      </div>
      <div id="prodModalList" class="flex-1 overflow-y-auto p-3">${productsModalListHtml()}</div>
    </div>`);
}

// Export picker: one tab, or the whole dashboard, as a Kusumgar-branded workbook.
function openExportModal() {
  const opt = (scope, icon, label, desc) => `<button type="button" data-export-scope="${scope}" class="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left ring-1 ring-slate-200 transition-colors hover:bg-slate-50 hover:ring-indigo-300">
    <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-lg">${icon}</span>
    <span class="min-w-0"><span class="block text-sm font-semibold text-slate-800">${label}</span><span class="block text-[12px] text-slate-500">${desc}</span></span>
  </button>`;
  openModalHtml(`
    <div data-modal-backdrop class="absolute inset-0 bg-slate-900/40"></div>
    <div class="modal-card absolute left-1/2 top-1/2 flex max-h-[88vh] w-[calc(100%-2rem)] max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div class="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
        <div><h3 class="font-display text-base font-extrabold text-slate-900">📊 Export to Excel</h3><p class="text-[12px] text-slate-500">Pick what to download — Kusumgar-branded, cleanly formatted.</p></div>
        <button type="button" data-modal-close aria-label="Close" class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
      </div>
      <div class="flex-1 space-y-2 overflow-y-auto p-4">
        ${opt('all', '🗂️', 'Entire dashboard', 'Every tab in one workbook (5 sheets)')}
        ${opt('exhibitions', '🎪', 'Exhibitions', 'All shows — dates, place, links, status')}
        ${opt('leads', '🏢', 'Exhibitors', 'Companies + contacts + priority + why')}
        ${opt('competitors', '🛡️', 'Competitors', 'Who they are and what they sell')}
        ${opt('products', '🧵', 'Products', 'The Kusumgar fabric catalog')}
        ${opt('outreach', '📮', 'Outreach pipeline', 'Your tracked leads + stages')}
      </div>
    </div>`);
}

/* ------------------------------------------------------------------ *
 * Pipeline compose workspace — left = my ⭐ leads, right = compose panel.
 * Reuses the drafted-email data (Nishad's voice) from outreach.json. Nothing
 * is auto-sent: Copy / Open in Gmail / Mark-as-sent are the manual send bridge.
 * ------------------------------------------------------------------ */

// Compose links, built live from the current (edited) To / Subject / Body.
const gmailComposeUrl = (to, su, body) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to || '')}&su=${encodeURIComponent(su || '')}&body=${encodeURIComponent(body || '')}`;
const mailtoUrl = (to, su, body) =>
  `mailto:${(to || '').trim()}?subject=${encodeURIComponent(su || '')}&body=${encodeURIComponent(body || '')}`;

// Clipboard copy that works without permissions (hidden textarea + execCommand, clipboard API fallback).
function copyText(text, btn) {
  let done = false;
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    document.body.appendChild(ta); ta.focus(); ta.select();
    done = document.execCommand('copy'); ta.remove();
  } catch { /* fall through */ }
  if (!done) { try { if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {}); } catch { /* noop */ } }
  if (btn) { const orig = btn.textContent; btn.textContent = 'Copied ✓'; setTimeout(() => { btn.textContent = orig; }, 1500); }
}
function copyComposeEmail(btn) {
  const su = ($('#composeSubject') || {}).value || '';
  const body = ($('#composeBody') || {}).value || '';
  copyText(`Subject: ${su}\n\n${body}`, btn);
}
function openInGmail() {
  const to = (($('#composeTo') || {}).value || '').trim();
  const su = ($('#composeSubject') || {}).value || '';
  const body = ($('#composeBody') || {}).value || '';
  const url = gmailComposeUrl(to, su, body);
  try { window.open(url, '_blank', 'noopener'); } catch { location.href = url; }
}
// Keep the plain-mailto fallback link in sync with the edited fields.
function updateComposeMailto() {
  const a = $('#composeMailto'); if (!a) return;
  const to = (($('#composeTo') || {}).value || '').trim();
  const su = ($('#composeSubject') || {}).value || '';
  const body = ($('#composeBody') || {}).value || '';
  a.setAttribute('href', mailtoUrl(to, su, body));
}
// "Mark as sent": capture a pasted email, move the stage to "Email sent" (which auto-sets a
// follow-up date), then re-render so it shows in the Tracker + Follow-ups.
function markComposeSent() {
  const id = state.composeId; if (!id) return;
  const to = (($('#composeTo') || {}).value || '').trim();
  const cur = displayContact(id);
  if (to && /.+@.+\..+/.test(to) && (!cur || cur.email !== to)) saveManualContact(id, to);
  setPipeline(id, { stage: 'Email sent' });
  render();
  const p = $('#composePanel');
  if (p && window.innerWidth < 1024) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const starredLeads = () => state.leads.filter((l) => isStarred(l.id));
function pipeMatch(l, q) {
  const c = displayContact(l.id);
  return `${l.company} ${l.segment || ''} ${l.country || ''} ${(c && c.name) || ''} ${(c && c.email) || ''}`.toLowerCase().includes(q);
}
function pipeLeadRow(l, selected) {
  const c = displayContact(l.id);
  const who = (c && c.name) ? escapeHtml(c.name) : '<span class="text-slate-400">→ find contact</span>';
  const pl = state.pipeline[l.id] || {};
  const col = STAGE_COLOR[pl.stage] || '#94a3b8';
  const stage = pl.stage
    ? `<span class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style="background:${col}1f;color:${darken(col, 0.35)}">${escapeHtml(pl.stage)}</span>` : '';
  const badge = emailClassBadge(c || {}, false);
  const selCls = selected ? 'bg-indigo-50 ring-2 ring-indigo-400' : 'bg-white ring-1 ring-slate-200 hover:bg-slate-50';
  return `<button type="button" data-compose-id="${escapeHtml(l.id)}" aria-pressed="${selected}" class="block w-full rounded-xl ${selCls} px-3 py-2.5 text-left transition-colors">
    <div class="flex items-center gap-2"><span class="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">${escapeHtml(l.company)}</span>${stage}</div>
    <div class="mt-0.5 flex items-center gap-2"><span class="min-w-0 flex-1 truncate text-[12px] text-slate-500">${who}</span>${badge}</div>
  </button>`;
}

function composePanelHtml(id) {
  const placeholder = `<div class="grid min-h-[320px] place-items-center rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
    <div><div class="text-4xl">✉️</div>
      <div class="mt-2 font-display text-base font-bold text-slate-700">Pick a lead to draft an email</div>
      <p class="mx-auto mt-1 max-w-sm text-sm text-slate-500">Choose one of your ⭐ leads on the left — its email drafts here, ready to edit and send.</p>
    </div></div>`;
  if (!id) return placeholder;
  const l = state.leads.find((x) => x.id === id);
  if (!l) return placeholder;

  const c = displayContact(id) || {};
  const eDraft = resolvedEmail(id);              // engine draft (Nishad's voice) wins
  const draft = eDraft || draftFromTemplate(l);  // else fill the same template client-side
  const to = c.email || '';
  const pl = state.pipeline[id] || {};
  const alreadySent = !!pl.stage && STAGE_KEYS.indexOf(pl.stage) >= STAGE_KEYS.indexOf('Email sent');
  const stageChip = pl.stage ? coloredChip(pl.stage, STAGE_COLOR[pl.stage] || '#64748b')
    : '<span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-400">Not started</span>';

  const profileLink = c.linkedin_url
    ? `<a href="${escapeHtml(c.linkedin_url)}" target="_blank" rel="noopener" class="font-semibold text-[#0a66c2] hover:underline">in ↗ LinkedIn profile</a>` : '';
  const findLink = `<a href="${escapeHtml(linkedinSearchUrl(l))}" target="_blank" rel="noopener" class="font-medium text-indigo-600 hover:underline">🔗 Find contact on LinkedIn ↗</a>`;

  return `<div class="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-5">
    <div class="rounded-xl bg-indigo-50 px-3 py-2 text-[12px] font-medium text-indigo-700 ring-1 ring-indigo-100">🔌 Connect Gmail for one-click send + automatic in-thread follow-ups — coming next.</div>

    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="font-display text-base font-extrabold text-slate-900">${escapeHtml(l.company)}</h3>
        <p class="truncate text-[12px] text-slate-500">${escapeHtml(dash(l.segment))} · ${countryCell(l.country)}</p>
      </div>
      <div class="shrink-0">${stageChip}</div>
    </div>

    <div class="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Contact</div>
      <div class="mt-1 text-sm font-bold text-slate-800">${escapeHtml(c.name || '—')}</div>
      ${c.title ? `<div class="text-[12px] text-slate-500">${escapeHtml(c.title)}</div>` : ''}
      <div class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">${profileLink}${findLink}</div>
      <label for="composeTo" class="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">To</label>
      <div class="mt-1 flex flex-wrap items-center gap-2">
        <input id="composeTo" type="email" value="${escapeHtml(to)}" placeholder="paste the buyer's email…" class="min-w-0 flex-1 rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-800 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
        ${emailClassBadge(c, true)}
      </div>
      ${to ? '' : '<div class="mt-1 text-[11px] text-slate-400">No email found yet — find the buyer on LinkedIn, then paste their address above.</div>'}
    </div>

    <div>
      <label for="composeSubject" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Subject</label>
      <input id="composeSubject" value="${escapeHtml(draft.subject)}" class="mt-1 w-full rounded-lg border-0 bg-white px-3 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
    </div>
    <div>
      <label for="composeBody" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Message</label>
      <textarea id="composeBody" rows="14" class="mt-1 w-full resize-y rounded-lg border-0 bg-white px-3 py-3 text-[13px] leading-relaxed text-slate-700 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none">${escapeHtml(draft.body)}</textarea>
      <div class="mt-1 text-[11px] text-slate-400">${eDraft ? "✍️ Pre-written in Nishad's voice" : '✍️ Draft'} — edit anything before you send. Nothing is sent automatically.</div>
    </div>

    <div class="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
      <button type="button" data-compose-gmail class="rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">✉️ Open in Gmail</button>
      <button type="button" data-compose-copy class="rounded-xl bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">📋 Copy email</button>
      <button type="button" data-compose-sent class="rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">✅ Mark as sent</button>
      <a id="composeMailto" data-compose-mailto href="${escapeHtml(mailtoUrl(to, draft.subject, draft.body))}" class="text-[12px] text-slate-500 hover:text-slate-700 hover:underline">or use your mail app</a>
    </div>
    ${alreadySent ? `<div class="rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700 ring-1 ring-emerald-200">✅ Marked as sent — now tracked in the Tracker${pl.next ? ` · follow-up ${escapeHtml(fmtDate(pl.next))} (${escapeHtml(dueLabel(pl.next))})` : ''}.</div>` : ''}
  </div>`;
}

// Re-render just the "My leads" list (keeps the search box + its focus intact).
function refreshPipeList() {
  const w = $('#pipeList'); if (!w) return;
  const q = state.pipeSearch.trim().toLowerCase();
  const rows = starredLeads().filter((l) => !q || pipeMatch(l, q));
  w.innerHTML = rows.length
    ? rows.map((l) => pipeLeadRow(l, l.id === state.composeId)).join('')
    : `<div class="px-3 py-8 text-center text-[13px] text-slate-400">No leads match your search.</div>`;
}

function renderPipeline() {
  const stars = starredLeads();
  // Keep composeId valid; auto-open the first ⭐ lead so the workspace isn't empty on arrival.
  let cid = state.composeId;
  if (cid && !stars.some((l) => l.id === cid)) cid = null;
  if (!cid && stars.length) cid = stars[0].id;
  state.composeId = cid;

  if (!stars.length) {
    return `<div class="fade-in rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
      <div class="mb-2 text-4xl">⭐</div>
      <div class="font-display text-lg font-bold text-slate-800">No leads picked yet</div>
      <p class="mx-auto mt-1 max-w-md text-sm text-slate-500">Pick leads in the <span class="font-semibold">Exhibitors</span> tab (⭐ Move to Lead) — they show up here to email.</p>
      <button type="button" data-goto="leads" class="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">🏢 Go to Exhibitors</button>
    </div>`;
  }

  const q = state.pipeSearch.trim().toLowerCase();
  const rows = stars.filter((l) => !q || pipeMatch(l, q));
  const listHtml = rows.length
    ? rows.map((l) => pipeLeadRow(l, l.id === cid)).join('')
    : `<div class="px-3 py-8 text-center text-[13px] text-slate-400">No leads match your search.</div>`;

  const left = `<aside class="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
    <div class="mb-2 flex items-baseline justify-between gap-2 px-1">
      <h3 class="font-display text-sm font-bold text-slate-800">⭐ My leads</h3>
      <span class="tnum text-[12px] font-semibold text-slate-400">${stars.length}</span>
    </div>
    <div class="relative mb-2">
      <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
      <input id="pipe-search" type="search" value="${escapeHtml(state.pipeSearch)}" placeholder="Search my leads…" class="w-full rounded-xl border-0 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
    </div>
    <div id="pipeList" class="max-h-[70vh] space-y-2 overflow-y-auto pr-0.5">${listHtml}</div>
  </aside>`;

  const right = `<section id="composePanel">${composePanelHtml(cid)}</section>`;

  return `<div class="fade-in grid grid-cols-1 gap-4 lg:grid-cols-[minmax(230px,320px)_1fr] lg:items-start">${left}${right}</div>`;
}

function trackerRows() {
  const f = state.trackerFilters;
  const q = f.search.trim().toLowerCase();
  return pipelinedLeads().filter((l) => {
    const pl = state.pipeline[l.id];
    if (f.stage !== 'all' && pl.stage !== f.stage) return false;
    if (q) { const hay = `${l.company} ${l.segment} ${l.country}`.toLowerCase(); if (!hay.includes(q)) return false; }
    return true;
  });
}

function trackerTableHtml() {
  const rows = trackerRows();
  if (!rows.length) {
    return `<table class="w-full"><tbody><tr><td class="px-4 py-10 text-center text-sm text-slate-400">No leads on your outreach desk yet — add some from the Leads tab (“➕ Add to Outreach”) and they’ll appear here to track and email.</td></tr></tbody></table>`;
  }
  const sel = (id, kind, options, cur, stageColored) => {
    const opts = options.map((o) => `<option value="${escapeHtml(o)}"${cur === o ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('');
    if (stageColored) {
      const col = STAGE_COLOR[cur] || '#64748b';
      return `<select data-pl-${kind}="${escapeHtml(id)}" class="rounded-lg border-0 px-2 py-1 text-[12px] font-semibold shadow-sm ring-1 ring-slate-200 focus:outline-none" style="background:${col}1f;color:${darken(col, 0.35)}">${opts}</select>`;
    }
    return `<select data-pl-${kind}="${escapeHtml(id)}" class="rounded-lg border-0 bg-white px-2 py-1 text-[12px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 focus:outline-none">${opts}</select>`;
  };
  const body = rows.map((l) => {
    const pl = state.pipeline[l.id];
    const c = displayContact(l.id);
    const contact = c && (c.name || c.email)
      ? `<span class="inline-flex items-center gap-1.5">${escapeHtml(c.name || c.email)}${emailClassBadge(c, true)}</span>`
      : `<span class="text-slate-400">→ find contact</span>`;
    const hasDraft = hasDraftFor(l.id) ? '<span class="font-bold text-emerald-600">✓</span>' : '<span class="text-slate-300">—</span>';
    return `<tr class="border-t border-slate-100 hover:bg-slate-50/60">
      <td class="whitespace-nowrap px-3 py-2.5 text-sm font-semibold text-slate-800">${escapeHtml(l.company)}</td>
      <td class="whitespace-nowrap px-3 py-2.5">${coloredChip(l.segment, leadSegColor(l.segment))}</td>
      <td class="whitespace-nowrap px-3 py-2.5">${sel(l.id, 'stage', STAGE_KEYS, pl.stage, true)}</td>
      <td class="whitespace-nowrap px-3 py-2.5">${stageClosed(pl.stage) ? '<span class="text-[12px] text-slate-300">—</span>' : `<input type="date" data-pl-followup="${escapeHtml(l.id)}" value="${escapeHtml(pl.next || '')}" class="rounded-lg border-0 bg-white px-2 py-1 text-[12px] font-semibold ring-1 ring-slate-200 focus:outline-none" style="color:${pl.next ? dueColor(pl.next) : '#94a3b8'}" />`}</td>
      <td class="whitespace-nowrap px-3 py-2.5">${sel(l.id, 'deal', DEAL_TYPES, pl.dealType || 'current', false)}</td>
      <td class="whitespace-nowrap px-3 py-2.5">${sel(l.id, 'mfg', MFG_TYPES, pl.mfg || 'own', false)}</td>
      <td class="whitespace-nowrap px-3 py-2.5 text-sm text-slate-600">${contact}</td>
      <td class="whitespace-nowrap px-3 py-2.5 text-center text-sm">${hasDraft}</td>
      <td class="whitespace-nowrap px-3 py-2.5"><button type="button" data-action="draft-email" data-lead-id="${escapeHtml(l.id)}" class="rounded-lg bg-slate-100 px-2 py-1 text-[12px] font-semibold text-slate-600 hover:bg-slate-200">✉️ Email</button></td>
    </tr>`;
  }).join('');
  const head = `<tr class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
    <th class="px-3 py-2.5 font-semibold">Company</th><th class="px-3 py-2.5 font-semibold">Segment</th>
    <th class="px-3 py-2.5 font-semibold">Stage</th><th class="px-3 py-2.5 font-semibold">Follow-up</th><th class="px-3 py-2.5 font-semibold">Deal</th>
    <th class="px-3 py-2.5 font-semibold">Mfg</th><th class="px-3 py-2.5 font-semibold">Contact</th>
    <th class="px-3 py-2.5 text-center font-semibold">Draft</th><th class="px-3 py-2.5 font-semibold"></th></tr>`;
  return `<table class="w-full min-w-[820px] border-collapse text-left"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function refreshTrackerTable() {
  const w = $('#trackerTableWrap'); if (w) w.innerHTML = trackerTableHtml();
  const c = $('#oCount'); if (c) c.textContent = trackerRows().length;
}

function renderTracker() {
  const f = state.trackerFilters;
  const stageSel = ['<option value="all">All stages</option>']
    .concat(STAGE_KEYS.map((s) => `<option value="${escapeHtml(s)}"${f.stage === s ? ' selected' : ''}>${escapeHtml(s)}</option>`)).join('');
  return `<div class="fade-in">
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <div class="relative min-w-[170px] flex-1">
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
        <input id="o-search" type="search" value="${escapeHtml(f.search)}" placeholder="Search pipeline…" class="w-full rounded-xl border-0 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
      </div>
      <select id="o-stage" class="rounded-xl border-0 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none">${stageSel}</select>
      <button type="button" data-goto="leads" class="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">➕ Add leads</button>
    </div>
    <div class="mb-2 px-0.5 text-[12px] text-slate-500"><span id="oCount" class="tnum font-semibold text-slate-700">${trackerRows().length}</span> in pipeline</div>
    <div class="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"><div id="trackerTableWrap">${trackerTableHtml()}</div></div>
  </div>`;
}

// "Follow-ups" — who to chase, so nothing slips through months of back-and-forth.
function renderFollowups() {
  const rows = followupLeads();
  const chip = (s) => coloredChip(s, STAGE_COLOR[s] || '#64748b');
  const dueCount = rows.filter((l) => daysUntil(state.pipeline[l.id].next) <= 0).length;
  if (!rows.length) {
    return `<div class="fade-in rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
      <div class="mb-2 text-4xl">⏰</div>
      <div class="font-display text-lg font-bold text-slate-800">No follow-ups scheduled yet</div>
      <p class="mx-auto mt-1 max-w-md text-sm text-slate-500">Add leads to your pipeline in the <span class="font-semibold">Tracker</span> (set a stage) — each gets a follow-up date automatically. Overdue ones show up here so you always know who to chase.</p>
      <button type="button" data-osub="tracker" class="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Go to Tracker</button>
    </div>`;
  }
  const rowHtml = (l) => {
    const pl = state.pipeline[l.id];
    const c = displayContact(l.id);
    const who = c && (c.name || c.email);
    return `<div class="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2.5 first:border-t-0">
      <div class="min-w-[150px] flex-1">
        <div class="text-sm font-semibold text-slate-800">${escapeHtml(l.company)}</div>
        <div class="mt-0.5 flex flex-wrap items-center gap-1.5">${chip(pl.stage)}<span class="text-[11px] font-bold" style="color:${dueColor(pl.next)}">${dueLabel(pl.next)}</span>${who ? `<span class="truncate text-[11px] text-slate-400">· ${escapeHtml(who)}</span>` : ''}</div>
      </div>
      <input data-fu-note="${escapeHtml(l.id)}" value="${escapeHtml(pl.note || '')}" placeholder="note — e.g. sample sent, chase" class="min-w-[130px] flex-1 rounded-lg border-0 bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-700 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
      <input type="date" data-fu-date="${escapeHtml(l.id)}" value="${escapeHtml(pl.next || '')}" class="rounded-lg border-0 bg-white px-2 py-1.5 text-[12px] text-slate-600 ring-1 ring-slate-200 focus:outline-none" />
      <button type="button" data-fu-done="${escapeHtml(l.id)}" title="Followed up — remind me again in a week" class="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700">✓ Done</button>
      <button type="button" data-fu-snooze="${escapeHtml(l.id)}" title="Snooze 3 days" class="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-200">+3d</button>
      <button type="button" data-action="draft-email" data-lead-id="${escapeHtml(l.id)}" title="Open email" class="rounded-lg bg-slate-100 px-2 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-200">✉️</button>
    </div>`;
  };
  const group = (title, emoji, color, items) => items.length ? `<div class="mb-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
    <div class="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5"><span>${emoji}</span><span class="text-sm font-bold text-slate-700">${title}</span><span class="rounded-full px-2 py-0.5 text-[11px] font-bold" style="background:${color}1f;color:${color}">${items.length}</span></div>
    ${items.map(rowHtml).join('')}
  </div>` : '';
  const overdue = rows.filter((l) => daysUntil(state.pipeline[l.id].next) < 0);
  const today = rows.filter((l) => daysUntil(state.pipeline[l.id].next) === 0);
  const upcoming = rows.filter((l) => daysUntil(state.pipeline[l.id].next) > 0);
  return `<div class="fade-in">
    <div class="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
      <span>Who to chase, oldest first. Set a date, jot a note, hit <span class="font-semibold text-emerald-600">✓ Done</span> once you've followed up (bumps the reminder a week).</span>
      ${dueCount ? `<span class="rounded-full bg-rose-50 px-2.5 py-1 font-bold text-rose-600">${dueCount} due now</span>` : ''}
    </div>
    ${group('Overdue', '🔴', '#f43f5e', overdue)}
    ${group('Due today', '🟠', '#f59e0b', today)}
    ${group('Upcoming', '📅', '#6366f1', upcoming)}
  </div>`;
}

function renderOutreach() {
  const dueCount = followupLeads().filter((l) => daysUntil(state.pipeline[l.id].next) <= 0).length;
  const fuBadge = dueCount ? ` <span class="ml-0.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">${dueCount}</span>` : '';
  const isTracker = state.outreachSub === 'tracker' || state.outreachSub === 'followups';
  const topBtn = (active, osub, label) => {
    const cls = active ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700';
    return `<button type="button" data-osub="${osub}" class="rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${cls}">${label}</button>`;
  };
  const toggle = `<div class="inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">${topBtn(state.outreachSub === 'pipeline', 'pipeline', '✉️ Pipeline')}${topBtn(isTracker, 'tracker', `📊 Tracker${fuBadge}`)}</div>`;
  const body = state.outreachSub === 'pipeline' ? renderPipeline() : renderTrackerHub();
  return `<div class="mb-4">${toggle}</div>${body}`;
}

// Tracker hub: the existing stage board + follow-ups, kept exactly as-is, under one Tracker view.
function renderTrackerHub() {
  const dueCount = followupLeads().filter((l) => daysUntil(state.pipeline[l.id].next) <= 0).length;
  const fuBadge = dueCount ? ` <span class="ml-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">${dueCount}</span>` : '';
  const onFollow = state.outreachSub === 'followups';
  const innerBtn = (active, osub, label) => {
    const cls = active ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700';
    return `<button type="button" data-osub="${osub}" class="rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${cls}">${label}</button>`;
  };
  const inner = `<div class="mb-3 inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">${innerBtn(!onFollow, 'tracker', '📋 Stage board')}${innerBtn(onFollow, 'followups', `⏰ Follow-ups${fuBadge}`)}</div>`;
  return `${inner}${onFollow ? renderFollowups() : renderTracker()}`;
}

/* ------------------------------------------------------------------ *
 * Today / Home tab — surfaces existing data (no new state)
 * ------------------------------------------------------------------ */

// Home — clean and minimal: just upcoming exhibitions + recently found leads. No charts.
/* ------------------------------------------------------------------ *
 * Industry Research tab — the curated target-company universe.
 * Each company is verified against its OWN website by the weekly robot;
 * nothing is invented. "Send to Growth Engine" activates it as a lead.
 * ------------------------------------------------------------------ */

const RESEARCH_SEGMENTS = ['Automotive Seating', 'Medical & Emergency', 'Tool & Equipment Bags', 'Pool & Outdoor Covers', 'Marine Covers', 'Protective & Industrial Covers'];
const RSENT_KEY = 'kgr.research.sent';
const RLEADS_KEY = 'kgr.research.leads';
const urlHost = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, ''); } catch { return ''; } };
const truncate = (s, n) => { const t = String(s || ''); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };

function loadResearchSent() { try { return new Set(JSON.parse(localStorage.getItem(RSENT_KEY) || '[]')); } catch { return new Set(); } }
function saveResearchSent() { try { localStorage.setItem(RSENT_KEY, JSON.stringify([...state.researchSent])); } catch { /* storage unavailable */ } }
const researchSent = (id) => state.researchSent.has(id);
function loadResearchLeads() { try { const o = JSON.parse(localStorage.getItem(RLEADS_KEY) || '{}'); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {}; } catch { return {}; } }
function saveResearchLeads(map) { try { localStorage.setItem(RLEADS_KEY, JSON.stringify(map)); } catch { /* storage unavailable */ } }

// Build a Growth-Engine lead from a curated target (only used when the company isn't already a lead).
function researchToLead(t) {
  return {
    id: t.id, company: t.company, segment: t.segment, country: t.country || null,
    website: t.website || null, application: t.application || null, fabric_fit: null,
    est_consumption: t.est_fabric_consumption || null, sourcing_model: t.sourcing_model || null,
    contact_role: t.buyer_role || null, priority: 'Medium', detail: 'full',
    source: 'industry-research', type: 'potential',
  };
}
// "➕ Send to Growth Engine": activate the company as a lead (star + pipeline it as a potential deal)
// so it shows in the Exhibitors tab + Outreach pipeline. Reuses the existing lead when one already
// exists (no duplicate row); otherwise creates one and persists it for the boot-time merge.
function sendResearchToEngine(id) {
  const t = state.research.find((x) => x.id === id); if (!t) return;
  let lead = state.leads.find((l) => l.id === id);
  if (!lead) {
    lead = researchToLead(t);
    const map = loadResearchLeads(); map[id] = lead; saveResearchLeads(map);
    state.leads.push(lead);
  }
  state.researchSent.add(id); saveResearchSent();
  if (!isStarred(lead.id)) toggleStar(lead.id);          // ⭐ so it appears in "My leads" + Outreach Pipeline
  setPipeline(lead.id, { stage: 'To contact', dealType: 'potential' }); // + Tracker, with a follow-up date
  render();
}

function researchBadge(t) {
  if (t.verified === true && t.product_confirmed === true) {
    const dom = urlHost(t.verify_source_url) || urlHost(t.website) || 'source';
    return `<a href="${escapeHtml(t.verify_source_url || t.website || '#')}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600 hover:underline" title="Confirmed on their website">✅ Verified · ${escapeHtml(dom)} ↗</a>`;
  }
  if (t.verified === true) {
    return `<span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-600" title="We visited the site but couldn't confirm the product fit">⚠️ Checked — couldn't confirm</span>`;
  }
  return '<span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-400">⏳ Not checked yet</span>';
}

function researchFiltered() {
  const f = state.researchFilters;
  const q = f.search.trim().toLowerCase();
  return state.research.filter((t) => {
    if (f.segment !== 'all' && t.segment !== f.segment) return false;
    if (f.country !== 'all' && (t.country || '') !== f.country) return false;
    if (q && !`${t.company} ${t.segment} ${t.country || ''} ${t.application || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

function researchCard(t) {
  const sent = researchSent(t.id);
  const fact = (label, val) => `<div class="text-[12px] text-slate-600"><span class="font-semibold text-slate-500">${label}:</span> ${escapeHtml(val)} <span class="ml-0.5 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-400">from target list</span></div>`;
  const evidence = t.product_evidence
    ? `<div class="mt-2 rounded-lg bg-slate-50 p-2 text-[12px] italic leading-snug text-slate-600 ring-1 ring-slate-100" title="${escapeHtml(t.product_evidence)}">“${escapeHtml(truncate(t.product_evidence, 160))}”</div>` : '';
  const facts = [
    t.application ? fact('Application', t.application) : '',
    t.buyer_role ? fact('Buyer role', t.buyer_role) : '',
    t.est_fabric_consumption ? fact('Est. fabric use', t.est_fabric_consumption) : '',
  ].filter(Boolean).join('');
  const action = sent
    ? '<span class="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-600 ring-1 ring-emerald-100">✓ In Growth Engine</span>'
    : `<button type="button" data-research-send="${escapeHtml(t.id)}" class="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">➕ Send to Growth Engine</button>`;
  return `<div class="flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition-shadow hover:shadow-md">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <div class="truncate text-sm font-bold text-slate-800" title="${escapeHtml(t.company)}">${escapeHtml(t.company)}</div>
        <div class="mt-0.5 text-[12px] text-slate-500">${countryCell(t.country)}</div>
      </div>
      <div class="shrink-0">${coloredChip(t.segment, anyColor(t.segment))}</div>
    </div>
    <div class="mt-2">${researchBadge(t)}</div>
    ${evidence}
    ${facts ? `<div class="mt-2 space-y-1">${facts}</div>` : ''}
    <div class="mt-3 pt-1">${action}</div>
  </div>`;
}

function researchListHtml() {
  const rows = researchFiltered();
  if (!rows.length) return '<div class="col-span-full py-10 text-center text-sm text-slate-400">No companies match your filters.</div>';
  return rows.map(researchCard).join('');
}
function refreshResearchList() {
  const w = $('#researchList'); if (w) w.innerHTML = researchListHtml();
  const c = $('#rCount'); if (c) c.textContent = researchFiltered().length;
}

function renderResearch() {
  const sub = state.researchSub === 'targets' ? 'targets' : 'market';
  const subBtn = (key, label) => {
    const on = sub === key;
    return `<button type="button" data-researchsub="${key}" aria-pressed="${on}" class="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${on ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">${label}</button>`;
  };
  const toggle = `<div class="inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">${subBtn('market', '📈 Market')}${subBtn('targets', '🎯 Targets')}</div>`;
  return `<div class="fade-in">
    <div class="mb-3">
      <h2 class="font-display text-lg font-extrabold text-slate-900">🔬 Industry Research</h2>
      <p class="mt-0.5 text-sm text-slate-500">First map the market with real UN trade data, then work your target companies. Nothing is invented.</p>
    </div>
    <div class="mb-4">${toggle}</div>
    ${sub === 'market' ? renderMarketView() : renderResearchTargets()}
  </div>`;
}

// A market-size stat card (real number + source link).
function sizeCard(label, big, sub, url, tone) {
  const tones = { indigo: 'text-indigo-600', sky: 'text-sky-600', emerald: 'text-emerald-600' };
  return `<div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
    <div class="text-[12px] font-semibold text-slate-500">${escapeHtml(label)}</div>
    <div class="mt-1 font-display text-2xl font-extrabold tnum ${tones[tone] || 'text-slate-900'}">${escapeHtml(big)}</div>
    <div class="mt-1 flex items-center justify-between gap-2">
      <span class="text-[11px] text-slate-400">${escapeHtml(sub)}</span>
      <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="shrink-0 text-[11px] font-semibold text-indigo-500 hover:underline">UN Comtrade ↗</a>
    </div>
  </div>`;
}

// 📈 Market — real UN Comtrade coated-fabric trade. Every figure carries its query URL; nothing modeled.
function renderMarketView() {
  const m = state.market;
  if (!m || !m.hs5903) {
    return '<div class="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">Market data hasn’t been pulled yet — the weekly UN Comtrade engine will fill this in.</div>';
  }
  const cmd = m[state.marketCommodity] ? state.marketCommodity : 'hs5903';
  const b = m[cmd];
  const year = (m._meta && m._meta.year) || '';
  const impUrl = (b.query_urls && b.query_urls.imports) || '#';
  const expUrl = (b.query_urls && b.query_urls.exports) || '#';
  const srcLink = (url, text = 'UN Comtrade ↗') => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="shrink-0 text-[11px] font-semibold text-indigo-500 hover:underline">${escapeHtml(text)}</a>`;

  const cmdBtn = (key, label) => {
    const on = cmd === key;
    return `<button type="button" data-mktcmd="${key}" aria-pressed="${on}" class="rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${on ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">${label}</button>`;
  };
  const cmdToggle = `<div class="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">${cmdBtn('hs5903', 'All coated fabric (5903)')}${cmdBtn('hs590320', 'PU-coated (5903.20)')}</div>`;

  const PALETTE = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#22c55e', '#eab308', '#3b82f6'];
  const barItems = (rows, prefix, verb) => (rows || []).slice(0, 12).map((r, i) => ({
    key: prefix + r.code, label: r.country, short: truncate(r.country, 16), iso2: r.iso2, value: r.value,
    valueText: fmtUSD(r.value), tipSub: `${fmtUSD(r.value)} · ${fmtTonnes(r.netWgt)} ${verb}`, color: PALETTE[i % PALETTE.length],
  }));
  const impItems = barItems(b.top_importers, 'imp', 'imported');
  const expItems = barItems(b.top_exporters, 'exp', 'exported');

  const REGION_COLORS = { Asia: '#6366f1', Europe: '#0ea5e9', 'North America': '#f59e0b', 'South America': '#10b981', Africa: '#ef4444', Oceania: '#8b5cf6', Other: '#94a3b8' };
  const regItems = (b.region_split || []).map((r) => ({
    key: 'reg' + r.region, label: r.region, value: r.value, valueText: fmtUSD(r.value), pct: r.pct,
    tipSub: `${fmtUSD(r.value)} · ${r.pct}% of imports`, color: REGION_COLORS[r.region] || '#94a3b8',
  }));

  const hsLabel = cmd === 'hs5903' ? 'HS 5903' : 'HS 5903.20';

  return `
    <div class="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div class="min-w-0">
        <h3 class="font-display text-base font-extrabold text-slate-900">Global coated-fabric market — real UN trade data (${escapeHtml(hsLabel)}, ${escapeHtml(String(year))})</h3>
        <p class="mt-0.5 text-[12px] text-slate-500">Source: ${srcLink(impUrl)} — every figure below is a value UN Comtrade actually reported, not a model.</p>
      </div>
      ${cmdToggle}
    </div>

    <div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      ${sizeCard('World import value', fmtUSD(b.world_import_value), `${b.reporting_importers || b.top_importers.length} countries buying · ${year}`, impUrl, 'indigo')}
      ${sizeCard('World import volume', fmtTonnes(b.world_import_netWgt), 'net weight reported', impUrl, 'sky')}
      ${sizeCard('World export value', fmtUSD(b.world_export_value), `${b.reporting_exporters || b.top_exporters.length} countries supplying`, expUrl, 'emerald')}
    </div>

    <div class="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div class="mb-1 flex items-center justify-between gap-2"><h4 class="text-sm font-bold text-slate-800">Where the demand is — top importers</h4>${srcLink(impUrl)}</div>
        <p class="mb-2 text-[12px] text-slate-500">Who buys coated fabric, by import value (${year}).</p>
        ${buildValueBars(impItems)}
      </div>
      <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div class="mb-1 flex items-center justify-between gap-2"><h4 class="text-sm font-bold text-slate-800">Demand by region</h4>${srcLink(impUrl)}</div>
        <p class="mb-2 text-[12px] text-slate-500">Imports grouped by world region.</p>
        <div class="flex flex-wrap items-center gap-4">
          ${buildValueDonut(regItems, { centerNum: fmtUSD(b.world_import_value), centerLabel: 'imports' })}
          ${buildValueLegend(regItems)}
        </div>
      </div>
    </div>

    <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div class="mb-1 flex items-center justify-between gap-2"><h4 class="text-sm font-bold text-slate-800">Who makes it — supply chain (top exporters)</h4>${srcLink(expUrl)}</div>
      <p class="mb-2 text-[12px] text-slate-500">Where coated fabric is produced &amp; shipped from, by export value (${year}).</p>
      ${buildValueBars(expItems)}
    </div>

    <p class="mt-3 text-center text-[11px] text-slate-400">Real UN Comtrade annual trade (HS classification), partner = World. ${srcLink(impUrl, 'View the exact query ↗')}</p>
  `;
}

function renderResearchTargets() {
  if (!state.research.length) {
    return '<div class="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">No research targets loaded.</div>';
  }
  const f = state.researchFilters;
  const total = state.research.length;
  const verified = state.research.filter((t) => t.verified === true && t.product_confirmed === true).length;
  const bySeg = {}; state.research.forEach((t) => { bySeg[t.segment] = (bySeg[t.segment] || 0) + 1; });
  const countries = [...new Set(state.research.map((t) => t.country || 'Unknown'))].sort();

  const chip = (key, label, n) => {
    const on = f.segment === key;
    return `<button type="button" data-rsub="${escapeHtml(key)}" aria-pressed="${on}" class="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold shadow-sm ring-1 transition-colors ${on ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}">${label} <span class="tnum ${on ? 'text-white/80' : 'text-slate-400'}">${n}</span></button>`;
  };
  const chips = [chip('all', 'All', total)].concat(RESEARCH_SEGMENTS.filter((s) => bySeg[s]).map((s) => chip(s, segLabel(s), bySeg[s]))).join('');

  return `<div>
    <p class="mb-3 text-[12px] text-slate-400">Your real target-company universe — each company gets verified against its own website. <span class="tnum font-semibold text-slate-600">${total}</span> companies · <span class="tnum font-semibold text-emerald-600">${verified}</span> verified against their site.</p>
    <div class="mb-3 flex flex-wrap items-center gap-2">${chips}</div>
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <div class="relative min-w-[180px] flex-1">
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
        <input id="r-search" type="search" value="${escapeHtml(f.search)}" placeholder="Search companies…" class="w-full rounded-xl border-0 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
      </div>
      ${selectHtml('r-country', 'All countries', f.country, countries)}
    </div>
    <div class="mb-2 px-0.5 text-[12px] text-slate-500"><span id="rCount" class="tnum font-semibold text-slate-700">${researchFiltered().length}</span> shown</div>
    <div id="researchList" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">${researchListHtml()}</div>
  </div>`;
}

function renderToday() {
  const upcomingAll = state.exhibitions.filter(showUpcoming);
  const upcoming = exhibitionsByDate(upcomingAll).slice(0, 8);
  const comingList = upcoming.length ? upcoming.map((d) => `
    <button type="button" data-exh-id="${escapeHtml(d.id)}" class="flex w-full items-center gap-3 border-t border-slate-100 py-2.5 text-left first:border-t-0 hover:bg-slate-50/60" title="See exhibitors from ${escapeHtml(d.name)}">
      <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:${segColor(d.segment)}"></span>
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold text-slate-800">${escapeHtml(d.name)}</div>
        <div class="truncate text-[12px] text-slate-500">${countryCell(d.country)}${d.place ? ' · ' + escapeHtml(d.place) : ''}</div>
      </div>
      <div class="shrink-0 text-right text-[12px] font-medium text-slate-500 tnum">${escapeHtml(dash(d.dates))}</div>
    </button>`).join('') : `<div class="py-6 text-center text-sm text-slate-400">No upcoming shows.</div>`;

  const foundAll = state.leads.filter((l) => isEngineSource(l.source));
  const recent = foundAll.slice(-8).reverse(); // most recently appended first
  const recentList = recent.length ? recent.map((l) => {
    const c = displayContact(l.id);
    const who = c && (c.name || c.email);
    const show = sourceShow(l.source);
    const sub = [escapeHtml(l.segment || ''), l.country ? countryCell(l.country) : '', who ? escapeHtml(who) : '', show ? '🎪 ' + escapeHtml(show.name) : ''].filter(Boolean).join(' · ');
    return `<button type="button" data-lead-id="${escapeHtml(l.id)}" class="flex w-full items-center gap-3 border-t border-slate-100 py-2.5 text-left first:border-t-0 hover:bg-slate-50/60">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-1.5"><span class="truncate text-sm font-semibold text-slate-800">${escapeHtml(l.company)}</span>${isRecommended(l) ? '<span class="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">★ Recommended</span>' : ''}</div>
        <div class="truncate text-[12px] text-slate-500">${sub}</div>
      </div>
      ${priorityChip(l.priority)}
    </button>`;
  }).join('') : `<div class="py-6 text-center text-sm text-slate-400">No leads found yet — the engine adds them from exhibitor lists.</div>`;

  const card = (icon, title, sub, body) => `<section class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-5">
    <div class="mb-1.5 flex items-baseline justify-between gap-2"><h3 class="font-display text-sm font-bold text-slate-800">${icon} ${title}</h3><span class="text-[12px] text-slate-400">${sub}</span></div>
    ${body}
  </section>`;

  return `<div class="fade-in grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
    ${card('📅', 'Upcoming exhibitions', `${upcomingAll.length} upcoming`, comingList)}
    ${card('🏢', 'Recently found leads', `${foundAll.length} found`, recentList)}
  </div>`;
}

/* ------------------------------------------------------------------ *
 * Global search (⌘K)
 * ------------------------------------------------------------------ */

function setSearchExpanded(v) { const i = $('#globalSearch'); if (i) i.setAttribute('aria-expanded', v ? 'true' : 'false'); }
function hideSearch() { const out = $('#searchResults'); if (out) { out.hidden = true; out.innerHTML = ''; } setSearchExpanded(false); }

function runGlobalSearch(q) {
  const out = $('#searchResults');
  if (!out) return;
  q = String(q || '').trim().toLowerCase();
  if (!q) { hideSearch(); return; }
  const has = (s) => String(s || '').toLowerCase().includes(q);
  const groups = [
    { type: 'lead', icon: '🎯', label: 'Companies', items: state.leads.filter((l) => has(l.company)).slice(0, 6).map((l) => ({ id: l.id, title: l.company, sub: l.segment })) },
    { type: 'exhibition', icon: '🎪', label: 'Exhibitions', items: state.exhibitions.filter((d) => has(d.name)).slice(0, 6).map((d) => ({ id: d.id, title: d.name, sub: d.country })) },
    { type: 'product', icon: '🧵', label: 'Products', items: state.products.filter((pr) => has(pr.name)).slice(0, 6).map((pr) => ({ id: pr.id, title: pr.name, sub: pr.family })) },
    { type: 'competitor', icon: '🛡️', label: 'Competitors', items: state.competitors.filter((c) => has(c.company)).slice(0, 6).map((c) => ({ id: c.id, title: c.company, sub: c.country })) },
  ].filter((g) => g.items.length);

  out.innerHTML = groups.length ? groups.map((g) => `
    <div class="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">${g.icon} ${g.label}</div>
    ${g.items.map((it) => `<button type="button" data-search-go="${g.type}:${escapeHtml(it.id)}" class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50">
      <span class="truncate text-sm font-semibold text-slate-700">${escapeHtml(it.title)}</span>
      <span class="shrink-0 text-[11px] text-slate-400">${escapeHtml(it.sub || '')}</span>
    </button>`).join('')}`).join('')
    : `<div class="px-3 py-4 text-center text-[13px] text-slate-400">No matches for “${escapeHtml(q)}”.</div>`;
  out.hidden = false;
  setSearchExpanded(true);
}

function searchGo(token) {
  const i = token.indexOf(':');
  const type = token.slice(0, i), id = token.slice(i + 1);
  hideSearch();
  const si = $('#globalSearch'); if (si) si.value = '';
  if (type === 'lead') { state.tab = 'leads'; state.leadsSub = 'list'; render(); openLeadDrawer(id); }
  else if (type === 'exhibition') { const ex = state.exhibitions.find((x) => x.id === id); state.tab = 'exhibitions'; state.sub = 'list'; state.filters = { ...state.filters, search: ex ? ex.name : '', segment: 'all', country: 'all', status: 'all' }; render(); }
  else if (type === 'product') { const pr = state.products.find((x) => x.id === id); state.prodModalSearch = pr ? pr.name : ''; openProductsModal(); }
  else if (type === 'competitor') { state.tab = 'competitors'; render(); openCompetitorDrawer(id); }
}

/* ------------------------------------------------------------------ *
 * Excel export (ExcelJS via CDN)
 * ------------------------------------------------------------------ */

// Kusumgar-branded workbook palette.
const XL = { brand: 'FF4F46E5', header: 'FF6366F1', headerText: 'FFFFFFFF', band: 'FFEEF2FF', border: 'FFCBD5E1', ink: 'FF1E293B', zebra: 'FFF8FAFC', muted: 'FF64748B' };
const xlBorder = () => { const s = { style: 'thin', color: { argb: XL.border } }; return { top: s, left: s, bottom: s, right: s }; };
// Tint an "Email type" cell to match the on-screen badge (verified/personal green, company amber, none grey).
const XLSX_EMAIL_ARGB = { verified: 'FF10B981', personal: 'FF10B981', company: 'FFF59E0B', none: 'FFE2E8F0' };
function paintEmailType(cell, klass) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_EMAIL_ARGB[klass] || 'FFE2E8F0' } };
  cell.font = { bold: true, color: { argb: klass === 'none' ? 'FF475569' : 'FFFFFFFF' } };
}
const colLetter = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; };

// One beautifully formatted sheet: brand title band, colored bold header, thin borders, zebra rows,
// frozen header, auto-filter, gridlines off. `painters[key]` can restyle a specific column's cells.
function buildStyledSheet(wb, name, title, columns, rows, painters = {}) {
  const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ showGridLines: false }] });
  const n = columns.length;
  const last = colLetter(n);
  columns.forEach((col, i) => { ws.getColumn(i + 1).width = col.width || 18; });

  ws.mergeCells(`A1:${last}1`);
  const t = ws.getCell('A1');
  t.value = `KUSUMGAR  ·  ${title}`;
  t.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.brand } };
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells(`A2:${last}2`);
  const s = ws.getCell('A2');
  s.value = `Kusumgar Growth Engine   ·   ${rows.length} row${rows.length === 1 ? '' : 's'}   ·   exported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  s.font = { italic: true, size: 10, color: { argb: XL.muted } };
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.band } };
  s.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 18;

  const H = 3;
  columns.forEach((col, i) => {
    const cell = ws.getCell(H, i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: XL.headerText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.header } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cell.border = xlBorder();
  });
  ws.getRow(H).height = 22;

  rows.forEach((row, ri) => {
    const er = ws.getRow(H + 1 + ri);
    columns.forEach((col, ci) => {
      const cell = er.getCell(ci + 1);
      cell.value = row[col.key] == null ? '' : row[col.key];
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: !!col.wrap };
      cell.border = xlBorder();
      cell.font = { color: { argb: XL.ink } };
      if (ri % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.zebra } };
      if (painters[col.key]) painters[col.key](cell, row);
    });
    er.height = 18;
  });

  ws.views = [{ state: 'frozen', ySplit: H, showGridLines: false }];
  ws.autoFilter = { from: { row: H, column: 1 }, to: { row: H, column: n } };
  return ws;
}

function addExhibitionsSheet(wb, list) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cols = [
    { header: 'Industry', key: 'segment', width: 22 }, { header: 'Exhibition', key: 'name', width: 34 },
    { header: 'Country', key: 'country', width: 16 }, { header: 'Place', key: 'place', width: 18 },
    { header: 'Date', key: 'dates', width: 20 }, { header: 'Timing', key: 'timing', width: 12 },
    { header: 'Website', key: 'website', width: 34 }, { header: 'Registration', key: 'registration', width: 30 },
    { header: 'Status', key: 'status', width: 12 },
  ];
  const rows = list.map((d) => { const end = showEndDate(d); return {
    segment: segLabel(d.segment), name: d.name, country: d.country || '', place: d.place || '',
    dates: d.dates || '', timing: end ? (end < today ? 'Completed' : 'Upcoming') : '—',
    website: d.website || '', registration: d.registration || '', status: d.status || '',
  }; });
  buildStyledSheet(wb, 'Exhibitions', 'Exhibitions', cols, rows);
}

function addExhibitorsSheet(wb, leads) {
  const cols = [
    { header: 'Company', key: 'company', width: 30 }, { header: 'Industry', key: 'segment', width: 22 },
    { header: 'Country', key: 'country', width: 16 }, { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Why (fit)', key: 'why', width: 52, wrap: true }, { header: 'Contact', key: 'cname', width: 22 },
    { header: 'Role', key: 'ctitle', width: 24 }, { header: 'Email', key: 'cemail', width: 28 },
    { header: 'Email type', key: 'etype', width: 14 }, { header: 'LinkedIn', key: 'linkedin', width: 30 },
    { header: 'Website', key: 'website', width: 30 }, { header: 'Which show', key: 'show', width: 24 },
  ];
  const rows = leads.map((l) => { const c = displayContact(l.id) || {}; const show = sourceShow(l.source); return {
    company: l.company, segment: segLabel(l.segment), country: l.country || '', priority: l.priority || '',
    why: priorityReason(l), cname: c.name || '', ctitle: c.title || '', cemail: c.email || '',
    etype: EMAIL_CLASS[classifyEmail(c)][1], linkedin: c.linkedin_url || '', website: l.website || '',
    show: show ? show.name : '', _klass: classifyEmail(c),
  }; });
  buildStyledSheet(wb, 'Exhibitors', 'Exhibitors (leads)', cols, rows, { etype: (cell, row) => paintEmailType(cell, row._klass) });
}

function addCompetitorsSheet(wb, comps) {
  const cols = [
    { header: 'Company', key: 'company', width: 28 }, { header: 'Country', key: 'country', width: 16 },
    { header: 'How they compete', key: 'compete', width: 20 }, { header: 'What they sell', key: 'focus', width: 50, wrap: true },
    { header: 'Industries', key: 'industries', width: 30 }, { header: 'Which show', key: 'show', width: 24 },
  ];
  const rows = comps.map((c) => { const show = sourceShow(c.source); return {
    company: c.company, country: c.country || '', compete: positionBucket(c.positioning).label,
    focus: c.focus || '', industries: (c.segments || []).map(segLabel).join(', '), show: show ? show.name : '',
  }; });
  buildStyledSheet(wb, 'Competitors', 'Competitors', cols, rows);
}

function addProductsSheet(wb, products) {
  const cols = [
    { header: 'Product', key: 'name', width: 34 }, { header: 'Family', key: 'family', width: 22 },
    { header: 'Base', key: 'base', width: 16 }, { header: 'Deniers', key: 'deniers', width: 14 },
    { header: 'Coatings', key: 'coatings', width: 24 }, { header: 'Properties', key: 'properties', width: 44, wrap: true },
    { header: 'Industries', key: 'segments', width: 30 }, { header: 'Applications', key: 'applications', width: 40, wrap: true },
  ];
  const rows = products.map((p) => ({
    name: p.name, family: p.family || '', base: p.base || '', deniers: p.deniers || '',
    coatings: (p.coatings || []).join(', '), properties: (p.properties || []).join(', '),
    segments: (p.segments || []).map(segLabel).join(', '), applications: (p.applications || []).join(', '),
  }));
  buildStyledSheet(wb, 'Products', 'Products (Kusumgar catalog)', cols, rows);
}

function addOutreachSheet(wb, leads) {
  const cols = [
    { header: 'Company', key: 'company', width: 30 }, { header: 'Industry', key: 'segment', width: 22 },
    { header: 'Stage', key: 'stage', width: 18 }, { header: 'Follow-up', key: 'next', width: 14 },
    { header: 'Contact', key: 'contact', width: 24 }, { header: 'Email', key: 'email', width: 28 },
    { header: 'Email type', key: 'etype', width: 14 }, { header: 'Has draft', key: 'draft', width: 10 },
  ];
  const rows = leads.map((l) => { const pl = state.pipeline[l.id] || {}; const c = displayContact(l.id) || {}; return {
    company: l.company, segment: segLabel(l.segment), stage: pl.stage || '', next: pl.next || '',
    contact: c.name || '', email: c.email || '', etype: EMAIL_CLASS[classifyEmail(c)][1],
    draft: hasDraftFor(l.id) ? 'Yes' : '', _klass: classifyEmail(c),
  }; });
  buildStyledSheet(wb, 'Outreach', 'Outreach pipeline', cols, rows, { etype: (cell, row) => paintEmailType(cell, row._klass) });
}

// scope: 'exhibitions' | 'leads' | 'competitors' | 'products' | 'outreach' | 'all'
function exportExcel(scope) {
  if (!window.ExcelJS) { console.error('ExcelJS not loaded yet'); return; }
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Kusumgar Growth Engine';
    if (scope === 'all') {
      addExhibitionsSheet(wb, exhibitionsByDate(state.exhibitions));
      addExhibitorsSheet(wb, sortedLeads(state.leads));
      addCompetitorsSheet(wb, state.competitors);
      addProductsSheet(wb, state.products);
      addOutreachSheet(wb, pipelinedLeads());
    } else if (scope === 'exhibitions') addExhibitionsSheet(wb, exhibitionFiltered());
    else if (scope === 'leads') addExhibitorsSheet(wb, sortedLeads(filteredLeads()));
    else if (scope === 'competitors') addCompetitorsSheet(wb, state.competitors);
    else if (scope === 'products') addProductsSheet(wb, state.products);
    else if (scope === 'outreach') addOutreachSheet(wb, pipelinedLeads());
    else return;
    wb.xlsx.writeBuffer().then((buf) => {
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kusumgar-${scope}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }).catch((e) => console.error('export failed', e));
  } catch (e) { console.error('export failed', e); }
}

/* ------------------------------------------------------------------ *
 * Render pipeline
 * ------------------------------------------------------------------ */

const view = $('#view');

function renderTabs() {
  const bar = $('#tabBar');
  bar.innerHTML = TABS.map((t) => {
    const active = state.tab === t.id;
    const txt = active ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700';
    return `<button type="button" data-tab="${t.id}" data-active="${active}"
      class="tab-btn relative shrink-0 whitespace-nowrap px-3.5 py-2.5 text-sm font-semibold transition-colors ${txt}">
      <span>${t.icon} ${escapeHtml(t.label)}</span>
      <span class="tab-underline absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"></span>
    </button>`;
  }).join('');
}

/* ---- "Show only what we found" — narrow leads/competitors/exhibitions to engine-generated
 * rows (client's seed data hidden, never deleted). Products stay (Kusumgar's own catalog). ---- */
// Engine-generated rows carry a source of "exhibition:<id>" (show scraper) or
// "category:<slug>" (category finder); competitors the same. Exhibitions: "discovered".
const isEngineSource = (s) => { const v = String(s || ''); return v.startsWith('exhibition') || v.startsWith('category'); };
const FOUND = {
  leads: (l) => isEngineSource(l.source),
  competitors: (c) => isEngineSource(c.source),
  exhibitions: (e) => e.source === 'discovered',
};
function applyOnlyFound() {
  if (!state.master) return;
  const F = state.onlyFound;
  ['leads', 'competitors', 'exhibitions'].forEach((k) => {
    state[k] = F ? state.master[k].filter(FOUND[k]) : state.master[k];
  });
}
function foundCounts() {
  const m = state.master || { leads: state.leads, competitors: state.competitors, exhibitions: state.exhibitions };
  return { leads: m.leads.filter(FOUND.leads).length, competitors: m.competitors.filter(FOUND.competitors).length, exhibitions: m.exhibitions.filter(FOUND.exhibitions).length };
}
function syncOnlyFoundBtn() {
  const btn = $('#onlyFoundToggle'); if (!btn) return;
  const on = state.onlyFound;
  const c = foundCounts();
  btn.setAttribute('aria-pressed', String(on));
  btn.className = `inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 transition-colors ${on ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}`;
  btn.textContent = on
    ? `✨ Showing only what we found (${c.leads} leads · ${c.competitors} competitors)`
    : '✨ Show only what we found';
}

function render() {
  renderTabs();
  syncOnlyFoundBtn();
  const tab = TABS.find((t) => t.id === state.tab);
  if (state.tab === 'today') view.innerHTML = renderToday();
  else if (state.tab === 'research') view.innerHTML = renderResearch();
  else if (state.tab === 'exhibitions') view.innerHTML = renderExhibitions();
  else if (state.tab === 'products') view.innerHTML = renderProducts();
  else if (state.tab === 'leads') view.innerHTML = renderLeads();
  else if (state.tab === 'competitors') view.innerHTML = renderCompetitors();
  else if (state.tab === 'outreach') view.innerHTML = renderOutreach();
  else view.innerHTML = renderPlaceholder(tab);

  // Views with SVG/dot entrance animations.
  if (state.tab === 'today') revealCharts();
  else if (state.tab === 'exhibitions' && state.sub === 'overview') revealCharts();
  else if (state.tab === 'products' && state.productsSub === 'coverage') revealCharts();
  else if (state.tab === 'leads' && state.leadsSub === 'overview') revealCharts();
  else if (state.tab === 'competitors' && state.competitorsSub === 'landscape') revealCharts();
  else if (state.tab === 'research' && state.researchSub === 'market') revealCharts();
}

// Kick chart entrance animations after the DOM paints (idempotent, so a
// timeout fallback covers throttled rAF when the tab isn't focused).
let revealScheduled = false;
function doReveal() {
  view.querySelectorAll('.reveal-arc').forEach((el) => {
    const a = el.getAttribute('data-arc'); if (a) el.setAttribute('stroke-dasharray', a);
  });
  view.querySelectorAll('.reveal-scale').forEach((el) => { el.style.transform = 'scaleX(1)'; });
  view.querySelectorAll('.reveal-pill').forEach((el) => el.classList.add('in'));
  view.querySelectorAll('.reveal-pop').forEach((el) => el.classList.add('in'));
}
function revealCharts() {
  revealScheduled = false;
  requestAnimationFrame(() => requestAnimationFrame(doReveal));
  setTimeout(doReveal, 80);
}

/* ------------------------------------------------------------------ *
 * Events (delegated on stable containers)
 * ------------------------------------------------------------------ */

function setRelevance(id, val) {
  // Persist first (best-effort), but always keep the in-memory state in sync.
  try {
    if (val === 'undecided') localStorage.removeItem(REL_KEY(id));
    else localStorage.setItem(REL_KEY(id), val);
  } catch { /* storage unavailable (private mode / quota) — in-memory only */ }
  if (val === 'undecided') delete state.relevance[id];
  else state.relevance[id] = val;
}

function wireEvents() {
  // Tabs
  $('#tabBar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    state.tab = b.getAttribute('data-tab');
    render();
  });

  // "Show only what we found" — hide the client's seed data to see just the engine's additions.
  const oft = $('#onlyFoundToggle');
  if (oft) oft.addEventListener('click', () => {
    state.onlyFound = !state.onlyFound;
    try { localStorage.setItem('kgr.onlyfound', state.onlyFound ? '1' : '0'); } catch { /* noop */ }
    applyOnlyFound();
    render();
  });

  // Sub-toggles, relevance triage, relevant-only toggle (all inside #view)
  view.addEventListener('click', (e) => {
    const sub = e.target.closest('[data-sub]');
    if (sub) { state.sub = sub.getAttribute('data-sub'); render(); return; }

    const psub = e.target.closest('[data-psub]');
    if (psub) { state.productsSub = psub.getAttribute('data-psub'); render(); return; }

    const lsub = e.target.closest('[data-lsub]');
    if (lsub) { state.leadsSub = lsub.getAttribute('data-lsub'); render(); return; }

    const csub = e.target.closest('[data-csub]');
    if (csub) { state.competitorsSub = csub.getAttribute('data-csub'); render(); return; }

    const osub = e.target.closest('[data-osub]');
    if (osub) { state.outreachSub = osub.getAttribute('data-osub'); render(); return; }

    // Industry Research: Market/Targets sub-view toggle + Market commodity toggle.
    const researchSub = e.target.closest('[data-researchsub]');
    if (researchSub) { state.researchSub = researchSub.getAttribute('data-researchsub'); render(); return; }
    const mktCmd = e.target.closest('[data-mktcmd]');
    if (mktCmd) { state.marketCommodity = mktCmd.getAttribute('data-mktcmd'); render(); return; }

    // Industry Research: segment chip + "Send to Growth Engine".
    const rsub = e.target.closest('[data-rsub]');
    if (rsub) { state.researchFilters.segment = rsub.getAttribute('data-rsub'); render(); return; }
    const rsend = e.target.closest('[data-research-send]');
    if (rsend) { sendResearchToEngine(rsend.getAttribute('data-research-send')); return; }

    // Pipeline compose: pick a lead (left) → draft opens (right); action buttons read the live fields.
    const composeRow = e.target.closest('[data-compose-id]');
    if (composeRow) {
      state.composeId = composeRow.getAttribute('data-compose-id');
      render();
      if (window.innerWidth < 1024) { const p = $('#composePanel'); if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      return;
    }
    const cGmail = e.target.closest('[data-compose-gmail]');
    if (cGmail) { openInGmail(); return; }
    const cCopy = e.target.closest('[data-compose-copy]');
    if (cCopy) { copyComposeEmail(cCopy); return; }
    const cSent = e.target.closest('[data-compose-sent]');
    if (cSent) { markComposeSent(); return; }

    const goFollow = e.target.closest('[data-gofollow]');
    if (goFollow) { state.tab = 'outreach'; state.outreachSub = 'followups'; render(); return; }
    const fuDone = e.target.closest('[data-fu-done]');
    if (fuDone) { markFollowedUp(fuDone.getAttribute('data-fu-done')); render(); return; }
    const fuSnooze = e.target.closest('[data-fu-snooze]');
    if (fuSnooze) { snoozeFollowup(fuSnooze.getAttribute('data-fu-snooze'), 3); render(); return; }

    const goto = e.target.closest('[data-goto]');
    if (goto) {
      state.tab = goto.getAttribute('data-goto');
      if (state.tab === 'leads') state.leadsSub = 'list';
      render(); return;
    }

    const toggle = e.target.closest('[data-toggle]');
    if (toggle) { state.filters.relevantOnly = !state.filters.relevantOnly; render(); return; }

    const lclass = e.target.closest('[data-lclass]');
    if (lclass) { const k = lclass.getAttribute('data-lclass'); state.leadFilters.emailClass = (state.leadFilters.emailClass === k ? 'all' : k); render(); return; }

    const distoggle = e.target.closest('[data-distoggle]');
    if (distoggle) { state.filters.discoveredOnly = !state.filters.discoveredOnly; render(); return; }

    const exportBtn = e.target.closest('[data-export]');
    if (exportBtn) { exportExcel(exportBtn.getAttribute('data-export')); return; }

    const sortTh = e.target.closest('[data-sort]');
    if (sortTh) {
      const key = sortTh.getAttribute('data-sort');
      const s = state.leadSort;
      s.dir = (s.key === key && s.dir === 'asc') ? 'desc' : 'asc';
      s.key = key;
      refreshLeadsTable();
      return;
    }

    const rel = e.target.closest('[data-rel]');
    if (rel) {
      const id = rel.closest('[data-rel-group]').getAttribute('data-rel-group');
      setRelevance(id, rel.getAttribute('data-rel'));
      refreshRows();
      return;
    }

    const draftBtn = e.target.closest('[data-action="draft-email"]');
    if (draftBtn) { openEmailModal(draftBtn.getAttribute('data-lead-id')); return; }

    // Real links (Website / Registration / LinkedIn / mailto) open in a new tab — don't trigger row clicks.
    if (e.target.closest('a')) return;

    // ⭐ Move-to-Lead toggle (Exhibitors table).
    const starBtn = e.target.closest('[data-star]');
    if (starBtn) { toggleStar(starBtn.getAttribute('data-star')); render(); return; }

    // Exhibitors "All | ⭐ My leads" view + "clear show filter".
    const leadView = e.target.closest('[data-leadview]');
    if (leadView) { state.leadFilters.view = leadView.getAttribute('data-leadview'); render(); return; }
    const clearShow = e.target.closest('[data-clearshow]');
    if (clearShow) { state.leadFilters.show = 'all'; render(); return; }
    const clearDates = e.target.closest('[data-cleardates]');
    if (clearDates) { state.filters.from = ''; state.filters.to = ''; render(); return; }

    // Exhibition row → centered detail modal (full info + exhibitors + competitors).
    const exhRow = e.target.closest('[data-exh-id]');
    if (exhRow) { openExhibitionModal(exhRow.getAttribute('data-exh-id')); return; }

    // Competitor row → detail drawer.
    const compRow = e.target.closest('[data-comp-id]');
    if (compRow) { openCompetitorDrawer(compRow.getAttribute('data-comp-id')); return; }

    const leadRow = e.target.closest('[data-lead-id]');
    if (leadRow) { openLeadDrawer(leadRow.getAttribute('data-lead-id')); }
  });

  // Filters (search inputs + selects)
  view.addEventListener('input', (e) => {
    if (e.target.id === 'f-search') { state.filters.search = e.target.value; refreshExhibitionsTable(); }
    else if (e.target.id === 'p-search') { state.productFilters.search = e.target.value; refreshCatalog(); }
    else if (e.target.id === 'l-search') { state.leadFilters.search = e.target.value; refreshLeadsTable(); }
    else if (e.target.id === 'o-search') { state.trackerFilters.search = e.target.value; refreshTrackerTable(); }
    else if (e.target.id === 'pipe-search') { state.pipeSearch = e.target.value; refreshPipeList(); }
    else if (e.target.id === 'r-search') { state.researchFilters.search = e.target.value; refreshResearchList(); }
    else if (e.target.id === 'composeTo' || e.target.id === 'composeSubject' || e.target.id === 'composeBody') { updateComposeMailto(); }
  });
  view.addEventListener('change', (e) => {
    const exMap = { 'f-seg': 'segment', 'f-timing': 'timing', 'f-from': 'from', 'f-to': 'to' };
    const pMap = { 'p-industry': 'industry', 'p-family': 'family' };
    const lMap = { 'l-seg': 'segment', 'l-country': 'country', 'l-priority': 'priority' };
    if (exMap[e.target.id]) { state.filters[exMap[e.target.id]] = e.target.value; render(); }
    else if (pMap[e.target.id]) { state.productFilters[pMap[e.target.id]] = e.target.value; refreshCatalog(); }
    else if (lMap[e.target.id]) { state.leadFilters[lMap[e.target.id]] = e.target.value; refreshLeadsTable(); }
    else if (e.target.id === 'o-stage') { state.trackerFilters.stage = e.target.value; refreshTrackerTable(); }
    else if (e.target.id === 'r-country') { state.researchFilters.country = e.target.value; render(); }
    else {
      // Tracker inline pipeline selects
      const stageId = e.target.getAttribute('data-pl-stage');
      const dealId = e.target.getAttribute('data-pl-deal');
      const mfgId = e.target.getAttribute('data-pl-mfg');
      if (stageId) { setPipeline(stageId, { stage: e.target.value }); refreshTrackerTable(); }
      else if (dealId) { setPipeline(dealId, { dealType: e.target.value }); refreshTrackerTable(); }
      else if (mfgId) { setPipeline(mfgId, { mfg: e.target.value }); refreshTrackerTable(); }
      else if (e.target.hasAttribute('data-pl-followup')) { setPipeline(e.target.getAttribute('data-pl-followup'), { next: e.target.value || null }); refreshTrackerTable(); }
      else if (e.target.hasAttribute('data-fu-date')) { setPipeline(e.target.getAttribute('data-fu-date'), { next: e.target.value || null }); render(); }
      else if (e.target.hasAttribute('data-fu-note')) { setPipeline(e.target.getAttribute('data-fu-note'), { note: e.target.value }); }
    }
  });

  // Tooltips + cross-highlight (delegated once)
  view.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tip-title]');
    if (el) { showTooltip(el); highlight(el); }
  });
  view.addEventListener('mouseout', (e) => {
    const el = e.target.closest('[data-tip-title]');
    if (el) { hideTooltip(); unhighlight(el); }
  });
  view.addEventListener('mousemove', moveTooltip);

  // Drill-panel (drawer) events — the #drawer element is stable, outside #view.
  const drawer = $('#drawer');
  drawer.addEventListener('click', (e) => {
    if (e.target.closest('[data-drawer-close]') || e.target.hasAttribute('data-drawer-backdrop')) { closeDrawer(); return; }
    const save = e.target.closest('[data-action="save-draft"]');
    if (save) {
      const id = save.getAttribute('data-lead-id');
      const inp = drawer.querySelector(`[data-manual-email="${CSS.escape(id)}"]`);
      const email = inp ? inp.value.trim() : '';
      if (email) { saveManualContact(id, email); openEmailModal(id); }
      return;
    }
    const draft = e.target.closest('[data-action="draft-email"]');
    if (draft) { openEmailModal(draft.getAttribute('data-lead-id')); }
  });

  // Header buttons (stable, outside #view): Products catalog + Export picker.
  const bP = $('#btnProducts'); if (bP) bP.addEventListener('click', openProductsModal);
  const bE = $('#btnExport'); if (bE) bE.addEventListener('click', openExportModal);

  // Centered modals (email, exhibition detail, products, export) — stable #modal outside #view.
  const modal = $('#modal');
  modal.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;   // links open normally
    if (e.target.closest('[data-modal-close]') || e.target.hasAttribute('data-modal-backdrop')) { closeModal(); return; }
    const copy = e.target.closest('[data-copy]');
    if (copy) { copyEmail(copy); return; }
    // Export picker → build the workbook for that scope.
    const exp = e.target.closest('[data-export-scope]');
    if (exp) { exportExcel(exp.getAttribute('data-export-scope')); closeModal(); return; }
    // Exhibition modal: ☆ add-to-lead (refresh modal in place) / "see all exhibitors".
    const star = e.target.closest('[data-star]');
    if (star) { toggleStar(star.getAttribute('data-star')); const card = modal.querySelector('[data-exh-modal]'); if (card) openExhibitionModal(card.getAttribute('data-exh-modal')); return; }
    const seeAll = e.target.closest('[data-exh-open-leads]');
    if (seeAll) {
      const sid = seeAll.getAttribute('data-exh-open-leads');
      closeModal();
      state.tab = 'leads';
      state.leadFilters = { ...state.leadFilters, show: sid, view: 'all', search: '', segment: 'all', country: 'all', priority: 'all', emailClass: 'all' };
      render(); return;
    }
  });
  modal.addEventListener('input', (e) => {
    if (e.target.id === 'prod-modal-search') { state.prodModalSearch = e.target.value; const w = $('#prodModalList'); if (w) w.innerHTML = productsModalListHtml(); }
  });
  modal.addEventListener('change', (e) => {
    const id = e.target.getAttribute('data-modal-stage');
    if (id) {
      setPipeline(id, { stage: e.target.value });
      const conf = $('#modalAdded', modal);
      if (conf) { conf.hidden = false; conf.textContent = e.target.value ? `Added to “${e.target.value}”` : 'Removed from pipeline'; }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('#modal').classList.contains('open')) closeModal();
    else closeDrawer();
  });

  // Global search (⌘K / Ctrl-K)
  const gs = $('#globalSearch');
  if (gs) {
    gs.addEventListener('input', () => runGlobalSearch(gs.value));
    gs.addEventListener('focus', () => { if (gs.value.trim()) runGlobalSearch(gs.value); });
    gs.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hideSearch(); gs.blur(); } });
  }
  const sr = $('#searchResults');
  if (sr) sr.addEventListener('click', (e) => { const b = e.target.closest('[data-search-go]'); if (b) searchGo(b.getAttribute('data-search-go')); });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); const i = $('#globalSearch'); if (i) { i.focus(); i.select(); } }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#globalSearch') && !e.target.closest('#searchResults')) hideSearch();
  });
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

function loadRelevance(ids) {
  ids.forEach((id) => {
    try {
      const v = localStorage.getItem(REL_KEY(id));
      if (v === 'yes' || v === 'no') state.relevance[id] = v;
    } catch { /* storage unavailable — ignore */ }
  });
}

async function boot() {
  wireEvents();
  try {
    // no-store: always pull the freshest data JSON (the background engines update these
    // files on every run) so the page never shows stale numbers from a cached copy.
    const NS = { cache: 'no-store' };
    const [meta, exhibitions, products, leads, competitors, outreach, research, market] = await Promise.all([
      fetch('data/meta.json', NS).then((r) => r.json()),
      fetch('data/exhibitions.json', NS).then((r) => r.json()),
      fetch('data/products.json', NS).then((r) => r.json()).catch(() => []),
      fetch('data/leads.json', NS).then((r) => r.json()).catch(() => []),
      fetch('data/competitors.json', NS).then((r) => r.json()).catch(() => []),
      fetch('data/outreach.json', NS).then((r) => r.json()).catch(() => ({})),
      fetch('data/research_targets.json', NS).then((r) => r.json()).catch(() => ({})),
      fetch('data/market_intel.json', NS).then((r) => r.json()).catch(() => null),
    ]);
    state.meta = meta;
    // Tolerate both the seed array and a pipeline { <items>, _meta, _debug } shape.
    const unwrap = (raw, key) => (Array.isArray(raw) ? raw : (raw && raw[key]) || []);
    state.exhibitions = unwrap(exhibitions, 'exhibitions').filter((d) => d && d.id && d.name);
    state.products = unwrap(products, 'products').filter((p) => p && p.id && p.name);
    state.leads = unwrap(leads, 'leads').filter((l) => l && l.id && l.company);
    state.competitors = unwrap(competitors, 'competitors').filter((c) => c && c.id && c.company);
    state.outreach = (outreach && typeof outreach === 'object' && !Array.isArray(outreach)) ? outreach : {};
    state.research = unwrap(research, 'targets').filter((t) => t && t.id && t.company);
    state.market = (market && typeof market === 'object' && market.hs5903) ? market : null;
    state.researchSent = loadResearchSent();
    // Merge any Industry-Research companies the user "sent to the Growth Engine" that aren't already leads.
    try {
      const rmap = loadResearchLeads();
      Object.values(rmap).forEach((l) => { if (l && l.id && l.company && !state.leads.some((x) => x.id === l.id)) state.leads.push(l); });
    } catch { /* ignore */ }
    loadRelevance(state.exhibitions.map((d) => d.id));
    loadPipeline(state.leads.map((l) => l.id));
    loadStars(state.leads.map((l) => l.id));   // ⭐ my-leads shortlist (localStorage)

    // "Updated" reflects the freshest REAL refresh — the newest _meta.scraped_at across the data
    // files, falling back to meta.updated_at — so it can never show a stale hardcoded date.
    const stamps = [meta && meta.updated_at];
    [exhibitions, products, leads, competitors, outreach].forEach((raw) => {
      const t = raw && !Array.isArray(raw) && raw._meta && raw._meta.scraped_at;
      if (t) stamps.push(t);
    });
    const freshest = stamps
      .map((t) => (t ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(t) ? t + 'T00:00:00Z' : t) : null))
      .filter((d) => d && !isNaN(d.getTime()))
      .sort((a, b) => b - a)[0] || null;
    const updated = freshest
      ? freshest.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
      : '—';
    const ut = $('#updatedText'); if (ut) ut.textContent = `Updated ${updated}`;
    const ff = $('#footerFreshness'); if (ff) ff.textContent = `Kusumgar Growth Engine · data updated ${updated}`;
  } catch (err) {
    console.error('Failed to load data', err);
    view.innerHTML = `<div class="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-100">Couldn’t load exhibition data. Please refresh.</div>`;
    renderTabs();
    return;
  }
  render();
}

boot();
