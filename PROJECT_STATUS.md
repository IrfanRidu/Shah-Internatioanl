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

## 16. Setup Reminder

```bash
npm install
cp .env.example .env.local   # fill in MongoDB/Cloudinary/Stripe/SMTP/Google/etc.
npm run seed
npm run dev
```

Demo Super Admin: `admin@shahintl.com` / `SuperAdmin123!`
