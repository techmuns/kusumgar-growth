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
  { id: 'today', label: 'Today', icon: '🏠', live: true },
  { id: 'exhibitions', label: 'Exhibitions', icon: '🎪', live: true },
  { id: 'products', label: 'Products', icon: '🧵', live: true },
  { id: 'leads', label: 'Leads', icon: '🎯', live: true },
  { id: 'competitors', label: 'Competitors', icon: '🛡️', live: true },
  { id: 'outreach', label: 'Outreach', icon: '📮', live: true },
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
  filters: { search: '', segment: 'all', country: 'all', status: 'all', relevantOnly: false, discoveredOnly: false },
  productsSub: 'catalog', // 'catalog' | 'coverage'
  productFilters: { search: '', industry: 'all', family: 'all' },
  leadsSub: 'overview',   // 'overview' | 'list'
  leadFilters: { search: '', segment: 'all', country: 'all', priority: 'all', fullOnly: false, needsContact: false },
  leadSort: { key: 'company', dir: 'asc' },
  competitorsSub: 'landscape', // 'landscape' | 'list'
  outreachSub: 'pipeline',     // 'pipeline' | 'tracker'
  trackerFilters: { search: '', stage: 'all' },
};

const PIPE_KEY = (id) => `kgr.outreach.${id}`;

const REL_KEY = (id) => `kgr.relevant.${id}`;
const REL_COLORS = { yes: '#10b981', no: '#f43f5e', undecided: '#94a3b8' };

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

