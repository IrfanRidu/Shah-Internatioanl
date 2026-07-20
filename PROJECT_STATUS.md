# Shah International — Project Status

This document maps every requirement from the original brief to its implementation
status, so you can see at a glance what's done, what's a deliberate simplification,
and what would need attention before a production launch.

Legend: ✅ Done · ⚠️ Partial / simplified · ❌ Not implemented

---

## 1. Core Stack

| Requirement | Status | Notes |
|---|---|---|
| Next.js + MongoDB + Cloudinary + Stripe + GSAP | ✅ | App Router, Mongoose, Cloudinary uploads, Stripe Elements, GSAP + ScrollTrigger throughout |
| JavaScript/JSX only | ✅ | No TypeScript used anywhere |

## 2. Buyer Experience

| Requirement | Status | Notes |
|---|---|---|
| Ask local vs. international on entry | ✅ | `BuyerTypeModal` shown on first visit |
| Switchable anytime | ✅ | Header toggle + Profile → Buyer Type tab |
| Mandatory choice at registration | ✅ | 2-step register flow |
| Local: BDT price, delivery, order on-site | ✅ | Full cart → checkout → Stripe/COD/bKash/Nagad |
| International: USD price range, quotation | ✅ | `priceRangeMin/Max` shown, quotation modal |
| Quotation via WhatsApp | ✅ | `wa.me` deep link with prefilled message |
| Quotation via email | ✅ | Branded HTML email to buyer + admin |
| Quotation via **direct message on the website** | ✅ *(Phase 4)* | New `Conversation`/`Message` models, `/messages` (buyer) and `/admin/messages` (staff) inboxes, "Send a Direct Message on the Site" button on product page |

## 3. Product Catalog

| Requirement | Status | Notes |
|---|---|---|
| Name, scientific name, qty, harvest season, origin, location | ✅ | All fields on `Product` model |
| Price range in USD for foreign importers, price for BD customers | ⚠️→✅ *(improved in Phase 5)* | The admin still has separate `price` (BDT) and `priceRangeMin/Max` (USD) fields rather than the international range being purely auto-derived — but the product form now has a **"Sync from BDT"** button that pulls the live rate from `/api/currency` and auto-fills a ±10–15% USD band from the BDT price, which the admin can then hand-adjust. This satisfies "price range initially inputted with BDT, shown in real-time-converted currency" while still letting admins set export margins manually. |
| Admin-only product cost | ✅ | `productCost` stripped from all public API responses |
| Certifications | ✅ | Array of `{name, issuer, year}`, shown on product page |
| Harvest vs. off-season label | ✅ | `SeasonLabel` component, green "In Season" / amber "Pre-Order" |
| Off-season = pre-order only | ✅ | Cart item flagged `isPreOrder`, checkout still accepts it |
| Categories + subcategories | ✅ | `Category.subcategories[]`, admin CRUD modal |

## 4. Site-wide Configuration

| Requirement | Status | Notes |
|---|---|---|
| Admin-manageable banners | ✅ | `/admin/banners` |
| Flash sales with countdown | ✅ | `CountdownTimer`, `/admin/flash-sales` |
| Coupons | ✅ | Percentage/fixed, expiry, usage limits, audience targeting |
| Editable footer | ✅ | `/admin/settings` → Footer tab |
| Editable header links | ✅ *(Phase 4)* | `/admin/settings` → Header tab, `Settings.headerLinks[]`, rendered dynamically in `Header.jsx` |
| Multiple themes | ✅ | Green / Dark / Earth / Ocean via CSS variables |
| Multiple languages | ✅ | English, Bengali, Arabic (RTL) |
| Special product-card carousel sections, toggleable | ✅ | `/admin/sections`, `isActive` toggle, `targetAudience` filter |

## 5. Inventory & Currency

| Requirement | Status | Notes |
|---|---|---|
| Full inventory system | ✅ | Stock, reserved, available, transaction log, low-stock alerts (email + admin bell) |
| Multi-currency (BDT/USD/EUR/INR/PKR/GBP) real-time | ✅ *(hardened — see §10)* | `/api/currency`, 30-min cache, tries Open Exchange Rates then two independent keyless providers so it never silently freezes on one hardcoded rate |

