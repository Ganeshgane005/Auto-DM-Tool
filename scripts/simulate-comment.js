// Send a fake, correctly signed "comment" webhook to the local server.
// Lets you test the whole pipeline without Instagram.
// Usage: node --env-file=.env scripts/simulate-comment.js <igAccountId> "<comment text>" [mediaId]
import crypto from 'node:crypto';

const [igAccountId, text = 'link', mediaId = 'TEST_MEDIA'] = process.argv.slice(2);
if (!igAccountId) {
  console.error('Usage: node --env-file=.env scripts/simulate-comment.js <igAccountId> "<comment text>" [mediaId]');
  process.exit(1);
}

const payload = {
  object: 'instagram',
  entry: [{
    id: igAccountId,
    time: Math.floor(Date.now() / 1000),
    changes: [{
      field: 'comments',
      value: {
        id: `SIM_${Date.now()}`,
        text,
        from: { id: 'SIM_USER', username: 'simulated_fan' },
        media: { id: mediaId },
      },
    }],
  }],
};

const body = JSON.stringify(payload);
const sig = 'sha256=' + crypto.createHmac('sha256', process.env.META_APP_SECRET).update(body).digest('hex');
const port = process.env.PORT || 3000;

const res = await fetch(`http://localhost:${port}/webhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig },
  body,
});
console.log(`webhook answered ${res.status}. Now check GET /api/events.`);
