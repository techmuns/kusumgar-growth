// Unit tests for the greeting helper. Pure, no network. Run: node scripts/lib/greeting.test.mjs
import { cleanGreetingName, applyGreeting } from './greeting.mjs';

let fails = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  <<< ' + extra}`); if (!cond) fails++; };
const eq = (name, got, want) => ok(name, got === want, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

/* ---- cleanGreetingName: accept clear personal names ---- */
eq('accepts "Jonathan Low"', cleanGreetingName({ name: 'Jonathan Low' }), 'Jonathan Low');
eq('accepts "Debasish Dash"', cleanGreetingName({ name: 'Debasish Dash' }), 'Debasish Dash');
eq('accepts single first name', cleanGreetingName({ name: 'Debasish' }), 'Debasish');
eq('trims trailing comma/space', cleanGreetingName({ name: '  Rahul Bendale , ' }), 'Rahul Bendale');
// normalisation: tidy case + drop credential suffixes, but keep intentional casing
eq('title-cases lowercase "laurie fischer"', cleanGreetingName({ name: 'laurie fischer' }), 'Laurie Fischer');
eq('title-cases ALL CAPS', cleanGreetingName({ name: 'JOHN SMITH' }), 'John Smith');
eq('drops ", C.P.M." suffix', cleanGreetingName({ name: 'David McCandless, C.P.M.' }), 'David McCandless');
eq('drops ", MBA" suffix', cleanGreetingName({ name: 'Robert Waite, MBA' }), 'Robert Waite');
eq('drops trailing "MBA" (no comma)', cleanGreetingName({ name: 'Robert Waite MBA' }), 'Robert Waite');
eq('preserves McDonald casing', cleanGreetingName({ name: 'Ronald McDonald' }), 'Ronald McDonald');
eq('fixes apostrophe name', cleanGreetingName({ name: "benjamin o'connor" }), "Benjamin O'Connor");

/* ---- cleanGreetingName: reject non-names → '' (→ Sir/Madam) ---- */
eq('rejects missing', cleanGreetingName({}), '');
eq('rejects null contact', cleanGreetingName(null), '');
eq('rejects empty string', cleanGreetingName({ name: '   ' }), '');
eq('rejects lone initial "J"', cleanGreetingName({ name: 'J' }), '');
eq('rejects lone initial "J."', cleanGreetingName({ name: 'J.' }), '');
eq('rejects two bare initials "A B"', cleanGreetingName({ name: 'A B' }), '');
eq('rejects digits', cleanGreetingName({ name: 'John3 Doe' }), '');
eq('rejects role "Purchasing Manager"', cleanGreetingName({ name: 'Purchasing Manager' }), '');
eq('rejects role "Procurement"', cleanGreetingName({ name: 'Procurement' }), '');
eq('rejects generic "Team"', cleanGreetingName({ name: 'Team' }), '');
eq('rejects generic "info"', cleanGreetingName({ name: 'info' }), '');
eq('rejects company "Adient Inc"', cleanGreetingName({ name: 'Adient Inc' }), '');
eq('rejects company "Grammer GmbH"', cleanGreetingName({ name: 'Grammer GmbH' }), '');

/* ---- applyGreeting: real name prepended ---- */
eq('real name → Dear <name>', applyGreeting('Let me introduce Kusumgar.', { name: 'Jonathan Low' }),
  'Dear Jonathan Low,\n\nLet me introduce Kusumgar.');
eq('no contact → Dear Sir/Madam', applyGreeting('Let me introduce Kusumgar.', null),
  'Dear Sir/Madam,\n\nLet me introduce Kusumgar.');
eq('role contact → Dear Sir/Madam', applyGreeting('Body here.', { name: 'Purchasing Manager' }),
  'Dear Sir/Madam,\n\nBody here.');

/* ---- applyGreeting: stale/garbled greeting is REPLACED by the current contact ---- */
eq('klein-tools: "Dear Cord G." → current "Jonathan Low"',
  applyGreeting('Dear Cord G.,\n\nLet me introduce Kusumgar.', { name: 'Jonathan Low' }),
  'Dear Jonathan Low,\n\nLet me introduce Kusumgar.');
eq('grammer-ag: "Dear Brett Gilman," → current "Rahul Bendale"',
  applyGreeting('Dear Brett Gilman,\n\nLet me introduce Kusumgar.', { name: 'Rahul Bendale' }),
  'Dear Rahul Bendale,\n\nLet me introduce Kusumgar.');
eq('garbled "Dear Hummy Truh," + no contact → Sir/Madam',
  applyGreeting('Dear Hummy Truh,\n\nLet me introduce Kusumgar.', {}),
  'Dear Sir/Madam,\n\nLet me introduce Kusumgar.');

/* ---- applyGreeting: strips Hi/Hello/Greetings + CRLF; idempotent ---- */
eq('strips "Hi X" salutation', applyGreeting('Hi Bob,\n\nBody.', { name: 'Jonathan Low' }),
  'Dear Jonathan Low,\n\nBody.');
eq('strips CRLF salutation', applyGreeting('Dear Old Name,\r\n\r\nBody.', { name: 'Rahul Bendale' }),
  'Dear Rahul Bendale,\n\nBody.');
const once = applyGreeting('Dear Whoever,\n\nBody.', { name: 'Jonathan Low' });
eq('idempotent (apply twice == once)', applyGreeting(once, { name: 'Jonathan Low' }), once);

console.log(`\n${fails === 0 ? '✅ ALL GREETING TESTS PASS' : '❌ ' + fails + ' FAIL(S)'}`);
process.exit(fails ? 1 : 0);
