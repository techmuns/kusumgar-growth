// POST /api/gmail/draft  body { leadId? , to?, subject?, body?, threadId?, inReplyTo?, references? }
// Creates a Gmail DRAFT in the connected inbox via users.drafts.create. NEVER sends.
// The client normally passes to/subject/body (the edited compose fields); leadId is a fallback that
// reads the deployed outreach.json/leads.json to fill them.
import { haveConfig, getTokens, refreshAccessToken, buildMime, isEmail, GMAIL_API, json, originOf } from './_lib.js';

async function resolveLead(request, leadId) {
  try {
    const base = originOf(request);
    const [outreach, leads] = await Promise.all([
      fetch(base + '/data/outreach.json').then((r) => r.json()).catch(() => ({})),
      fetch(base + '/data/leads.json').then((r) => r.json()).catch(() => []),
    ]);
    const o = (outreach && outreach[leadId]) || {};
    const arr = Array.isArray(leads) ? leads : (leads.leads || []);
    const lead = arr.find((l) => l && l.id === leadId) || {};
    return { to: (o.contact && o.contact.email) || '', subject: (o.email && o.email.subject) || '', body: (o.email && o.email.body) || '', company: lead.company || '' };
  } catch { return {}; }
}

export async function onRequestPost({ request, env }) {
  if (!haveConfig(env)) return json({ error: 'not_configured' }, 503);
  const t = await getTokens(env);
  if (!t || !t.refresh_token) return json({ error: 'not_connected' }, 401);

  let b = {}; try { b = await request.json(); } catch { /* ignore */ }
  let to = String(b.to || '').trim(), subject = b.subject, body = b.body;
  const threadId = b.threadId || null;
  if ((!to || subject == null || body == null) && b.leadId) {
    const r = await resolveLead(request, b.leadId);
    to = to || r.to; if (subject == null) subject = r.subject; if (body == null) body = r.body;
  }
  if (!isEmail(to)) return json({ error: 'bad_recipient' }, 400);
  subject = String(subject || '').slice(0, 998);
  body = String(body || '');
  if (!body.trim()) return json({ error: 'empty_body' }, 400);
  if (body.length > 100_000) return json({ error: 'body_too_long' }, 400);

  let access;
  try { access = (await refreshAccessToken(env, t.refresh_token)).access_token; }
  catch (e) { return json({ error: 'refresh_failed', detail: String((e && e.message) || e).slice(0, 120) }, 502); }
  if (!access) return json({ error: 'refresh_failed' }, 502);

  const raw = buildMime({
    from: t.email || undefined, to, subject, body,
    inReplyTo: b.inReplyTo || null, references: b.references || b.inReplyTo || null,
  });
  const message = { raw };
  if (threadId) message.threadId = threadId;   // proper threading when replying

  const res = await fetch(`${GMAIL_API}/drafts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'content-type': 'application/json' },
    body: JSON.stringify({ message }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return json({ error: 'draft_failed', status: res.status, detail: (data.error && data.error.message) || '' }, 502);

  return json({
    ok: true,
    draftId: data.id || '',
    messageId: (data.message && data.message.id) || '',
    threadId: (data.message && data.message.threadId) || threadId || '',
    gmailUrl: 'https://mail.google.com/mail/u/0/#drafts',
  });
}
