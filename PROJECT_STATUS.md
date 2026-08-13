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

## 11. Fix Round — 2026-07-27 — Campaign Display, Auto-Season, Coupons & Financials

This round addressed 14 specific reported issues. As with the previous round, several turned out to
have a precise, narrow root cause once traced through fully rather than needing a rewrite.

**Campaign display & pricing (product page + homepage):** the product-detail page's "Active
Campaigns" strip rendered one generic link-card per campaign — a badge, a countdown timer, and "N
products on offer" text — with no actual product image, name, or price shown anywhere, which is
exactly what was reported. Rebuilt it to reuse the homepage's `FlashSaleSection` component directly
(real product cards, auto-scroll that pauses on hover/touch, full campaign branding) instead of
duplicating that logic a second time. While in this code: a campaign's own sale price was
unconditionally overwriting a product's price even when the product's own discount was better
(fixed with a shared `getEffectivePricing` helper that always uses whichever discount is bigger, per
the request); international buyers previously never saw a discounted price at all inside a campaign
(no range-with-discount concept existed) — `PriceDisplay` now supports one when a campaign context is
present. Also found that a campaign/section restricted to local-only or international-only buyers
(`targetAudience`) was never actually filtered out anywhere it rendered — the check existed in one
unreachable code path — now enforced everywhere campaigns and special sections appear, server-side
for signed-in buyers and client-side for guests (matching the existing per-product visibility split).

**Homepage restructure:** added dedicated "Currently Harvesting" and "Available for Pre-Order"
sections plus one section per category, alongside the existing Featured/campaign/special-section
content. A single sequential exclude-set is threaded through every section's query so no product can
repeat anywhere on the page — including between campaigns and special sections themselves, which are
fetched in parallel and so needed their own explicit cross-filter to avoid overlapping.

**Auto harvesting season & shelf life:** "currently harvesting" was a manually-set toggle an admin
had to remember to flip on a schedule. There's no cron/scheduler in this project, so instead of a
periodic job, the stored flag now self-heals from real traffic: a cheap bulk correction runs on the
highest-traffic product-list endpoint (a true no-op once already in sync), and single-product reads
(direct links) correct themselves in-memory immediately with a background write to catch the
database up too. Every manual "mark as in season" control (the admin form's toggle, a per-row button,
and a bulk action) was removed — the only input now is which months a product harvests in. Shelf life
changed from a free-text field (admin had to remember to type a unit) to a plain number of days,
auto-formatted as "X days" everywhere it's shown.

**Coupons:** the model already supported per-product restriction and a per-user usage cap, but neither
was ever exposed in the admin form, and the actual order-placement endpoint — the only point that can
authoritatively enforce anything, since the pre-flight "validate" check can simply be bypassed —
never checked the overall usage limit, the per-user limit, or product restriction at all, and only
ever tracked total usage count (a user's own usage was never recorded anywhere despite the schema
having a field for it). Added a product search/multi-select picker and a usage-per-user field to the
admin form, and implemented real enforcement at both the pre-flight and the authoritative point.

**Export documents & financials:** the "Additional Documents" uploader on a shipment's Other Details
tab accepts PDF and image files, but the per-shipment merged "All Documents" PDF only ever included
PDF-type attachments — any uploaded JPG/PNG was silently absent from the merged file with no trace.
Fixed by embedding image attachments as their own page in the merge (scaled to fit, not upscaled)
alongside the existing PDF-page-copying path. Freight Cost was hardcoded as always being in BDT
(explicitly labeled that way in the UI) while being summed directly into Total Cost; it's now treated
the same way Order Value already was — entered in the shipment's own base currency, converted to BDT
via that shipment's own exchange rate before being included in any BDT total, with the same
conversion also applied to the Export Analytics dashboard's Freight Cost column (which had the same
assumption baked in for its own currency-converted display).

**Verification note:** this sandbox has no network access and no node_modules, so no dev server,
build, or `tsc` could be run here (unlike, apparently, whatever produced section 10's note above —
this session confirmed zero node_modules from the very first command run). Built a small
dependency-free syntax checker instead (`/home/claude/verify.py`): balanced brackets/braces/parens
ignoring string/comment contents, plus a brace-depth-aware JSX tag-balance scanner (a first, naive
regex attempt produced false positives on this codebase's common `onClick={() => {...}}` pattern,
since `=>` contains a literal `>` — fixed by tracking brace depth while scanning for a tag's true
end). Verified against known-good files and deliberately-broken test copies before trusting it, and
also caught a real bug in the tool itself mid-batch (plain JSX text like "today's" was being
misread as a string literal) — fixed and re-verified everything already checked up to that point.
Every plain `.js` file (no JSX) was additionally checked with `node --check`, a real parser.

## 12. Fix Round — 2026-07-28 — Export Dashboard Settings System

This round built an entirely new configuration layer for the Export Dashboard rather than fixing
existing behavior: five admin-managed settings sections (CTN sizes, shipment logistics option
lists, bank accounts, export licenses, and export categories/incentive rates), each wired into the
shipment editor so picking a saved entry auto-fills the relevant fields instead of the admin
re-typing the same bank details or TIN/BIN on every shipment.

**CTN sizes & gross weight.** "Pack Size (KG)" is renamed "CTN Size (KG)" throughout the packing
list, buyer's invoice, and BD invoice, and now suggests the admin's saved CTN Configuration entries
while typing. Each item row's total CTN weight is calculated automatically from the matching saved
entry's weight; summed across every row plus the total net weight gives an "estimated gross
weight," which is what Gross Weight starts out as on every document. Gross Weight stays freely
editable at any time — editing it never touches the estimate, and a shipment saved before this
existed keeps whatever Gross Weight it already had rather than that value silently changing the
first time the shipment is opened.

**Bank accounts & export licenses.** Both are now saved, reusable entities instead of re-typed per
shipment: picking a saved bank account fills in its account number, branch, address, routing
number, and SWIFT code (all independently editable afterward); picking a saved export license
fills in TIN and BIN, and that license's own letterhead becomes the one used on that shipment's
documents specifically, taking priority over the global company letterhead everywhere a document
can be generated or downloaded — the shipment editor, the print view, and the bulk archive
download all resolve this the same way.

**Export categories & incentive.** A single "Export Category" concept now serves three purposes at
once: it carries the incentive/tax rates and flat costs used to calculate a shipment's incentive
the moment a category is picked, it's the field a buyer's shipment list can now be filtered by (an
"All" tab plus one tab per category actually in use for that buyer), and its image now appears on
each shipment's card in place of a generic box icon.

**Shipment Details tab.** The tab formerly labeled "Other Details" is renamed "Shipment Details"
and now opens by default (previously "Packing List" did); the shipment's own identifying fields
(shipment/contract/invoice numbers, dates, TIN/BIN/ERC/EXP/AWB/PC) moved into this tab from a
separate always-visible block above the tabs, matching how the feature's own request already
referred to TIN/BIN as living inside it.

**Verification note:** same dependency-free approach as the July 27 round — `/home/claude/verify.py`
(bracket/JSX-tag balance) plus `node --check` on every plain `.js` file, run after every individual
edit rather than only at the end, given how many interdependent pieces this round touched.

