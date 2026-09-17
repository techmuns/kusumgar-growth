// Shared, source-backed date/place normalization for exhibitions — used by BOTH the discovery
// engine (captures details from the directory listing) and the date-finder (backfills by search).
// Never guesses: a date is kept only when it validates as a real calendar date that is today-or-later.

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export const parseISO = (s) => (ISO_RE.test(String(s || '')) ? new Date(String(s) + 'T00:00:00Z') : null);
const valid = (d) => d instanceof Date && !isNaN(d.getTime());

// Normalize a candidate URL to a clean absolute http(s) link, or null. Never invents a link.
export function cleanUrl(u) {
  const s = String(u || '').trim();
  if (!/^https?:\/\/[^\s]+\.[^\s]{2,}/i.test(s)) return null;
  try { return new URL(s).toString().replace(/\/+$/, ''); } catch { return null; }
}

// Human display range in the "D–D Mon YYYY" family the dashboard parses.
export function displayDates(startISO, endISO) {
  const s = parseISO(startISO); if (!valid(s)) return null;
  const e = parseISO(endISO);
  const sd = s.getUTCDate(), sm = s.getUTCMonth(), sy = s.getUTCFullYear();
  if (!valid(e) || endISO === startISO) return `${sd} ${MONTHS[sm]} ${sy}`;
  const ed = e.getUTCDate(), em = e.getUTCMonth(), ey = e.getUTCFullYear();
  if (sy === ey && sm === em) return `${sd}–${ed} ${MONTHS[sm]} ${sy}`;
  if (sy === ey) return `${sd} ${MONTHS[sm]}–${ed} ${MONTHS[em]} ${sy}`;
  return `${sd} ${MONTHS[sm]} ${sy}–${ed} ${MONTHS[em]} ${ey}`;
}

// Validate a candidate edition extracted for a show. Returns {start,end,dates,place} where each field
// may be null: a valid today-or-later date fills start/end/dates; a place is kept independently (so a
// show with a known city but no confident date still gets its city). `text`, when given, is the real
// source text the candidate came from — the date's year MUST appear in it (anti-hallucination guard).
export function normalizeEdition({ start, end, city } = {}, todayISO, text) {
  const out = { start: null, end: null, dates: null, place: null };
  const c = (typeof city === 'string' && city.trim() && city.trim().length <= 60) ? city.trim() : null;
  out.place = c;

  const s = parseISO(start);
  if (!valid(s)) return out;                                   // no valid date → place only
  const today = parseISO(todayISO);
  if (valid(today) && (today - s) / 86400000 > 3) return out;  // past edition → drop date, keep place
  if (typeof text === 'string' && !text.includes(String(start).slice(0, 4))) return out; // year not in source

  let endISO = null;
  const e = parseISO(end);
  if (valid(e) && e >= s && (e - s) / 86400000 <= 21) endISO = end; // sane span (<= 3 weeks)
  out.start = start; out.end = endISO; out.dates = displayDates(start, endISO);
  return out;
}