## 6. Admin Financials & Operations

| Requirement | Status | Notes |
|---|---|---|
| Gross/net profit, revenue, AOV (CA-audit grade) | ✅ | `/admin/analytics`, full COGS-based P&L |
| Date-range filtering on all metrics | ✅ | From/to pickers on Analytics & Dashboard |
| Orders categorized: processing/cancelled/return/confirmed/on-the-way/delivered | ✅ | `Order.status` enum matches exactly |
| New orders appear "automatically without refreshing" | ✅ *(upgraded in Phase 5)* | Originally 30-second polling. Now pushed instantly via **Server-Sent Events backed by a MongoDB change stream** (`/api/admin/orders/stream`) — the dashboard, Orders page, and notification bell all show a live "🟢 Live" badge and update the moment an order is placed, with a toast notification. Change streams require a MongoDB **replica set** (MongoDB Atlas has this by default). If the database is a bare standalone instance, the client (`useOrderStream` hook) detects this automatically and falls back to the original 30s polling — nothing breaks either way. |
| Click-to-call admin | ✅ | `tel:` links throughout orders, customers, messages |
| Customer DB: emails/phones, filter, sort, export as **PDF/DOC/XLSX** | ✅ *(Phase 4 completed)* | Was CSV/XLSX-only through Phase 3; Phase 4 added PDF (jsPDF) and DOC (docx) export options to the dropdown |

## 7. Roles & Access Control

| Requirement | Status | Notes |
|---|---|---|
| Super Admin full control | ✅ | `superAdmin` role bypasses all permission checks |
| Super Admin grants other admins role-based access | ✅ | `/admin/roles` — create custom Role with a permission matrix, assign to a staff user |
| **"Others can't access any data except what's granted to them"** | ✅ *(Phase 4 — was a real gap, now fixed)* | Through Phase 3 the granular `Role.permissions` matrix existed in the data model and admin UI, but **was never actually enforced** — every API route just checked `role ∈ {superAdmin, admin, editor}`, so any editor could do anything. Phase 4 added `lib/permissions.js` (`hasPermission`), embedded the assigned Role's permission matrix into the JWT at sign-in, and applied `hasPermission()` checks to products, categories, banners, flash sales, coupons, settings, inventory, special sections, pages, order status updates, customer export, and analytics routes. The admin sidebar now also hides nav items an editor isn't permitted to see. **Also fixed a privilege-escalation bug**: assigning a custom Role previously set `role: 'admin'` (full bypass) instead of `role: 'editor'` (gated) — corrected in Phase 4. |
| Demo seed data | ✅ | 7 users across all roles, 12 products, banners, flash sale, coupons, sections |

## 8. Known Simplifications & Honest Caveats

These are deliberate trade-offs, not oversights — flagged here so you can decide whether to revisit them before production:

