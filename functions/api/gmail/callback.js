// GET /api/gmail/callback → verify CSRF state (signature + cookie nonce), exchange the code for a
// refresh token, store { email, refresh_token } in KV, then redirect back to the dashboard.
import { haveConfig, verifyState, readCookie, STATE_COOKIE, exchangeCode, decodeJwtEmail, redirectUri, putTokens, setCookie, redirect } from './_lib.js';

const safePath = (p) => (typeof p === 'string' && /^\/[^/]/.test(p) ? p : '/?gmail=connected');

export async function onRequestGet({ request, env }) {
  const clear = { 'Set-Cookie': setCookie(STATE_COOKIE, '', 0) };
  if (!haveConfig(env)) return redirect('/?gmail=notconfigured', clear);

  const url = new URL(request.url);
  const err = url.searchParams.get('error');
  if (err) return redirect('/?gmail=error&reason=' + encodeURIComponent(err.slice(0, 60)), clear);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const parsed = await verifyState(state, env.GOOGLE_CLIENT_SECRET);
  const cookieNonce = readCookie(request, STATE_COOKIE);
  // CSRF: the signed state must verify AND its nonce must match the cookie set on /connect.
  if (!code || !parsed || !cookieNonce || parsed.n !== cookieNonce) {
    return redirect('/?gmail=error&reason=bad_state', clear);
  }
  try {
    const tok = await exchangeCode(env, code, redirectUri(request, env));
    if (!tok.refresh_token) return redirect('/?gmail=error&reason=no_refresh_token', clear);
    await putTokens(env, {
      email: decodeJwtEmail(tok.id_token) || '',
      refresh_token: tok.refresh_token,
      scope: tok.scope || '',
      connected_at: new Date().toISOString(),
    });
    return redirect(safePath(parsed.ret), clear);
  } catch (e) {
    return redirect('/?gmail=error&reason=' + encodeURIComponent(String((e && e.message) || 'exchange_failed').slice(0, 60)), clear);
  }
}
