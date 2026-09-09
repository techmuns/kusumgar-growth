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
  { id: 'exhibitions', label: 'Exhibitions', icon: '🎪', live: true },
  { id: 'products', label: 'Products', icon: '🧵', live: true },
  { id: 'leads', label: 'Leads', icon: '🎯', live: false },
  { id: 'competitors', label: 'Competitors', icon: '🛡️', live: false },
  { id: 'outreach', label: 'Outreach', icon: '📮', live: false },
];

const FLAGS = {
  'France': '🇫🇷', 'Spain': '🇪🇸', 'USA': '🇺🇸', 'Japan': '🇯🇵', 'India': '🇮🇳',
  'Germany': '🇩🇪', 'Canada': '🇨🇦', 'Qatar': '🇶🇦', 'Malaysia': '🇲🇾', 'UK': '🇬🇧',
  'South Korea': '🇰🇷', 'Israel': '🇮🇱', 'Poland': '🇵🇱', 'Egypt': '🇪🇬', 'Chile': '🇨🇱',
  'Czechia': '🇨🇿', 'UAE': '🇦🇪', 'Australia': '🇦🇺', 'Indonesia': '🇮🇩', 'Brazil': '🇧🇷',
  'Singapore': '🇸🇬', 'Saudi Arabia': '🇸🇦',
};

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */

