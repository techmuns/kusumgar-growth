// POST /api/gmail/disconnect → delete the stored token (forget the connected inbox).
import { haveConfig, delTokens, json } from './_lib.js';

export async function onRequestPost({ env }) {
  if (!haveConfig(env)) return json({ ok: true, configured: false });
  await delTokens(env);
  return json({ ok: true });
}
