// GET /api/gmail/status → { configured, connected, email }
// Graceful before setup: reports configured:false so the UI shows "Gmail not set up yet".
import { haveConfig, getTokens, json } from './_lib.js';

export async function onRequestGet({ env }) {
  if (!haveConfig(env)) return json({ configured: false, connected: false, email: '' });
  const t = await getTokens(env);
  return json({ configured: true, connected: !!(t && t.refresh_token), email: (t && t.email) || '' });
}
