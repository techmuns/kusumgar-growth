// Email greeting helpers — the greeting is ALWAYS derived from the CURRENT contact, never baked
// stale into the stored body. Pure + dependency-free (Node 22 / browser), so it is unit-testable and
// has zero LLM/API cost. Used by scripts/draft-emails.mjs (new drafts + a migration over existing
// data). Draft-mode only — this never touches sending, subjects or sign-off.

// Role / generic / company tokens that are never a person's given/family name. If any whole token of
// the candidate name matches one of these, the name is rejected (→ "Dear Sir/Madam,"). Kept to
// unambiguous words so real surnames aren't dropped.
const NON_NAME_TOKENS = new Set([
  // roles / titles
  'manager', 'director', 'officer', 'buyer', 'purchasing', 'procurement', 'sourcing', 'sales',
  'marketing', 'operations', 'engineer', 'engineering', 'executive', 'vp', 'president', 'ceo', 'cto',
  'coo', 'cfo', 'cmo', 'founder', 'sir', 'madam', 'mr', 'mrs', 'ms', 'dr', 'prof',
  // generic inboxes / functions
  'team', 'department', 'dept', 'contact', 'info', 'enquiries', 'enquiry', 'support', 'admin', 'hr',
  // company suffixes / words
  'inc', 'ltd', 'llc', 'gmbh', 'corp', 'co', 'pvt', 'limited', 'company', 'group', 'industries',
  'international', 'technologies', 'solutions', 'systems', 'enterprises', 'holdings',
  'sa', 'ag', 'bv', 'srl', 'spa', 'plc', 'pte',
]);

// Trailing credential / honorific tokens to drop ("Robert Waite MBA" → "Robert Waite").
const CREDENTIALS = new Set(['mba', 'phd', 'msc', 'bsc', 'pmp', 'cpm', 'cfa', 'cpa', 'esq', 'dds', 'mph', 'ceng', 'peng', 'jr', 'sr', 'ii', 'iii', 'iv']);

const normTok = (t) => t.toLowerCase().replace(/[^a-z]/g, '');
// Tidy the case of a single token WITHOUT wrecking intentional casing: an all-lower or all-upper
// token is title-cased (respecting ' and -), while an already mixed-case token (McDonald, DeVries,
// O'Brien) is left untouched.
function fixCase(tok) {
  if (/[a-z]/.test(tok) && /[A-Z]/.test(tok)) return tok;
  return tok.toLowerCase().replace(/(^|['\-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

// Return a safe, tidy human name to greet, or '' when the contact has no usable personal name.
// Rejects: missing, < 2 letters, a lone initial, anything with a digit, or a role/company token.
// Also drops a comma-suffix / trailing credentials and normalises case so the greeting is presentable
// regardless of how the contact was stored ("laurie fischer" → "Laurie Fischer").
export function cleanGreetingName(contact) {
  let name = (contact && typeof contact.name === 'string') ? contact.name : '';
  name = name.replace(/^["'\s]+|["'\s]+$/g, '').trim();
  name = name.split(',')[0].trim();                               // drop ", C.P.M." / ", MBA" suffixes
  if (!name) return '';
  if (/\d/.test(name)) return '';                                  // contains digits → garbage
  if ((name.match(/[A-Za-z]/g) || []).length < 2) return '';       // fewer than 2 letters
  let tokens = name.split(/\s+/).filter(Boolean);
  while (tokens.length > 1 && CREDENTIALS.has(normTok(tokens[tokens.length - 1]))) tokens.pop();
  // a lone initial: single token that is just one letter (optionally with a dot/hyphen)
  if (tokens.length === 1 && normTok(tokens[0]).length < 2) return '';
  // any role/company token anywhere → not a person
  if (tokens.some((t) => NON_NAME_TOKENS.has(normTok(t)))) return '';
  // must carry at least one real name part (≥2 letters)
  if (!tokens.some((t) => normTok(t).length >= 2)) return '';
  return tokens.map(fixCase).join(' ');
}

// Recompute the greeting from the current contact: strip any existing leading salutation line, then
// prepend the correct one. Idempotent — running it again yields the same result.
export function applyGreeting(body, contact) {
  // Strip a leading salutation line. (Spec regex, with (?:\r?\n)+ so a CRLF blank line is fully eaten.)
  const text = String(body == null ? '' : body)
    .replace(/^\s*(?:dear|hi|hello|greetings)\b[^\n]*(?:\r?\n)+/i, '');
  const name = cleanGreetingName(contact);
  const greeting = name ? `Dear ${name},` : 'Dear Sir/Madam,';
  return `${greeting}\n\n${text}`;
}