## 13. Fix Round — 2026-08-01 — Shipment Details as Master Record, Category-Driven Document Formats

**Architecture change: single source of truth.** The shipment editor previously stored THREE
independent product tables (`items` for Packing List, `buyerItems` for Buyer's Invoice, `bdItems`
for BD Invoice) that the admin had to fill in separately, with no guarantee they'd agree with each
other. `items`, entered once in the Shipment Details tab, is now the ONE master table — Packing
List and Buyer's Invoice are read-only views computed directly from it (so they structurally can't
disagree with Shipment Details anymore), and BD Invoice keeps its own small, independently-editable
set of consolidated override rows (per its own spec — it shows the shipment as one or a few
HS-code-level lines, not one row per product), auto-seeded once from the Export Category + the
master table's totals and then freely editable from there. `buyerItems` stays in the schema
untouched for backward compatibility with pre-existing shipments, but is no longer read or written.

**Category-driven document formats.** Different export categories need different Packing List /
Buyer's Invoice / BD Invoice column layouts (e.g. Fresh Fruits & Vegetables vs. some other product
type) — one fixed format doesn't fit every category. Each ExportCategory now owns a
`documentColumns` config (which optional columns — HS Code, Pack Size, Total CTN, Quantity, Unit
Price, Average Price, Total Value — appear on each of the 3 documents, chosen via checkboxes),
defined in `lib/exportColumns.js` as the shared registry read by the category editor, the shipment
editor's document tabs, and both PDF/print generators alike. New shipments with no category picked
yet fall back to the full default set (the "Fresh Fruits and Vegetables" reference format) so
nothing is ever blank or broken pre-selection.

**Export Category elevated to the dashboard's central concept.** Pulled out of the generic Settings
tab page into its own first-class page (`/admin/export-dashboard/categories`), now first in the
dashboard's top nav (Settings kept the remaining 4 sections: CTN Config, Shipment Configuration,
Bank Accounts, Export Licenses).