const state = {
  tab: 'exhibitions',
  sub: 'overview',        // 'overview' | 'list'
  meta: null,
  exhibitions: [],
  products: [],
  relevance: {},          // id -> 'yes' | 'no'   (undecided = absent)
  filters: { search: '', segment: 'all', country: 'all', status: 'all', relevantOnly: false },
  productsSub: 'catalog', // 'catalog' | 'coverage'
  productFilters: { search: '', industry: 'all', family: 'all' },
};

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
function buildDonut(items, { centerNum, centerLabel }) {
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
        data-tip-sub="${plural(i.value, 'show')} • ${pct}%"></circle>`;
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
function buildLegend(items, { total } = {}) {
  return `<ul class="flex-1 space-y-1.5 min-w-0">` + items.map((i) => {
    const pct = total ? Math.round((i.value / total) * 100) : null;
    return `<li class="hovable flex items-center gap-2 rounded-lg px-1.5 py-0.5" data-key="${escapeHtml(i.key)}"
        data-tip-title="${escapeHtml(i.label)}" data-tip-color="${i.color}"
        data-tip-sub="${plural(i.value, 'show')}${pct != null ? ` • ${pct}%` : ''}">
      <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:${i.color}"></span>
      <span class="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-600">${escapeHtml(i.label)}</span>
      <span class="tnum text-[13px] font-bold text-slate-900">${i.value}</span>
    </li>`;
  }).join('') + `</ul>`;
}

// Horizontal bars — items: [{label, value, color, key, flag}]
function buildBars(items) {
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
        data-tip-sub="${plural(i.value, 'show')}">
      <rect x="0" y="${y}" width="${W}" height="${rowH}" fill="transparent"></rect>
      <text x="${x0 - 8}" y="${cy}" text-anchor="end" dominant-baseline="central"
        style="font-size:11.5px;font-weight:600;fill:#475569;">${escapeHtml(flag + i.label)}</text>
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
function buildStackedBar(items) {
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
        data-tip-sub="${plural(i.value, 'show')} • ${pct}%"></rect>`;
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
    .map(([seg, v]) => ({ label: seg, value: v, color: segColor(seg), key: 'seg:' + seg }));
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
      ${statChip('🧩', segments, 'Segments', '#0ea5e9')}
      ${statChip('✅', engaged, 'Already engaged', '#10b981')}
      ${statChip('🗓️', upcoming, 'Upcoming (dated)', '#ec4899')}
    </div>`;

  // Independent column stacks: no coupled-row gaps, balanced heights, and on
  // mobile they collapse to one column in this order (donut leads).
  const donutCard = `<div data-chart>${chartCard('🧩', 'Shows by segment', 'share of portfolio', donutSeg)}</div>`;
  const timelineCard = `<div data-chart>${chartCard('🗓️', 'Upcoming in 2026', plural(upcomingShows.length, 'dated show'), buildTimeline(upcomingShows) + tlLegend)}</div>`;
  const countriesCard = `<div data-chart>${chartCard('🌍', 'Top countries', 'by number of shows', buildBars(barItems) + barsLegend)}</div>`;
  const engagementCard = `<div data-chart>${chartCard('📈', 'Engagement status', `${engaged} of ${statusTotal} engaged`, buildStackedBar(statusItems) + statusLegend)}</div>`;

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
      <td class="whitespace-nowrap px-3 py-2.5">${coloredChip(d.segment, segColor(d.segment))}</td>
      <td class="px-3 py-2.5 text-sm font-semibold text-slate-800">${escapeHtml(d.name)}</td>
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
      </div>

      <div class="mb-2 flex items-center justify-between px-0.5 text-[12px] text-slate-500">
        <span><span id="rowCount" class="tnum font-semibold text-slate-700">${filteredRows().length}</span> shown</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span><span id="relCount" class="tnum font-semibold text-emerald-600">${relCount()}</span> marked relevant</span>
      </div>

      <div class="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
        <table class="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <th class="px-3 py-2.5 font-semibold">Triage</th>
              <th class="px-3 py-2.5 font-semibold">Segment</th>
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

function productCard(p) {
  const coatings = (p.coatings || []).map((c) =>
    `<span class="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">${escapeHtml(c)}</span>`).join('');
  const props = (p.properties || []).slice(0, 4).map((pr) =>
    `<span class="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-100">
       <span aria-hidden="true">${iconForProperty(pr)}</span>${escapeHtml(pr)}</span>`).join('');
  const segs = (p.segments || []).map((s) => coloredChip(s, segColor(s))).join(' ');
  const deniers = p.deniers && p.deniers !== '—' ? ` · ${escapeHtml(p.deniers)}` : '';
  const apps = (p.applications || []).join(', ');
  const srcBadge = p.source && p.source !== 'seed'
    ? `<span class="ml-1 rounded bg-indigo-50 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-indigo-500" title="Found on ${escapeHtml(p.source)}">↗</span>` : '';
  return `
    <article class="fade-in flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div class="mb-2">
        <h4 class="font-display text-[15px] font-bold leading-tight text-slate-800">${escapeHtml(p.name)}${srcBadge}</h4>
        <p class="mt-0.5 text-[12px] text-slate-500">${escapeHtml(p.base || '')}${deniers}</p>
      </div>
      ${coatings ? `<div class="mb-2 flex flex-wrap gap-1">${coatings}</div>` : ''}
      ${props ? `<div class="mb-3 flex flex-wrap gap-1.5">${props}</div>` : ''}
      <div class="mt-auto">
        <div class="mb-2 flex flex-wrap gap-1.5">${segs}</div>
        ${apps ? `<p class="truncate text-[11px] text-slate-400" title="${escapeHtml(apps)}">🧭 ${escapeHtml(apps)}</p>` : ''}
      </div>
    </article>`;
}

function renderCatalogGrid() {
  const list = filteredProducts();
  if (!list.length) {
    return `<div class="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">No products match these filters.</div>`;
  }
  return familiesPresent(list).map((fam) => {
    const items = list.filter((p) => p.family === fam);
    return `
      <section class="mb-6 last:mb-0">
        <div class="mb-3 flex items-center gap-2">
          <h3 class="font-display text-sm font-bold text-slate-700">${FAMILY_ICONS[fam] || '🧵'} ${escapeHtml(fam)}</h3>
          <span class="tnum text-[11px] font-semibold text-slate-400">${items.length}</span>
          <span class="h-px flex-1 bg-slate-100"></span>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">${items.map(productCard).join('')}</div>
      </section>`;
  }).join('');
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
      <span class="text-[12px] font-medium text-slate-600">${escapeHtml(seg)}</span></div>`).join('') + `</div>`;

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
        <span aria-hidden="true">🔍</span><span class="font-semibold text-amber-700">Whitespace:</span>
        <span class="font-medium text-amber-700">${escapeHtml(wsShort)}</span>
        <span class="hidden text-[12px] text-amber-600 sm:inline">— products but no shows yet</span>
      </span>` : ''}
    </div>`;

  return `<div class="fade-in">${chartCard('🧭', 'Where it sells', 'dot = # products serving that industry', matrix + legend)}${insight}</div>`;
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
  if (state.tab === 'exhibitions') view.innerHTML = renderExhibitions();
  else if (state.tab === 'products') view.innerHTML = renderProducts();
  else view.innerHTML = renderPlaceholder(tab);

  // Views with SVG/dot entrance animations.
  if (state.tab === 'exhibitions' && state.sub === 'overview') revealCharts();
  else if (state.tab === 'products' && state.productsSub === 'coverage') revealCharts();
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

    const toggle = e.target.closest('[data-toggle]');
    if (toggle) { state.filters.relevantOnly = !state.filters.relevantOnly; render(); return; }

    const rel = e.target.closest('[data-rel]');
    if (rel) {
      const id = rel.closest('[data-rel-group]').getAttribute('data-rel-group');
      setRelevance(id, rel.getAttribute('data-rel'));
      refreshRows();
    }
  });

  // Filters (search inputs + selects)
  view.addEventListener('input', (e) => {
    if (e.target.id === 'f-search') { state.filters.search = e.target.value; refreshRows(); }
    else if (e.target.id === 'p-search') { state.productFilters.search = e.target.value; refreshCatalog(); }
  });
  view.addEventListener('change', (e) => {
    const exMap = { 'f-seg': 'segment', 'f-country': 'country', 'f-status': 'status' };
    const pMap = { 'p-industry': 'industry', 'p-family': 'family' };
    if (exMap[e.target.id]) { state.filters[exMap[e.target.id]] = e.target.value; refreshRows(); }
    else if (pMap[e.target.id]) { state.productFilters[pMap[e.target.id]] = e.target.value; refreshCatalog(); }
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
    const [meta, exhibitions, products] = await Promise.all([
      fetch('data/meta.json').then((r) => r.json()),
      fetch('data/exhibitions.json').then((r) => r.json()),
      fetch('data/products.json').then((r) => r.json()).catch(() => []),
    ]);
    state.meta = meta;
    state.exhibitions = exhibitions;
    // Tolerate both the seed array and the scraper's { products, _meta, _debug } shape.
    const rawProducts = Array.isArray(products) ? products : (products.products || []);
    state.products = rawProducts.filter((p) => p && p.id && p.name);
    loadRelevance(exhibitions.map((d) => d.id));

    const updated = meta.updated_at
      ? new Date(meta.updated_at + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
      : '—';
    const ut = $('#updatedText'); if (ut) ut.textContent = `Updated ${updated}`;
  } catch (err) {
    console.error('Failed to load data', err);
    view.innerHTML = `<div class="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-100">Couldn’t load exhibition data. Please refresh.</div>`;
    renderTabs();
    return;
  }
  render();
}

boot();
