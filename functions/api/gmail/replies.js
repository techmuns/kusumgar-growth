// GET /api/gmail/replies?threadIds=a,b,c → for each tracked thread, is there a new INBOUND reply?
// Uses gmail.metadata (headers only — no bodies). Basic version: a thread "has a reply" when it holds
// a message whose From is not the connected inbox.
import { haveConfig, getTokens, refreshAccessToken, GMAIL_API, json } from './_lib.js';

export async function onRequestGet({ request, env }) {
  if (!haveConfig(env)) return json({ error: 'not_configured' }, 503);
  const t = await getTokens(env);
  if (!t || !t.refresh_token) return json({ error: 'not_connected' }, 401);

  const ids = (new URL(request.url).searchParams.get('threadIds') || '')
    .split(',').map((s) => s.trim()).filter(Boolean).slice(0, 25);
  if (!ids.length) return json({ threads: [] });

  let access;
  try { access = (await refreshAccessToken(env, t.refresh_token)).access_token; }
  catch { return json({ error: 'refresh_failed' }, 502); }

  const me = String(t.email || '').toLowerCase();
  const threads = [];
  for (const id of ids) {
    try {
      const res = await fetch(`${GMAIL_API}/threads/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(15_000) });
      if (res.status === 403) { threads.push({ threadId: id, hasReply: null, note: 'read scope not granted — reconnect Gmail to enable reply detection' }); continue; }
      if (!res.ok) { threads.push({ threadId: id, hasReply: null }); continue; }
      const data = await res.json();
      let hasReply = false, lastFrom = '', lastDate = '';
      for (const m of (data.messages || [])) {
        const hs = (m.payload && m.payload.headers) || [];
        const from = ((hs.find((h) => h.name === 'From') || {}).value || '');
        const date = ((hs.find((h) => h.name === 'Date') || {}).value || '');
        if (me && !from.toLowerCase().includes(me)) { hasReply = true; lastFrom = from; lastDate = date; }
      }
      threads.push({ threadId: id, hasReply, lastFrom, lastDate });
    } catch { threads.push({ threadId: id, hasReply: null }); }
  }
  return json({ threads });
}
