# Shah International – E-Commerce Platform

> Premium farm-fresh vegetables & fruits export platform — multi-buyer, multi-currency, multi-language.

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Environment variables
Copy `.env.example` to `.env.local` and fill in your values:
```bash
cp .env.example .env.local
```

Required keys:
| Key | Description |
|-----|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `NEXTAUTH_SECRET` | Random 32+ char string |
| `NEXTAUTH_URL` | `http://localhost:3000` for dev |
| `CLOUDINARY_*` | Cloudinary account credentials |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe public key |
| `SMTP_*` | Email (Gmail app password recommended) |
| `OPEN_EXCHANGE_RATES_APP_ID` | Free at openexchangerates.org |

### 3. Seed the database
```bash
npm run seed
```

### 4. Run development server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| **Super Admin** | admin@shahintl.com | SuperAdmin123! |
| **Admin** | manager@shahintl.com | Admin123! |
| **Editor** | editor@shahintl.com | Editor123! |
| **Local Buyer** | rahul.bd@test.com | Test123! |
| **Local Buyer** | fatima.bd@test.com | Test123! |
| **Int'l Buyer** | john.importer@test.com | Test123! |
| **Int'l Buyer** | sarah.eu@test.com | Test123! |

**Coupon Codes:** `WELCOME10` · `FRESH20` · `SAVE100`

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Database | MongoDB + Mongoose |
| Auth | NextAuth.js v4 |
| Images | Cloudinary |
| Payments | Stripe |
| Animations | GSAP + ScrollTrigger |
| Styling | Tailwind CSS |
| State | Zustand + React Context |
| Charts | Recharts |
| Emails | Nodemailer |

---

## 📁 Project Structure

```
shah-international/
├── app/
│   ├── (auth)/          # Login, Register
│   ├── (shop)/          # Home, Products, Cart, Checkout, Orders, Profile
│   ├── admin/           # Full admin panel
│   └── api/             # All API routes
├── components/
│   ├── ui/              # Reusable UI components
│   ├── layout/          # Header, Footer, Sidebar, BuyerTypeModal
│   ├── product/         # ProductCard, PriceDisplay, SeasonLabel
│   ├── home/            # Hero, FeaturedProducts, FlashSale, SpecialSection
│   └── animations/      # GSAP wrappers
├── contexts/            # Theme, Language, Currency, Cart, BuyerType
├── lib/                 # MongoDB, Cloudinary, Stripe, Auth, Email, Utils
├── models/              # All Mongoose models
├── translations/        # en.js, bn.js
├── scripts/             # seed.js
└── middleware.js        # Auth-based route protection
```

---

## ✨ Key Features

- 🌍 **Dual Buyer Mode** – Local (BDT + delivery) vs International (USD + quotation)
- 💱 **Live Currency** – Real-time rates for BDT, USD, EUR, GBP, INR, PKR
- 🌿 **Season Labels** – Harvesting / Off-Season with pre-order support
- 🛡️ **Role-Based Access** – Super Admin controls all; granular permissions per role
- 📊 **Full Analytics** – Revenue, COGS, Gross/Net Profit, AOV, Top Products
- ⚡ **Flash Sales** – Countdown timers, limited stock offers
- 🏷️ **Coupons** – Percentage/fixed, expiry, usage limits
- 📦 **Inventory Management** – Stock tracking, alerts, adjustment log
- 📱 **WhatsApp Integration** – Direct quotation via WhatsApp
- 🎨 **Multi-Theme** – Green, Dark, Earth, Ocean
- 🌐 **Multi-Language** – English, Bengali (extensible)
- 📈 **Admin Dashboard** – Real-time orders (auto-refresh 30s), click-to-call
- 📤 **Customer Export** – CSV export for marketing

---

## 🧪 Testing & Deployment

```bash
npm test              # run the unit test suite (Vitest)
npm run test:watch    # watch mode
npm run build          # production build
docker compose up --build   # or self-host via Docker — see DEPLOYMENT.md
```

- **`PROJECT_STATUS.md`** — a requirement-by-requirement audit against the original spec: what's done, what's a deliberate simplification, and why.
- **`DEPLOYMENT.md`** — step-by-step guide for deploying to Vercel or self-hosting with Docker, including Stripe webhook and cron-job setup.
- **`tests/README.md`** — what the unit test suite covers (and doesn't).

## 🔄 Build History

This project was built iteratively across several phases — foundation (models/API/admin panel/storefront), payments & email, PWA & advanced analytics, on-site messaging & granular RBAC enforcement, real-time order updates via SSE, and finally a test suite + CI/Docker deployment setup. See `PROJECT_STATUS.md` for the full breakdown of what each phase covers.
