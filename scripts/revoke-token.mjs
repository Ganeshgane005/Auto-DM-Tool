// Revoke old Instagram/Meta access tokens with Meta's official revoke API
// (GET /{version}/oauth/revoke, docs: developers.facebook.com/docs/business-management-apis/system-users/install-apps-and-generate-tokens/).
//
// Usage (from the dm-tool folder):
//   node --env-file=.env scripts/revoke-token.mjs old-tokens.txt   -> revoke every token in the file (one per line)
//   node --env-file=.env scripts/revoke-token.mjs --db             -> revoke the token saved in the database, if it differs from .env
//
// Safety: never revokes the token in .env (IG_ACCESS_TOKEN), never prints full tokens (only the last 4 characters).
import fs from 'node:fs';
import mongoose from 'mongoose';

const E = process.env;
const APP_ID = '1662523452263968';
const V = E.GRAPH_VERSION || 'v27.0';
const appToken = `${APP_ID}|${E.META_APP_SECRET}`;
const tail = (t) => '...' + t.slice(-4);

async function debug(t) {
  const u = `https://graph.facebook.com/${V}/debug_token?input_token=${encodeURIComponent(t)}&access_token=${encodeURIComponent(appToken)}`;
  const r = await fetch(u).then((r) => r.json());
  return r.data || {};
}

async function revoke(t) {
  if (t === E.IG_ACCESS_TOKEN) return console.log(tail(t), 'SKIPPED: this is the current token in .env');
  const before = await debug(t);
  if (!before.is_valid) return console.log(tail(t), 'already dead, nothing to do');
  // Meta's docs only say the caller token must be from the same app, so try each caller in turn.
  const callers = [['app key', appToken], ['current .env token', E.IG_ACCESS_TOKEN], ['the token itself', t]];
  for (const [name, caller] of callers) {
    if (!caller) continue;
    const q = new URLSearchParams({ client_id: APP_ID, client_secret: E.META_APP_SECRET, revoke_token: t, access_token: caller });
    const res = await fetch(`https://graph.facebook.com/${V}/oauth/revoke?${q}`).then((r) => r.json());
    const after = await debug(t);
    console.log(tail(t), `caller=${name}`, 'reply:', JSON.stringify(res?.error?.message || res), '| still valid after:', !!after.is_valid);
    if (!after.is_valid) return console.log(tail(t), 'REVOKED');
  }
  console.log(tail(t), 'NOT revoked by any caller');
}

const arg = process.argv[2];
let tokens = [];
if (arg === '--db') {
  await mongoose.connect(E.MONGODB_URI, { dbName: E.MONGODB_DB || 'dm-tool' });
  const accts = await mongoose.connection.db.collection('accounts').find({}).toArray();
  tokens = accts.map((a) => a.accessToken).filter(Boolean);
  await mongoose.disconnect();
} else if (arg) {
  // Finds tokens anywhere in the file, even with "IG_ACCESS_TOKEN=" or quotes around them.
  tokens = fs.readFileSync(arg, 'utf8').match(/EAA[A-Za-z0-9]{20,}/g) || [];
  console.log(`Found ${tokens.length} token(s) in ${arg}`);
  if (!tokens.length) console.log('No token found. Paste the token (starts with EAA) into the file, save with Ctrl+S, and run again.');
} else {
  console.log('Give a file of tokens or --db');
  process.exit(1);
}
for (const t of [...new Set(tokens)]) await revoke(t);
const cur = await debug(E.IG_ACCESS_TOKEN || '');
console.log('Current .env token still valid:', !!cur.is_valid);
