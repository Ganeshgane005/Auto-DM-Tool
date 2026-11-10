# DM Tool: Instagram comment-to-DM automation

When someone comments a keyword on your post or reel, the tool sends them a DM
(a "private reply") and optionally replies publicly under the comment.
It uses only Meta's official Instagram API, so accounts are not at risk of bans
from unofficial automation.

## What is built so far (backend, v0.1)

- Webhook endpoint with Meta signature verification (`src/webhook.js`, `src/signature.js`)
- Keyword matching: contains / exact, per-post or any post (`src/match.js`)
- Private reply and public reply calls (`src/instagram.js`)
- MongoDB models: Account, Automation, Event log with duplicate protection (`src/models.js`)
- REST API to manage accounts and automations (`src/routes.js`)
- Unit tests for matching and signature checks (`test/core.test.js`)

Not built yet: the React dashboard, Instagram login flow, billing.

## Run it on your computer

1. Install Node 20+ and MongoDB (or use a free MongoDB Atlas cluster).
2. `npm install`
3. Copy `.env.example` to `.env` and fill it in.
4. `npm test` (should pass without any setup)
5. `npm run dev`
6. Expose it publicly so Meta can reach it, for example `ngrok http 3000`.

## Connect Meta (one time)

1. Create an app at developers.facebook.com and add the Instagram product
   (Instagram API with Instagram Login).
2. Switch your Instagram account to a Professional (Creator or Business) account.
3. In the app dashboard, set the webhook callback URL to `https://<your-ngrok-host>/webhook`
   and the verify token to your `WEBHOOK_VERIFY_TOKEN`. Subscribe to the `comments` field.
4. Add your own Instagram account as a tester/role on the app, generate its access token,
   and register it:

```bash
curl -X POST http://localhost:3000/api/accounts \
  -H "x-api-key: $ADMIN_API_KEY" -H "Content-Type: application/json" \
  -d '{"igUserId":"<your IG user id>","username":"<handle>","accessToken":"<token>"}'
```

5. Create an automation:

```bash
curl -X POST http://localhost:3000/api/automations \
  -H "x-api-key: $ADMIN_API_KEY" -H "Content-Type: application/json" \
  -d '{"accountId":"<_id from step 4>","name":"Tools list","keywords":["link","tools"],
       "dmText":"Here is the list: https://example.com","publicReplies":["Sent! Check your DMs"]}'
```

6. Comment "link" from a different Instagram account on one of your posts.
   Check `GET /api/events` to see what happened.

## Meta rules to remember

- Only ONE private reply per comment, within 7 days of the comment.
- You can only DM people who commented (or messaged you first). No cold messages.
- Using the tool on your own account needs no App Review. Serving other creators needs
  Advanced Access, which requires App Review and Business Verification. Start that
  process early because it takes time.
- Meta requires an escalation path to a human for messaging apps.

## Next steps

1. Test end-to-end on your own account.
2. Instagram login flow so creators can connect without copying tokens.
3. React dashboard: automations list, create form, event log.
4. Token encryption, per-user login, rate limiting, then billing.
