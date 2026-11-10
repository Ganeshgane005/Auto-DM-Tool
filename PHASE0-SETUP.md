# Phase 0: Run the DM tool on your own Instagram account

Goal: someone comments "link" on your reel → they get a DM automatically.

Already done for you (2026-11-10):
- `npm install` done. Tests pass (7/7).
- `.env` created with a random `WEBHOOK_VERIFY_TOKEN` and `ADMIN_API_KEY`. **You only need to paste `META_APP_SECRET`.**
- A local test with a fake comment worked: keyword matched → real call to Instagram → failed only because the token was fake.

Folder: `C:\Users\ganesh\Downloads\dm-tool\dm-tool` (run every command below from here).

> **Important limit (from Meta's webhook docs):** "Advanced Access is required for `comments` notifications" and the app "must be Live to receive notifications". So in this phase, **test by commenting from a second account that is an Instagram Tester on your app.** Comments from random followers will probably not arrive until App Review (Phase 2). Step 10 checks this.

---

## You need

- [ ] Your Instagram account as **Professional** (Creator or Business). Instagram app → Settings → Account type and tools.
- [ ] A **second Instagram account** to comment from (any personal account).
- [ ] A Facebook account to log in to developers.facebook.com.
- [ ] About 1-2 hours.

## Step 1: Create a Meta developer account
Go to **developers.facebook.com** → Get Started → log in → verify. You do this yourself (I can't create accounts or enter passwords).

## Step 2: Create the app
1. My Apps → **Create App**.
2. Use case: **"Manage messaging & content on Instagram"** (the wording may differ slightly).
3. App name: e.g. `HiddenTech DM Test`. No business portfolio needed yet.

## Step 3: Instagram API setup (Unified login)
> Update 2026-11-10: Meta no longer offers "Instagram login" to new apps. Use **API setup with Unified login**. It needs a **business portfolio** (free, no verification needed for testing). The code uses `GRAPH_HOST=graph.facebook.com` for this.

In the app: Use cases → Customize → **API setup with Unified login**.
1. Click **+ Business portfolio** and create/connect one (name it e.g. "Hidden Tech").
2. Then follow the setup sections on that page. Send Claude a screenshot if unsure.
3. **App roles → Roles → Add People → Instagram Tester**: add **both** Instagram usernames (done: wallframez + shiv__ganesh_).
3. Accept the invites. On each Instagram account, open instagram.com on a browser → Settings → **Apps and websites** → **Tester invites** → Accept.

## Step 4: Copy the app secret into `.env`
App settings → **Basic** → **App secret** → Show → copy.
Open `.env` in Notepad and replace `replace-with-meta-app-secret` with it. Save.
(If step 8 later logs "bad signature", use the **Instagram app secret** from the API setup page instead.)

## Step 5: Start the database and the server (2 PowerShell windows)

Window 1 (database, keep it open):
```bash
npm run db
```
Window 2 (server, keep it open):
```bash
npm run dev
```
You should see `dm-tool listening on :3000`.

> Your PC has little free RAM. Close Steam, Epic, uTorrent and Oracle DB while testing.

## Step 6: Make your PC reachable from the internet (tunnel)
Meta must reach `localhost:3000`. Install ngrok (free, needs a free ngrok account):
```bash
winget install ngrok.ngrok
```
Sign up at ngrok.com, copy your authtoken from their dashboard, then:
```bash
ngrok config add-authtoken YOUR_TOKEN
```
Window 3 (keep it open):
```bash
ngrok http 3000
```
Copy the `https://....ngrok-free.app` address it shows.

## Step 7: Connect the webhook in Meta
Instagram → API setup with Instagram login → **Configure webhooks**:
- Callback URL: `https://YOUR-NGROK-ADDRESS/webhook`
- Verify token: the `WEBHOOK_VERIFY_TOKEN` value from your `.env`
- **Verify and save**. Then turn on the **comments** field.

## Step 8: Generate a token and connect your account
API setup with Unified login → generate an access token for your **main** account → copy the token **and the Instagram account ID** shown for it.

Window 4 (PowerShell):
```powershell
$KEY = (Select-String '^ADMIN_API_KEY=' .env).Line.Split('=')[1]
$TOKEN = Read-Host 'Paste the token'
$IGID = Read-Host 'Paste the Instagram account ID'
Invoke-RestMethod -Method Post http://localhost:3000/api/accounts/connect -Headers @{ 'x-api-key' = $KEY } -ContentType 'application/json' -Body (@{ accessToken = $TOKEN; igUserId = $IGID } | ConvertTo-Json)
```
You should see your username. Copy the `_id`. If `subscribed` is `False`, send Claude the `subscribeError` text (never the token).

The token is stored only in your local database. Don't paste it in chat or anywhere public.

## Step 9: Create your first automation
```powershell
$body = @{
  accountId     = 'PASTE_ID_FROM_STEP_8'
  name          = 'Test link'
  keywords      = @('link')
  dmText        = 'Hey! Here is the link you asked for: https://github.com/langflow-ai/langflow'
  publicReplies = @('Sent! Check your DMs')
} | ConvertTo-Json
Invoke-RestMethod -Method Post http://localhost:3000/api/automations -Headers @{ 'x-api-key' = $KEY } -ContentType 'application/json' -Body $body
```

## Step 10: The real test
1. From your **second (tester) account**, comment **"link"** on any post of your main account.
2. Watch Window 2. You should see `comment from @yoursecondaccount: "link"`.
3. Check the second account's DMs (look in **Message requests** too).
4. See the log:
```powershell
Invoke-RestMethod http://localhost:3000/api/events -Headers @{ 'x-api-key' = $KEY }
```

## If something goes wrong

| What you see | Meaning / fix |
|---|---|
| Verify and save fails in step 7 | Server or ngrok not running, wrong URL (must end in `/webhook`), or verify token typo |
| `bad signature` in Window 2 | Wrong secret in `.env`. Try the Instagram app secret (step 4), then restart `npm run dev` |
| Nothing at all in Window 2 after a comment | Comment webhooks are blocked by app mode/access. Confirm the commenter is an accepted tester. If still nothing, that's the Advanced Access wall: tell me and we move to App Review prep |
| `comment for unknown account` | Step 8 didn't save, run it again |
| Event `failed` with an error | Send me the error text (not the token) |
| Window 2 shows a MongoDB connection error | Window 1 (`npm run db`) is not running |

When step 10 works (or fails), tell me what you saw. Next: dashboard + Instagram login (Phase 1), or App Review prep if we hit the access wall.
