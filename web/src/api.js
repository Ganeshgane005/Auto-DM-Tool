// Tiny API client. Phase 1 step 1 uses the admin key; "Login with Instagram" replaces it later.
const KEY_STORAGE = 'dmtool.adminKey';

export function getKey() {
  try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
}
export function setKey(key) {
  try { key ? localStorage.setItem(KEY_STORAGE, key) : localStorage.removeItem(KEY_STORAGE); } catch { /* private mode */ }
}

export class AuthError extends Error {}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'x-api-key': getKey(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new AuthError('Wrong or missing admin key');
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Same defaults as the server (src/gate.js), shown as placeholders and in the preview.
export const DEFAULTS = {
  openerText: "Hey! 👋 Tap the button below and I'll send you the link.",
  buttonLabel: 'Send me the link',
  followText: 'Almost there! Please follow @{username} first, then tap the button below 👇',
  followButtonLabel: 'I followed ✅',
};
