# Phase 1: From "works on my PC" to a real product

## Step 1: Dashboard ✅ (built 2026-11-10)
- React (Vite) app in `web/`, served by Express at `http://localhost:3000`.
- Login with the `ADMIN_API_KEY` from `.env` (temporary, replaced in step 3).
- **Automations:** list with stats, pause/resume, edit, delete.
- **Editor:** keywords, contains/exact, post picker (your real posts), followers-only gate with editable messages and button labels, public replies, live DM preview.
- **Activity:** every matching comment with its status (link sent / waiting for tap / asked to follow / failed), auto-refresh.
- After changing anything in `web/src`, run `npm run build:web` and restart the server.
  For live editing instead: `npm run dev` (server) + `cd web && npm run dev` (opens on :5173).

## Step 2: Hosting (next)
Why first: "Login with Instagram" needs a **fixed https address** for its redirect URL. The free cloudflared address changes every restart.
- Database: **MongoDB Atlas** free cluster (M0).
- Server: a host that runs Node 20+ and gives an https URL. Candidates: Render, Railway, Fly.io, or a small VPS. **Check each one's current free tier and sleep rules before choosing.** A server that sleeps can miss webhooks (Meta retries for a while, but not forever).
- Then: update the webhook URL in Meta's Step 3 to the fixed address. No more tunnel.
- You create the accounts (Atlas, host). I write the config and deploy steps.

## Step 3: "Connect Instagram" login (multi-user)
- Facebook Login for Business with the existing configuration (ID `1620049612375893`).
- Register `https://<fixed-host>/auth/callback` as the Redirect URL in Meta's Step 1.
- Flow: creator clicks Connect → logs in with Instagram/Facebook → we receive a code → exchange for their token → save account → subscribe `comments,messages` → start a login session (cookie).
- Every API call is then limited to **that creator's** account (no more shared admin key).
- Encrypt tokens in the database (AES-256-GCM, key in `.env`).
- Privacy policy + terms + data-deletion URL pages (needed by Meta before App Review).

## Step 4: Ready for other creators (Phase 2 in the research plan)
- Business Verification + App Review (Advanced Access) so non-tester creators can connect.
- Rate limiting, a queue for viral spikes, error alerts.
- Then billing (Razorpay subscriptions) = Phase 3.

## Open housekeeping
- Old wallframez token is still valid (same system user). Revoke all tokens for that system user before connecting any important account.
