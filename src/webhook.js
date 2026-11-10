import express from 'express';
import { config } from './config.js';
import { verifySignature } from './signature.js';
import { findAutomation } from './match.js';
import { extractComments, extractMessages } from './payload.js';
import { followGateStep, withButton, defaults, fill, WAITING } from './gate.js';
import { Account, Automation, Event } from './models.js';
import {
  sendPrivateReply,
  sendMessage,
  getFollowStatus,
  replyToComment,
} from './instagram.js';

export const webhookRouter = express.Router();

// Meta calls this once when you save the webhook URL in the app dashboard.
webhookRouter.get('/', (req, res) => {
  if (
    req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === config.verifyToken
  ) {
    return res.status(200).send(req.query['hub.challenge']);
  }
  return res.sendStatus(403);
});

// Raw body is required: the signature is computed over the exact bytes Meta sent.
webhookRouter.post('/', express.raw({ type: '*/*', limit: '1mb' }), (req, res) => {
  if (!verifySignature(req.body, req.get('x-hub-signature-256'), config.appSecret)) {
    console.warn('webhook rejected: bad signature (check META_APP_SECRET in .env)');
    return res.sendStatus(401);
  }
  // Answer fast so Meta does not retry; do the work afterwards.
  res.sendStatus(200);

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch {
    return;
  }
  processPayload(payload).catch((err) => console.error('webhook processing failed:', err));
});

async function findAccount(igAccountId) {
  const account = await Account.findOne({ igUserId: igAccountId });
  if (!account) console.warn(`event for unknown account ${igAccountId}; register it with POST /api/accounts/connect`);
  return account;
}

async function processPayload(payload) {
  for (const { igAccountId, value } of extractComments(payload)) {
    const account = await findAccount(igAccountId);
    if (!account) continue;
    console.log(`comment from @${value.from?.username}: "${value.text}"`);
    await handleComment(account, value);
  }
  for (const msg of extractMessages(payload)) {
    const account = await findAccount(msg.igAccountId);
    if (!account || msg.senderId === account.igUserId) continue;
    console.log(`message from ${msg.senderId}: "${msg.text}"${msg.payload ? ` [button ${msg.payload}]` : ''}`);
    await handleMessage(account, msg);
  }
}

const bump = (automation, field) =>
  Automation.updateOne({ _id: automation._id }, { $inc: { [`stats.${field}`]: 1 } });

async function handleComment(account, value) {
  // Never react to our own comments (e.g. our public replies), or we would loop.
  if (String(value.from?.id) === account.igUserId) return;

  const automations = await Automation.find({ accountId: account._id, active: true });
  const automation = findAutomation(automations, { text: value.text, mediaId: value.media?.id });
  if (!automation) return;

  let event;
  try {
    event = await Event.create({
      accountId: account._id,
      automationId: automation._id,
      commentId: value.id,
      commenterId: value.from?.id,
      commenterUsername: value.from?.username,
      commentText: value.text,
    });
  } catch (err) {
    if (err.code === 11000) return; // already handled (webhook retry)
    throw err;
  }

  try {
    if (automation.requireFollow) {
      // Step 1 of the gate: a DM with a button. Their tap = a message = consent to check follow.
      const opener = withButton(
        automation.openerText || defaults.openerText,
        automation.buttonLabel || defaults.buttonLabel,
        `GET_LINK:${event._id}`
      );
      let res;
      try {
        res = await sendPrivateReply(account.igUserId, account.accessToken, value.id, opener);
      } catch (err) {
        // If Meta refuses buttons in a private reply, fall back to plain text.
        console.warn('opener with button failed, sending plain text:', err.message);
        res = await sendPrivateReply(
          account.igUserId,
          account.accessToken,
          value.id,
          `${automation.openerText || defaults.openerText}\n\n(Reply "yes" here to get it.)`
        );
      }
      event.recipientId = res?.recipient_id;
      event.status = 'awaiting_reply';
    } else {
      const res = await sendPrivateReply(account.igUserId, account.accessToken, value.id, automation.dmText);
      event.recipientId = res?.recipient_id;
      event.status = 'sent';
      await bump(automation, 'sent');
    }
  } catch (err) {
    event.status = 'failed';
    event.error = String(err.message).slice(0, 500);
    await bump(automation, 'failed');
  }
  await event.save();

  if (event.status !== 'failed' && automation.publicReplies.length > 0) {
    const text = automation.publicReplies[Math.floor(Math.random() * automation.publicReplies.length)];
    try {
      await replyToComment(account.accessToken, value.id, text);
    } catch (err) {
      console.error('public reply failed:', err.message);
    }
  }
}

async function handleMessage(account, msg) {
  // The most recent comment from this person that is still waiting on the gate.
  const event = await Event.findOne({
    accountId: account._id,
    status: { $in: WAITING },
    $or: [{ commenterId: msg.senderId }, { recipientId: msg.senderId }],
  }).sort({ createdAt: -1 });
  if (!event) return; // a normal DM, not part of any automation
  if (msg.mid && event.lastMid === msg.mid) return; // webhook retry

  const automation = await Automation.findById(event.automationId);
  if (!automation) return;

  let follows = false;
  try {
    const profile = await getFollowStatus(msg.senderId, account.accessToken);
    follows = profile.is_user_follow_business === true;
    console.log(`@${profile.username} follows us: ${follows}`);
  } catch (err) {
    console.warn('follow check failed:', err.message);
  }

  const step = followGateStep(event, follows);
  event.lastMid = msg.mid;
  try {
    if (step.action === 'send_link') {
      await sendMessage(account.igUserId, account.accessToken, msg.senderId, automation.dmText);
      await bump(automation, 'sent');
    } else if (step.action === 'ask_follow') {
      const text = fill(automation.followText || defaults.followText, { username: account.username });
      await sendMessage(
        account.igUserId,
        account.accessToken,
        msg.senderId,
        withButton(text, automation.followButtonLabel || defaults.followButtonLabel, `CHECK_FOLLOW:${event._id}`)
      );
      event.followChecks = (event.followChecks || 0) + 1;
    }
    if (step.status) event.status = step.status;
    event.error = undefined;
  } catch (err) {
    event.error = String(err.message).slice(0, 500);
    console.error('gate reply failed:', err.message);
  }
  await event.save();
}