function renderOverview() {
  const data = state.exhibitions;
  const total = data.length;
  const segCounts = countBy(data, (d) => d.segment);
  const engaged = data.filter((d) => ENGAGED.has(d.status)).length;
  const upcoming = data.filter((d) => d.start).length;
  const segments = [...segCounts.keys()].length;

  // 1) Segment donut
  const segItems = [...segCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([seg, v]) => ({ label: segLabel(seg), value: v, color: segColor(seg), key: 'seg:' + seg }));
  const donutSeg = `<div class="flex items-center gap-3 sm:gap-4">${buildDonut(segItems, { centerNum: total, centerLabel: 'shows' })}${buildLegend(segItems, { total })}</div>`;

  // 2) Country bars (top 7)
  const countryCounts = [...countBy(data, (d) => d.country).entries()]
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
  const upcomingShows = data.filter((d) => d.start);
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
    if (f.country !== 'all' && d.country !== f.country) return false;
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
  const countries = [...new Set(state.exhibitions.map((d) => d.country))].sort();
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

function renderExhibitions() {
  const subBtn = (id, label) => {
    const active = state.sub === id;
    const cls = active ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700';
    return `<button type="button" data-sub="${id}" class="rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${cls}">${label}</button>`;
  };
  const toggle = `<div class="inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">${subBtn('overview', '📊 Overview')}${subBtn('list', '📋 List')}</div>`;
  const body = state.sub === 'overview' ? renderOverview() : renderList();
  return `<div class="mb-4">${toggle}</div>${body}`;
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
  const fullCount = leads.filter((d) => d.detail === 'full').length;

  const chips = `
    <div class="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      ${statChip('🎯', total, 'Total leads', '#6366f1')}
      ${statChip('🧩', segCounts.size, 'Segments', '#0ea5e9')}
      ${statChip('⭐', high, 'High priority', '#10b981')}
      ${statChip('📇', fullCount, 'Full details', '#f59e0b')}
    </div>`;

  // Live source split (grows once the classify engine appends exhibition leads).
  const research = leads.filter((d) => !String(d.source || '').startsWith('exhibition')).length;
  const fromEx = total - research;
  const sourceLine = `
    <div class="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
      <span class="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-medium text-slate-600 shadow-sm ring-1 ring-slate-100"><span class="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>Research <span class="tnum font-bold text-slate-900">${research}</span></span>
      <span class="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-medium text-slate-600 shadow-sm ring-1 ring-slate-100"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>From exhibitions <span class="tnum font-bold text-slate-900">${fromEx}</span></span>
    </div>`;

  const segItems = [...segCounts.entries()].sort((a, b) => b[1] - a[1])
    .map(([s, v]) => ({ label: s, value: v, color: leadSegColor(s), key: 'lseg:' + s }));
  const donut = `<div class="flex items-center gap-3 sm:gap-4">${buildDonut(segItems, { centerNum: total, centerLabel: 'leads', unit: 'lead' })}${buildLegend(segItems, { total, unit: 'lead' })}</div>`;

  const countryCounts = [...countBy(leads, (d) => d.country).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10);
  const maxC = countryCounts[0] ? countryCounts[0][1] : 1, minC = countryCounts.length ? countryCounts[countryCounts.length - 1][1] : 0;
  const countryItems = countryCounts.map(([c, v]) => ({ label: c, value: v, flag: FLAGS[c] || '', key: 'lc:' + c, color: lerpColor('#818cf8', '#db2777', maxC === minC ? 0.5 : (v - minC) / (maxC - minC)) }));
  const countryLegend = `<div class="mt-3 flex items-center gap-2 text-[11px] font-medium text-slate-400"><span>fewer</span><span class="h-2 flex-1 rounded-full" style="background:linear-gradient(to right,#818cf8,#db2777)"></span><span>more leads</span></div>`;

  const priItems = ['High', 'Medium'].map((p) => ({ label: p, value: leads.filter((d) => d.priority === p).length, color: PRIORITY_COLORS[p], key: 'pri:' + p })).filter((i) => i.value > 0);
  const priLegend = `<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">` + priItems.map((i) =>
    `<div class="hovable flex items-center gap-1.5" data-key="${i.key}" data-tip-title="${escapeHtml(i.label)} priority" data-tip-color="${i.color}" data-tip-sub="${plural(i.value, 'lead')}"><span class="h-2.5 w-2.5 rounded-full" style="background:${i.color}"></span><span class="text-[13px] font-medium text-slate-600">${i.label}</span><span class="tnum text-[13px] font-bold text-slate-900">${i.value}</span></div>`).join('') + `</div>`;

  const fitCounts = [...countBy(leads, (d) => d.fabric_fit).entries()].filter(([k]) => k).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxF = fitCounts[0] ? fitCounts[0][1] : 1, minF = fitCounts.length ? fitCounts[fitCounts.length - 1][1] : 0;
  const fitShort = (f) => f.replace(/ Polyester| Fabric/g, '').replace(/ \/ /g, '/');
  const fitItems = fitCounts.map(([f, v]) => ({ label: f, short: fitShort(f), value: v, key: 'fit:' + f, color: lerpColor('#34d399', '#6366f1', maxF === minF ? 0.5 : (v - minF) / (maxF - minF)) }));
  const fitLegend = `<div class="mt-3 flex items-center gap-2 text-[11px] font-medium text-slate-400"><span>fewer</span><span class="h-2 flex-1 rounded-full" style="background:linear-gradient(to right,#34d399,#6366f1)"></span><span>more leads</span></div>`;

  const grid = `
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <div class="space-y-4">
        <div data-chart>${chartCard('🧩', 'Leads by industry', 'what they make', donut)}</div>
        <div data-chart>${chartCard('🧵', 'Leads by best-fit fabric', 'our closest fabric for them', buildBars(fitItems, { unit: 'lead' }) + fitLegend)}</div>
      </div>
      <div class="space-y-4">
        <div data-chart>${chartCard('🌍', 'Top countries', 'by number of leads', buildBars(countryItems, { unit: 'lead' }) + countryLegend)}</div>
        <div data-chart>${chartCard('⭐', 'Priority split', 'high vs medium', buildStackedBar(priItems, { unit: 'lead' }) + priLegend)}</div>
      </div>
    </div>`;

  return chips + sourceLine + grid;
}

function filteredLeads() {
  const f = state.leadFilters;
  const q = f.search.trim().toLowerCase();
  return state.leads.filter((l) => {
    if (f.segment !== 'all' && l.segment !== f.segment) return false;
    if (f.country !== 'all' && l.country !== f.country) return false;
    if (f.priority !== 'all' && l.priority !== f.priority) return false;
    if (f.fullOnly && l.detail !== 'full') return false;
    if (f.needsContact && !leadNeedsContact(l.id)) return false;
    if (q) {
      const hay = `${l.company} ${l.country} ${l.segment} ${l.application || ''} ${l.fabric_fit || ''} ${l.contact_role || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
// A lead "needs contact" if it has no verified/published/manual email (i.e. guessed or none).
const leadNeedsContact = (id) => {
  const c = resolvedContact(id);
  const st = c && c.email_status;
  return !(st === 'verified' || st === 'verified (manual)' || st === 'published');
};

function sortedLeads(list) {
  const { key, dir } = state.leadSort;
  const s = dir === 'asc' ? 1 : -1;
  const val = (l) => {
    if (key === 'est') return consumptionSortVal(l.est_consumption);
    if (key === 'priority') return l.priority === 'High' ? 0 : 1;
    return String(l[key] ?? '').toLowerCase();
  };
  return [...list].sort((a, b) => {
    const va = val(a), vb = val(b);
    if (va < vb) return -s;
    if (va > vb) return s;
    return a.company.localeCompare(b.company);
  });
}

const LEAD_COLS = [
  { key: 'company', label: 'Company' }, { key: 'segment', label: 'Industry' },
  { key: 'country', label: 'Country' }, { key: 'application', label: 'Used for' },
  { key: 'fabric_fit', label: 'Best-fit fabric' }, { key: 'est', label: 'Est. yearly use (m²)' },
  { key: 'sourcing_model', label: 'How they buy' }, { key: 'contact_role', label: 'Who to contact' },
  { key: 'priority', label: 'Priority' },
];

function leadsTableHtml() {
  const { key: sk, dir } = state.leadSort;
  const arrow = (k) => (sk === k ? (dir === 'asc' ? ' ▲' : ' ▼') : '');
  const thead = `<tr class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">` + LEAD_COLS.map((c) =>
    `<th class="cursor-pointer whitespace-nowrap px-3 py-2.5 font-semibold hover:text-slate-600 ${sk === c.key ? 'text-indigo-600' : ''}" data-sort="${c.key}">${escapeHtml(c.label)}<span class="tnum">${arrow(c.key)}</span></th>`).join('') + `</tr>`;
  const rows = sortedLeads(filteredLeads());
  const body = rows.length ? rows.map((l) => `
    <tr class="cursor-pointer border-t border-slate-100 hover:bg-slate-50/60" data-lead-id="${escapeHtml(l.id)}">
      <td class="whitespace-nowrap px-3 py-2.5 text-sm font-semibold text-slate-800">${escapeHtml(l.company)}</td>
      <td class="whitespace-nowrap px-3 py-2.5">${coloredChip(l.segment, leadSegColor(l.segment))}</td>
      <td class="whitespace-nowrap px-3 py-2.5 text-sm text-slate-600">${l.country ? (FLAGS[l.country] || '') + ' ' : ''}${escapeHtml(dash(l.country))}</td>
      <td class="px-3 py-2.5"><div class="max-w-[210px] truncate text-sm text-slate-600" title="${escapeHtml(l.application || '')}">${escapeHtml(dash(l.application))}</div></td>
      <td class="whitespace-nowrap px-3 py-2.5 text-sm text-slate-600">${escapeHtml(dash(l.fabric_fit))}</td>
      <td class="whitespace-nowrap px-3 py-2.5 text-sm text-slate-500 tnum">${escapeHtml(fmtConsumption(l.est_consumption))}</td>
      <td class="whitespace-nowrap px-3 py-2.5 text-sm text-slate-500">${escapeHtml(dash(l.sourcing_model))}</td>
      <td class="px-3 py-2.5"><div class="max-w-[190px] truncate text-sm text-slate-500" title="${escapeHtml(l.contact_role || '')}">${escapeHtml(dash(l.contact_role))}</div></td>
      <td class="whitespace-nowrap px-3 py-2.5">${priorityChip(l.priority)}</td>
    </tr>`).join('') : `<tr><td colspan="9" class="px-4 py-10 text-center text-sm text-slate-400">No leads match these filters.</td></tr>`;
  return `<table class="w-full min-w-[980px] border-collapse text-left"><thead>${thead}</thead><tbody>${body}</tbody></table>`;
}

function refreshLeadsTable() {
  const w = $('#leadsTableWrap'); if (w) w.innerHTML = leadsTableHtml();
  const c = $('#lCount'); if (c) c.textContent = filteredLeads().length;
}

function renderLeadsList() {
  const f = state.leadFilters;
  const segs = [...new Set(state.leads.map((l) => l.segment))].sort();
  const countries = [...new Set(state.leads.map((l) => l.country))].sort();
  const toggleCls = f.fullOnly ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50';
  const needCount = state.leads.filter((l) => leadNeedsContact(l.id)).length;
  const needCls = f.needsContact ? 'bg-amber-500 text-white ring-amber-500' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50';
  return `
    <div class="fade-in">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <div class="relative min-w-[170px] flex-1">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
          <input id="l-search" type="search" value="${escapeHtml(f.search)}" placeholder="Search leads…"
            class="w-full rounded-xl border-0 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
        </div>
        ${selectHtml('l-seg', 'All segments', f.segment, segs)}
        ${selectHtml('l-country', 'All countries', f.country, countries)}
        ${selectHtml('l-priority', 'All priorities', f.priority, ['High', 'Medium'])}
        <button type="button" data-ltoggle aria-pressed="${f.fullOnly}"
          class="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold shadow-sm ring-1 transition-colors ${toggleCls}">📇 Full details only</button>
        <button type="button" data-lneed aria-pressed="${f.needsContact}"
          class="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold shadow-sm ring-1 transition-colors ${needCls}">📮 Needs contact${needCount ? ` <span class="tnum">${needCount}</span>` : ''}</button>
        <button type="button" data-export="leads" class="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">📊 Export Excel</button>
      </div>
      <div class="mb-2 px-0.5 text-[12px] text-slate-500"><span id="lCount" class="tnum font-semibold text-slate-700">${filteredLeads().length}</span> leads · <span class="text-slate-400">click a row for the full profile</span></div>
      <div class="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"><div id="leadsTableWrap">${leadsTableHtml()}</div></div>
    </div>`;
}

function renderLeads() {
  if (!state.leads.length) {
    return `<div class="fade-in rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">No leads loaded.</div>`;
  }
  const subBtn = (id, label) => {
    const active = state.leadsSub === id;
    const cls = active ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700';
    return `<button type="button" data-lsub="${id}" class="rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${cls}">${label}</button>`;
  };
  const toggle = `<div class="inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">${subBtn('overview', '📊 Overview')}${subBtn('list', '📋 Leads list')}</div>`;
  const body = state.leadsSub === 'overview' ? renderLeadsOverview() : renderLeadsList();
  return `<div class="mb-4">${toggle}</div>${body}`;
}

// Drill-panel (right slide-over) for a single lead.
function openLeadDrawer(id) {
  const l = state.leads.find((x) => x.id === id);
  if (!l) return;
  const row = (label, val) => `<div class="flex justify-between gap-4 border-b border-slate-100 py-2.5"><span class="shrink-0 text-[12px] font-medium text-slate-400">${escapeHtml(label)}</span><span class="text-right text-[13px] font-semibold text-slate-700">${val}</span></div>`;
  const website = l.website ? `<a href="${escapeHtml(l.website)}" target="_blank" rel="noopener" class="text-indigo-600 hover:underline">${escapeHtml(String(l.website).replace(/^https?:\/\//, ''))}</a>` : '—';
  const badge = l.detail === 'full'
    ? '<span class="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600">Full details</span>'
    : '<span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400">Quick info</span>';
  const body = `
    <div class="flex flex-wrap items-center gap-2">${coloredChip(l.segment, leadSegColor(l.segment))}${priorityChip(l.priority)}${badge}</div>
    <div class="mt-4">
      ${row('Country', (l.country ? (FLAGS[l.country] || '') + ' ' : '') + escapeHtml(dash(l.country)))}
      ${row('Website', website)}
      ${row('Used for', escapeHtml(dash(l.application)))}
      ${row('Best-fit fabric', escapeHtml(dash(l.fabric_fit)))}
      ${row('Est. yearly use (m²)', escapeHtml(fmtConsumption(l.est_consumption)))}
      ${row('How they buy', escapeHtml(dash(l.sourcing_model)))}
      ${row('Who to contact', escapeHtml(dash(l.contact_role)))}
      ${row('Where we found them', escapeHtml(dash(l.source)))}
    </div>`;
  // Layer B — manual contact bridge (Nishad's real ContactOut-extension workflow).
  const rc = resolvedContact(l.id);
  const rcHas = rc && (rc.name || rc.email);
  const bridge = `
    <div class="mb-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <div class="mb-1.5 flex items-center justify-between gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Contact</span>
        ${emailStatusBadge(rc && rc.email_status, true)}
      </div>
      ${rcHas
        ? `<div class="text-sm font-bold text-slate-800">${escapeHtml(rc.name || rc.email)}</div>${rc.title ? `<div class="text-[12px] text-slate-500">${escapeHtml(rc.title)}</div>` : ''}${rc.email ? `<div class="mt-0.5 text-[12px]"><a href="mailto:${escapeHtml(rc.email)}" class="text-indigo-600 hover:underline">${escapeHtml(rc.email)}</a></div>` : ''}`
        : `<div class="text-[13px] text-slate-600">Best person to contact: <span class="font-semibold text-slate-800">${escapeHtml(dash(l.contact_role))}</span></div>`}
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

  const countryCounts = [...countBy(comps, (d) => d.country).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
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
    <th class="px-3 py-2.5">What they make</th>
    <th class="px-3 py-2.5">Industries</th>
  </tr>`;
  const rows = comps.map((c) => {
    const b = positionBucket(c.positioning);
    const segs = (c.segments || []).map((s) => coloredChip(segLabel(s), anyColor(s))).join(' ') || '<span class="text-slate-300">—</span>';
    return `
      <tr class="border-t border-slate-100 align-top hover:bg-slate-50/60">
        <td class="px-3 py-2.5 text-sm font-semibold text-slate-800">${escapeHtml(c.company)}</td>
        <td class="whitespace-nowrap px-3 py-2.5 text-sm text-slate-600">${c.country ? (FLAGS[c.country] || '') + ' ' : ''}${escapeHtml(dash(c.country))}</td>
        <td class="whitespace-nowrap px-3 py-2.5">${coloredChip(b.label, b.color)}</td>
        <td class="px-3 py-2.5"><div class="max-w-[380px] text-[13px] text-slate-600">${escapeHtml(dash(c.focus))}</div></td>
        <td class="px-3 py-2.5"><div class="flex flex-wrap gap-1.5">${segs}</div></td>
      </tr>`;
  }).join('');
  return `<div class="fade-in overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
    <table class="w-full min-w-[820px] border-collapse text-left"><thead>${thead}</thead><tbody>${rows}</tbody></table>
  </div>`;
}

function renderCompetitors() {
  if (!state.competitors.length) {
    return `<div class="fade-in rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">No competitors loaded.</div>`;
  }
  const subBtn = (id, label) => {
    const active = state.competitorsSub === id;
    const cls = active ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700';
    return `<button type="button" data-csub="${id}" class="rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${cls}">${label}</button>`;
  };
  const toggle = `<div class="inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">${subBtn('landscape', '🗺️ Overview')}${subBtn('list', '📋 List')}</div>`;
  const body = state.competitorsSub === 'landscape' ? renderCompetitorsLandscape() : renderCompetitorsList();
  return `<div class="mb-4">${toggle}</div>${body}`;
}

/* ------------------------------------------------------------------ *
 * Outreach tab — contacts + email modal + pipeline tracker
 * ------------------------------------------------------------------ */

const outreachFor = (id) => state.outreach[id] || {};
const validStage = (s) => STAGE_KEYS.includes(s);

// Colored email-status badge: verified & verified(manual)=green, published=blue, guessed=amber, none=grey.
const EMAIL_STATUS = {
  'verified': ['#10b981', 'Verified'],
  'verified (manual)': ['#10b981', 'Verified ✋'],
  'published': ['#3b82f6', 'Published'],
  'guessed': ['#f59e0b', 'Guessed'],
};
function emailStatusBadge(status, showNone = false) {
  const m = EMAIL_STATUS[status];
  if (!m) return showNone ? `<span class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold" style="background:#94a3b81f;color:#64748b">✉ No email</span>` : '';
  return `<span class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold" style="background:${m[0]}1f;color:${darken(m[0], 0.3)}">✉ ${m[1]}</span>`;
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
// Draft: engine draft (outreach.json) wins; else a manual template draft.
function resolvedEmail(id) {
  const e = outreachFor(id).email;
  if (e) return e;
  const m = manualContact(id);
  return (m && m.draft) ? m.draft : null;
}
const hasDraftFor = (id) => !!resolvedEmail(id);
const linkedinSearchUrl = (lead) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${lead.company} ${lead.contact_role || ''}`.trim())}`;

// Client-side Nishad-style template fill (Layer B — no LLM needed).
function draftFromTemplate(lead) {
  const industry = lead.segment || 'technical textiles';
  const application = lead.application || lead.segment || 'your products';
  const fit = lead.fabric_fit || 'coated & laminated technical fabrics';
  const subject = `Technical Textiles for ${lead.segment || application} / Kusumgar`;
  const body = `My name is Nishad Kusumgar, and I represent Kusumgar Private Limited (www.kusumgar.com), a leading technical textile manufacturer based in India, with over 50 years of expertise in producing synthetic technical textiles. Our state-of-the-art production facility includes weaving, dyeing, finishing, coating, and calendaring, enabling us to offer end-to-end solutions. Our fabrics are widely used across industries such as Military, Industrial, Outdoor, Medical, Automotive, Aeronautical, and Workwear.\n\nCoated and laminated fabrics are a core focus of our business, and we specialize in providing customized solutions for various sectors. We believe our capabilities and infrastructure align well with the requirements of the ${industry} industry, particularly for ${application}. Here are some of the solutions we can offer:\n- ${fit} tailored for ${application}\n- Custom coatings and finishes (PU, PVC, silicone, FR) engineered for durability\n- Colour-matched, made-to-spec rolls with consistent, repeatable quality\nThese fabrics can be tailored with various colour options, finishes, and coatings to meet your exact specifications.\n\nI would greatly appreciate the opportunity to arrange a conference call with you and your team in the coming weeks to discuss how Kusumgar can support your fabric requirements.\n\nThank you for your time and consideration. I look forward to your response.`;
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
function setPipeline(id, patch) {
  const next = { ...(state.pipeline[id] || {}), ...patch };
  if (patch.stage && !next.dealType) next.dealType = 'current';
  if (patch.stage && !next.mfg) next.mfg = 'own';
  const removed = ('stage' in patch) && !patch.stage;
  try {
    if (removed) localStorage.removeItem(PIPE_KEY(id));
    else localStorage.setItem(PIPE_KEY(id), JSON.stringify(next));
  } catch { /* storage unavailable — in-memory only */ }
  if (removed) delete state.pipeline[id];
  else state.pipeline[id] = next;
}
const pipelinedLeads = () => state.leads.filter((l) => validStage(state.pipeline[l.id]?.stage));

function contactBlock(lead) {
  const c = resolvedContact(lead.id);
  if (c && (c.name || c.email)) {
    const li = c.linkedin_url ? `<a href="${escapeHtml(c.linkedin_url)}" target="_blank" rel="noopener" class="text-indigo-600 hover:underline">LinkedIn ↗</a>` : '';
    const em = c.email ? `<a href="mailto:${escapeHtml(c.email)}" class="text-indigo-600 hover:underline">${escapeHtml(c.email)}</a>` : '';
    return `<div class="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Contact</div>
      <div class="mt-1 text-sm font-bold text-slate-800">${escapeHtml(c.name || '—')}</div>
      ${c.title ? `<div class="text-[12px] text-slate-500">${escapeHtml(c.title)}</div>` : ''}
      <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">${li}${em}${emailStatusBadge(c.email_status, true)}</div>
      ${c.source ? `<div class="mt-1 text-[11px] text-slate-400">via ${escapeHtml(c.source)}${c.confidence ? ` · ${escapeHtml(String(c.confidence))} confidence` : ''}</div>` : ''}
    </div>`;
  }
  return `<div class="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
    <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Contact</div>
    <div class="mt-1 text-[13px] text-slate-600">Best role to target: <span class="font-semibold text-slate-800">${escapeHtml(dash(lead.contact_role))}</span></div>
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

function renderPipeline() {
  const inPipe = pipelinedLeads();
  if (!inPipe.length) {
    return `<div class="fade-in rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
      <div class="mb-2 text-4xl">🔀</div>
      <div class="font-display text-lg font-bold text-slate-800">Your pipeline is empty</div>
      <div class="mt-1 text-sm text-slate-500">Open a lead in the Leads tab → “➕ Add to Outreach”, or use the Tracker.</div>
      <button type="button" data-goto="leads" class="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">➕ Add leads</button>
    </div>`;
  }
  const total = inPipe.length;
  const stageOf = (l) => state.pipeline[l.id].stage;
  const won = inPipe.filter((l) => stageOf(l) === 'Won').length;
  const meetings = inPipe.filter((l) => stageOf(l) === 'Meeting set').length;

  const chips = `<div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
    ${statChip('🔀', total, 'In pipeline', '#6366f1')}
    ${statChip('🗓️', meetings, 'Meetings set', '#8b5cf6')}
    ${statChip('🏆', won, 'Won', '#10b981')}
  </div>`;

  const stageItems = OUTREACH_STAGES.map((s) => ({ label: s.key, value: inPipe.filter((l) => stageOf(l) === s.key).length, color: s.color, key: 'stg:' + s.key }));
  const funnel = buildBars(stageItems, { unit: 'lead' });
  const funnelNote = `<div class="mt-3 text-[11px] font-medium text-slate-400">Leads at each stage of Nishad's outreach flow.</div>`;

  const cur = inPipe.filter((l) => (state.pipeline[l.id].dealType || 'current') === 'current').length;
  const dealItems = [
    { label: 'Current', value: cur, color: '#6366f1', key: 'dl:current' },
    { label: 'Potential', value: total - cur, color: '#94a3b8', key: 'dl:potential' },
  ].filter((i) => i.value > 0);
  const dealBar = buildStackedBar(dealItems, { unit: 'lead' });
  const dealLegend = `<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">` + dealItems.map((i) =>
    `<div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full" style="background:${i.color}"></span><span class="text-[13px] font-medium text-slate-600">${i.label}</span><span class="tnum text-[13px] font-bold text-slate-900">${i.value}</span></div>`).join('') + `</div>`;

  const grid = `<div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
    <div data-chart>${chartCard('🔀', 'Pipeline funnel', `${total} in play`, funnel + funnelNote)}</div>
    <div data-chart>${chartCard('⚖️', 'Current vs potential', 'business type', dealBar + dealLegend)}</div>
  </div>`;
  return `<div class="fade-in">${chips}${grid}</div>`;
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
    return `<table class="w-full"><tbody><tr><td class="px-4 py-10 text-center text-sm text-slate-400">No leads in the pipeline yet — use “➕ Add leads”.</td></tr></tbody></table>`;
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
    const c = resolvedContact(l.id);
    const contact = c && (c.name || c.email)
      ? `<span class="inline-flex items-center gap-1.5">${escapeHtml(c.name || c.email)}${emailStatusBadge(c.email_status, true)}</span>`
      : `<span class="text-slate-400">→ ${escapeHtml(dash(l.contact_role))}</span>`;
    const hasDraft = hasDraftFor(l.id) ? '<span class="font-bold text-emerald-600">✓</span>' : '<span class="text-slate-300">—</span>';
    return `<tr class="border-t border-slate-100 hover:bg-slate-50/60">
      <td class="whitespace-nowrap px-3 py-2.5 text-sm font-semibold text-slate-800">${escapeHtml(l.company)}</td>
      <td class="whitespace-nowrap px-3 py-2.5">${coloredChip(l.segment, leadSegColor(l.segment))}</td>
      <td class="whitespace-nowrap px-3 py-2.5">${sel(l.id, 'stage', STAGE_KEYS, pl.stage, true)}</td>
      <td class="whitespace-nowrap px-3 py-2.5">${sel(l.id, 'deal', DEAL_TYPES, pl.dealType || 'current', false)}</td>
      <td class="whitespace-nowrap px-3 py-2.5">${sel(l.id, 'mfg', MFG_TYPES, pl.mfg || 'own', false)}</td>
      <td class="whitespace-nowrap px-3 py-2.5 text-sm text-slate-600">${contact}</td>
      <td class="whitespace-nowrap px-3 py-2.5 text-center text-sm">${hasDraft}</td>
      <td class="whitespace-nowrap px-3 py-2.5"><button type="button" data-action="draft-email" data-lead-id="${escapeHtml(l.id)}" class="rounded-lg bg-slate-100 px-2 py-1 text-[12px] font-semibold text-slate-600 hover:bg-slate-200">✉️ Email</button></td>
    </tr>`;
  }).join('');
  const head = `<tr class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
    <th class="px-3 py-2.5 font-semibold">Company</th><th class="px-3 py-2.5 font-semibold">Segment</th>
    <th class="px-3 py-2.5 font-semibold">Stage</th><th class="px-3 py-2.5 font-semibold">Deal</th>
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
      <button type="button" data-export="outreach" class="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">📊 Export Excel</button>
    </div>
    <div class="mb-2 px-0.5 text-[12px] text-slate-500"><span id="oCount" class="tnum font-semibold text-slate-700">${trackerRows().length}</span> in pipeline</div>
    <div class="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"><div id="trackerTableWrap">${trackerTableHtml()}</div></div>
  </div>`;
}

function renderOutreach() {
  const subBtn = (id, label) => {
    const active = state.outreachSub === id;
    const cls = active ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700';
    return `<button type="button" data-osub="${id}" class="rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${cls}">${label}</button>`;
  };
  const toggle = `<div class="inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">${subBtn('pipeline', '🔀 Pipeline')}${subBtn('tracker', '📋 Tracker')}</div>`;
  const body = state.outreachSub === 'pipeline' ? renderPipeline() : renderTracker();
  return `<div class="mb-4">${toggle}</div>${body}`;
}

/* ------------------------------------------------------------------ *
 * Today / Home tab — surfaces existing data (no new state)
 * ------------------------------------------------------------------ */

function renderToday() {
  const leads = state.leads;
  // Hot leads: High-priority with a drafted email; fall back to High-priority.
  const drafted = leads.filter((l) => l.priority === 'High' && hasDraftFor(l.id));
  const hot = (drafted.length ? drafted : leads.filter((l) => l.priority === 'High')).slice(0, 6);
  const hotCards = hot.length ? `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">` + hot.map((l) => {
    const hasDraft = hasDraftFor(l.id);
    return `<button type="button" data-action="draft-email" data-lead-id="${escapeHtml(l.id)}" class="flex flex-col rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-100 transition hover:ring-indigo-200">
      <div class="mb-1 flex items-center justify-between gap-2">
        <h4 class="truncate font-display text-[15px] font-bold text-slate-800">${escapeHtml(l.company)}</h4>
        ${hasDraft ? '<span class="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">✉️ draft ready</span>' : '<span class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">draft</span>'}
      </div>
      <div class="mb-2 flex flex-wrap gap-1.5">${coloredChip(l.segment, leadSegColor(l.segment))}</div>
      <p class="mt-auto truncate text-[12px] text-slate-500">${escapeHtml(dash(l.application || l.fabric_fit))}</p>
    </button>`;
  }).join('') + `</div>`
    : `<div class="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">No high-priority leads yet.</div>`;

  // Coming up: next dated exhibitions.
  const upcoming = state.exhibitions.filter((d) => d.start).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 6);
  const comingList = upcoming.length ? upcoming.map((d) => {
    const col = segColor(d.segment);
    const isNew = d.source === 'discovered' ? ' <span class="rounded-full bg-fuchsia-100 px-1.5 py-0.5 text-[10px] font-bold text-fuchsia-600">✨</span>' : '';
    return `<div class="flex items-center gap-3 border-t border-slate-100 py-2.5 first:border-t-0">
      <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:${col}"></span>
      <div class="min-w-0 flex-1"><div class="truncate text-sm font-semibold text-slate-800">${escapeHtml(d.name)}${isNew}</div><div class="text-[12px] text-slate-500">${d.country ? (FLAGS[d.country] || '') + ' ' : ''}${escapeHtml(d.country)}${d.place ? ' · ' + escapeHtml(d.place) : ''}</div></div>
      <div class="shrink-0 text-right text-[12px] font-medium text-slate-500 tnum">${escapeHtml(dash(d.dates))}</div>
    </div>`;
  }).join('') : `<div class="py-6 text-center text-sm text-slate-400">No dated shows yet.</div>`;
  const comingCard = chartCard('📅', 'Coming up', `${upcoming.length} next shows`, comingList);

  // Pipeline snapshot.
  const inPipe = pipelinedLeads();
  let snap;
  if (!inPipe.length) {
    snap = chartCard('📊', 'Pipeline snapshot', 'outreach stages', `<div class="py-6 text-center"><p class="text-sm text-slate-400">No leads in the pipeline yet.</p><button type="button" data-goto="outreach" class="mt-3 rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700">Open Outreach</button></div>`);
  } else {
    const stageItems = OUTREACH_STAGES.map((s) => ({ label: s.key, value: inPipe.filter((l) => state.pipeline[l.id].stage === s.key).length, color: s.color, key: 'tsg:' + s.key })).filter((i) => i.value > 0);
    const cur = inPipe.filter((l) => (state.pipeline[l.id].dealType || 'current') === 'current').length;
    const dealItems = [
      { label: 'Current', value: cur, color: '#6366f1', key: 'tdl:current' },
      { label: 'Potential', value: inPipe.length - cur, color: '#94a3b8', key: 'tdl:potential' },
    ].filter((i) => i.value > 0);
    const dealLegend = `<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">` + dealItems.map((i) => `<div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full" style="background:${i.color}"></span><span class="text-[13px] font-medium text-slate-600">${i.label}</span><span class="tnum text-[13px] font-bold text-slate-900">${i.value}</span></div>`).join('') + `</div>`;
    snap = chartCard('📊', 'Pipeline snapshot', `${inPipe.length} in play`, buildBars(stageItems, { unit: 'lead' }) + `<div class="mt-3 border-t border-slate-100 pt-3">${buildStackedBar(dealItems, { unit: 'lead' })}${dealLegend}</div>`);
  }

  return `<div class="fade-in space-y-5">
    <section>
      <h3 class="mb-3 font-display text-sm font-bold text-slate-700">🔥 Hot leads</h3>
      ${hotCards}
    </section>
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <div data-chart>${comingCard}</div>
      <div data-chart>${snap}</div>
    </div>
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
  else if (type === 'product') { const pr = state.products.find((x) => x.id === id); state.tab = 'products'; state.productsSub = 'catalog'; state.productFilters = { search: pr ? pr.name : '', industry: 'all', family: 'all' }; render(); }
  else if (type === 'competitor') { state.tab = 'competitors'; state.competitorsSub = 'list'; render(); }
}

/* ------------------------------------------------------------------ *
 * Excel export (ExcelJS via CDN)
 * ------------------------------------------------------------------ */

function styleHeader(ws) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
  row.alignment = { vertical: 'middle' };
  row.height = 20;
}

function buildLeadsSheet(wb) {
  const ws = wb.addWorksheet('Leads');
  ws.columns = [
    { header: 'Company', key: 'company', width: 30 },
    { header: 'Segment', key: 'segment', width: 26 },
    { header: 'Country', key: 'country', width: 14 },
    { header: 'Application', key: 'application', width: 30 },
    { header: 'Fabric fit', key: 'fabric_fit', width: 26 },
    { header: 'Est. use (m²/yr)', key: 'est', width: 16 },
    { header: 'Sourcing', key: 'sourcing', width: 22 },
    { header: 'Contact role', key: 'role', width: 26 },
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Contact name', key: 'cname', width: 22 },
    { header: 'Contact email', key: 'cemail', width: 28 },
    { header: 'Email status', key: 'estatus', width: 14 },
    { header: 'Has draft', key: 'draft', width: 10 },
  ];
  sortedLeads(filteredLeads()).forEach((l) => {
    const c = resolvedContact(l.id) || {};
    ws.addRow({
      company: l.company, segment: l.segment, country: l.country || '', application: l.application || '',
      fabric_fit: l.fabric_fit || '', est: l.est_consumption || '', sourcing: l.sourcing_model || '',
      role: l.contact_role || '', priority: l.priority || '', cname: c.name || '', cemail: c.email || '',
      estatus: c.email_status || '', draft: hasDraftFor(l.id) ? 'Yes' : '',
    });
  });
  styleHeader(ws);
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function buildOutreachSheet(wb) {
  const ws = wb.addWorksheet('Outreach pipeline');
  ws.columns = [
    { header: 'Company', key: 'company', width: 30 },
    { header: 'Segment', key: 'segment', width: 26 },
    { header: 'Stage', key: 'stage', width: 18 },
    { header: 'Current/Potential', key: 'deal', width: 18 },
    { header: 'Own/Jobwork/Agency', key: 'mfg', width: 20 },
    { header: 'Contact', key: 'contact', width: 24 },
    { header: 'Has draft', key: 'draft', width: 10 },
  ];
  pipelinedLeads().forEach((l) => {
    const pl = state.pipeline[l.id];
    const c = resolvedContact(l.id) || {};
    ws.addRow({
      company: l.company, segment: l.segment, stage: pl.stage, deal: pl.dealType || 'current',
      mfg: pl.mfg || 'own', contact: c.name || c.email || l.contact_role || '', draft: hasDraftFor(l.id) ? 'Yes' : '',
    });
  });
  styleHeader(ws);
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function exportExcel(kind) {
  if (!window.ExcelJS) { console.error('ExcelJS not loaded yet'); return; }
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Kusumgar Growth Engine';
    if (kind === 'leads') buildLeadsSheet(wb);
    else if (kind === 'outreach') buildOutreachSheet(wb);
    else return;
    wb.xlsx.writeBuffer().then((buf) => {
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kusumgar-${kind}-${new Date().toISOString().slice(0, 10)}.xlsx`;
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

function render() {
  renderTabs();
  const tab = TABS.find((t) => t.id === state.tab);
  if (state.tab === 'today') view.innerHTML = renderToday();
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
  else if (state.tab === 'outreach' && state.outreachSub === 'pipeline') revealCharts();
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

    const goto = e.target.closest('[data-goto]');
    if (goto) {
      state.tab = goto.getAttribute('data-goto');
      if (state.tab === 'leads') state.leadsSub = 'list';
      render(); return;
    }

    const toggle = e.target.closest('[data-toggle]');
    if (toggle) { state.filters.relevantOnly = !state.filters.relevantOnly; render(); return; }

    const ltoggle = e.target.closest('[data-ltoggle]');
    if (ltoggle) { state.leadFilters.fullOnly = !state.leadFilters.fullOnly; render(); return; }

    const lneed = e.target.closest('[data-lneed]');
    if (lneed) { state.leadFilters.needsContact = !state.leadFilters.needsContact; render(); return; }

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

    const leadRow = e.target.closest('[data-lead-id]');
    if (leadRow) { openLeadDrawer(leadRow.getAttribute('data-lead-id')); }
  });

  // Filters (search inputs + selects)
  view.addEventListener('input', (e) => {
    if (e.target.id === 'f-search') { state.filters.search = e.target.value; refreshRows(); }
    else if (e.target.id === 'p-search') { state.productFilters.search = e.target.value; refreshCatalog(); }
    else if (e.target.id === 'l-search') { state.leadFilters.search = e.target.value; refreshLeadsTable(); }
    else if (e.target.id === 'o-search') { state.trackerFilters.search = e.target.value; refreshTrackerTable(); }
  });
  view.addEventListener('change', (e) => {
    const exMap = { 'f-seg': 'segment', 'f-country': 'country', 'f-status': 'status' };
    const pMap = { 'p-industry': 'industry', 'p-family': 'family' };
    const lMap = { 'l-seg': 'segment', 'l-country': 'country', 'l-priority': 'priority' };
    if (exMap[e.target.id]) { state.filters[exMap[e.target.id]] = e.target.value; refreshRows(); }
    else if (pMap[e.target.id]) { state.productFilters[pMap[e.target.id]] = e.target.value; refreshCatalog(); }
    else if (lMap[e.target.id]) { state.leadFilters[lMap[e.target.id]] = e.target.value; refreshLeadsTable(); }
    else if (e.target.id === 'o-stage') { state.trackerFilters.stage = e.target.value; refreshTrackerTable(); }
    else {
      // Tracker inline pipeline selects
      const stageId = e.target.getAttribute('data-pl-stage');
      const dealId = e.target.getAttribute('data-pl-deal');
      const mfgId = e.target.getAttribute('data-pl-mfg');
      if (stageId) { setPipeline(stageId, { stage: e.target.value }); refreshTrackerTable(); }
      else if (dealId) { setPipeline(dealId, { dealType: e.target.value }); refreshTrackerTable(); }
      else if (mfgId) { setPipeline(mfgId, { mfg: e.target.value }); refreshTrackerTable(); }
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

  // Outreach/email modal (stable element outside #view).
  const modal = $('#modal');
  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-modal-close]') || e.target.hasAttribute('data-modal-backdrop')) { closeModal(); return; }
    const copy = e.target.closest('[data-copy]');
    if (copy) copyEmail(copy);
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
    const [meta, exhibitions, products, leads, competitors, outreach] = await Promise.all([
      fetch('data/meta.json').then((r) => r.json()),
      fetch('data/exhibitions.json').then((r) => r.json()),
      fetch('data/products.json').then((r) => r.json()).catch(() => []),
      fetch('data/leads.json').then((r) => r.json()).catch(() => []),
      fetch('data/competitors.json').then((r) => r.json()).catch(() => []),
      fetch('data/outreach.json').then((r) => r.json()).catch(() => ({})),
    ]);
    state.meta = meta;
    // Tolerate both the seed array and a pipeline { <items>, _meta, _debug } shape.
    const unwrap = (raw, key) => (Array.isArray(raw) ? raw : (raw && raw[key]) || []);
    state.exhibitions = unwrap(exhibitions, 'exhibitions').filter((d) => d && d.id && d.name);
    state.products = unwrap(products, 'products').filter((p) => p && p.id && p.name);
    state.leads = unwrap(leads, 'leads').filter((l) => l && l.id && l.company);
    state.competitors = unwrap(competitors, 'competitors').filter((c) => c && c.id && c.company);
    state.outreach = (outreach && typeof outreach === 'object' && !Array.isArray(outreach)) ? outreach : {};
    loadRelevance(state.exhibitions.map((d) => d.id));
    loadPipeline(state.leads.map((l) => l.id));

    const updated = meta.updated_at
      ? new Date(meta.updated_at + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
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
