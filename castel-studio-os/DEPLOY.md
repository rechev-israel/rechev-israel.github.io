# Deploy CASTEL STUDIO OS to Vercel — from an iPhone

Everything below works in **Safari on iPhone**. No computer or terminal needed.
Takes about 10 minutes. Cost: Vercel Hobby + Neon Free plans are $0.

> **Branch:** the app lives on branch `claude/castel-studio-ai-os-976xw1`, in the folder `castel-studio-os/`.
> The repository's `main` branch is the separate car-dealership website. It is **not touched**.

---

## 1. Create the Vercel project

1. Open **https://vercel.com/signup** in Safari → **Continue with GitHub** → authorize.
   If asked, install the Vercel GitHub app and allow access to `rechev-israel/rechev-israel.github.io`.
2. Tap **Add New… → Project** → next to `rechev-israel.github.io` tap **Import**.
3. On the configure screen leave everything as is and tap **Deploy**.
   This first deployment builds `main` (the car site). That's expected and harmless. We switch it in step 3.
   Don't open or share that first URL.

## 2. Add the PostgreSQL database (Neon)

1. In the project, tap the **Storage** tab → **Create Database** → **Neon** (Serverless Postgres) → **Continue**.
2. Region: **Frankfurt (eu-central-1)**, the closest to Israel. Plan: **Free**. Tap **Create**.
3. When asked to connect it to the project, keep **all environments** checked → **Connect**.

This automatically adds `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct, used only for migrations).
Don't copy or paste these anywhere.

## 3. Point the project at the app

**Settings → Build and Deployment** (on some accounts this is under **General**):
- **Root Directory** → **Edit** → type `castel-studio-os` → **Save**.
- **Framework Preset** should read **Next.js**. If it doesn't, choose it.
  Leave the build and install commands on default: `vercel.json` sets them.

**Settings → Environments → Production → Branch Tracking** (older UI: **Settings → Git → Production Branch**):
- Set the branch to `claude/castel-studio-ai-os-976xw1` → **Save**.

## 4. Environment variables

**Settings → Environment Variables** → add each one below for **Production** and **Preview**:

| Name | Value | Required |
|---|---|---|
| `SETUP_TOKEN` | A long random secret (20+ characters). To make one on iPhone: **Passwords app → + → generate a strong password → copy**. Keep it until step 6. | **Yes** |
| `ANTHROPIC_API_KEY` | Your key from platform.claude.com. Add it now or later. Without it the AI Agents page shows "Not configured". | Optional |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` (this is already the default) | Optional |
| `SESSION_TTL_DAYS` | `14` (default) | Optional |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | **Added by Neon in step 2. Don't edit them.** | Auto |

Never put keys in the code, the chat or GitHub. Vercel environment variables are the only place for them.

## 5. Deploy the app

**Deployments** tab → **Create Deployment** (top right; on a narrow screen it may be in the **⋯** menu) →
type the branch `claude/castel-studio-ai-os-976xw1` → **Create Deployment**.

The build runs three steps:
1. `prisma generate`
2. `prisma migrate deploy`: creates the tables. It only applies new migrations and never deletes data.
3. `next build`

Wait for **Ready** (about 2–3 minutes). If it fails, open the deployment → **Build Logs**, copy the red lines and paste them to Claude.

From now on, every push to that branch redeploys automatically.

## 6. Open it and create your owner account

1. Tap **Visit**, or open `https://<your-project>.vercel.app` in Safari.
   Vercel shows the exact domain on the project's main page.
2. On a fresh database you are taken to **/setup**:
   - Paste your `SETUP_TOKEN`.
   - Enter your name, email and a password (10+ characters, letters and digits).
   - Tap **יצירת חשבון בעלים**.
3. You're signed in. Setup **locks itself** as soon as an owner exists.
   You can then delete `SETUP_TOKEN` from Vercel if you want.
4. **Install it as an app (PWA):**
   - **iPhone/iPad (Safari):** **Share** → **Add to Home Screen**.
   - **Android / desktop Chrome or Edge:** tap the gold **Install** button in the app's top bar, or use the install icon in the address bar.
   It opens full-screen with the CASTEL icon. The same URL works in any browser, on desktop, tablet and phone.

Public academy page to share on Instagram: `https://<your-project>.vercel.app/join`
Health check: `https://<your-project>.vercel.app/api/health` should show `{"ok":true,"db":"up"}`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build log: `No database configured` | Step 2 wasn't connected to this project. Go to Storage → Neon → Connect Project, then redeploy. |
| `/setup` says "Setup is locked" | Add `SETUP_TOKEN` (step 4), then **Redeploy**. Env changes need a redeploy. |
| 404 / car website shows | Root Directory or Production Branch not set (step 3). Fix it and do step 5 again. |
| AI Agents shows "Not configured" | Add `ANTHROPIC_API_KEY`, then redeploy. |

## Notes

- Region `fra1` (Frankfurt) is set in `vercel.json` so the app and the database sit close together.
- The login rate limiter is in-memory per server instance. That's fine for one owner, but use a shared store before going high-traffic.
- `npm run jobs` (nightly maintenance) isn't scheduled on Vercel yet. That comes with the automation phase. Segments can be recomputed any time with the CRM button.