**New fields:** REX No (Shipment Identifiers, auto-fills from the selected Export License, used in
the Buyer's Invoice's GSP declaration as "BDREX{number}" — previously hardcoded as "04343"),
per-product HS Code (Shipment Details table + Product catalog, for auto-fill), Average Price
(derived, never stored — always `totalValue ÷ quantityKg`, so it can't drift out of sync), Exporter
Name/Address (Settings, replacing text that was hardcoded in 4+ places across the print/PDF code).

**Cross-document consistency check.** Since Packing List and Buyer's Invoice are now structurally
guaranteed to match Shipment Details (same underlying data), the only place genuine drift can occur
is BD Invoice's independently-editable rows — a red warning banner in that tab compares its own
Total CTN / Net Weight / Total Value against Shipment Details' true totals and explains exactly
what doesn't match, whenever they diverge beyond a small rounding tolerance.

**Print/PDF output overhaul.** Both the print-preview page and the downloadable-PDF generator were
rebuilt to a plain, formal, black-border/white-background layout matching reference documents the
project owner provided (previously used dark-filled table headers, a colored banner, and
zebra-striped rows even in "plain A4" mode, which didn't match at all). Fixed along the way: BD
Invoice's heading was "Bangladeshi Invoice", now correctly "Commercial Invoice"; BD Invoice was
showing the long BDREX/GSP declaration paragraph (that belongs to Buyer's Invoice only) instead of
the simple declaration it should share with Packing List; Invoice No was missing entirely from the
printed header block on all 3 documents.

**Settings-goes-empty-after-refresh investigation.** Re-investigated from scratch rather than
trusting the previous round's inconclusive theory. Ruled out Next.js route caching (already
`force-dynamic`) and every component-level fetch/save path (all read correct, complete data).
Applied a concrete hardening fix regardless of the exact historical cause: the Settings PUT route
now flattens nested config objects (contact/social/payment/exportShipmentOptions) into explicit
dot-notation `$set` paths instead of `$set`-ing each whole nested object in one shot — the most
unambiguous update MongoDB/Mongoose supports, removing any possible whole-object-casting edge case.
Confirmed the *other* half of this bug report (Settings page always reopening on the CTN
Configuration tab after a refresh) was already fixed in the previous round via a URL `?tab=` param.

**Verification note:** this round had a real global TypeScript install available
(`/home/claude/.npm-global/bin/tsc`) usable as a genuine syntax/JSX parser without needing the
project's own `node_modules` — a more reliable check than the dependency-free heuristic scripts
prior rounds had to build, run after every single edit rather than batched. Manual full-file
re-reads (tsc cannot catch these) still caught three real bugs a syntax check alone would have
missed: a dropped-during-rewrite Photos section (handlers defined, never rendered), and two related
rounding bugs in the BD Invoice auto-seed logic that would have produced a false-positive mismatch
warning on a freshly-seeded row before the admin had touched anything at all.

## 14. Fix Round — 2026-08-01 (same day, round 2) — Save Crash, BD Invoice Sync, Table Layout

Real-world testing of the round above surfaced 4 concrete bugs, all fixed:

**Save crashed entirely** (`Cast to ObjectId failed for value ""`) whenever a shipment was saved
without an Export License, Export Category, or Bank Account selected — those three fields are
ObjectId references, but their `<select>` elements default to `''` when nothing's chosen, and that
empty string was being sent straight through to Mongoose. Fixed both client-side (converts `''` to
`undefined` before sending, which correctly clears the field if deselected) and server-side (both
the create and update routes now sanitize the same way as a backstop, via a new shared
`sanitizeObjectIdFields()` helper) so this can't happen from any caller, not just the shipment
editor's own save button.

**BD Invoice showed permanently stale numbers.** The previous round's design seeded BD Invoice's row
ONCE from Shipment Details' totals and then froze it forever — so a shipment that kept growing
(more products added to Shipment Details) after BD Invoice had already auto-seeded once was left
showing old, now-wrong totals with no obvious reason why, exactly what real testing surfaced.
Redesigned to continuously auto-sync BD Invoice to Shipment Details' current totals for as long as
the admin hasn't edited it directly — the moment they touch a field, or add/remove a row, it locks
and becomes their own independently-editable data (with a visible 🔒Locked / 🔄Auto-syncing badge
so this state is never a surprise, and a "Re-fill from Shipment Details" button to go back to
auto-syncing). Direct consequence: the mismatch warning banner can now only ever appear on a row
the admin has actually taken manual control of — while auto-syncing, BD Invoice is computed to
exactly equal Shipment Details by construction, so there's no false-positive path left.

**Table columns misaligned, numeric fields cramped.** In all 3 product-table components (Shipment
Details' master table, the Packing List/Buyer's Invoice read-only view, BD Invoice's table), the
"Name" column had no width specified while the numeric columns next to it did — under the browser's
default table layout, that unconstrained column absorbed most of the available space and squeezed
everything else down to barely-legible widths (visible directly in the bug report's screenshot).
Fixed with an explicit width on every column plus a fixed table layout so those widths are
authoritative, and more generous padding throughout; each table now scrolls horizontally on
narrower screens rather than cramming everything to fit.

**Product suggestions appeared underneath the table instead of on top of it.** The suggestion
dropdown was a plain absolutely-positioned element inside a table cell, and that table sits inside a
horizontally-scrollable wrapper — which, per the CSS spec, clips vertical overflow too once
horizontal scrolling is enabled on an element, regardless of the dropdown's z-index. Rewrote the
dropdown to render through a React portal attached to the page body instead, positioned by the
input's actual on-screen coordinates — the standard fix for a dropdown trapped inside a scrollable
container, and immune to any ancestor's clipping.

## 15. Fix Round — 2026-08-02 — Product Search Regex Crash

Reported as "No catalog match" appearing in the Shipment Details product search when it shouldn't.
Root cause: the product search built a MongoDB `$regex` directly from raw typed text with no
escaping. This catalog's botanical names are written like "Mango (Mangifera indica)" — typing that
naturally passes through an unbalanced `(` on every keystroke before the closing `)` arrives, and
an unescaped `(` in that position throws a regex compilation error, which the API's error handler
turns into a response with zero products — indistinguishable from a genuine "no match" without
seeing the actual server error. Fixed by escaping regex special characters in `buildProductQuery`
(`lib/utils.js`) before they're used as `$regex`/`RegExp` patterns — this function backs the main
`/api/products` listing route too, so the fix also protects the customer-facing storefront search
from the same crash, not just the export dashboard's product picker. Added test coverage for this
in `tests/unit/utils.test.js`.

## 16. Fix Round — 2026-08-03 — TT Configuration, Draft/Active Lifecycle, License Details, Document
Export Formats + Editable Text, and the Incentive Application Workflow

A large batch covering 16 requirements from a fresh spec document — the biggest single addition
since the export dashboard was first built. Summary by area (see AGENT_PROGRESS_8.md in this same
zip for the full phase-by-phase build log, design-decision reasoning, and command history):

**Shipment lifecycle (draft → active).** A shipment now starts as a draft and stays one across
repeated saves ("Save Draft") with zero audit logging, until an explicit "Save & Activate" (or
first save with activation) moves it to active — the exact moment its audit trail begins. Once
active, a shipment can never be silently pushed back to draft (enforced server-side, not just in the
UI), so "logging never turns off" holds even against a replayed/crafted request. Deleting a draft is
a plain, untracked hard delete (nothing to restore, since nothing was ever logged); deleting an
active-or-later shipment still goes through the existing recycle-bin flow unchanged.

**Compact selector cards.** Base Currency / Export Category / Beneficiary Bank / Export License
used to each render as a full-width banner (~180px tall apiece); now a single 4-across (2-across on
tablet) grid of small cards carries the same functionality in a fraction of the space.

**TT Configuration.** A new section in Shipment Details, right after Financial Details & Profit
Analysis, holding the (renamed) Rate in BDT and Incentive fields moved out of that section, plus a
repeatable TT Number / TT Date / TT Value list. Order Value stopped being a manually-typed field —
it's now always exactly the Packing List's total, live. Receive Amount (BDT) uses that Order Value
until at least one TT entry has a value, at which point the TT total takes over for that calculation
everywhere it's used (the shipment editor's own preview, and Export Analytics).

**License Settings.** Export Registration Certificate Number, Address, Owner Name, Phone, and Email
added to each saved license.

**Document export formats + editable text.** Packing List, Buyer's Invoice, and BD Invoice can now
be downloaded as DOCX or XLSX in addition to the existing PDF, via a format selector next to the
existing Print/Download actions. A new "Edit Text" option lets an admin adjust the declaration
paragraph and signatory title per shipment, per document, before generating any of the above —
Print, Download, and every format all read from the same saved override, so they can never drift out
of sync with each other.

**Incentive Application workflow.** An entirely new "Incentive" section of the export dashboard:
shipments eligible for a government incentive claim list under "Available for Incentive
Application" (oldest first); an admin bulk-selects up to 10 sharing one Export Category and one
Export License and proceeds to create a serially-numbered, renamable "Incentive Application" card;
from there it can be viewed (Incentive Details / Ka Form / Others tabs — the live BDT rate plus an
optional manual-rate override that, once set, becomes the rate for every member shipment everywhere
a rate is used or shown), deleted, or marked claimed. Claiming freezes the rate, marks every member
shipment completed (which is all Export Archive needed to pick them up automatically — no changes
needed there), and fully locks them against further edits until the application is unclaimed.

**Bugs found and fixed along the way (not part of the 16 requirements, but blocking or adjacent to
this work):**
- The shipment editor's footer "Save Shipment" button called its save handler with no argument,
  which — once that handler started distinguishing "save as draft" from "save and activate" for
  this batch — would have made that specific button always behave as a draft-preserving save,
  silently never activating any shipment saved through it. Fixed to match the header buttons.
- The buyer-page shipment delete handler never checked its DELETE request's response — it always
  showed "Shipment deleted" regardless of whether the server actually deleted anything. Harmless
  before (deletes essentially never failed), but this batch adds real, expected rejection cases
  (a locked or still-grouped shipment), so it was fixed to surface the real outcome.
- A systemic gap across `app/api/export/`: several routes called `.populate()` on a field without
  ever importing the model that field references, relying on that model happening to already be
  registered via some other route's earlier import. Harmless on a single long-running Node process
  once enough traffic has flowed through the app, but a real risk on a fresh cold start (serverless,
  or the first request after a restart) if the affected route is hit first. Every populate call
  under `app/api/export/` now has its model imported directly in the same file — covers both the
  new Incentive Application routes and four pre-existing instances (buyers/shipments populating
  country/category/license/bank-account) found during the same sweep.

## 17. Batch 9 — Export Contract, Ka Form, Stamp Application, Readable Activity Log (R18-23)

Continuing directly from batch 8's own output (this batch's input zip was literally batch 8's
deliverable). Full detail lives in `AGENT_PROGRESS_9.md` and `KA_FORM_AND_STAMP_REFERENCE.md` — this
section is the same kind of durable summary the other 16 sections already are.

**New hierarchy layer.** Export Contract now sits between Buyer and Shipments (country → buyer →
Export Contract → shipments, was country → buyer → shipments) — a new top-level entity (contract
no/date/Export Category/value/base currency) with its own CRUD, audit logging, and recycle-bin
support, at the same tier as Buyer/Country rather than the config-only entities that stay
deliberately unlogged. The buyer page itself now lists Export Contracts; a new page underneath it
lists the shipments under one contract. Pre-batch-9 shipments (which predate this entity) get a
dedicated "Shipments without a Contract" fallback view rather than silently losing visibility.

**Incentive grouping rule changed.** The bulk-select-for-incentive constraint moved from "same
Export Category + same Export License" to "same Export Contract No + same Export License" (a
contract already implies one category, so this is strictly narrower/more correct) — plus a same-
Base-Currency requirement that wasn't explicitly asked for but is necessary: the Ka Form sums every
member shipment into single "(FC)" totals with one currency label, and mixing currencies there would
silently produce a wrong number with no error surfaced anywhere.

**The Ka Form is now real**, not the notes+uploads stub batch 8's own R14 shipped (that stub was
explicitly flagged at the time as "no field spec was given... flagged for the user to refine" — this
batch is that refinement arriving). Three reference PDFs were provided mid-batch (Ka Form English,
Stamp Application English + Bengali) and fully extracted into `KA_FORM_AND_STAMP_REFERENCE.md` —
every section, column, formula, and default value in the generator was cross-checked against the
real document's own numbers, not just the original prose spec (which turned out to be missing 2 of
the form's 8 sections entirely, and had one field formula that the real PDF corrected). The
Incentive Details tab now shows the full Section A-H data model (fetched + a handful of genuinely
admin-editable pieces), and a Ka Form tab renders/downloads/prints the actual A3 document in English
and Bengali, in PDF/DOCX/XLSX, with an edit option for every boilerplate label. "Incentive after
costing" (Tax + Application Cost + Others Cost, from the Export Category's own rate settings,
deducted from the government form's gross Payable Incentive Amount) is a new internal layer on top,
distributed equally across member shipments and automatically written into each one's TT
Configuration "Incentive" field — which Export Analytics already summed, so no analytics-route
change was needed, just correctly populating that one field.

