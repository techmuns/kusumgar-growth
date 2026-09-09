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

const p = (env, rel) => process.env[env] || fileURLToPath(new URL(rel, import.meta.url));
const LEADS_PATH = p('KGR_LEADS_PATH', '../public/data/leads.json');
const OUTREACH_PATH = p('KGR_OUTREACH_PATH', '../public/data/outreach.json');

const MAX = Math.max(1, parseInt(process.env.MAX || '25', 10) || 25);
const PRIORITY_ONLY = /^(1|true|yes)$/i.test(process.env.PRIORITY_ONLY || '');
const SENDER = process.env.SENDER_NAME || 'Nishad Kusumgar';
const MODEL_LABEL = (process.env.BEDROCK_MODEL_IDS || '').split(',')[0].trim() || 'bedrock-converse';

const SYSTEM = `You are ${SENDER}, writing B2B cold emails for Kusumgar Private Limited, a 50-year Indian technical-textile manufacturer (weaving, dyeing, finishing, coating, calendaring).

Write the email in EXACTLY this structure and warm, concise, professional voice — only the <bracketed> parts change per lead:

Subject: "Technical Textiles for <their product/industry> / Kusumgar"

Body:
"My name is ${SENDER}, and I represent Kusumgar Private Limited (www.kusumgar.com), a leading technical textile manufacturer based in India, with over 50 years of expertise in producing synthetic technical textiles. Our state-of-the-art production facility includes weaving, dyeing, finishing, coating, and calendaring, enabling us to offer end-to-end solutions. Our fabrics are widely used across industries such as Military, Industrial, Outdoor, Medical, Automotive, Aeronautical, and Workwear.

Coated and laminated fabrics are a core focus of our business, and we specialize in providing customized solutions for various sectors. We believe our capabilities and infrastructure align well with the requirements of the <their industry> industry, particularly for <their application>. Here are some of the solutions we can offer:
- <solution 1 tailored to their product, built around the lead's fabric_fit>
- <solution 2>
- <solution 3>
These fabrics can be tailored with various colour options, finishes, and coatings to meet your exact specifications.

I would greatly appreciate the opportunity to arrange a conference call with you and your team in the coming weeks to discuss how Kusumgar can support your fabric requirements.

Thank you for your time and consideration. I look forward to your response."

Return STRICT JSON only: {"subject": "...", "body": "..."} — no markdown, no commentary. The body must keep the exact paragraph structure above with three tailored bullet lines.`;

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
  if (!haveBedrock()) { console.log('[draft-emails] BEDROCK_API_KEY not set — writing nothing. Exiting 0.'); return; }

  const leads = await loadLeads();
  const outreach = await loadOutreach();

  let queue = leads.filter((l) => !outreach[l.id]?.email);
  if (PRIORITY_ONLY) queue = queue.filter((l) => l.priority === 'High');
  queue.sort((a, b) => rank(a) - rank(b) || a.company.localeCompare(b.company));
  queue = queue.slice(0, MAX);
  console.log(`[draft-emails] drafting ${queue.length} of ${leads.length} lead(s)`);

  let drafted = 0;
  for (const l of queue) {
    const user = `Lead company: ${l.company}
Segment: ${l.segment}
Country: ${l.country || 'n/a'}
Their application: ${l.application || l.segment}
Kusumgar fabric that fits them (fabric_fit): ${l.fabric_fit || 'coated technical fabric'}

Draft the email for this lead now.`;
    const res = await askClaude({ system: SYSTEM, user, json: true, maxTokens: 1200 });
    if (res && res.subject && res.body) {
      outreach[l.id] = { ...(outreach[l.id] || {}), email: { subject: String(res.subject), body: String(res.body), drafted_at: new Date().toISOString(), model: MODEL_LABEL } };
      drafted++;
    } else {
      console.error(`[draft-emails] no draft returned for ${l.id}`);
    }
  }

  if (!drafted) { console.log('[draft-emails] nothing drafted; outreach.json unchanged.'); return; }
  await writeFile(OUTREACH_PATH, JSON.stringify(outreach, null, 2) + '\n');
  console.log(`[draft-emails] drafted ${drafted} email(s).`);
}

main()
  .catch((err) => { console.error('[draft-emails] unexpected error (exiting 0):', err); })
  .finally(() => process.exit(0));
