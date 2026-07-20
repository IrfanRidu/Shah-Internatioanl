# Deployment Guide

Two supported paths: **Vercel** (simplest, recommended for most cases) or **Docker** (self-hosted, full control). Both need the same external services configured first.

---

## 1. External services to set up first

| Service | What it's for | Where to get it |
|---|---|---|
| **MongoDB Atlas** | Database. Use a free M0 cluster or larger. **Must be a replica set** (Atlas clusters are by default) for the Phase 5 live-order feature (Change Streams) to work — a bare standalone `mongod` will silently fall back to 30s polling instead. | mongodb.com/atlas |
| **Cloudinary** | Product/banner image uploads | cloudinary.com → Dashboard for cloud name/key/secret |
| **Stripe** | Card payments | dashboard.stripe.com → Developers → API keys |
| **SMTP (e.g. Gmail App Password)** | Order/quotation/message emails | A Gmail account with 2FA + an "App Password", or any SMTP provider |
| **Google OAuth** *(optional)* | "Continue with Google" login | console.cloud.google.com → Credentials → OAuth Client ID |
| **Open Exchange Rates** *(optional)* | Live currency conversion | openexchangerates.org (free tier is fine) |
| **VAPID keys** *(optional)* | Web push notifications | run `npx web-push generate-vapid-keys` locally |

Copy `.env.example` → `.env.local` and fill in every value before either deployment path.

---

## 2. Option A — Deploy to Vercel (recommended)

1. Push this repo to GitHub/GitLab/Bitbucket.
2. Import the repo at vercel.com/new.
3. In **Project Settings → Environment Variables**, paste in every key from your `.env.local` (for Production, and Preview if you want preview deploys to work too). Set `NEXTAUTH_URL` to your production domain (e.g. `https://shahintl.com`).
4. Deploy. Vercel auto-detects Next.js — no build command changes needed (the `output: 'standalone'` setting in `next.config.js` is harmless on Vercel; it's only consumed by the Dockerfile).
5. **Stripe webhook**: in the Stripe Dashboard, add an endpoint at `https://your-domain.com/api/payment/webhook`, subscribe to `payment_intent.succeeded`, `payment_intent.payment_failed`, and `charge.refunded`, then copy the generated signing secret into `STRIPE_WEBHOOK_SECRET` in Vercel's env vars and redeploy.
6. **Cron jobs**: add a `vercel.json` with a Cron entry to hit `/api/cron/update-currency` (see below) on a schedule, e.g. hourly — Vercel Cron Jobs are free on most plans for low-frequency jobs.
7. Run the seed script once from your local machine, pointed at the production `MONGODB_URI`:
   ```bash
   MONGODB_URI="<your atlas uri>" node scripts/seed.js
   ```
   (Only do this against a fresh database — `seed.js` wipes existing collections first.)

### Example `vercel.json` for the currency/inventory cron
```json
{
  "crons": [
    { "path": "/api/cron/update-currency", "schedule": "0 * * * *" }
  ]
}
```
This endpoint checks `Authorization: Bearer $CRON_SECRET` — Vercel Cron automatically sends this header when `CRON_SECRET` is set as an env var, matching what's in `app/api/cron/update-currency/route.js`.

---

## 3. Option B — Docker self-host

```bash
cp .env.example .env.local   # fill in every value
docker compose up --build
docker compose run --rm seed # first run only — seeds demo data
```

The app is now at `http://localhost:3000`.

- `docker-compose.yml` runs a **single-node MongoDB replica set** (not a bare standalone instance) specifically so the live-order SSE feature works out of the box. If you point `MONGODB_URI` at your own external MongoDB instead, make sure it's also a replica set (or Atlas) for the same reason — otherwise the app still works fine, it just falls back to 30s polling for the admin order list.
- For a real production deployment behind a domain, put this behind a reverse proxy (Caddy, nginx, Traefik) for TLS termination, and point `NEXTAUTH_URL` at the public HTTPS URL.
- The Stripe webhook and cron-job setup steps are the same as the Vercel path above — just point them at your own domain, and run the cron endpoint via your own scheduler (cron, systemd timer, etc.) instead of Vercel Cron:
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/update-currency
  ```

---

## 4. Post-deploy checklist

- [ ] Log in as the seeded Super Admin (`admin@shahintl.com` / `SuperAdmin123!`) and **change the password immediately**, or better, create a new Super Admin and deactivate the seed account.
- [ ] Replace all seeded demo products/banners/coupons with real data.
- [ ] Verify the Stripe webhook is receiving events (Stripe Dashboard → Developers → Webhooks → your endpoint → recent deliveries).
- [ ] Send a test order end-to-end (place order → confirmation email → admin sees it on the dashboard, ideally with the "🟢 Live" badge if your MongoDB is a replica set).
- [ ] Confirm the dashboard shows "🟢 Live" rather than "Polling (30s)" if you expect Change Streams to work (Atlas/replica-set only).
- [ ] Run `npm run test` and `npm run build` locally at least once before going live — this sandbox environment could not execute either (no network access), so they have not been run against the real `node_modules` yet. See `PROJECT_STATUS.md` §8 for exactly what was and wasn't verified.
