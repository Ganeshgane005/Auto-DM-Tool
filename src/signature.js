import crypto from 'node:crypto';

/**
 * Verify Meta's X-Hub-Signature-256 header against the raw request body.
 * rawBody must be the exact bytes Meta sent (a Buffer), not re-serialised JSON.
 */
export function verifySignature(rawBody, header, appSecret) {
  if (!rawBody || !header || !header.startsWith('sha256=') || !appSecret) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const received = header.slice('sha256='.length);
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
