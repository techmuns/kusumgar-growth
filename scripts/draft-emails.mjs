// Draft a personalised cold email per lead in Nishad's exact voice, via Bedrock Claude.
//
// - Prioritises High-priority + fully-profiled leads; skips leads already drafted.
// - Caps per run via MAX (default 25).
// - Writes { subject, body, drafted_at, model } into outreach.json[leadId].email (MERGES —
//   never overwrites other ids or the .contact field).
// - Graceful: no BEDROCK key → logs and exits 0, writes nothing. Never hard-fails.
//
// Test hooks: KGR_OUTREACH_PATH / KGR_LEADS_PATH.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { askClaude, haveBedrock } from './lib/llm.mjs';
import { applyGreeting } from './lib/greeting.mjs';

const p = (env, rel) => process.env[env] || fileURLToPath(new URL(rel, import.meta.url));
const LEADS_PATH = p('KGR_LEADS_PATH', '../public/data/leads.json');
const OUTREACH_PATH = p('KGR_OUTREACH_PATH', '../public/data/outreach.json');

const MAX = Math.max(1, parseInt(process.env.MAX || '25', 10) || 25);
const PRIORITY_ONLY = /^(1|true|yes)$/i.test(process.env.PRIORITY_ONLY || '');
// Bump when the email voice/template changes — drafts below this version get re-written.
const VOICE = 2;
const SENDER = process.env.SENDER_NAME || 'Nishad Ansari';
const SENDER_TITLE = process.env.SENDER_TITLE || 'DGM – Sales & Marketing';
const MODEL_LABEL = (process.env.BEDROCK_MODEL_IDS || '').split(',')[0].trim() || 'bedrock-converse';

// Voice + structure are lifted from Nishad's REAL cold emails; the bullets may use ONLY the
// capabilities in the brief below (never invented specs, prices, or certifications).
const SYSTEM = `You are ${SENDER} (${SENDER_TITLE}) writing a B2B COLD email for Kusumgar Limited, a 50-year Indian technical-textile manufacturer. Voice: warm, respectful, concise, professional; short paragraphs; always close by inviting a next step (a brief call, or sending samples). NEVER invent specifications, prices, certifications, or claims — use ONLY the capabilities brief below.

KUSUMGAR CAPABILITIES BRIEF (all real — build the bullets only from here):
- Vertically integrated: weaving, dyeing, finishing, coating, lamination, calendaring, cut-and-sew.
- Fibres: Nylon 6, Nylon 66, Polyester, Aramids (meta & para), Polypropylene; 20D–3000D multifilament woven fabrics.
- Finishes/coatings: PU, PVC, silicone; FR (fire-retardant), water-repellent (DWR), antimicrobial; PFAS-free options; custom surface treatments for rubber adhesion.
- Sectors: Military, Industrial, Automotive, Aeronautical/Aerospace, Medical, Outdoor lifestyle, Workwear.
- Proof points (use AT MOST one, and ONLY if it truly fits the lead's industry): meta/para-aramid reinforcement fabrics for railway mobility gangways (HL2/HL3), approved with major global railway players; ripstop nylon for parachute/paragliding; reinforcement fabrics for rubber diaphragms, bellows, hoses and beltings; coated-laminated FR + antimicrobial fabrics for institutional/medical mattresses.

Write EXACTLY this structure — only the <bracketed> parts change per lead:

Subject: Technical Textiles for <their industry/product> / Kusumgar

Body (NO greeting line — start directly at "Let me take this opportunity"):
Let me take this opportunity to briefly introduce Kusumgar Limited (www.kusumgar.com), one of India's leading manufacturers of high-performance technical textiles, with over 50 years of expertise. We operate a fully vertically integrated setup — weaving, dyeing, finishing, coating, lamination and cut-and-sew — producing synthetic multifilament fabrics in Nylon, Polyester and Aramids from 20D to 3000D, with in-house finishes and performance coatings.

We believe our capabilities align well with the <their industry> industry. Some of the solutions we can offer:
- <real, industry-fit solution 1 from the brief>
- <real solution 2>
- <real solution 3>
These fabrics can be tailored with various colour, finish and coating options to meet your exact specifications.

We would be keen to support your fabric sourcing requirements, and I would welcome the opportunity to arrange a brief call — or share samples for your evaluation.

Look forward to hearing from you.

Best Regards,
${SENDER}
${SENDER_TITLE}
Kusumgar Limited | www.kusumgar.com

Rules: Do NOT write ANY salutation or greeting line — no "Dear …", "Hi", "Hello", "Greetings". Begin the body directly with "Let me take this opportunity to briefly introduce Kusumgar Limited". The greeting is added separately from the contact record. The three bullets MUST be real capabilities from the brief tailored to the lead's industry — never invented. Return STRICT JSON only: {"subject":"...","body":"..."} — no markdown, no commentary.`;

