import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    igUserId: { type: String, required: true, unique: true },
    username: String,
    name: String,
    profilePictureUrl: String,
    // TODO before onboarding other creators: encrypt this at rest.
    accessToken: { type: String, required: true },
  },
  { timestamps: true }
);

const automationSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    name: { type: String, required: true },
    mediaId: { type: String, default: '' }, // empty = any post or reel
    keywords: { type: [String], validate: (v) => v.length > 0 },
    matchType: { type: String, enum: ['contains', 'exact'], default: 'contains' },
    dmText: { type: String, required: true, maxlength: 1000 },
    publicReplies: { type: [String], default: [] }, // optional replies under the comment
    // Follow gate: only send dmText to people who follow the account.
    requireFollow: { type: Boolean, default: false },
    openerText: { type: String, default: '' },       // first DM (with a button); empty = default
    buttonLabel: { type: String, default: '' },
    followText: { type: String, default: '' },       // "please follow first"; {username} allowed
    followButtonLabel: { type: String, default: '' },
    active: { type: Boolean, default: true },
    stats: {
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

const eventSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    automationId: { type: mongoose.Schema.Types.ObjectId, required: true },
    commentId: { type: String, required: true, unique: true }, // dedupes webhook retries
    commenterId: String,
    commenterUsername: String,
    commentText: String,
    recipientId: String, // IGSID returned by Meta for the private reply
    status: {
      type: String,
      enum: ['pending', 'awaiting_reply', 'awaiting_follow', 'sent', 'failed', 'gave_up'],
      default: 'pending',
    },
    followChecks: { type: Number, default: 0 },
    lastMid: String, // last message handled, so webhook retries are ignored
    error: String,
  },
  { timestamps: true }
);
eventSchema.index({ accountId: 1, commenterId: 1, status: 1 });

export const Account = mongoose.model('Account', accountSchema);
export const Automation = mongoose.model('Automation', automationSchema);
export const Event = mongoose.model('Event', eventSchema);
