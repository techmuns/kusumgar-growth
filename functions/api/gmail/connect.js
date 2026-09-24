// GET /api/gmail/connect → 302 to Google OAuth consent (offline + consent to get a refresh token).
// Sets a short-lived, signed CSRF state (nonce in an HttpOnly cookie, matched on callback).
import { haveConfig, redirectUri, buildAuthUrl, signState, randomNonce, setCookie, STATE_COOKIE, redirect } from './_lib.js';

const safePath = (p) => (typeof p === 'string' && /^\/[^/]/.test(p) ? p : '/?gmail=connected');

export async function onRequestGet({ request, env }) {
  if (!haveConfig(env)) return redirect('/?gmail=notconfigured');
  const nonce = randomNonce();
  const ret = safePath(new URL(request.url).searchParams.get('return'));
  const state = await signState({ n: nonce, ts: Date.now(), ret }, env.GOOGLE_CLIENT_SECRET);
  const url = buildAuthUrl({ clientId: env.GOOGLE_CLIENT_ID, redirectUri: redirectUri(request, env), state });
  return redirect(url, { 'Set-Cookie': setCookie(STATE_COOKIE, nonce, 600) });
}
