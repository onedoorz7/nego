# Deploying the test environment

Goal: a private URL you can open on your phone and share with a few testers.

## Why not Vercel (yet)

The app stores sessions/progress in **SQLite on disk** (`data/nego.db`). Vercel's
serverless filesystem is ephemeral, so data would vanish between requests. We'd
first have to swap SQLite for a hosted DB (Postgres/Turso) — planned for Phase 4,
not worth it for the first test environment. Instead, use any host that runs a
**persistent Node server with a disk volume**. The repo ships a `Dockerfile` and
pins Node ≥ 22.5 (`engines` + `.nvmrc`) so these hosts pick a compatible runtime.

## Access protection (already built in)

Set the env var `NEGO_ACCESS_CODE=<anything you like>` and the whole site
(pages *and* API, including `/admin`) requires that code once per device — a
small gate page asks for it and sets a 1-year cookie. Without the env var
(e.g. local dev) there is no gate. **Do not put the app online without it** —
`/admin` exposes transcripts and hidden scenario values, and `/api/*` would
otherwise let anyone burn your Anthropic credits.

## Option A — Railway (recommended, ~5 minutes)

1. Log in at railway.app with GitHub → **New Project → Deploy from GitHub repo**
   → pick `onedoorz7/nego`.
2. In the service **Settings → Source**, set the branch you want to deploy
   (e.g. `main` after merging, or the feature branch directly).
   Railway detects the `Dockerfile` automatically.
3. **Variables** — add:
   - `NEGO_ACCESS_CODE` = your chosen code
   - `ANTHROPIC_API_KEY` = your key (optional but recommended — otherwise the
     opponent speaks in mock templates)
   - `NEGO_DATA_DIR` = `/data`
4. Right-click the service → **Attach volume**, mount path `/data`
   (this is what makes progress/sessions survive restarts and deploys).
5. **Settings → Networking → Generate domain** → you get
   `https://<something>.up.railway.app`.
6. On your phone: open the URL, enter the access code once, add to home screen.

Each `git push` to the selected branch redeploys automatically.

## Option B — Render

Same idea: **New → Web Service** from the repo (it uses the Dockerfile),
add the same env vars, and attach a **Disk** mounted at `/data`
(disks need the paid Starter instance; the free tier loses data on restarts).

## Option C — Fly.io / any VPS

`fly launch` picks up the Dockerfile; create a volume and mount it at `/data`
(`fly volumes create nego_data`), set secrets with `fly secrets set`.
On a plain VPS: `docker build -t nego . && docker run -p 3000:3000 -v nego-data:/data -e NEGO_ACCESS_CODE=... nego`.

## Testing on your phone without deploying

While developing: run `npm run dev` on your computer and open
`http://<your-computer's-LAN-IP>:3000` on a phone on the same Wi-Fi
(find the IP with `ipconfig` / `ifconfig`). No gate needed locally.

## Env var reference

| Variable | Required online? | Purpose |
| --- | --- | --- |
| `NEGO_ACCESS_CODE` | **Yes** | Gates the whole site behind a shared code |
| `ANTHROPIC_API_KEY` | Recommended | Natural dialogue + AI coaching |
| `NEGO_MODEL` | No (default `claude-opus-4-8`) | Dialogue/coaching model |
| `NEGO_PROVIDER` | No (default `auto`) | Force `mock` to test without spend |
| `NEGO_DATA_DIR` | Yes with Docker (`/data`) | Where `nego.db` lives — must be on the volume |
| `NEGO_UNLOCK_ALL` | No | `1` unlocks all content for testing |

## Notes for this stage

- One shared progress profile: everyone using the URL plays the same "user".
  Fine for founder + a couple of testers; real accounts are Phase 4.
- Usage limits: none beyond the access code. Watch Anthropic console spend if
  you share the code more widely.
- Back up the test data anytime via `/api/admin/export?format=json`.
