// Pure follow-gate logic: no dependencies, easy to test.
//
// Why a gate needs a reply first: Meta only lets us check "does this person follow us?"
// after they MESSAGE us (a comment alone is not consent). So the flow is:
//   comment -> opener DM with a button -> they tap/reply -> check follow -> link or "follow first"

export const MAX_FOLLOW_CHECKS = 5; // stop nagging after this many "please follow" messages

export const WAITING = ['awaiting_reply', 'awaiting_follow'];

/**
 * Decide what to do when a person who commented sends us a message.
 * @param {{status: string, followChecks?: number}} event
 * @param {boolean} follows  is_user_follow_business from Meta
 * @returns {{action: 'send_link'|'ask_follow'|'none', status?: string}}
 */
export function followGateStep(event, follows) {
  if (!WAITING.includes(event.status)) return { action: 'none' };
  if (follows) return { action: 'send_link', status: 'sent' };
  if ((event.followChecks || 0) >= MAX_FOLLOW_CHECKS) return { action: 'none', status: 'gave_up' };
  return { action: 'ask_follow', status: 'awaiting_follow' };
}

/** Message with one tap-able quick reply button. */
export function withButton(text, title, payload) {
  return { text, quick_replies: [{ content_type: 'text', title: title.slice(0, 20), payload }] };
}

export const defaults = {
  openerText: "Hey! 👋 Tap the button below and I'll send you the link.",
  buttonLabel: 'Send me the link',
  followText: 'Almost there! Please follow @{username} first, then tap the button below 👇',
  followButtonLabel: 'I followed ✅',
};

export const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
