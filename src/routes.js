import express from 'express';
import crypto from 'node:crypto';
import { config } from './config.js';
import { Account, Automation, Event } from './models.js';
import { resolveAccount, subscribeToComments, getMedia, getSubscribedFields, unsubscribe } from './instagram.js';

export const apiRouter = express.Router();

// Minimal protection for now: a shared secret in the x-api-key header.
// Replace with real user login before other creators use this.
apiRouter.use((req, res, next) => {
  const key = Buffer.from(req.get('x-api-key') || '');
  const expected = Buffer.from(config.adminApiKey);
  if (key.length !== expected.length || !crypto.timingSafeEqual(key, expected)) {
    return res.sendStatus(401);
  }
  next();
});

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    const status = err.name === 'ValidationError' ? 400 : 500;
    res.status(status).json({ error: err.message });
  });

// --- Accounts (the connected Instagram professional accounts) ---
// Every account with its automation count and total DMs sent (tokens never leave the server).
apiRouter.get('/accounts', wrap(async (_req, res) => {
  const accounts = await Account.find({}, '-accessToken').sort({ createdAt: 1 }).lean();
  const totals = await Automation.aggregate([
    { $group: { _id: '$accountId', automations: { $sum: 1 }, sent: { $sum: '$stats.sent' } } },
  ]);
  const byId = Object.fromEntries(totals.map((t) => [String(t._id), t]));
  res.json(accounts.map((a) => ({
    ...a,
    automations: byId[String(a._id)]?.automations || 0,
    sent: byId[String(a._id)]?.sent || 0,
  })));
}));

// Add (or re-connect) an Instagram account: token + account ID from Meta's "Generate access tokens".
// We check the token works, save it, and switch on comment + message webhooks for it.
apiRouter.post('/accounts/connect', wrap(async (req, res) => {
  const accessToken = String(req.body?.accessToken || '').trim();
  const givenId = String(req.body?.igUserId || '').trim();
  if (!accessToken) return res.status(400).json({ error: 'accessToken is required' });
  let profile;
  try {
    profile = await resolveAccount(accessToken, givenId);
  } catch (err) {
    return res.status(400).json({ error: `Meta did not accept this token / account ID. ${err.message}` });
  }
  const { igUserId, username, name, profilePictureUrl } = profile;
  const account = await Account.findOneAndUpdate(
    { igUserId },
    { igUserId, username, name, profilePictureUrl, accessToken },
    { upsert: true, new: true, runValidators: true }
  );
  // Saving the account must not depend on this call: with Unified Login the
  // subscription may already be on from the dashboard, or need a different token.
  let subscribed = true;
  let subscribeError;
  try {
    await subscribeToComments(igUserId, accessToken);
  } catch (err) {
    subscribed = false;
    subscribeError = err.message;
  }
  res.status(201).json({ _id: account._id, igUserId, username, subscribed, subscribeError });
}));

// Is this account still working? (token valid + which webhook fields are on)
apiRouter.get('/accounts/:id/health', wrap(async (req, res) => {
  const account = await Account.findById(req.params.id);
  if (!account) return res.sendStatus(404);
  try {
    const profile = await resolveAccount(account.accessToken, account.igUserId);
    const fields = await getSubscribedFields(account.igUserId, account.accessToken);
    const ok = fields.includes('comments') && fields.includes('messages');
    if (profile.username !== account.username || profile.profilePictureUrl !== account.profilePictureUrl) {
      await Account.updateOne({ _id: account._id }, { username: profile.username, name: profile.name, profilePictureUrl: profile.profilePictureUrl });
    }
    res.json({ ok, tokenOk: true, subscribedFields: fields });
  } catch (err) {
    res.json({ ok: false, tokenOk: false, error: err.message });
  }
}));

// Remove an account and everything that belongs to it.
apiRouter.delete('/accounts/:id', wrap(async (req, res) => {
  const account = await Account.findById(req.params.id);
  if (!account) return res.sendStatus(404);
  try {
    await unsubscribe(account.igUserId, account.accessToken); // stop Meta sending its webhooks
  } catch (err) {
    console.warn('unsubscribe failed (continuing):', err.message);
  }
  await Automation.deleteMany({ accountId: account._id });
  await Event.deleteMany({ accountId: account._id });
  await account.deleteOne();
  res.sendStatus(204);
}));

// --- Automations ---
apiRouter.get('/automations', wrap(async (req, res) => {
  const filter = req.query.accountId ? { accountId: req.query.accountId } : {};
  res.json(await Automation.find(filter).sort({ createdAt: -1 }));
}));

apiRouter.post('/automations', wrap(async (req, res) => {
  res.status(201).json(await Automation.create(req.body));
}));

apiRouter.patch('/automations/:id', wrap(async (req, res) => {
  // The dashboard must not overwrite counters or move an automation to another account.
  const { stats, accountId, _id, createdAt, updatedAt, ...changes } = req.body || {};
  const updated = await Automation.findByIdAndUpdate(req.params.id, changes, {
    new: true,
    runValidators: true,
  });
  if (!updated) return res.sendStatus(404);
  res.json(updated);
}));

apiRouter.delete('/automations/:id', wrap(async (req, res) => {
  await Automation.findByIdAndDelete(req.params.id);
  res.sendStatus(204);
}));

// --- Posts and reels of an account (for the "which post?" picker) ---
apiRouter.get('/accounts/:id/media', wrap(async (req, res) => {
  const account = await Account.findById(req.params.id);
  if (!account) return res.sendStatus(404);
  res.json(await getMedia(account.igUserId, account.accessToken));
}));

// --- Event log ---
apiRouter.get('/events', wrap(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const filter = req.query.accountId ? { accountId: req.query.accountId } : {};
  res.json(await Event.find(filter).sort({ createdAt: -1 }).limit(limit));
}));