**Stamp Application** (Others tab) — a full 5-paragraph/3-page bank undertaking document, English
verbatim from the reference PDF and Bengali via a genuine clean-font PDF text extraction (not a
translation), both with the same token-substitution treatment, downloadable/printable/editable the
same way as the Ka Form.

**Activity log is now readable.** "View details" used to `JSON.stringify` the raw before/after
snapshots into a `<pre>` block — technically complete but illegible, exactly the complaint raised.
The underlying data was already correct (full snapshots, stored since early in this project); this
was purely a display gap, fixed with a proper field-by-field diff (human labels, formatted dates/
currency/arrays, only the fields that actually changed for updates).

**Bugs found and fixed along the way (not part of R18-23, but found via code review while wiring
the new grouping cascade in):**
- Naively wiring the new "recompute the group when any member shipment's own data changes" trigger
  would have produced a redundant, near-duplicate audit-log entry for the shipment that was JUST
  saved+logged by that same request (`recordAuditLog` never deduplicates — confirmed by reading it).
  Fixed with a `skipLogForId` option threaded through the shared cascade function: that one
  shipment's derived fields still get silently corrected, just without a second log line; every
  other sibling in the group still logs normally, since for them it's a genuinely new change.
- The audit log's own `labelFor` helper had no case for the new `exportContract` entity type
  (would have fallen through to a raw database ID instead of the contract number).
- Incentive Applications were never actually cascaded on creation — the very first computation of
  the group's rate-driven derived fields only happened on some LATER edit. Batch 9's own R20
  distribution needed this fixed to satisfy "will appear automatically" from the moment an
  application exists, not just after a subsequent edit touches it.

## 18. Batch 10 — Ka Form/Stamp Application Exact-Match Rewrite, Bengali Rendering, Letterhead-as-Background, and 5 Reported Bugs (R24)

Full detail lives in `AGENT_PROGRESS_10.md` and this file's own `ROADMAP.md` working notes (kept
through the session for resumability) — this section is the same kind of durable summary the other
17 sections already are. Input this round: the existing v12 zip plus 4 new reference PDFs (a real
Bengali Ka Form reference existed for the first time — batch 9 had only ever had the English one)
and a sample invoice photo showing what a document printed on the physical company letterhead
actually looks like, alongside 9 reported bugs.

**Bengali rendering was fundamentally broken, and the fix is a different rendering path, not a font
swap.** jsPDF's built-in fonts have zero Bengali glyphs, but embedding a Unicode Bengali font on its
own isn't sufficient either — jsPDF has no OpenType shaping engine at all, so even with the right
glyphs available it draws one glyph per Unicode codepoint with no conjunct ligatures and no vowel-
sign reordering, which is still wrong for real Bengali (conjuncts and the very common pre-base vowel
sign are basic to the script, not edge cases). Fixed by rendering Bengali text to an offscreen canvas
using a bundled web font first — canvas text goes through the browser's real text-shaping engine, the
same one used for ordinary page text — then embedding the result as an image via `doc.addImage()`
instead of `doc.text()`. The font itself (`public/fonts/FreeSansBengali.ttf`) is GNU FreeSans,
subsetted to Bengali + basic Latin with `pyftsubset` (1.8MB → 218KB), chosen because it has full
Bengali OpenType shaping tables (confirmed by inspecting its GSUB script/feature tags directly, not
assumed) — verified end-to-end by rendering real Bengali test strings with known-tricky conjuncts
through an actual browser-grade shaping engine before trusting it in the app. See
`lib/bengaliText.js` and `public/fonts/FONT_LICENSE.txt`.

**Ka Form and Stamp Application rebuilt against the real reference PDFs, pixel-by-pixel.** Rather
than trust `pdftotext` extraction (which reorders/garbles complex Bengali conjuncts on these specific
documents even though the PDFs themselves render correctly — the exact same illegible-when-copy-
pasted phenomenon `KA_FORM_AND_STAMP_REFERENCE.md` already flagged for the Stamp Application last
batch), every section, table, column, and font choice below was confirmed by rasterizing the actual
PDFs to images and reading them directly. Real, previously-unknown differences found this way:
- English Ka Form is A3; Bengali is A4 — genuinely different physical page sizes, not a simplification.
- The TT table (Section C) splits into two side-by-side tables past 5 rows in English (confirmed:
  left column always exactly 5 rows); Bengali keeps one full-width table regardless of row count
  (narrower page, no room to split) — this is real and now handled per-language.
- Section E has 7 columns in English but only 6 in Bengali (two columns merge into one stacked cell).
- Section F was flat-out wrong in the previous implementation: only 3 columns existed, with 3 more
  figures squeezed into a merged footer text line. Both reference PDFs (both languages) show a real
  6-column table with a numbered sub-header row. Rebuilt properly, in PDF, DOCX, and XLSX.
- Table headers use a light gray fill in the reference, sampled directly from the rendered pixels
  (232,232,232) — was plain white.