async function loadOutreach() {
  try { const o = JSON.parse(await readFile(OUTREACH_PATH, 'utf8')); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {}; }
  catch { return {}; }
}
async function loadLeads() {
  try { const raw = JSON.parse(await readFile(LEADS_PATH, 'utf8')); return Array.isArray(raw) ? raw : (raw.leads || []); }
  catch (e) { console.error(`[draft-emails] cannot read leads: ${e.message}`); return []; }
}

const rank = (l) => (l.priority === 'High' ? 0 : 2) + (l.detail === 'full' ? 0 : 1);

async function main() {
  const leads = await loadLeads();
  const outreach = await loadOutreach();

  // 1) GREETING MIGRATION (pure string — no LLM, no network): re-derive every stored greeting from
  //    the CURRENT contact, so any stale/garbled baked-in name is discarded. Runs on every invocation
  //    and even without a Bedrock key, so the data self-heals the moment a contact is updated.
  let migrated = 0;
  for (const id of Object.keys(outreach)) {
    const e = outreach[id] && outreach[id].email;
    if (!e || typeof e.body !== 'string') continue;
    const fixed = applyGreeting(e.body, outreach[id].contact);
    if (fixed !== e.body) { e.body = fixed; migrated++; }
  }

  // 2) DRAFTING (needs Bedrock). Graceful without it — the migration above still applies.
  let drafted = 0;
  if (!haveBedrock()) {
    console.log('[draft-emails] BEDROCK_API_KEY not set — skipping new drafts (greeting migration still applied).');
  } else {
    // Draft leads with no email yet, and re-draft any whose email is from an older voice version.
    let queue = leads.filter((l) => outreach[l.id]?.email?.voice !== VOICE);
    if (PRIORITY_ONLY) queue = queue.filter((l) => l.priority === 'High');
    queue.sort((a, b) => rank(a) - rank(b) || a.company.localeCompare(b.company));
    queue = queue.slice(0, MAX);
    console.log(`[draft-emails] drafting ${queue.length} of ${leads.length} lead(s)`);
    for (const l of queue) {
      const user = `Lead company: ${l.company}
Their industry / segment: ${l.segment || 'technical textiles'}
Country: ${l.country || 'n/a'}
Their application (if known): ${l.application || 'unknown'}

Write the cold email now.`;
      const res = await askClaude({ system: SYSTEM, user, json: true, maxTokens: 1200 });
      if (res && res.subject && res.body) {
        // The greeting is applied here from the contact record — never written by the LLM.
        const contact = outreach[l.id]?.contact;
        outreach[l.id] = { ...(outreach[l.id] || {}), email: { subject: String(res.subject), body: applyGreeting(String(res.body), contact), drafted_at: new Date().toISOString(), model: MODEL_LABEL, voice: VOICE } };
        drafted++;
      } else {
        console.error(`[draft-emails] no draft returned for ${l.id}`);
      }
    }
  }

  if (!migrated && !drafted) { console.log('[draft-emails] nothing changed; outreach.json unchanged.'); return; }
  await writeFile(OUTREACH_PATH, JSON.stringify(outreach, null, 2) + '\n');
  console.log(`[draft-emails] migrated ${migrated} greeting(s), drafted ${drafted} email(s).`);
}

main()
  .catch((err) => { console.error('[draft-emails] unexpected error (exiting 0):', err); })
  .finally(() => process.exit(0));