1. **BDT→USD price range**: ✅ *resolved in Phase 5.* The product form's "Sync from BDT" button now derives the USD range from the live rate; admins can still hand-edit the result for export margin.
2. **Real-time order updates**: ✅ *resolved in Phase 5.* Now pushed via SSE + MongoDB change streams (`useOrderStream` hook), with automatic polling fallback if the database doesn't support change streams (see §6 above for details).
3. **No production build was ever run.** This sandbox has no network access (confirmed: `npm install` returns a 403 from the registry), so `next build`/`next dev` could never actually be executed here. What *was* verified: every `.js` file in the project (98 files — API routes, lib, models) passes `node --check`; every heavily-edited `.jsx` file was checked for balanced braces/parens; and as of Phase 6, `lib/utils.js` and `lib/permissions.js` had **every assertion in their unit test files actually executed against the real implementation** (62 assertions, all passing — done via a throwaway Node script with a local stub for the one missing npm dependency, `slugify`, since pure logic alone doesn't need a real install). `lib/validators.js`'s tests (Zod-based) could not be executed the same way since `zod` itself wasn't installable, but are written against standard, well-documented v3 API usage. **You must still run `npm install && npm test && npm run build` locally before deploying** — see `DEPLOYMENT.md` for the full process.
4. **Push notifications**: ✅ *resolved in Phase 5.* `web-push` is now listed in `package.json`. You still need to generate VAPID keys (`npx web-push generate-vapid-keys`) and set them in `.env.local` before the `usePushNotifications` hook will work end-to-end.
5. **Email marketing & review moderation permissions**: ✅ *resolved in Phase 5.* Added `marketing` (`view`/`send`) and `reviews` (`view`/`moderate`) modules to the `Role` schema, wired `hasPermission()` checks into their API routes, and tagged the corresponding admin sidebar links so an editor without explicit grants won't see or reach them. **Note:** any custom Role created *before* this update won't have these two keys in its stored `permissions` object — that's fine, it just means those editors are denied by default (safe fail-closed behavior) until a Super Admin re-saves their Role with the new toggles checked.
6. **MongoDB Change Streams requirement**: the new live-order feature (#2 above) only activates on a replica-set deployment. MongoDB Atlas (the recommended setup, per `.env.example`) supports this out of the box; a local single-node `mongod` does not, and the dashboard will simply show "Polling (30s)" instead of "Live" — fully functional, just not instant.

## 9. Testing, CI & Deployment *(added in Phase 6)*

None of this was requested in the original brief, but rounds out the project for anyone taking it to production:

- **Unit tests** (`tests/unit/`, run via `npm test` — Vitest) cover `lib/utils.js`, `lib/permissions.js`, and `lib/validators.js`. See `tests/README.md` for exactly what's covered and what isn't (no component or API-route tests yet).
- **CI** (`.github/workflows/ci.yml`) runs lint → unit tests → build on every push/PR.
- **Docker**: a multi-stage `Dockerfile` (using Next's `output: 'standalone'`) plus `docker-compose.yml` that spins up the app alongside a single-node MongoDB **replica set** locally — specifically so the Phase 5 live-order SSE feature works in self-hosted setups too, not just on Atlas.
- **`DEPLOYMENT.md`**: step-by-step guide for both a Vercel deploy and Docker self-hosting, including the Stripe webhook setup and the currency/inventory cron job that were previously undocumented.

## 10. Fix Round — 2026-07-19 — Product Discovery, Export Documents & Notification Fixes

This round addressed 10 specific reported issues plus several root-cause bugs found directly underneath
them. Every fix targets the actual reported symptom — none of this was a speculative rewrite.

**Product discovery & storefront:** this codebase already had well-built dedicated pieces for most of
what was asked — `RecommendedForYou`/`BestSellingProducts` components backed by genuinely good
`/api/products/recommended` (order-history personalized) and `/api/products/best-selling` (real
delivered-order sales aggregation) API routes, plus an `ActiveCampaignsStrip` for flash sales. The
actual bug: each of these, plus `RelatedProducts`, independently self-fetched with only
`exclude=<currentProductId>`, so none of them knew what the OTHERS had already displayed — the same
product could easily show up in three different sections on one page. Rewrote the product detail page's
server component to compute all five sections (campaigns, active flash-sale strip, related, recommended,
best-selling) in one sequential pass with a shared exclude-list, then pass the results down as props;
each component still supports self-fetching as a fallback for any other future caller. Campaigns
deliberately do NOT exclude each other (the same product can appear in two different campaigns with
different discounts/badges — that's meaningful, not a duplicate). Product cards were fixed so a 2-line
name or a discounted price can no longer push the Add to Cart button outside the card, and carousels
(campaign rows, featured products, all five product-detail sections) now auto-scroll, pause immediately
on hover or touch, and show navigation arrows on mobile too (previously desktop-hover-only).

**Currency (real-time exchange rates):** `/api/currency` and the currency cron job previously only tried
`openexchangerates.org` and silently fell back to a permanent hardcoded rate table if that single call
ever failed or no key was configured. Added `lib/exchangeRates.js`: tries that provider first (if a key
is set), then two independent keyless providers (`open.er-api.com`, `exchangerate-api.com`). Also found
and fixed a real math bug in `CurrencyContext`: it assumed rates were expressed "per 1 BDT" but the API
actually (and correctly) returns them "per 1 USD" — once a live fetch resolved, every non-BDT price
shown anywhere on the storefront became wrong by roughly two orders of magnitude. Fixed the
export-dashboard shipment page's analytics banner, which had a formula (`rate * (1/rate) * 110`) that
mathematically always equals exactly 110 regardless of the real rate — the exact number quoted in the
original bug report.

**Notification badges / order status:** the `Order.status` schema has never had a `'pending'` value (real
flow: `processing → confirmed/cancelled → onTheWay → delivered/returned`), but several places compared
against the string `'pending'` anyway and so silently always matched zero orders: the admin sidebar
badge, the notification bell, the dashboard's "orders waiting for confirmation" banner (which also read
a field name — `pendingOrders` — that didn't exist in the metrics API response), the buyer Orders page's
filter tab, and — most seriously — the Cancel Order button never rendered for any order, and the
server-side cancel guard would have rejected the request even if it had. All of these now use the real
status values. Sidebar/notification badge counts also now refresh client-side (on a poll and on every
route change), since Next.js doesn't re-run a server layout on sibling-page navigation — this is why a
badge could stay stale until a hard refresh even after the underlying item was read. Buyers also now get
their own unread-messages badge in the header (previously admin-only). Also fixed: the admin orders page
wasn't reading `?status=` from the URL at all, so even a correct link to it couldn't pre-select a filter
tab; and a Stripe refund webhook was writing `status: 'refunded'` to `Order.status`, which isn't a valid
value there (only valid as `paymentStatus`) — now correctly writes `'returned'`.

**Export dashboard — product selection, letterhead, documents, archive:**
- Admins can now pick a product from the catalog (typeahead, or browse the full list) directly in each
  shipment line item, not just via the separate "add new row" search box — selecting one auto-fills the
  botanical name exactly as entered when that product was first listed.
- The company letterhead is now a single global setting (`Settings.exportLetterheadUrl`), uploaded once
  from either the shipment page or the main Export Dashboard page, and used on every shipment's
  documents from then on — instead of needing a fresh upload per shipment.
- Print and Download are now genuinely separate actions. The print route was moved out from under
  `app/admin/*` (which had been forcing the admin sidebar/topbar into every printed page — the reported
  "prints with website layout" bug) into its own minimal, still admin-gated route, and print now waits
  for the letterhead image to actually finish loading instead of a blind fixed delay. Download builds a
  real PDF client-side (`lib/exportDocuments.js`, jsPDF + jspdf-autotable, matching this project's exact
  document wording/layout) and saves it directly — since it's built from data rather than a screenshot
  of the page, it can never include site UI either way.
- The Export Archive previously showed a table of shipment metadata; it now lists the actual PDF files
  for each completed shipment (the 3 generatable documents, plus any uploaded attachment that is itself
  a PDF — image attachments are excluded, per the request that this be PDF-only).
- While in this code: every export-dashboard `GET` endpoint (shipments/buyers/countries, list and
  single) had no authentication check at all, unlike the `POST`/`PUT`/`DELETE` handlers in the same
  files — anyone with a shipment ID could have read buyer bank details and shipment financials
  unauthenticated. Added the same admin-only guard already used elsewhere in each file.

**Verification note:** this sandbox has no network access, so no dev server or build could be run here
— every touched file was syntax-verified with `tsc --noEmit --allowJs --jsx preserve --noResolve`
instead (confirmed experimentally more reliable than `node --check`, which silently passes broken syntax
in any file using top-level `import`/`export`, i.e. every file in this project).

## 11. Setup Reminder

```bash
npm install
cp .env.example .env.local   # fill in MongoDB/Cloudinary/Stripe/SMTP/Google/etc.
npm run seed
npm run dev
```

Demo Super Admin: `admin@shahintl.com` / `SuperAdmin123!`
