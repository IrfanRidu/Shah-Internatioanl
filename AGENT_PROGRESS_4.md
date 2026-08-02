# AGENT PROGRESS TRACKER — Shah International — Batch 4
> READ THIS FILE FIRST on every resume/continue. Working copy: /home/claude/work/site (contains
> completed batch 1 [AGENT_PROGRESS.md], batch 2 [AGENT_PROGRESS_2.md], batch 3 [AGENT_PROGRESS_3.md]
> work — do not re-touch those areas unless directly relevant to one of THIS batch's issues).
> Final deliverable: zip of /home/claude/work/site (minus node_modules/.next/.git) →
> /mnt/user-data/outputs/shah-international-v5.zip
> ENVIRONMENT (re-confirmed): no node_modules, no network (curl to registry.npmjs.org → 403
> host_not_allowed), no git. Cannot run `npm install`/`next build`/`next dev`/tsc. Verification =
> careful manual reading + `node --check`-equivalent (see below) + re-viewing every file immediately
> after every edit (batches 2 and 3 both caught self-introduced bugs this exact way — MANDATORY habit,
> do not skip).
> Verify command available: `node --input-type=module --check < file` for plain .js (models/lib/api
> routes) — a REAL parser. For .jsx: `python3 /home/claude/verify.py <file>` — a from-scratch
> dependency-free brace/paren/bracket + JSX-tag balance checker (built this batch since there's no
> node_modules/babel/tsc at all). Not a real parser, but verified against known-good files (0 false
> positives) and deliberately-broken test copies (catches real mistakes). Run after EVERY .jsx edit.

## THE 14 ISSUES (user's own numbering, this batch)
1. 500 error on /api/admin/metrics (both dashboard + analytics pages) — "unrecognized option to
   $unwind stage: preserveNullAndEmpty".
2. Product detail page: different campaigns display ONLY date/time, no actual products; all
   campaigns appear to merge into one generic "Active Campaigns" section with no product cards.
3. Export Archive: need one merged "All Documents for (Shipment Name)" PDF per shipment (this exists
   per batch 3 log) — but documents uploaded in the "Other Details" tab are NOT included in the merge.
4. Auto-pick Harvesting months: harvesting season (in-season vs pre-order) must be automatically
   derived from the current date/time vs. the product's configured harvesting months, not a manual
   toggle.
5. Shelf life must be counted automatically in days (not a free-text field admin fills in by hand).
6. Product cards must NOT show organic-certified/featured badges ON the product image — move them
   to under the product name on the card, and show them in the product detail page too.
7. Admin coupon form needs a product search + multi-select picker (model already supports
   `applicableProducts`, UI never exposed it).
8. Coupons need BOTH an overall usage limit (exists, enforced) AND a per-user usage limit (field
   `usagePerUser` exists on the model but is never surfaced in the admin form NOR enforced at
   checkout — checkout's /api/coupons/validate doesn't even know which user is asking).
9. If a product is in a campaign AND the campaign's discount > the product's own discount, use the
   campaign discount; if the product's own discount is higher, keep using the product's own discount.
   (i.e. always take whichever discount is more favorable to the buyer.)
10. Campaigns for international buyers show a PRICE RANGE + discounted PRICE RANGE on product cards;
    campaigns for local buyers show a single PRICE + discounted PRICE.
11. Campaigns must dynamically filter by buyer type: international-only campaigns show only to
    international buyers, local-only show only to local buyers (targetAudience field already exists
    on FlashSale/SpecialSection models — need to confirm it's actually enforced everywhere it's
    rendered, not just modeled).
12. Products within a campaign auto-scroll left/right, pausing on hover/touch (exists on homepage
    FlashSaleSection per batch-1 log — must confirm same behavior applies everywhere campaigns render,
    esp. after issue-2's rebuild of ActiveCampaignsStrip).
13. Homepage restructure: dedicated "Currently Harvesting" section, dedicated "Available for
    Pre-Order" section, then one section PER CATEGORY (each showing that category's products) —
    alongside campaigns. No product may appear twice anywhere on the homepage. Buyer-type visibility
    must be respected throughout (local-only products only in local UI, international-only only in
    international UI, both-type in both).
14. Freight Cost must be entered/stored in the shipment's OWN base currency, then converted to BDT
    using that shipment's configured exchange rate to compute Total Cost (BDT) wherever that applies.

## KEY FILES MAP (confirmed via reading, not assumed)
- Campaign model = `models/FlashSale.js` (renamed "Campaign" in UI/admin), has `targetAudience`
  enum all/local/international, `items[]` with per-item `salePrice`/`salePriceUSD`/
  `discountPercentage`. Curated (non-discount) carousels = `models/SpecialSection.js`, also has
  `targetAudience` + `position` (home/productDetail/both).
- Campaign display components: `components/home/FlashSaleSection.jsx` (homepage — GOOD reference
  pattern: real product cards, auto-scroll w/ pause-on-hover/touch, arrows, uses PriceDisplay,
  respects branding fields) vs `components/product/ActiveCampaignsStrip.jsx` (product-detail-page —
  BROKEN: renders one link-card per campaign showing only badge+title+countdown+"N products on
  offer" text, never renders actual product cards/images — THIS is issue 2's root cause).
  `components/home/SpecialSection.jsx` and `components/product/RelatedProducts.jsx` /
  `RecommendedForYou.jsx` / `BestSellingProducts.jsx` are the other carousels to check for the same
  auto-scroll pattern (issue 12) once ActiveCampaignsStrip is rebuilt.
- Homepage: `app/(shop)/page.jsx` (server) + `app/(shop)/HomeClientWrapper.jsx` (client) — need to
  read fully to see current section list/order before restructuring for issue 13.
- Product detail page: `app/(shop)/products/[slug]/page.jsx` computes campaigns/sections/related/
  recommended/best-selling server-side with a shared exclude list (per batch-1 log) — need to
  re-read current state, confirm campaigns really are buyer-type-filtered server-side already or if
  that's issue 11's gap.
- Pricing: `components/product/PriceDisplay.jsx` (need to read) — issue 9/10 will likely center here
  plus wherever campaign salePrice/discountPercentage is compared against the product's own
  price/discountPrice or priceRangeMin/Max.
- Product model (`models/Product.js`) confirmed fields relevant to this batch:
  `harvestingMonths: [Number]` (1-12) EXISTS but `isHarvestingSeason: Boolean` is a manual flag not
  derived from it (issue 4). `shelfLife: String` is free text (issue 5 — need to decide exact
  interpretation; check admin form + product detail rendering first). `isOrganic`/`isFeatured`
  booleans exist (issue 6). `availableForLocal`/`availableForInternational` exist (issue 11/13
  reuse the same visibility helper `isProductVisibleToBuyer` from `lib/utils.js`).
- Coupon: `models/Coupon.js` ALREADY has `applicableProducts: [ObjectId ref Product]` and
  `usagePerUser: Number` (default 1) — confirmed the admin UI (`app/admin/coupons/page.jsx`) exposes
  NEITHER (no product picker, no per-user-limit input), and `/api/coupons/validate/route.js` checks
  overall `usageLimit` but never looks at `usagePerUser`, and doesn't even receive a user identity to
  check per-user usage against (issue 7/8 gap confirmed).
- Export archive merge: `lib/exportDocuments.js` `generateAllDocumentsPDF()` (built in batch 3, issue
  11 of that batch) merges the 3 generated docs + PDF `additionalDocs` attachments. Batch-2's log
  mentions shipment `photos: [{url, caption}]` added to `ExportShipment` model for the "Other Details"
  tab (issue 43 of batch 2) — need to check: (a) does "Other Details" tab have its own SEPARATE
  document/attachment field distinct from `additionalDocs` that generateAllDocumentsPDF doesn't know
  about? This is almost certainly issue 3's gap — investigate `ExportShipment.js` schema + the
  shipment editor's "Other Details" tab fully before fixing.
- Freight cost / currency: `lib/utils.js` `calculateShipmentFinancials()` (batch 2) — need to check
  whether `freightCost` is currently assumed to already be in BDT vs. the shipment's own currency,
  and where the shipment's own currency/exchange rate fields live on `ExportShipment.js`.
- Verified fixed already (issue 1): `app/api/admin/metrics/route.js` line 136, `preserveNullAndEmpty`
  → `preserveNullAndEmptyArrays`. Only occurrence in the whole codebase (grepped). Confirmed both
  dashboard (`app/admin/page.jsx`) and analytics (`app/admin/analytics/page.jsx`) call this same
  endpoint, so one fix covers both reported URLs.

## PLAN (grouped by shared files, roughly in dependency order)
- [x] G0. Environment re-verification + full repo orientation (done above).
- [x] G1 (issue 1). $unwind typo fix. DONE, verified only occurrence.
- [x] G2 (issues 2, 9, 10, 11, 12). Campaign display cluster — COMPLETE, see LIVE LOG for exact
      file-by-file summary. targetAudience is now enforced everywhere a campaign/section renders
      EXCEPT app/(shop)/page.jsx's server query (deliberately deferred into G3 below since that
      file's data-fetching is being rewritten there anyway).
- [x] G4 (issue 6). Product card + product detail page badge repositioning — COMPLETE (done as part
      of G2 above since it touched the same files).
- [x] G5 (issues 4, 5). COMPLETE. Self-healing architecture (lib/harvestSeason.js +
      computeHarvestingSeason in lib/utils.js) since no cron exists. Files touched & verified:
      models/Product.js (shelfLife→Number, +index), app/api/products/route.js (GET syncs, POST
      derives), app/api/products/[id]/route.js (GET applies, PUT re-derives), product detail
      page.jsx (applies to viewed product), app/admin/products/new/page.jsx (shared create/edit
      form — removed manual toggle, added live computed status badge, shelfLife→number input),
      app/admin/products/page.jsx (removed toggleSeason button + bulk option), app/api/admin/
      products/bulk/route.js (removed 'season' case), ProductDetailClient.jsx + compare/page.jsx
      (shelfLife formatted as "X day(s)"), scripts/seed.js (schema + 10 example values converted to
      representative day counts). tests/unit/utils.test.js's buildProductQuery test still passes
      conceptually — that function's logic wasn't changed, only callers now sync before querying.
- [x] G3 (issue 13). COMPLETE. New reusable `components/home/ProductCarouselSection.jsx`
      (generalizes the proven FeaturedProducts.jsx pattern — kept that file untouched, used only for
      the pre-existing Featured section, to avoid any risk to its established class hooks).
      `app/(shop)/page.jsx` `getHomeData()` REWRITTEN: fetches ALL categories (not just the top-8
      tile cap) for per-category sections; builds one page-wide sequential `excludeIds` set —
      campaigns claim first, then special sections (cross-filtered against campaigns too, since
      those two are fetched in parallel and could otherwise overlap — caught and fixed this gap
      myself before it shipped), then Featured, then Currently Harvesting
      (`isHarvestingSeason:true`), then Available for Pre-Order (`allowPreOrder:true,
      isHarvestingSeason:false` — matches the existing pre-order badge logic on the product detail
      page), then one section per category with whatever's left — each step's query excludes
      everything already claimed by every step before it, guaranteeing no product repeats anywhere
      on the page. Also folded in the G2-deferred server-side `campaignAudienceQuery`
      (issue 11) and added `buyerVisibilityQuery` to the homepage's campaign/section populate
      matches for logged-in users (previously only client-side filtered on the homepage).
      `app/(shop)/HomeClientWrapper.jsx` REWRITTEN: renders the 3 new sections in the order the
      issue lists them (Currently Harvesting → Pre-Order → ... → one per category, after
      Featured/Special Sections), each still going through the same buyer-type + non-empty
      filtering pattern as every other section, and still fully participating in the existing
      campaign-interleaving logic (campaigns now spread across a larger set of blocks). Added
      `allowPreOrder` filter support to `buildProductQuery` (lib/utils.js) and a `preOrder` URL
      param to `app/api/products/route.js` (discovered + corrected along the way: the existing
      harvesting filter's URL param is `harvesting`, not `isHarvesting` — used the correct one for
      the Currently Harvesting section's View All link). All files re-viewed in full + verified.
- [x] G6 (issues 7, 8). COMPLETE. New `components/admin/ProductMultiSelect.jsx` (search-as-you-type
      picker, chips for selected products — checked for an existing reusable component first;
      found `ProductNameCombobox.jsx` but it's single-select/text-replacement, not a fit for a
      multi-select array, so built a purpose-made one instead, reusing the same search/UX pattern).
      `app/admin/coupons/page.jsx`: wired the picker to `applicableProducts` (converts the picker's
      `{_id,name}` display pairs to plain IDs on save), added a "Usage Limit Per User" field for
      `usagePerUser` (model already had the field, UI never exposed it). `app/api/coupons/route.js`
      GET now populates `applicableProducts` with name/slug so the edit modal can show chips
      without a separate lookup. Enforcement implemented at BOTH points: `/api/coupons/validate`
      (pre-flight, while shopping — now checks per-user usage via session + `usedBy`, and
      product-eligibility via a new `productIds` field the client now sends, sourced from
      `CartContext.jsx`'s cart items) AND `/api/orders` POST (the actually-authoritative point,
      since order placement requires login so `session.user.id` is always available there —
      discovered this route never checked `usageLimit`/`usagePerUser`/`applicableProducts` at all
      before incrementing usage, only re-checked dates/minimum-order; fixed all three checks here
      too, plus fixed usage tracking itself to properly maintain BOTH `usedCount` (overall) and each
      user's own entry in `usedBy` (previously only `usedCount` was ever incremented, `usedBy` was
      dead data despite existing on the schema). Did NOT enforce `applicableCategories` or
      `applicableFor` (buyer-type) — both exist on the model but neither was asked for in issues
      7/8, and adding enforcement for fields nobody asked about is unrequested scope creep, however
      low-risk it might seem; left those exactly as they were.

## LIVE LOG (append-only, most recent last)
- Batch 4 tracker created. Environment re-confirmed identical to batches 2/3 (no node_modules, no
  network, no git). Read all 3 prior AGENT_PROGRESS files + PROJECT_STATUS.md + README.md in full
  before touching anything, per user's explicit instruction to read carefully first.
- **Issue 1 done and verified.** Exact typo found via grep (`preserveNullAndEmpty` at
  app/api/admin/metrics/route.js:136, only occurrence in repo). Fixed to
  `preserveNullAndEmptyArrays`. Confirmed both `/api/admin/metrics?currency=BDT` (dashboard) and
  `/api/admin/metrics?from=...&to=...` (analytics) hit this exact same endpoint/aggregation, so this
  single fix resolves both reported URLs. Checked the parallel `/api/admin/analytics/advanced` route
  too (loads alongside metrics on the Analytics page) — its own `$unwind`/`$lookup` usage is
  syntactically correct, no similar bug, left untouched.
- Read models/Product.js, models/FlashSale.js, models/SpecialSection.js, models/Coupon.js fully.
  Read app/admin/coupons/page.jsx + app/api/coupons/validate/route.js fully — confirmed issue 7/8
  gaps precisely (see KEY FILES MAP above). Read components/product/ActiveCampaignsStrip.jsx (issue
  2's exact bug, confirmed) and components/home/FlashSaleSection.jsx (the correct reference pattern
  to mirror) in full.
- Starting G2 (campaign display cluster) now — next step is reading PriceDisplay.jsx and the
  product detail page's current server-side campaign computation before writing any code.
- **G2 investigation complete — precise root causes confirmed for issues 2, 6, 9, 10, 11 (reading
  PriceDisplay.jsx, ProductCard.jsx, Product.js, FlashSale.js, app/admin/flash-sales/page.jsx,
  app/(shop)/products/[slug]/page.jsx + ProductDetailClient.jsx + ActiveCampaignsStrip.jsx,
  contexts/BuyerTypeContext.jsx, lib/utils.js in full):**
  - **Product pricing fields (models/Product.js):** local = `price`/`discountPrice` (BDT). Intl =
    `priceRangeMin`/`priceRangeMax` (USD) — NO discount-range field exists on Product at all, so a
    product's "own" international discount doesn't exist as stored data; it must be DERIVED from the
    local discount ratio (`1 - discountPrice/price`) applied proportionally to the range. This is the
    cleanest consistent design (see below).
  - **Campaign item fields (models/FlashSale.js `CampaignItemSchema`):** `salePrice` (BDT, admin
    enters an absolute number), `salePriceUSD` (exists on schema but admin UI never has an input for
    it — confirmed by reading app/admin/flash-sales/page.jsx's item form, only `salePrice` +
    `discountPercentage` inputs exist), `discountPercentage` (admin enters a plain % number). Given
    salePriceUSD is dead/unset in practice, `discountPercentage` is the only usable cross-currency
    signal for international campaign discounts.
  - **Design for issue 9 + 10 (write as a new pure helper, `getEffectivePricing(product, item)` in
    lib/utils.js):** compute `ownPct = (discountPrice && price && discountPrice < price) ? 1 -
    discountPrice/price : 0`. Compute campaign pct as
    `Math.max(price>0 ? Math.max(0, 1 - salePrice/price) : 0, (discountPercentage>0 ?
    discountPercentage/100 : 0))` (take whichever of the campaign's two admin-entered signals implies
    the bigger discount). Then `effectivePct = Math.max(ownPct, campaignPct)` — THIS single line is
    issue 9 in its entirety ("whichever discount is bigger wins/is counted"), and it's backward
    compatible (no campaign ⇒ campaignPct=0 ⇒ unchanged behavior). Apply `effectivePct` to BOTH local
    (`price * (1-effectivePct)`) and international (`priceRangeMin/Max * (1-effectivePct)`) — this is
    issue 10, and it naturally falls out of the same helper.
  - **PriceDisplay.jsx gap:** international branch currently has ZERO discount concept (just shows
    the plain range, no strikethrough, no discounted range) — needs a new optional discounted-range
    render path. Local branch only compares `product.discountPrice` vs `product.price` directly, no
    concept of an externally-computed "effective" price. PLAN: add an optional `effective` prop
    (`{ price, original, min, max, originalMin, originalMax }`) — when passed, overrides the
    product-derived numbers; when absent, current behavior is 100% unchanged (safe for the two
    non-campaign call sites: default ProductCard.jsx usage and default
    ProductDetailClient.jsx usage).
  - **Issue 2 root cause (components/product/ActiveCampaignsStrip.jsx), fully confirmed:** renders
    ONE link-card per campaign with only a badge/title/countdown-timer/"N products on offer" text —
    never renders an actual product image, name, or price for ANY product. This is the literal bug
    the user described ("only date and time... without any products"). REBUILD PLAN: mirror
    components/home/FlashSaleSection.jsx's proven pattern (real product cards in an
    auto-scroll-with-pause-on-hover/touch track, manual arrows) instead of the generic link-box.
    Extract the shared card-track markup into a new component,
    `components/product/CampaignProductTrack.jsx`, reused by both FlashSaleSection (homepage) and the
    rebuilt ActiveCampaignsStrip (product detail page) — avoids duplicating the auto-scroll rAF logic
    twice and keeps issue 12's behavior guaranteed identical everywhere campaigns render.
  - **Issue 9's bug in FlashSaleSection.jsx today (line ~75):**
    `.map(item => ({ ...item.product, price: item.salePrice, discountPrice: null }))` —
    UNCONDITIONALLY overwrites price with the campaign's salePrice and WIPES discountPrice to null,
    discarding the product's own discount entirely even when it was better. Also has NO effect at all
    for international buyers today (PriceDisplay's intl branch ignores price/discountPrice
    completely) — confirms issue 10's international gap precisely. FIX: replace this line to use
    `getEffectivePricing` and pass its result via PriceDisplay's new `effective` prop instead of
    mutating product.price/discountPrice.
  - **Issue 11 root cause, fully confirmed at BOTH layers:**
    (a) Server (app/(shop)/products/[slug]/page.jsx): `SpecialSection.find({isActive, position...})`
    and `FlashSale.find({isActive, startTime, endTime...})` — NEITHER query filters by
    `targetAudience` at all; only per-PRODUCT visibility is applied via populate `match`. A
    local-only or international-only CAMPAIGN itself is never excluded.
    (b) Client (app/(shop)/products/[slug]/ProductDetailClient.jsx `visibleSections`/
    `visibleCampaigns`, and components/home equivalents): only filters each section/campaign's
    products by `isProductVisibleToBuyer`; never checks the section/campaign's OWN `targetAudience`
    field against the current buyer type. ActiveCampaignsStrip.jsx DOES have a targetAudience filter
    but only inside its self-fetch fallback branch (`useEffect`'s `.then`), which never runs in the
    normal flow since `page.jsx` always supplies `campaignsProp` (even as `[]`, which is truthy so
    the effect returns early without fetching/filtering).
    FIX: add a new tiny helper `isCampaignVisibleToBuyer(campaign, buyerType)` next to
    `isProductVisibleToBuyer` in lib/utils.js (`targetAudience` undefined/'all' ⇒ visible to
    everyone; else must match `buyerType` exactly), then apply it (i) server-side in page.jsx's two
    queries for logged-in users (`session?.user?.buyerType` known there, mirrors the existing
    `buyerVisibilityQuery` precedent exactly) AND (ii) unconditionally client-side in
    ProductDetailClient.jsx's `visibleSections`/`visibleCampaigns` computation (covers guests, whose
    true buyer type per contexts/BuyerTypeContext.jsx is ONLY ever known client-side via
    localStorage — confirmed by reading that file in full, it is the documented "source of truth"
    and is NOT mirrored into any cookie the server could read). Must apply the identical fix
    everywhere else campaigns/sections render: components/home/HomeClientWrapper.jsx +
    components/home/SpecialSection.jsx + the public GET handlers in app/api/flash-sales/route.js and
    app/api/special-sections/route.js (still need to read all of these — next step).
  - **Issue 6 root cause (components/product/ProductCard.jsx lines 56-60):** `isFeatured`
    (⭐ badge) and `isOrganic` (🌿 Organic badge) render inside the absolute-positioned top-left
    overlay ON the product image, alongside `SeasonLabel` (which issue 6 does NOT ask to move —
    leave it in place, only relocate isFeatured/isOrganic). FIX: remove those two lines from the
    image overlay, add a small badge row directly under the `<h3>` product name in the info section
    instead. Also must add the same organic/featured indicator to the product detail page — read
    ProductDetailClient.jsx lines 124-173 next (currently truncated in my view — only confirmed line
    124 has an on-image organic badge in the image gallery area, same relocation likely needed there,
    need the full picture before editing).
- **Issue 14 strong lead found (lib/utils.js `calculateShipmentFinancials`, read in full):** its own
  doc-comment says "every field here is expected in the shipment's stored base (BDT) unit" —
  currently `freightCost` is summed directly into `totalCost` as if already BDT
  (`totalCost = freightCost + goodsCost + exportProcessingCost + othersCost + damage`), exactly
  contradicting issue 14 ("Freight Cost will be in the base currency of the particular shipment...
  converted in BDT against the Rate in BDT"). This is the SAME conversion pattern already used one
  line below for `orderValueForeign` (`receiveAmountBDT = orderValueForeign * exchangeRateBDT`) — so
  the fix is almost certainly: convert `freightCost` the same way before summing into totalCost. Have
  NOT yet confirmed the ExportShipment model's currency field(s) or the shipment editor's freight
  cost input UI/labels — MUST check models/ExportShipment.js and the shipment editor page fully
  before editing this (need to know exactly which currency field the "base currency of the
  particular shipment" refers to, and every call site of calculateShipmentFinancials, since a
  signature/meaning change here is a breaking change that must be propagated everywhere it's called
  — grep for `calculateShipmentFinancials` usages before touching it).

- **Tooling: built /home/claude/verify.py** (a from-scratch, dependency-free JS/JSX sanity checker,
  since there's no node_modules/babel/tsc available at all in this sandbox). Checks (1) balanced
  `{}/()/[]` ignoring string/template-literal/comment contents, (2) balanced JSX tags via a
  brace-depth-aware character scanner (a naive regex first attempt produced false positives on this
  codebase's very common `onClick={() => {...}}` style, since `=>` contains a literal `>` — fixed by
  tracking brace depth while scanning for a tag's terminating `>`). Verified against 7 known-good
  unmodified files (0 false positives) AND two deliberately-broken copies (removed a `</div>`;
  removed a `)` ) — both correctly flagged. Usage from here on: `python3 /home/claude/verify.py
  <file1> <file2> ...` after every edit to a .js/.jsx file, in addition to (not instead of) actually
  re-reading the diff/file. `node --input-type=module --check < file.js` remains the go-to for plain
  .js (no JSX) files since that's a REAL parser, not a heuristic.
- **components/product/PriceDisplay.jsx REWRITTEN and verified** (both `node --check`-equivalent via
  verify.py, and manually re-read the full diff before applying). Added optional `campaignItem` prop;
  computes via `getEffectivePricing`. Local branch behavior is byte-for-byte equivalent to before when
  `campaignItem` is omitted (same displayPrice/original derivation, just routed through the shared
  helper). International branch gained a full compact/non-compact split (previously shared one
  return path with no compact-specific layout) with a discounted-range display that only activates
  when `campaignItem` is supplied — plain range unchanged everywhere else. Fixed-height 2-row compact
  skeleton (row 2 reserved-but-empty when no discount) now applies to BOTH buyer types consistently,
  so mixed discounted/non-discounted cards in the same grid never end up with mismatched heights.

- **components/product/PriceDisplay.jsx REWRITTEN and verified** (both `node --check`-equivalent via
  verify.py, and manually re-read the full diff before applying). Added optional `campaignItem` prop;
  computes via `getEffectivePricing`. Local branch behavior is byte-for-byte equivalent to before when
  `campaignItem` is omitted (same displayPrice/original derivation, just routed through the shared
  helper). International branch gained a full compact/non-compact split (previously shared one
  return path with no compact-specific layout) with a discounted-range display that only activates
  when `campaignItem` is supplied — plain range unchanged everywhere else. Fixed-height 2-row compact
  skeleton (row 2 reserved-but-empty when no discount) now applies to BOTH buyer types consistently,
  so mixed discounted/non-discounted cards in the same grid never end up with mismatched heights.
- **G2 CLUSTER COMPLETE (issues 2, 6, 9, 10, 11, 12) — every file touched, re-viewed, and verified:**
  - `components/home/FlashSaleSection.jsx`: fixed the issue-9 bug (no longer overwrites
    price/discountPrice with the raw campaign salePrice) — now keeps `campaignEntries` (product+item
    pairs) untouched and passes `campaignItem={entry}` to PriceDisplay; Add-to-Cart snapshot fixed the
    same way via `getEffectivePricing` so the cart total matches what's displayed. Verified with
    verify.py + full re-read; no stale references to the old `products` variable remained.
  - `components/product/ActiveCampaignsStrip.jsx`: REBUILT — deleted the entire broken "one link-card
    per campaign, no products shown" implementation (issue 2's exact bug) and now just renders
    `<FlashSaleSection sale={c} />` per eligible campaign (real product cards, auto-scroll, pause on
    hover/touch, full branding — all inherited for free, can't drift out of sync with the homepage
    version again). Added the missing `isCampaignVisibleToBuyer` filter unconditionally (issue 11 —
    previously only existed in a fallback fetch branch that the normal flow never reached).
  - `app/(shop)/products/[slug]/ProductDetailClient.jsx`: added `isCampaignVisibleToBuyer` filtering
    to `visibleSections`/`visibleCampaigns` (issue 11). Issue 6: removed the on-image organic badge
    from the gallery; moved the SeasonLabel+Featured badge row from ABOVE the h1 to BELOW it
    (truly "under the product name" per the literal wording) and added an Organic badge there too;
    added an "Organic Certified" entry to the specs grid (imported `Sprout` icon for it). Verified —
    full file re-read top to bottom after all edits, reads coherently.
  - `app/(shop)/products/[slug]/page.jsx`: added `campaignAudienceQuery` (mirrors the existing
    `buyerVisibilityQuery` pattern exactly) to both the SpecialSection and FlashSale server queries,
    scoped to signed-in users (issue 11, server-side half — guest half already covered by the
    ProductDetailClient.jsx client-side filter above, same reasoning as the pre-existing
    buyerVisibilityQuery split).
  - `app/(shop)/HomeClientWrapper.jsx`: same `isCampaignVisibleToBuyer` filter added to
    `visibleFlashSales`/`visibleSections` (issue 11 on the homepage). NOTE: did NOT yet add the
    equivalent server-side `campaignAudienceQuery` to `app/(shop)/page.jsx`'s `getHomeData()` — that
    file's data-fetching is about to be substantially rewritten for issue 13 (homepage restructure)
    anyway, so the session-based server-side optimization will be folded into that rewrite rather
    than done twice. The client-side fix just made is already fully correct/complete on its own in
    the meantime (matches how guests were always handled).
  - `components/product/ProductCard.jsx`: issue 6 — removed isFeatured/isOrganic from the
    absolute-positioned image overlay (SeasonLabel deliberately left in place, issue 6 doesn't
    mention it), added a small badge row directly under the `<h3>` product name instead. Removed the
    now-unused `Badge` import. Verified with verify.py.
  - Confirmed NOT needed: `app/api/flash-sales/route.js` and `app/api/special-sections/route.js`
    (public GET handlers) — read both in full, neither ever filtered by targetAudience even before
    this batch (fully relies on client-side filtering per the codebase's established pattern for
    guest buyer-type, confirmed via contexts/BuyerTypeContext.jsx) — left untouched, no gap here that
    isn't already covered by the client-side fixes above.
  - Confirmed NOT needed: `components/home/SpecialSection.jsx` (the shared curated-carousel
    component) — it has no per-item discount concept at all (SpecialSection model has no
    salePrice/discountPercentage fields, just a plain product list), so `getEffectivePricing` doesn't
    apply to it; and it receives already-audience-filtered `section` objects from its callers
    (HomeClientWrapper/ProductDetailClient, both fixed above), so it needs no direct changes. Its
    carousel (`components/ui/Carousel.jsx`) was independently confirmed to already implement
    auto-scroll + pause-on-hover/touch correctly (issue 12 was already satisfied here, only
    ActiveCampaignsStrip was missing it, now fixed by reusing FlashSaleSection).

- **IMPORTANT TOOLING FIX to /home/claude/verify.py**: discovered it was treating apostrophes inside
  plain JSX text content (e.g. "today's", "there's", "don't") as JS string delimiters, since JSX text
  isn't JavaScript and quotes there are just literal characters — this corrupted parsing of
  everything after such a word in some cases, causing FALSE issue reports (caught this for real on
  app/admin/products/new/page.jsx, see below). Fixed with a heuristic: only treat a quote as entering
  string mode when the immediately-preceding character is NOT a word character (a real JS string's
  opening quote is never immediately preceded by an identifier with zero gap, but a contraction's
  apostrophe always is). Re-verified all 10 files touched so far with the fixed checker — all still
  OK, so nothing was actually masked. Re-ran the true/false-positive regression tests too — still
  correctly flags a real removed closing tag. Backticks no longer share this heuristic (kept as
  always-enter-string, template literals are rare enough here and less apostrophe-like).
- **G5 (issues 4 + 5) IN PROGRESS.** Grepped all 22 consumers of `isHarvestingSeason`. Decision:
  given no cron/scheduler exists in this project, implemented a "self-healing on read" architecture
  instead of trusting a periodically-stale stored boolean — see new file `lib/harvestSeason.js`
  (`syncHarvestingSeasonStatus()` bulk-corrects via two cheap indexed `updateMany` no-ops once in
  sync, called from the highest-traffic list endpoint; `applyComputedHarvestSeason()` /
  `applyComputedHarvestSeasonToAll()` correct a single doc/array in-memory + fire a non-blocking
  write, for read paths that fetch by id/slug rather than a list). Pure compute function
  `computeHarvestingSeason(harvestingMonths, now)` lives in lib/utils.js (client-safe, no DB import,
  used for the admin form's live preview too). Products with NO harvestingMonths configured are
  left alone entirely (both functions return/no-op on `null`), preserving legacy behavior.
  Done so far, all verified: `models/Product.js` (`shelfLife: String`→`{type:Number,min:0}` — issue
  5, see rationale below; added `harvestingMonths` index). `app/api/products/route.js` (GET calls
  `syncHarvestingSeasonStatus()` before querying; POST derives `isHarvestingSeason` from
  `harvestingMonths` server-side, ignoring whatever the client sent). `app/api/products/[id]/route.js`
  (GET applies `applyComputedHarvestSeason`; PUT re-derives when `harvestingMonths` is present in the
  update, doesn't touch it otherwise so a partial edit can't stomp it with `undefined`).
  `app/(shop)/products/[slug]/page.jsx` (applies `applyComputedHarvestSeason` to the viewed product).
  `app/admin/products/new/page.jsx` (shared create/edit form — confirmed via reading
  `app/admin/products/[id]/page.jsx` that it's a thin wrapper reusing this same `ProductForm`, so one
  file covers both flows): removed the manual "Currently In Harvesting Season" Toggle entirely,
  replaced with a live read-only status badge computed from `form.harvestingMonths` via
  `computeHarvestingSeason` (three states: no months picked yet / currently harvesting / off season);
  `handleSubmit` now sends the computed value, never a hand-set one; shelfLife input changed from
  free-text ("e.g. 7 days") to `type="number"` labeled "Shelf Life (Days)", coerced to
  Number-or-null on submit.
  **Issue 5 semantics decided**: grepped every `shelfLife` consumer first — found `scripts/seed.js`
  has rich descriptive strings like "Whole: 1 week; Cut: 3-5 days refrigerated" and "12 months dried"
  as demo data. Decided AGAINST trying to preserve that multi-condition nuance in a single number
  (would require a much bigger data-model change nobody asked for) — instead `shelfLife` becomes one
  plain number of days, consistently auto-formatted as "X day(s)" wherever shown, which is what
  "counted in days automatically" most directly asks for; nuanced handling notes still have a home in
  the pre-existing separate `storageInstructions` free-text field, so no real information-capturing
  capability is lost, just moved to the field that already existed for exactly that purpose.
  **STILL TO DO for G5**: `app/admin/products/page.jsx` (remove `toggleSeason` inline button + the
  bulk "🌿 Mark In Season" dropdown option — both are manual overrides that must go, per the same
  "no manual toggle" reasoning) + `app/api/admin/products/bulk/route.js` (remove the now-invalid
  `case 'season'`); format `shelfLife` display as "X day(s)" in
  `app/(shop)/products/[slug]/ProductDetailClient.jsx` (currently a raw passthrough of the old string
  field — already restructured for issue 6 this batch, will need re-viewing before editing again) and
  `app/(shop)/products/compare/page.jsx`; update `scripts/seed.js`'s OWN inline duplicate schema
  (`shelfLife: String` → `Number`) and convert its example string values to representative day
  counts.
  *(This snapshot was mid-G5 — all of the above was subsequently finished; see the "G5 (issues 4, 5).
  COMPLETE" entry in the PLAN checklist near the top of this file for the full final summary, and
  G3/G6's checklist entries similarly for their own completions — this narrative log doesn't restate
  every one of those, to avoid duplicating the same detail twice in one file.)*

- **Issue 14 COMPLETE.** Root-caused precisely by reading the shipment editor UI first: both
  `freightCost` inputs were explicitly labeled "Freight Cost (BDT)" while `orderValueForeign`
  right next to it was already correctly labeled `Order Value (${baseCurrency})` — confirmed
  `baseCurrency` (not the unused/vestigial `orderCurrency`/`freightCostCurrency` schema fields,
  neither of which the UI ever reads or writes) is THE established "shipment's own currency"
  concept, and `exchangeRateBDT` (labeled "Rate in BDT (live)") is THE established rate — exactly
  matching the user's own wording ("base currency of the particular shipment... Rate in BDT").
  Fixed `lib/utils.js` `calculateShipmentFinancials` to convert `freightCost * exchangeRateBDT`
  before summing into `totalCost` (identical pattern to the pre-existing
  `orderValueForeign * exchangeRateBDT → receiveAmountBDT`), and now also returns `freightCostBDT`
  for callers that need the converted figure directly. Grepped every consumer before touching
  anything: shipment editor's two labels fixed to `Freight Cost (${baseCurrency})`; the editor's
  live preview (`liveFinancials`) needed NO changes since it already imports and calls the shared
  function rather than duplicating the math. `app/api/export/shipments/route.js` and
  `.../[id]/route.js` also needed no changes — both just pass `body.freightCost` through to the
  shared function. `app/api/export/analytics/route.js` DID need a fix: it was converting the raw
  stored `s.freightCost` as if it were already BDT (`conv(s.freightCost)`) for its own
  display-currency-converted column — now uses `conv(computed.freightCostBDT)` instead, so a
  shipment's freight cost is correctly converted shipment-currency→BDT→analytics-display-currency
  (two steps) instead of being silently treated as already-BDT; `totalCost`'s own column needed no
  change since it already flows through the same fixed `calculateShipmentFinancials`. Confirmed via
  reading `app/admin/export-dashboard/analytics/page.jsx` that its `Freight Cost (${baseCurrency})`
  labels already correctly refer to the analytics-wide DISPLAY currency (a different, pre-existing,
  intentional concept from the shipment's own currency) — no change needed there, it was already
  correctly designed to receive a pre-converted value from the API. Added the shipment's
  `baseCurrency` code inline next to Freight Cost in both places it's printed
  (`app/(print)/print/export/[shipmentId]/page.jsx` ×2 and `lib/exportDocuments.js` ×2 — the
  generated PDF) for clarity, since the unit now varies per shipment where it was previously always
  implicitly BDT. All 5 touched files re-viewed + verified.
- **Issue 3 COMPLETE — ALL 14 ISSUES NOW DONE.** Root-caused precisely: the "Additional Documents"
  uploader on the shipment editor's Other Details tab explicitly accepts `.pdf,.jpg,.jpeg,.png`
  (confirmed by reading the exact `<input accept=...>` line), but `generateAllDocumentsPDF()`'s
  merge step (built last batch) filtered attachments down to ONLY `.pdf`-named ones before even
  attempting to fetch anything — any JPG/PNG uploaded there was silently dropped from the merged
  "All Documents for (Shipment Name)" file with zero trace, exactly matching what was reported.
  Fixed `lib/exportDocuments.js`: `generateAllDocumentsPDF` now inspects each attachment
  individually — PDFs still have their pages copied in as before (pdf-lib `copyPages`); JPG/PNG
  attachments are now embedded as their own full page via pdf-lib's `embedJpg`/`embedPng` +
  `drawImage`, scaled to fit an A4 page (in points, matching the jsPDF-generated documents'
  physical size) without ever upscaling past the original resolution; anything still unrecognized
  is reported via the existing `skipped` array exactly like a fetch/parse failure already was.
  Extracted the type-detection into a new exported `isMergeableAttachment(doc)` helper so it has
  one definition instead of drifting between the merge function and any caller that needs to know
  the same thing.
  Also traced (and fixed) two knock-on inconsistencies this surfaced in the ONLY caller,
  `app/admin/export-dashboard/archive/page.jsx`: its "(N merged)" count badge and its "no documents
  yet" empty-state check were BOTH still computed from the pre-existing PDF-only `uploadedPdfs` list
  (confirmed this one is deliberately PDF-only per an explicit prior requirement quoted in its own
  comment — issue 38, "only files ... in pdf format" — so it was correctly left completely
  untouched, still governs the separate INDIVIDUAL per-file download list further down); both now
  use the new `mergeableAttachments` (PDF+JPG+PNG) list instead, so the count is accurate and a
  shipment with only image attachments no longer wrongly shows "no documents". All 2 touched files
  re-viewed fully + verified.

## NEXT STEPS — FINAL PHASE (all 14 issues complete: 1,2,3,4,5,6,7,8,9,10,11,12,13,14)
1. [DONE] Updated PROJECT_STATUS.md with a new dated section (§11) summarizing batch 4, matching
   the format of prior "Fix Round" sections; renumbered Setup Reminder to §12.
2. [DONE] Final holistic verify.py + node --check pass across all 31 touched/new files — zero
   issues found.
3. [DONE] Zipped /home/claude/work/site (no node_modules/.next/.git existed to exclude, but the
   command excludes them defensively anyway) → /mnt/user-data/outputs/shah-international-v5.zip.
   Verified zip integrity (`unzip -t`, no errors) AND spot-checked extracted contents against
   several of this session's actual edits (the issue-1 $unwind fix, the new lib/harvestSeason.js
   and ProductCarouselSection.jsx files, the getEffectivePricing/computeHarvestingSeason/
   isCampaignVisibleToBuyer helpers) to confirm the zip is not a stale snapshot.
4. [DONE] Delivered via present_files.

## BATCH 4 COMPLETE — all 14 reported issues fixed and verified. Deliverable:
## /mnt/user-data/outputs/shah-international-v5.zip

