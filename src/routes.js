import express from 'express';
import crypto from 'node:crypto';
import { config } from './config.js';
import { Account, Automation, Event } from './models.js';
import { resolveAccount, subscribeToComments, getMedia } from './instagram.js';

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
apiRouter.get('/accounts', wrap(async (_req, res) => {
  const accounts = await Account.find({}, '-accessToken');
  res.json(accounts);
}));

apiRouter.post('/accounts', wrap(async (req, res) => {
  const { igUserId, username, accessToken } = req.body;
  const account = await Account.findOneAndUpdate(
    { igUserId: String(igUserId) },
    { igUserId: String(igUserId), username, accessToken },
    { upsert: true, new: true, runValidators: true }
  );
  res.status(201).json({ _id: account._id, igUserId: account.igUserId, username: account.username });
}));

// Easiest way to add an account: send the token (+ igUserId for Unified Login).
// We check the token works, save it, and try to switch on comment webhooks.
apiRouter.post('/accounts/connect', wrap(async (req, res) => {
  const { accessToken, igUserId: givenId } = req.body || {};
  if (!accessToken) return res.status(400).json({ error: 'accessToken is required' });
  const { igUserId, username } = await resolveAccount(accessToken, givenId);
  const account = await Account.findOneAndUpdate(
    { igUserId },
    { igUserId, username, accessToken },
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