- Every "(FC)" abbreviation is spelled out as "...in Foreign Currency" in the real forms — fixed
  everywhere it appeared (issue 4's literal ask), across all three output formats.
- Bengali digit convention is genuinely mixed and field-specific, confirmed by zooming into individual
  cells: the Ka Form uses Bengali numerals for serial numbers, BDT/Taka amounts, and the exchange
  rate, but Latin numerals for foreign-currency amounts, dates, quantities, and reference codes —
  even within the same table row. The Stamp Application, by contrast, uses Bengali numerals for
  everything. The previous implementation applied one rule to both.
- Stamp Application now forces exactly 3 pages via explicit break markers placed at the same 2 points
  the real documents break (confirmed from `pdftotext`'s own page-boundary positions), rather than
  relying on vertical-overflow math that doesn't reliably reproduce a fixed page count.
- Bengali/A4 table density was tuned against measured real row heights (pulled directly from the
  reference PDF's pixels, not estimated) so a typical application still fits the single page the
  reference itself is; a pagination safety net (redraws the letterhead on any spillover page) was
  added regardless, since an unusually large application has no fixed upper bound on row count.

**Letterhead is now a real page background, not a synthesized header, everywhere.** New shared
`lib/pdfLetterhead.js` used identically by every PDF generator (Packing List, Buyer's Invoice, BD
Invoice, Ka Form, Stamp Application): the uploaded image is drawn full-width at the top of every
page, height derived from its own aspect ratio (never distorted, never cropped), with all
programmatic header code (the coded green banner + drawn company name/address/phone/etc.) deleted
outright rather than kept as a fallback, per the explicit request. The Cloudinary upload preset for
letterheads was also widened (was a 1200×400 landscape-biased box that would have crushed a portrait/
full-page-shaped upload) to a generous, aspect-ratio-agnostic ceiling at real print resolution.

**5 other reported bugs, each a genuine, narrow root cause:**
- *Product search always empty*: the catalog query excluded any product missing an `isActive` field
  — which happens for anything not created through one specific code path — while every OTHER
  boolean visibility flag in that same function already used a form that stays correct for that case.
  One-line fix to match the established pattern.
- *"Payable Incentive (BDT)" / live rate*: a live exchange-rate hook already existed and was already
  being fetched and displayed in a small rate card, but its result was never actually fed into the
  incentive calculation, which used the shipment's own stored (manually-entered-once) rate
  regardless. Wired it in with manual-rate and claimed-and-locked-rate still taking precedence.
  Relabeled to "Receivable Incentive (BDT)".
- *Whole page reloading on every field edit*: every save-then-refresh call site shared the same
  loading flag as the page's true initial load, which a `if (loading) return <Loader />` a few lines
  down uses to unmount the entire page. Saving so much as one field replaced the whole page with a
  spinner and remounted everything from scratch. Fixed by making background refreshes silent by
  default and reserving the full-page loader for the one genuine initial-mount call.
- *Incentive not appearing on Shipment Details or counting in Export Analytics*: `calculateShipment-
  Financials` computed `netProfit` using the incentive value but never actually included `incentive`
  itself in its returned object, so every caller that persists via `{...computed}` — critically the
  cascade that's supposed to write each shipment's distributed share of a claimed application back
  onto it — was silently never writing the field to the database at all, no matter how correctly the
  surrounding distribution logic (already fully wired, from batch 9) had just calculated it. One
  field added to a return statement; both pages read/sum that same stored field directly.
- *No way to delete a shipment from Export Archive*: the backend (recycle-bin snapshot + audit log
  entry + guards against deleting a claimed/locked/pending-incentive shipment) already existed and
  was already correct, as did a full Recycle Bin restore UI on the Audit Log page — the Archive page
  itself just never exposed a delete button to call it. Added one, matching this codebase's own
  established delete-confirmation pattern from the buyer/contract page.

## 19. Batch 11 — Follow-up Correction Round: Ka Form/Stamp Application Back to Plain Paper, Signature Block Removed, Bracket Style, EXP Year, Vercel Hardening (R25)

Direct feedback on batch 10's own output, addressed in the same session's immediate next round. Full
detail lives in `AGENT_PROGRESS_11.md` — this section is the same kind of durable summary the other
18 sections already are.

**Ka Form and Stamp Application reverted off the letterhead, onto plain paper — batch 10's issue 9
letterhead-as-background treatment was correct for Packing List/Invoice but wrong for these two.**
Ka Form: plain A3, both languages now (previously English A3 / Bengali A4, matching each one's own
real reference page size — the explicit ask this round is a single guaranteed page for 1 to 7
shipments, this app's own hard group-size range, with no letterhead reserve, and A3's extra room
makes that reliable rather than tight; the Bengali-specific content structure — 6-column Section E,
single-table Section C, numbered Section H, all confirmed against the real Bengali reference PDF in
batch 10 — is unchanged, just rendered on the larger canvas). Stamp Application: plain LEGAL size
(215.9×355.6mm), not A4. Neither document draws the letterhead at all any more.

**Signature/stamp block removed entirely from Packing List, Buyer's Invoice, BD Invoice** — a
physical company stamp is added by hand afterward now, which is exactly what the drawn "line +
Proprietor + company name" used to stand in for. Removed from all 4 places it existed: the PDF
generator (`drawSignature` + both call sites), DOCX, XLSX, and — found while making this
consistent — the separate HTML print view's own `SignatureBlock`, which still had it. While in the
print view: also found and fixed the same stale "coded banner fallback + banner-shape-only
restriction" in its own header component that batch 10 had already fixed in the PDF path, so Print
and Download match again (this round's own wording, "printed or downloaded", made the mismatch worth
fixing rather than leaving as before).

**A real rendering bug found and fixed while correcting the Stamp Application's Bengali salutation
text**: `wrapBengaliText` treated an embedded `\n` as just more whitespace and word-wrapped straight
over it, silently discarding forced line breaks — a short multi-line block like a letter's opening
address (several deliberately separate short lines) would get re-flowed into one run-on line. Fixed
at the source (splits on `\n` first, wraps each resulting line independently), which benefits any
other Bengali paragraph text with an embedded line break, not just this one block. The salutation
block itself was also replaced with the exact fixed text provided, for Bengali specifically.

**"(In Foreign Currency)" bracket style** — batch 10's spelled-out "...in Foreign Currency" wording
(itself a fix for the original "(FC)" abbreviation) is now bracketed to match the real reference
forms' own convention (e.g. "ইনভয়েসের মূল্য (বৈদেশিক মুদ্রায়)"), across the PDF, DOCX, and XLSX
generators. The one structurally different string ("Payable Incentive Amount (in Taka: ...)", which
describes a calculation formula rather than labeling a value's currency) was correctly left alone.

**Section E's missing EXP year, root-caused rather than patched around**: `expDate` was a real
`ExportShipment` schema field, but had no input anywhere in the shipment editor to ever actually set
it — only "EXP No." had a field. Added the missing "EXP Date" input (same date-input pattern already
used for Shipment Date), AND added a fallback in the Ka Form's own data assembly that derives the
year from the shipment's own always-populated `date` field when `expDate` isn't set, so
already-saved shipments show a correct year immediately too, not only ones saved going forward.

**Vercel deployment audit** — systematic sweep (filesystem writes, middleware Edge-runtime
compatibility, env var handling, NextAuth config, image domains) came back clean; found and fixed 3
concrete things: (1) a cron endpoint for currency-rate/inventory updates existed and checked its own
secret correctly but was never actually scheduled — added `vercel.json`, deliberately once/day since
Vercel's Hobby plan hard-rejects (fails the whole deploy) any more frequent schedule, confirmed via
research rather than assumed; (2) pinned `"engines": {"node": "22.x"}` in `package.json` — Vercel is
deprecating Node 20 for new deployments on Oct 1 2026, and nothing was pinning this project away from
that as Vercel's own shifting default changes; (3) the significant one — confirmed via research that
Vercel Serverless Functions hard-cap request bodies at 4.5MB, non-configurable, and `/api/upload`
takes images as base64 JSON. A prior round had already correctly identified and solved exactly this
(`lib/clientImageResize.js`) but only wired it into 3 of 11 actual upload points across the app;
wired in the other 8 (export categories/licenses, the main and per-license letterhead uploads, the
shipment editor's letterhead/photo/document uploaders, products, banners), sized per use case, with
the 2 mixed PDF-or-image uploaders handling each file type appropriately (images resized, PDFs passed
through as before — resizing a PDF client-side isn't a small addition, flagged as a smaller remaining
gap rather than solved). Confirmed zero unresized image upload call sites remain anywhere in the app.

## 20. Batch 12 — Letterhead Gap/2-Page Print Fix, Missing Campaigns Root-Caused (R26)

Full detail lives in `AGENT_PROGRESS_12.md`. Direct feedback on batch 11's own output plus one
freshly reported, previously-unmentioned bug (campaigns/flash-sales not appearing on the site).

**The letterhead gap and the print view's 2-page problem shared one root cause, confirmed by
measuring an actual downloaded PDF pixel-by-pixel rather than estimating**: the real uploaded
letterhead's visible banner graphic is only ~20mm tall, but the image FILE's own aspect ratio
renders to ~80mm at full page width — it has a lot of blank space baked into the file well past its
visible content. `lib/pdfLetterhead.js` was reserving content-start space proportional to that FULL
rendered height (capped 38-90mm), which is why content was starting ~66mm too low. Replaced with a
single fixed constant (`LETTERHEAD_CONTENT_START_MM = 45`, exported as the one shared source of
truth) — content now starts a predictable ~1 inch past a typical banner's own height, regardless of
how much blank padding an uploaded file happens to carry beyond it; the image itself is still always
drawn at its own full, undistorted size underneath. The PDF side needed no further changes (`draw-
Header` already just forwards whatever this module returns). The print view had a compounding
second bug: its letterhead `<img>` was a normal-flow element, so that same ~80mm render height was
physically pushing all following content down by that amount in the page's real layout, and with
everything shifted that far, the whole document no longer fit on one printed page — fixed by making
the image `position: absolute` (out of flow, can't affect pagination) with a small fixed spacer
using the same shared constant, landing print and PDF at the same effective content-start position
(worked through the CSS containing-block math for an absolutely-positioned percentage width/an
absolutely-positioned element ignoring its ancestor's padding specifically, rather than assuming).

**Campaigns not appearing — two separate, real bugs, both fixed:**
1. The same `isActive: true` exact-match bug already fixed once for the Product catalog (search
   round) turned up again in 3 separate FlashSale queries (homepage, product-detail campaign strip,
   the flash-sales API route) — all switched to `{ $ne: false }`, matching the established pattern.
2. A genuine timezone bug in the admin Campaigns page: its date/time picker built a plain, timezone-
   naive datetime string and sent it straight to the server. Since this server runs in UTC (Vercel)
   while the business operates from Bangladesh (UTC+6), an admin picking "start now" was unknowingly
   storing a start time 6 real hours in the future from the server's perspective — a very plausible,
   direct explanation for a freshly-created campaign not showing up for hours. Fixed by constructing
   a real local `Date` (interpreted in the admin's own browser timezone) and normalizing with
   `.toISOString()` before sending; fixed the same picker's read-back path to use the `Date`
   object's own local getters rather than slicing an always-UTC ISO string; and found + fixed a
   third related bug this uncovered — the edit-population code was ALSO pre-converting via
   `.toISOString().slice(0,16)` before handing off to the picker, which would have made the now-
   correct picker misinterpret an already-UTC value as local time all over again on every re-edit.

## 21. Batch 13 — Letterhead Watermark Layering, Campaign Price Populate Gap, Local Name Field, Universal Search, Systemic Vercel Dynamic-Rendering Fix (R27)

Full detail in AGENT_PROGRESS_13.md. Six reported issues, all root-caused with direct evidence
(not pattern-matched to prior rounds) before any fix was written:

**1. Packing List / BD Invoice / Buyer's Invoice: blank print preview, downloaded PDF content
covering the letterhead.** Two independent bugs sharing one root cause — nothing previously stopped
content from opaquely covering a letterhead image taller than the fixed 45mm content-start offset
(LETTERHEAD_CONTENT_START_MM, unchanged by this fix — it was never actually the problem):
  - Downloaded PDF: `PLAIN_TABLE_STYLE` in lib/exportDocuments.js set `fillColor:[255,255,255]`
    (opaque white) on head/foot/alternate-row styles, and left bodyStyles/the table-wide `styles`
    with no override at all — silently inheriting the same opaque white from the 'grid' theme's own
    default. jsPDF draws sequentially like a canvas (letterhead drawn first, table after) — those
    opaque cells painted directly over any part of the letterhead still visible below the table's
    start position. Fixed: `fillColor: false` at every level (head/body/foot/alternate/table-wide),
    which skips the fill draw call entirely rather than drawing white — confirmed via grep that
    every other `doc.rect()` call in the file already had no fill (stroke-only by jsPDF's default),
    so this was specifically and only the two `autoTable()` calls.
  - Print preview: DocHeader's `<img>` is `position:absolute` with no z-index; everything else
    (title/InfoGrid/table/summary/declaration) is normal static flow. Per CSS's default stacking
    order, a positioned element paints ABOVE static siblings regardless of DOM order — so wherever
    the (opaque) letterhead image rendered taller than the fixed offset, it visually covered
    everything underneath it, reading as "blank, only the letterhead is showing." Fixed by wrapping
    all post-DocHeader content in a new `CONTENT_LAYER_STYLE = {position:'relative', zIndex:1}` div
    in both PackingListDoc and InvoiceDoc — any explicit positive z-index sibling paints above a
    z-index:auto one unconditionally.
  - This CSS fix was empirically verified, not just reasoned about: built a minimal faithful
    reproduction (position:relative container + oversized position:absolute rect simulating a tall
    letterhead + real DocHeader spacer math + content once without and once with the fix), rendered
    it with the locally-available Playwright/Chromium binary (no network needed — the browser was
    already installed in this sandbox), and screenshotted both. The "before" render exactly
    reproduced the reported bug (title/table 100% invisible under the banner); the "after" render
    confirmed the fix (identical content clearly visible on top of the still-fully-visible banner).
  - Confirmed out of scope / unaffected: Ka Form and Stamp Application (lib/kaFormDocuments.js) —
    separate file, doesn't import pdfLetterhead.js, no letterhead-as-background involved. Also
    confirmed lib/invoice.js (regular e-commerce order invoices, unrelated system with its own
    synthesized colored header, no letterhead image at all) is unrelated.

**2. International buyers saw campaign/flash-sale price as 0.** Not a discount-math bug —
`getEffectivePricing` in lib/utils.js was already correct. Root cause: three separate Mongoose
`.populate('items.product', ...)` calls that feed campaign product cards used field-selection
projections missing `priceRangeMin`/`priceRangeMax` (one was missing almost every pricing field,
including images/price/discountPrice too), so those fields were `undefined` on the populated
product and `Number(undefined) || 0` always computed 0 regardless of discount status. Fixed all
three: app/(shop)/page.jsx (homepage — brought in line with its own sibling SpecialSection populate
four lines below, which already had the fields right), app/(shop)/products/[slug]/page.jsx (product
detail page's campaign strip — replaced a hand-rolled select with the file's own existing
`CARD_FIELDS` constant so it can't drift out of sync again), and app/api/flash-sales/route.js (the
standalone API route, reachable via ActiveCampaignsStrip.jsx's self-fetch fallback).

**3. Added a Local Name field** (alongside Product Name and Botanical Name) — `models/Product.js`
schema, the shared admin create/edit form (app/admin/products/new/page.jsx, exported as
`ProductForm` and reused by app/admin/products/[id]/page.jsx), and display everywhere Botanical
Name was already shown (ProductMultiSelect, ProductNameCombobox, the shipment page's product
picker, the admin products table, the storefront product detail page) using a consistent
`[scientificName, localName].filter(Boolean).join(' · ')` pattern. translations/{en,bn,ar}.js
already had a correct `localName` key from earlier scaffolding — nothing to change there.
scripts/seed.js's standalone schema also already had the field declared but no demo values; added
real values to 11 of 12 seed products (reusing the local name already embedded in several products'
own `name` field, e.g. "Bitter Gourd (Karela)" → `localName: 'Karela'`, plus well-established common
Bengali names for the rest).

**4 & 5. Universal product search (storefront + admin + shipment picker) now matches local name,
product name, botanical name, and tags.** Found all THREE real search implementations in the
codebase and fixed each: `buildProductQuery` in lib/utils.js (shared by the main catalog, admin
product list, and — this is what folded issue 5 in for free — both shipment-page product pickers,
since they all call `/api/products?search=`), and the standalone `/api/products/search/route.js`
(storefront header autocomplete) which also had unescaped regex (a `(` in a botanical name search
would throw, caught as a 500) and the stricter `isActive:true` bug — both fixed to match the
established `$ne:false` + `escapeRegex` conventions. Confirmed the shipment picker's existing
Product Name → Botanical Name autofill-on-select was already correct and needed no changes.
  - Found and fixed a genuine standing bug while here: `app/api/products/route.js` swapped in a
    bare `{}` query whenever `adminView=true`, discarding search/category filtering entirely — the
    admin product list's search box had apparently never actually filtered anything. Refactored
    `buildProductQuery` to accept `filters.adminView`, which now correctly skips only the
    visibility restrictions (isActive/availableForLocal/availableForInternational) while still
    applying category/search — real product-visible query building.  Updated
    tests/unit/utils.test.js (existing real vitest suite — confirmed it can't actually be run in
    this sandbox, no node_modules/no network, but kept it consistent and extended with 3 new cases
    documenting the localName search field and the adminView fix).
  - Same-class opportunistic fixes applied while directly in this territory (all product-domain,
    all the identical `isActive:true` → `{$ne:false}` pattern already established everywhere else):
    app/api/products/best-selling/route.js, app/api/products/recommended/route.js (both instances),
    and app/api/admin/metrics/route.js's active-product count (already a touched file this round).
    Also fixed unescaped regex in app/api/users/route.js's admin search (crash-safety only, doesn't
    change matching semantics). Deliberately did NOT extend the `isActive:true` sweep into Coupons/
    Categories/Special Sections/Banners/Pages/Notifications — different domains, not part of any of
    the 6 reported issues, and some (Coupons especially) carry business-logic judgment calls about
    legacy documents that shouldn't be made unilaterally.

**6. Vercel deployment errors — systemic root cause, not three separate bugs.**
`getServerSession()` internally calls `headers()`; 67 of 79 API routes called it without declaring
`export const dynamic = 'force-dynamic'`, so Next.js's build/render pipeline attempted to
statically evaluate them, `headers()` threw its internal `DynamicServerError` (digest
`DYNAMIC_SERVER_USAGE`) as a control-flow signal meant for Next's OWN machinery to catch — but
every one of these routes wraps its logic in `try/catch`, which intercepted that signal first and
turned it into a real, user-facing 500. This is exactly the reported `/api/admin/metrics` stack
trace. 9 more routes (including `/api/currency`) had neither session code nor the dynamic export —
same risk via the same mechanism, most likely why currency 500'd consistently (a build-time
static-evaluation attempt with the DB unreachable from the build step would bake a 500 response in
as the "static" output, permanently, until redeploy). Fixed by adding
`export const dynamic = 'force-dynamic'` to all 76 affected routes (verified 79/79 route.js files
now correctly configured, zero duplicates). The generic "Something Went Wrong" Server Components
error had no independent stack trace to chase — most likely a knock-on symptom of the above, flagged
to confirm after redeploy rather than conclusively closed on static analysis alone.

**Verification approach this round:** no network access in this sandbox (confirmed, same constraint
every prior round faced) — couldn't run `npm install`/`next build`/`next dev`/the real vitest suite.
Used the established `tsc --noEmit --allowJs --checkJs --jsx preserve --noResolve --skipLibCheck`
syntax/reference check (catches TS2304/TS2552/TS2551 — undefined names/typos — while ignoring
type-mismatch noise from unresolved imports) across every one of the 90 files touched this round,
individually as each was edited and again as one final consolidated pass; the only hit was a single,
already-known, pre-existing `Buffer` Node-global false positive unrelated to any edit. Additionally,
for the one fix resting on a genuinely subtle mechanism (CSS stacking order, not simple/documented
library API behavior) — the print-preview letterhead fix — went beyond static analysis and
empirically confirmed it with a real headless-Chromium render via the locally-available Playwright
install, reproducing the exact reported bug and confirming the fix resolves it (see issue 1 above).

## 22. Batch 14 — Declaration/Total-Carton Spacing, Bengali Ka Form Section E Column Split, Section A Spacing, Center-Alignment Sweep (R28)

Full detail in AGENT_PROGRESS_14.md. Four reported issues, all against the v16 deliverable from
Batch 13 (same conversation) — no new zip uploaded this round, worked directly against the existing
project tree. Two new screenshots + a reference Ka Form PDF supplied evidence for three of the four.

**1. Declaration text and "Total Carton" line touching in Packing List / BD Invoice / Buyer's
Invoice.** A real arithmetic bug in lib/exportDocuments.js, not a subjective spacing preference:
the declaration text was drawn with `doc.text(certLines, MARGIN+2, y+4)` (baseline 4mm below the
box top), but the running `y` tracker used to position the NEXT line only added
`certLines.length*3.5 + 3` — never accounting for that same `+4` offset the text was actually drawn
at. For the common one-line-declaration case this put "Total Carton" under 1mm below the
declaration's own visual bottom. Fixed in both `generatePackingListPDF` and the shared
`generateInvoicePDF` (BD Invoice + Buyer's Invoice) by restoring the missing `+4` into the
cumulative advance.

**2. Bengali Ka Form Section E: EXP Number and Repatriated Value merged into one column.** The
user-supplied reference PDF was rasterized and inspected column-by-column (150 then 300 DPI),
confirming the Bengali original has these as genuinely separate columns, contradicting a Batch-9-
era note that had concluded (from a different reference at the time) that Bengali only had room for
6 merged columns. Fixed by extending Section E to 7 columns in both languages (SL, Description,
Quantity, Invoice Value, Ship Date, EXP Number, Repatriated Value & Date) — kept the existing SL
column since the user's complaint was specifically about the merge, not about matching the
reference's exact column set. `sectionERowsBn` (a near-duplicate of `sectionERows` differing only by
this now-corrected merge) was removed entirely rather than patched in place, since once fixed it
became computationally identical to `sectionERows` — both language paths now share one function.
The two new Bengali column headers were deliberately NOT hand-transcribed from the reference image
(Bengali conjuncts are easy to mis-key from a raster scan) — instead assembled from phrase fragments
already correctly typed and rendering elsewhere in this exact file (Section F's own header, Section
H's caption), which also confirmed the file's own established two-word spacing convention for
"বৈদেশিক মুদ্রায়". Could not be empirically rendered (no jspdf/node-canvas available locally, no
network to install either) — confidence instead rests on exact structural verification (column-width
sum = 1.0, matching array lengths across colW/head/body/foot/aligns) plus reuse of proven text
fragments, a real but categorically weaker form of verification than an actual rendered screenshot.

**3. Bengali Ka Form Section A: company name/address too close to its label.** Not the same bug
class as issue 1 — `drawBengaliText` (lib/bengaliText.js) already correctly bakes a small gap into
its own return value; this was a legitimate "needs more room" request, not broken math. Fixed by
increasing the shared `sectionHeadingBn` helper's added gap (used by all 8 section headings, A-H,
not just A) from +1.5mm to +3mm — total gap roughly 2.3mm → 3.8mm, negligible against the A3 page's
available headroom.

**4. All table headers and values across every PDF type should be center-aligned.** Surveyed every
table in both generator files before touching anything: lib/exportDocuments.js has 2 `autoTable()`
calls sharing one `PLAIN_TABLE_STYLE` object; lib/kaFormDocuments.js has 7 `autoTable()` calls
sharing one `TABLE_STYLE` object, plus 5 `bnDrawGridTable()` calls each with their own `aligns`
array (Sections C, D, E, F, H). Confirmed no per-column override anywhere in either file that could
conflict with a single shared-object fix. Added `halign: 'center'` to both shared style objects
(covers 9 of the 14 tables in one change each) and changed all 5 `aligns` arrays to all-`'center'`.
Also fixed the HTML print-preview page's table styling for consistency — found `TH` (headers) was
already centered by design but `TD` (the Name/Botanical/HS-code body cell) was left-aligned;
centering the base `TD` constant fixed it without touching individual call sites.

**Verification:** tsc clean across all 4 touched files, individually and as a final consolidated
pass. DOCX/XLSX Ka Form output confirmed unaffected (already used `sectionERows`, unchanged by this
round) — correctly out of scope, the user's report was explicitly PDF-specific throughout.

## 23. Batch 15 — Vercel Error Investigation, Service Worker Staleness Fix, Shipment Rename, EXP No. Year Dedup, Per-Field EXP/AWB/PC Dates (R29)

Full detail in AGENT_PROGRESS_15.md. Opened with a live-site investigation (5 screenshots: browser
console, 3 Vercel dashboard panels, 1 reference photo) before any of the 3 new feature requests.

**Vercel error investigation.** The same generic error from Batch 13's opening report was still
occurring, alongside persisting `/api/currency` and `/api/settings` 500s. Confirmed via direct code
read that both routes already have Batch 13's `force-dynamic` fix correctly in place, and ruled out
every other code-level throw source reachable from either route (`fetchLiveRates()` is fully
defensive — every provider call has its own try/catch, confirmed by direct read, matching its own
"Never throws" doc comment; Settings' `required` fields are all inside array sub-schemas that don't
validate on an empty first-create). With both routes' own code already correct, the most likely
remaining explanation for a live 500 on both simultaneously is either a deployment that predates
these fixes reaching Vercel, or a genuine MongoDB connectivity issue at the infrastructure level
(env var, Atlas Network Access, or a paused cluster) — not something fixable from inside the
codebase. Flagged clearly for the user to check rather than presented as resolved.

Separately, found and fixed a real, independent bug while investigating: the console showed a
service worker registering (confirmed this app is a PWA — public/sw.js, manifest.json). It
correctly bypasses `/api/` routes entirely (not the cause of the two 500s specifically), but its
page-caching strategy was cache-first with only a background refresh — the wrong tradeoff for pages
like `/` that are Server Components rendering live DB data (prices, campaigns, stock) on every
request. An online visitor could be served a stale cached homepage indefinitely with no way to tell.
Rewrote to network-first with cache only as an offline fallback, and bumped the cache name (v1→v2,
never bumped before) so the update actually clears old cached entries via the existing cleanup logic
that had never once triggered.

**Request 1 — rename shipments.** No dedicated name field exists; `shipmentNo` (required, unique-
indexed) is the identifying label throughout. Before writing any UI, found that the shipment PUT
route does a full-document REPLACE, not a `$set` — a naive rename endpoint would have wiped every
other field. Found an exact existing precedent for this same problem already in the route
(`documentTextOverridesOnly`) and followed it precisely: added a `shipmentNoOnly` branch that does a
proper $set-only update, catches the duplicate-key error from `shipmentNo`'s unique index with a
specific message, and sits after the existing incentive-lock check so a locked/claimed shipment
still correctly refuses a rename. Added a small rename button to the two real shipment-management
list views (the Contract-scoped list and the Export Archive), using `window.prompt()` to match each
file's own already-established native-dialog convention (both already use `confirm()` for delete).

**Request 2 — EXP No. year duplication.** Found and fixed two independent instances of the same
bug, not just the one specifically pointed at. `expNoWithYear` (Ka Form Section E's EXP column,
both languages) unconditionally appended a year that the admin now enters as part of `expNo` itself
— renamed to `expNoWithDate`, stopped appending, and properly wired in the real `expDate` field for
the column's actual "& Date" half (which the old code only ever half-delivered — a bare year, never
a full date). While investigating, independently found `buildExpSequence` (feeds the declaration
paragraph's "EXP Nos. X, Y, and Z" text) had the identical bug via an older, no-longer-valid
assumption — fixed the same way. Not explicitly named by the user, but the same stated principle
applied directly; leaving it would have reproduced their exact complaint in a different spot.

**Request 3 — individual EXP/AWB/PC dates.** The schema already had all three date fields
(`expDate`/`awbDate`/`pcDate` — a prior round had added `expDate` for the Ka Form fix above, and
`awbDate`/`pcDate` existed but were never wired to anything). Found the codebase's own established
`"{value} DT:{date}"` inline pattern (already used for Invoice No.) and followed it exactly for all
three identifiers, across all three document generators (Packing List, the shared Invoice generator,
and the DOCX/XLSX data-assembly function — included DOCX/XLSX this round since the request wasn't
format-specific). Added the missing `awbDateStr`/`pcDateStr` UI inputs to the shipment editor,
matching `expDate`'s existing input exactly; confirmed the general save path's `{...form}` spread
needed no additional API changes since the schema already had these fields.

**Verification:** tsc clean across all 7 touched files (one pre-existing, already-documented false
positive in sw.js unrelated to this round's edit — a Service Worker global tsc can't resolve without
full lib definitions, same class as the earlier `Buffer` false positive).

## 24. Setup Reminder

```bash
npm install
cp .env.example .env.local   # fill in MongoDB/Cloudinary/Stripe/SMTP/Google/etc.
npm run seed
npm run dev
```

Demo Super Admin: `admin@shahintl.com` / `SuperAdmin123!`
