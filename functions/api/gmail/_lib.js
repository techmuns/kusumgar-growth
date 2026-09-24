// Shared helpers for the Gmail connector (Cloudflare Pages Functions).
//
// DRAFT-MODE ONLY. There is deliberately NO send helper in this file and no endpoint calls
// gmail.messages.send — the only Gmail write is users.drafts.create. Do not add a send path.
//
// Self-contained: uses only Web-platform APIs (crypto.subtle, TextEncoder, btoa/atob, fetch) so it
// runs unchanged on Cloudflare's runtime and can be unit-tested under Node 22.
//
// A leading-underscore filename keeps Pages from turning this module into a route.

export const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
export const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

// Scopes. gmail.compose = create drafts (never send here). gmail.metadata = read ONLY message
// headers (From/Date/Subject) — no bodies, no send — the minimum needed to detect an inbound reply
// for /replies; gmail.compose alone cannot read threads. openid+email = learn which inbox connected.
export const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.metadata',
].join(' ');

export const TOKENS_KEY = 'inbox';          // single-inbox trial: one KV entry
export const STATE_COOKIE = 'kgr_goauth';   // CSRF: nonce cookie tied to the signed state
export const STATE_TTL_MS = 10 * 60 * 1000; // signed OAuth state is valid for 10 minutes

/* ---------------- config / origin ---------------- */
// True only when the two secrets AND the KV binding are all present, so every endpoint can degrade
// gracefully to "Gmail not set up yet" until the user finishes the Cloudflare setup.
export const haveConfig = (env) => !!(env && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GMAIL_TOKENS);

export const originOf = (request) => new URL(request.url).origin;
// The OAuth redirect URI. Derived from the live request origin so it works on production and previews;
// an explicit GMAIL_REDIRECT_URI env overrides it (e.g. a custom domain).
export const redirectUri = (request, env) => (env && env.GMAIL_REDIRECT_URI) || `${originOf(request)}/api/gmail/callback`;

/* ---------------- base64 / bytes ---------------- */
const enc = new TextEncoder();
const dec = new TextDecoder();
export const u8 = (str) => enc.encode(str);
function bytesToBinary(bytes) {
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return s;
}
export const b64 = (bytes) => btoa(bytesToBinary(bytes instanceof Uint8Array ? bytes : u8(String(bytes))));
export const b64url = (bytes) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function b64urlToBytes(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s + pad); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------------- signed CSRF state (HMAC-SHA256) ---------------- */
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', u8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, u8(msg))));
}
function timingSafeEq(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
export const randomNonce = () => b64url(crypto.getRandomValues(new Uint8Array(16)));
// state = base64url(json).hmac — carries a nonce (matched to the cookie), a timestamp (expiry) and a
// return path, and cannot be forged without GOOGLE_CLIENT_SECRET.
export async function signState(obj, secret) {
  const payload = b64url(u8(JSON.stringify(obj)));
  return `${payload}.${await hmac(secret, payload)}`;
}
export async function verifyState(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!timingSafeEq(sig, await hmac(secret, payload))) return null;
  try {
    const obj = JSON.parse(dec.decode(b64urlToBytes(payload)));
    if (!obj || !obj.ts || Date.now() - obj.ts > STATE_TTL_MS) return null;
    return obj;
  } catch { return null; }
}

/* ---------------- KV token store (minimal: refresh_token + email) ---------------- */
export async function getTokens(env) {
  try { const raw = await env.GMAIL_TOKENS.get(TOKENS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export async function putTokens(env, obj) { await env.GMAIL_TOKENS.put(TOKENS_KEY, JSON.stringify(obj)); }
export async function delTokens(env) { try { await env.GMAIL_TOKENS.delete(TOKENS_KEY); } catch { /* ignore */ } }

/* ---------------- Google OAuth ---------------- */
export function buildAuthUrl({ clientId, redirectUri: ru, state }) {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: ru,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',   // ask for a refresh token
    prompt: 'consent',        // force a refresh token even on re-consent
    include_granted_scopes: 'true',
  });
  p.set('state', state);
  return `${GOOGLE_AUTH}?${p.toString()}`;
}
async function tokenCall(env, params) {
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`token ${res.status}: ${data.error || ''} ${data.error_description || ''}`.trim());
  return data;
}
export const exchangeCode = (env, code, ru) => tokenCall(env, {
  code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: ru, grant_type: 'authorization_code',
});
export const refreshAccessToken = (env, refresh_token) => tokenCall(env, {
  refresh_token, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token',
});
// Read the email claim from Google's id_token (issued by the token endpoint over TLS). We only read
// it to label the connected inbox; we do not accept id_tokens from anywhere else.
export function decodeJwtEmail(id_token) {
  try { const parts = String(id_token).split('.'); if (parts.length < 2) return ''; const p = JSON.parse(dec.decode(b64urlToBytes(parts[1]))); return (p && (p.email || '')) || ''; } catch { return ''; }
}

/* ---------------- RFC822 draft MIME (no send) ---------------- */
export const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
// RFC 2047 encode a header value only when it has non-ASCII, so plain subjects stay readable.
const encHeader = (s) => (/^[\x00-\x7F]*$/.test(s) ? s : `=?UTF-8?B?${b64(u8(s))}?=`);
const wrap76 = (s) => s.replace(/.{1,76}/g, '$&\r\n').trimEnd();
// Build a base64url-encoded RFC822 message for gmail.users.drafts.create's `raw` field.
export function buildMime({ from, to, subject, body, inReplyTo, references }) {
  const headers = [
    from ? `From: ${from}` : null,
    `To: ${to}`,
    `Subject: ${encHeader(String(subject || ''))}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    references ? `References: ${references}` : null,
  ].filter(Boolean);
  const bodyB64 = wrap76(b64(u8(String(body || ''))));
  const message = headers.join('\r\n') + '\r\n\r\n' + bodyB64;
  return b64url(u8(message));
}

/* ---------------- HTTP helpers ---------------- */
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
export const redirect = (location, headers = {}) =>
  new Response(null, { status: 302, headers: { Location: location, 'cache-control': 'no-store', ...headers } });

export function setCookie(name, value, maxAgeSec) {
  const parts = [`${name}=${value}`, 'Path=/api/gmail', 'HttpOnly', 'Secure', 'SameSite=Lax'];
  parts.push(maxAgeSec ? `Max-Age=${maxAgeSec}` : 'Max-Age=0');
  return parts.join('; ');
}
export function readCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const kv of raw.split(/;\s*/)) { const i = kv.indexOf('='); if (i > 0 && kv.slice(0, i) === name) return kv.slice(i + 1); }
  return '';
}
