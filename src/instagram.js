import { config } from './config.js';

// GRAPH_HOST:
//   graph.facebook.com  = "Instagram API with Unified Login" (Meta's only option for new apps, 2026)
//   graph.instagram.com = "Instagram API with Instagram Login" (older apps only)
const base = () => `https://${config.graphHost}/${config.graphVersion}`;

async function call(method, path, token, body) {
  const res = await fetch(`${base()}/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Instagram API error: ${msg}`);
  }
  return data;
}

const post = (path, token, body) => call('POST', path, token, body);
const get = (path, token) => call('GET', path, token);

/**
 * Meta allows ONE private reply per comment, within 7 days of the comment.
 * It is sent to the /messages endpoint with recipient.comment_id.
 */
export function sendPrivateReply(igUserId, token, commentId, message) {
  return post(`${igUserId}/messages`, token, {
    recipient: { comment_id: commentId },
    message: typeof message === 'string' ? { text: message } : message,
  });
}

/** Normal DM. Only allowed within 24 hours of the person's last message to us. */
export function sendMessage(igUserId, token, recipientId, message) {
  return post(`${igUserId}/messages`, token, {
    recipient: { id: recipientId },
    message: typeof message === 'string' ? { text: message } : message,
  });
}

/**
 * Does this person follow us? Needs their consent first: Meta only allows it after
 * they have messaged us (a comment alone returns "User consent is required").
 */
export function getFollowStatus(igsid, token) {
  return get(`${igsid}?fields=username,is_user_follow_business`, token);
}

/**
 * Work out which Instagram professional account a token is for.
 * Unified Login: pass the account ID shown in the App Dashboard; we read its username.
 * Instagram Login: /me returns `user_id` (the ID webhooks use as entry.id).
 */
export async function resolveAccount(token, igUserId) {
  if (igUserId) {
    const data = await get(`${igUserId}?fields=id,username,name,profile_picture_url`, token);
    return {
      igUserId: String(data.id || igUserId),
      username: data.username,
      name: data.name,
      profilePictureUrl: data.profile_picture_url,
    };
  }
  const me = await get('me?fields=user_id,username,name,profile_picture_url', token);
  if (!me.user_id) {
    throw new Error('Could not find the Instagram account ID from this token. Send igUserId too (shown in the App Dashboard).');
  }
  return { igUserId: String(me.user_id), username: me.username, name: me.name, profilePictureUrl: me.profile_picture_url };
}

/** Which webhook fields are switched on for this account, e.g. ['comments', 'messages']. */
export async function getSubscribedFields(igUserId, token) {
  const data = await get(`${igUserId}/subscribed_apps`, token);
  return (data.data || []).flatMap((a) => a.subscribed_fields || []);
}

/** Stop webhooks for this account (used when it is removed from the tool). */
export function unsubscribe(igUserId, token) {
  return call('DELETE', `${igUserId}/subscribed_apps`, token);
}

/** Turn on webhook notifications for this account. Without this, no comments arrive. */
// `messages` is needed for the follow gate (button taps and replies arrive as messages).
export function subscribeToComments(igUserId, token) {
  return post(`${igUserId}/subscribed_apps?subscribed_fields=comments,messages`, token, {});
}

/** Latest posts and reels, newest first. */
export async function getMedia(igUserId, token, limit = 24) {
  const fields = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,comments_count';
  const data = await get(`${igUserId}/media?fields=${fields}&limit=${limit}`, token);
  return data.data || [];
}

/** Optional public reply under the comment, e.g. "Check your DMs!" */
export function replyToComment(token, commentId, text) {
  return post(`${commentId}/replies`, token, { message: text });
}
