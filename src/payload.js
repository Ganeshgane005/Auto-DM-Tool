// Pure parsing of Meta webhook payloads: no dependencies, easy to test.

/**
 * Pull comment notifications out of an Instagram webhook payload.
 * Meta documents two shapes, so accept both:
 *   entry[].changes[] = { field: 'comments', value }   (classic)
 *   entry[] = { id, field: 'comments', value }         (Instagram Login examples)
 * Returns [{ igAccountId, value }], where igAccountId is the account that owns the post.
 */
export function extractComments(payload) {
  const payloads = Array.isArray(payload) ? payload : [payload];
  const out = [];
  for (const p of payloads) {
    if (p?.object !== 'instagram') continue;
    for (const entry of p.entry || []) {
      const changes = Array.isArray(entry.changes)
        ? entry.changes
        : entry.field
          ? [{ field: entry.field, value: entry.value }]
          : [];
      for (const change of changes) {
        if (change.field === 'comments' && change.value?.id && change.value?.text) {
          out.push({ igAccountId: String(entry.id), value: change.value });
        }
      }
    }
  }
  return out;
}

/**
 * Pull direct messages (texts, quick-reply taps, button postbacks) out of a webhook payload.
 * Shape: entry[].messaging[] = { sender:{id}, recipient:{id}, message?:{mid,text,is_echo,quick_reply}, postback? }
 * Echoes (messages WE sent) are dropped.
 */
export function extractMessages(payload) {
  const payloads = Array.isArray(payload) ? payload : [payload];
  const out = [];
  for (const p of payloads) {
    if (p?.object !== 'instagram') continue;
    for (const entry of p.entry || []) {
      for (const m of entry.messaging || []) {
        if (m.message?.is_echo) continue;
        if (!m.message && !m.postback) continue;
        out.push({
          igAccountId: String(entry.id),
          senderId: String(m.sender?.id),
          mid: m.message?.mid || m.postback?.mid || '',
          text: m.message?.text || m.postback?.title || '',
          payload: m.message?.quick_reply?.payload || m.postback?.payload || '',
        });
      }
    }
  }
  return out;
}
