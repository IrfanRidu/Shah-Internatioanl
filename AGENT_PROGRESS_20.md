# AGENT PROGRESS 20 — Implementation tracking

See ROADMAP_BATCH20.md for the full plan/reasoning. This file tracks EXECUTION only — checked off
the moment each step is actually done and verified, not in batch at the end. If interrupted, resume
at the first unchecked step below.

## Steps
- [x] 1. models/Product.js — additionalFields[] (issue 7) + minimumOrderQuantityLocal/International (issue 8). Syntax-checked OK.
- [x] 2. lib/utils.js — getMoqForBuyer (8); normalizeSearchTerm + escapeRegex export + buildFlexibleSearchRegexSource (4).
      Executed 17 real test scenarios against a stubbed copy (slugify isn't installed, no network) — ALL PASS, incl.
      negative cases (no false-positive over-matching e.g. "mangox" vs "Mango" correctly stays non-matching).
- [x] 3. lib/exportColumns.js — mandatory hsCode on bdInvoice (1). Executed 5 real test scenarios against
      getDocumentColumns() directly (no category / empty config / config missing hsCode / stale dupe / packingList
      toggle still works) — ALL PASS.
- [x] 4. components/ui/Carousel.jsx — named group fix (9). Confirmed Tailwind 3.4.1 (supports named
      groups, v3.1+ feature; also already proven in use elsewhere in this codebase in FlashSaleSection.jsx).
      Verified clean via `tsc --jsx preserve --allowJs --noEmit` (found this works for .jsx syntax
      checking — node --check alone doesn't handle JSX; using tsc this way from now on for .jsx files).
- [x] 5. app/admin/products/new/page.jsx — additionalFields UI (7), split MOQ inputs (8), upload name-hint (3), alt fix (3).
      Verified clean via tsc --jsx preserve. Full file re-read end to end to confirm all pieces integrate correctly
      (form state, handlers, submit payload, JSX all consistent).
- [x] 6. ProductDetailClient.jsx — render additionalFields (7), buyer-aware MOQ (8), alt fix (3). Also fixed
      components/ui/ImageLightbox.jsx's two blank alt="" attributes while in the area (added an altPrefix prop,
      wired product.name into it from ProductDetailClient — confirmed via grep this is the component's ONLY
      call site, so safe to add a new prop). Verified moq computed ONCE (effectiveMoq) and reused consistently
      across qty-stepper init, decrement clamp, and the spec tile — confirmed via grep no leftover
      product.minimumOrderQuantity references remain in ProductDetailClient.jsx. Both files tsc-clean.
- [x] 7. app/admin/products/page.jsx — URL-synced page/search/category + returnTo links (6) + mobile card view (5).
      Also discovered + fixed a related correctness issue while implementing: adding useSearchParams() to a
      page.jsx default export needs a Suspense boundary per Next.js App Router rules (confirmed the admin layout
      already forces dynamic rendering via getServerSession, so this wasn't a functional break, but added the
      Suspense wrapper anyway to avoid a build warning and follow the documented pattern properly) — applied
      consistently to all 3 files that now use useSearchParams() in this area: app/admin/products/page.jsx,
      app/admin/products/new/page.jsx, and app/admin/products/[id]/page.jsx (the latter two share ProductForm).
      Traced the full returnTo round-trip end to end (list page with filters -> encoded returnTo on Edit link ->
      decoded + reconstructed listUrl in ProductForm -> back to the exact same list state on save/cancel) —
      confirmed correct. All 3 files tsc-clean.
- [x] 8. app/admin/products/new/page.jsx (returnTo handling) — MERGED into step 5 above (was already deep in this
      file, made sense to finish issue 6's form-side half in the same pass rather than re-visiting later). Added
      useSearchParams import, computed listUrl from `returnTo` query param, applied to: submit-success redirect,
      top back-arrow button, and Cancel button (all 3 nav-away points now consistent + deterministic, no more
      router.back() reliance). NOTE: this half is only complete once step 7 actually builds & passes the `returnTo`
      param from the list page — until then `returnTo` is simply absent and everything correctly falls back to
      plain '/admin/products', so no breakage in the interim, but step 7 is required to close the loop.
- [x] 9. app/(shop)/page.jsx — restructure exclusion groups (2). Group 1 (FlashSale+SpecialSection) stays
      mutually exclusive of everything and claims first, exactly as before. Group 2 (Featured, Harvesting,
      PreOrder, per-category sections) now only excludes Group 1's claims, not each other — this is the direct
      fix for "Fresh Fruits only showing 2 products". Parallelized the 4 Group-2 queries (incl. per-category loop)
      via Promise.all since removing the artificial chained dependency made this safe — a nice perf bonus, verified
      the logic doesn't actually need sequential execution anymore (traced through: none of the 4 read each
      other's results, only the shared static campaignsAndSectionsExclude list). tsc-clean, fixed one stray
      typo (an accidental stray non-English character that slipped into a comment) caught on re-review before
      finalizing.
- [x] 10. app/(shop)/products/[slug]/page.jsx — same restructuring, adapted to this page's 5 sections: Group1
      (SpecialSection+FlashSale, unchanged, still claim first in that priority order same as before) / Group2
      (Related+Recommended+BestSelling, now parallel + non-exclusive of each other, only excluding Group1's
      claims + the product itself). Recommended's own internal 2-phase query (fetch, then backfill if <8 results)
      preserved correctly inside its own async IIFE — still self-consistent, just no longer aware of Related/
      BestSelling's picks. Updated the file's own top-of-function doc comment (was describing the old chained
      behavior, now describes the new group split accurately) so future sessions don't get misled by stale docs
      the way batch 20 nearly did trusting AGENT_PROGRESS_19's HS code claim. tsc-clean.
      NOTE (documented transparently, not "fixed" — deliberate trade-off): for a guest/new customer with no
      order history, Recommended's category fallback is the same category Related already queries, so the two
      CAN show overlapping items in that specific no-personalization case. Considered making Recommended aware
      of Related's picks only in the fallback case, but that reintroduces a sequential dependency for a minor
      polish gain on a narrow edge case — not worth the complexity against this batch's actual reported bugs.
- [x] 11. app/api/products/search/route.js — shared normalize/escape (4). Replaced the route's own local
      escapeRegex duplicate + bare .trim() with the shared normalizeSearchTerm + buildFlexibleSearchRegexSource
      from lib/utils.js, so header/home search-suggestions now behaves identically to the main listing page's
      search (case-insensitive, whitespace/punctuation-tolerant). node --check clean (confirmed Node 22 here
      correctly parses ESM import/export syntax via its module auto-detection even without "type":"module" in
      package.json — verified this isn't a false-negative by re-checking package.json).
- [x] 12. ProductNameCombobox.jsx + ProductMultiSelect.jsx — image thumbnails (4). Added a small (32px) rounded
      thumbnail per suggestion row in both, with a Leaf-icon fallback when a product has no image, matching the
      existing pattern already used in SearchAutocomplete.jsx and the admin products table. Caught and fixed a
      blank alt="" I'd initially written on ProductNameCombobox's new thumbnail before finalizing (no reason to
      introduce a new instance of the exact issue being fixed elsewhere in this same batch). Both tsc-clean.
- [x] 13. lib/cloudinary.js + app/api/upload/route.js — descriptive public_id slugs (3). uploadImage() now takes
      an optional seoName, slugifies it (reusing generateSlug from lib/utils.js — confirmed no circular import
      risk), and passes it as Cloudinary's public_id with a base36 timestamp+random suffix for uniqueness.
      Actually executed this against 4 realistic scenarios (with a name, without one, with heavy punctuation in
      the name, and the shipment-docs no-transform path) with Cloudinary's SDK stubbed out — all 4 produced
      exactly the expected URL shape. Confirmed uploadMultiple() is unused anywhere in the codebase (grep) so
      left untouched rather than adding unnecessary risk to dead code.
- [x] 14. Wired the name hint through the 2 storefront-relevant admin upload call sites: banners page
      (form.title) and categories page (form.name for the main image, subcategory-name-falling-back-to-
      category-name for subcategory images). Deliberately did NOT touch the internal-only upload sites
      (shipment docs, letterheads, incentive attachments) per the roadmap's scope decision — zero public SEO
      value there, not worth the extra risk. Both files tsc-clean.
- [x] 15. generateMetadata: product page (app/(shop)/products/[slug]/page.jsx) now prefers metaTitle/
      metaDescription when set (confirmed both fields genuinely exist on the Product schema before relying on
      them) and adds openGraph+twitter with the product's own first image. Category page had an even thinner
      gap — was returning bare {title: cat.name} only, completely ignoring the metaTitle/metaDescription fields
      the Category schema already has (confirmed those exist too) — fixed the same way, using cat.image for OG.
      Root layout (app/layout.jsx) gets a site-wide openGraph/twitter image fallback (icons/icon-512x512.png,
      the largest static asset available) plus the metadataBase Next.js needs to resolve that relative path to
      an absolute URL, reusing the same NEXTAUTH_URL-based site-URL convention already established in
      app/sitemap.js. All 3 files tsc-clean.
- [x] 16. Remaining alt="" fixes (3). Fresh grep sweep found 5 remaining: FlashSaleSection.jsx's campaign banner
      (public-facing, priority) plus 4 admin-only preview thumbnails (banners page, ExportCategorySection,
      ExportLicenseSection, contract page's category icon). All fixed with contextually appropriate descriptive
      text. Re-ran the grep sweep after fixing all 5 — confirmed zero blank alt="" instances remain anywhere in
      the codebase. All 5 files tsc-clean.
- [x] 17. Final syntax verification pass on every touched file. This pass caught 2 real gaps the earlier
      per-file checks (correctly) didn't catch, since they're cross-cutting concerns rather than syntax issues:
        (a) app/(shop)/products/compare/page.jsx — the product COMPARE page ALSO displayed MOQ via the old
            single field (`p.minimumOrderQuantity`), found via a fresh grep across the whole codebase for every
            remaining minimumOrderQuantity reference. Fixed to use getMoqForBuyer(p, buyerType), same as
            ProductDetailClient — confirmed useBuyerType() genuinely exposes a buyerType string (not just the
            isLocal boolean already destructured there) by reading contexts/BuyerTypeContext.jsx directly rather
            than assuming.
        (b) lib/validators.js — a productSchema Zod validator exists with its own copy of minimumOrderQuantity
            but no additionalFields/split-MOQ fields. Confirmed via grep it is DEAD CODE (zero imports anywhere
            else in the codebase, so it posed no actual risk to this session's changes) but updated it anyway
            defensively so a future session wiring it up can't reintroduce a silent-field-stripping bug via
            Zod's default unknown-key-stripping behavior.
      Also checked PromoBannerStrip.jsx for the same nested-group hover bug class as issue 9 (flagged as worth
      checking during investigation) — confirmed safe on inspection: each banner card's `group` is
      self-contained with no shared outer group wrapping multiple cards, unlike Carousel.jsx's original bug.
      Also confirmed BOTH product API routes (POST in route.js, PUT in [id]/route.js) pass the request body
      through to Mongoose with no field whitelist, so every new schema field (additionalFields, split MOQ)
      persists correctly with zero route changes needed — verified by reading both files fresh rather than
      assuming, since this was the single most important thing to confirm (if the API silently dropped these
      fields, all the admin-form work would be inert).
      Ran a batch tsc --jsx preserve syntax check across all 25 touched files in one pass — all 25 pass. Re-ran
      the executable regression tests (normalizeSearchTerm, buildProductQuery matching, getMoqForBuyer,
      getDocumentColumns) one final time against the current file state (not the earlier mid-session state) to
      confirm nothing drifted from later edits — 8/8 + 2/2 pass.
      Full list of 27 files touched this session: models/Product.js, lib/utils.js, lib/exportColumns.js,
      lib/cloudinary.js, lib/validators.js, components/ui/Carousel.jsx, components/ui/ImageLightbox.jsx,
      components/admin/ProductNameCombobox.jsx, components/admin/ProductMultiSelect.jsx,
      components/home/FlashSaleSection.jsx, app/admin/products/new/page.jsx, app/admin/products/page.jsx,
      app/admin/products/[id]/page.jsx, app/admin/banners/page.jsx, app/admin/categories/page.jsx,
      app/admin/export-dashboard/.../contracts/[contractId]/page.jsx,
      components/admin/export-settings/ExportCategorySection.jsx,
      components/admin/export-settings/ExportLicenseSection.jsx, app/(shop)/page.jsx,
      app/(shop)/products/[slug]/page.jsx, app/(shop)/products/[slug]/ProductDetailClient.jsx,
      app/(shop)/products/compare/page.jsx, app/(shop)/categories/[slug]/page.jsx, app/layout.jsx,
      app/api/products/search/route.js, app/api/upload/route.js.
- [x] 18. Zip + present. Confirmed clean tree first (no node_modules, no .git, no stray test artifacts —
      all executable regression testing throughout this session was done in /tmp against stubbed copies,
      never inside the project directory itself). Zipped matching the original upload's own flat structure
      (no wrapping folder, package.json etc. at the archive root) for consistency with how it was received.
      Verified zip integrity (unzip -t, zero errors) and reconciled the entry count (532 zip entries vs 345
      `find -type f` results — the gap is exactly the 188 directory entries zip -r also records, not missing
      or duplicated files: 345+188=533, matches). Delivered as shah-international-v24.zip. Also added a
      matching "## 28. Batch 20" section to PROJECT_STATUS.md, in the same topic-by-topic prose format
      batch 19's entry used, and renumbered the trailing "Setup Reminder" section to stay last — continuing
      the established cross-session documentation convention so PROJECT_STATUS.md remains the one file that
      summarizes the FULL project history, not just this batch.

ALL 18 STEPS COMPLETE. Batch 20 finished.

---

## POST-DELIVERY HOTFIX — Shipment save crash on incomplete row (reported via screenshot, mobile)

Not one of the original 9 issues — a new bug report after the v24 delivery above. Error shown to the
admin: `ExportShipment validation failed: items.2.productId: Cast to ObjectId failed for value ""
(type string)...` — a raw, technical Mongoose error with no indication of what to actually do.

ROOT CAUSE: `ItemsTable`'s `addRow()` (and `EMPTY()`, the 3-row starting state every brand-new
shipment begins with) creates rows with a literal `productId: ''` until a product is picked for that
row via the combobox. `handleSave` sent `form.items` straight through unmodified — if any row (very
easy to end up with one: the default state alone gives you 3, and most shipments don't need exactly
3 products) still had `productId: ''` at save time, that empty string reached the server, where
`items.productId` being an ObjectId reference made Mongoose's cast fail. Notably, the EXACT same
failure mode (empty string sent for an ObjectId field) was already fixed for exportLicense/
exportCategory/bankAccount a few lines below this in the same function — just never extended to
cover items. Confirmed bdItems (BD Invoice) is NOT affected: computeCategoryBreakdown's output never
includes a productId key at all (category-level aggregate rows, not per-product), and BdInvoiceTable's
own addRow doesn't set one either — undefined keys get dropped by JSON.stringify, so no cast is ever
attempted there.

FIX (app/admin/products/.../shipments/[shipmentId]/page.jsx, handleSave only): before building the
save payload — a row with a product selected passes through unchanged; a row with NEITHER a product
NOR any other meaningful data filled in (name/qty/price/CTN/value) is silently dropped (it was never
real data, just an unused default/added row) and remaining rows are renumbered; a row with other data
filled in but no product chosen now BLOCKS the save with a clear, specific message ("Row 2 in
Shipment Details is missing a product...") instead of letting a broken request reach the server —
this matters because silently dropping a row the admin actually put data into would lose their work
without telling them why. Also updated local form state after a successful save to reflect the
cleaned list, so a dropped blank row visibly disappears immediately rather than sitting there until
the next reload.

VERIFIED: syntax-checked via tsc --jsx preserve (clean). Actually executed the filtering/blocking
logic (not just reasoned about it) against 4 scenarios, including reconstructing the exact reported
case — 2 valid rows + 1 blank 3rd row (matching "items.2" in the error, 0-indexed) — confirms it now
saves successfully with the blank row silently dropped; also confirmed a row with real data but no
product correctly blocks with a clear message, an all-blank starting shipment cleans to zero items
without crashing, and a fully-valid row passes through completely untouched. 6/6 scenarios pass.

Delivered as shah-international-v25.zip.

---

## POST-DELIVERY FOLLOW-UP — Product card image "too square"

User request: "bring back the previous product cards" (no image/file attached, just a text complaint).
Searched all 19 prior AGENT_PROGRESS logs for any documented history of the card's image aspect ratio
specifically — found none (batch 19's "uniform product cards" item was about a hardcoded WIDTH, not
the image's height/shape). No definitive "previous" state to revert to; proceeded with a well-reasoned
fix rather than guessing blindly, and said so.

ROOT CAUSE: components/product/ProductCard.jsx's image area used a FIXED `height: 160px` regardless of
the card's actual rendered width — which varies a lot across its 9 consumers (grid columns on 3 pages,
`w-48` through `w-60` wrapper divs on 6 carousels). At the narrower end of that range (mobile grid
columns, roughly 170-180px wide), 160px tall next to ~170px wide is nearly a literal 1:1 square.

FIX: replaced the fixed pixel height with `aspect-[4/5]` (a responsive portrait ratio that scales
proportionally WITH the card's width in every context, instead of a fixed value that only happened to
look reasonable at some widths). Checked the rest of the codebase for an existing aspect-ratio
convention to stay consistent with first (none found — no other card-image component in this codebase
uses a fixed aspect ratio) before picking 4:5, a standard, well-established portrait ratio for
product-photography-led e-commerce cards.

VERIFIED VISUALLY, not just by CSS math: rendered a before/after mockup at the card's actual approximate
mobile width (~170px) showing the old design reading as near-square exactly as described, versus the
new one clearly taller/non-square — confirmed before packaging rather than shipping on reasoning alone.
tsc --jsx preserve clean.

Delivered as shah-international-v26.zip.

---

## POST-DELIVERY FOLLOW-UP 2 — International campaign cards missing info + image still wrong

Two related reports after v26:
1. "For International campaign product cards are not appearing with full information."
2. "the product cards are too long (image section). the current campaign product cards are perfect
   in ratio. make all the product cards as the current campaign product cards with minimal necessary
   modification."

**Issue 1 root cause (components/home/FlashSaleSection.jsx):** the campaign card's button row was
`{isLocal && <button>...Add...</button>}` with NO else branch — international buyers got nothing at
all after the price, not even an alternative CTA, while ProductCard.jsx (the main card) already
correctly branches to a "💬 Quote" link to `#quotation` for international buyers. Added the identical
branch here: same wording, same `/products/${slug}#quotation` target with `onClick={e =>
e.stopPropagation()}` (needed because the whole card is already a `<Link>`, same pattern
ProductCard.jsx already uses for this exact reason), same neutral blue (kept distinct from the
campaign's own badgeColor deliberately — Quote is a site-wide "get in touch" action, not a
discount-urgency one, so it shouldn't borrow the sale's own alarm color).

**Issue 2 root cause:** the PREVIOUS follow-up's fix (aspect-[4/5], addressing an earlier "too square"
report) overshot in the portrait direction and made the image section too tall. The user pointed at
the campaign card's own fixed dimensions (150px wide × 140px tall image = a 15:14 ratio, i.e. only
very slightly taller than wide, much closer to square than 4:5 but not literally 1:1 either) as the
correct reference. Changed ProductCard.jsx from `aspect-[4/5]` to `aspect-[15/14]` — the exact same
proportion as the campaign card, expressed as a ratio (not fixed pixels, since unlike the campaign
card ProductCard.jsx is deliberately width-flexible across all 9 of its own consumers — see the
Batch-19 note already in that file) so it reproduces the "perfect" proportion at whatever width each
context actually renders.

Checked for any OTHER standalone product-card implementation that might also need this ratio (the
user said "ALL the product cards") — found none: the other files touching product images
(ProductNameCombobox, ProductMultiSelect, SearchAutocomplete, CompareBar) are all small ~32px
dropdown/tray thumbnails, not comparable listing cards with name+price+CTA. ProductCard.jsx and
FlashSaleSection.jsx are the only two.

VERIFIED VISUALLY (both changes) rather than trusting the CSS math alone — rendered the previous
4:5 version next to the new 15:14 version side by side and confirmed the new one is visibly shorter/
more compact and matches the campaign card's proportions, before packaging.
tsc --jsx preserve clean on both files.

Delivered as shah-international-v27.zip.
