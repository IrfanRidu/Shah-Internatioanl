# AGENT PROGRESS TRACKER — Shah International — Batch 13 (R27): Blank letterhead PDFs,
# international campaign price=0, local name field + universal search, shipment product
# search, systemic Vercel dynamic-rendering crash sweep.
> READ THIS FILE FIRST on every resume/continue. If interrupted mid-batch, the "LIVE STATUS" block
> at the very top (updated after every meaningful step) tells you exactly what's done and what's
> next — resume from there, don't restart. Then AGENT_PROGRESS_12.md, _11.md, then PROJECT_STATUS.md
> §1-20 for everything before that.
> Source: uploaded zip shah-international-v15.zip (this IS batch 12's own deliverable — verified
> lib/pdfLetterhead.js already has LETTERHEAD_CONTENT_START_MM=45 from batch 12). No new reference
> files this round.
> Working copy: /home/claude/work/project. Final deliverable: zip of that tree (minus
> node_modules/.git) → /mnt/user-data/outputs.

## ============ LIVE STATUS (update this block after every step) ============
CURRENT PHASE: ALL DONE. Zip built at /mnt/user-data/outputs/shah-international-v16.zip, verified
  by re-extracting and spot-checking every fix (330/330 files match, fillColor:false/
  CONTENT_LAYER_STYLE/localName/dynamic exports all present and correctly counted). Presented to
  user. Nothing further pending unless the user reports something after redeploy.
LAST COMPLETED STEP: Full-codebase re-grep for each bug-pattern class fixed this round (unescaped
  regex, bare isActive:true, opaque autoTable fillColor, missing priceRangeMin/Max in product
  populates), across the WHOLE codebase, not just touched files. Found and fixed 4 more same-class,
  low-risk, adjacent instances: app/api/products/best-selling/route.js and
  app/api/products/recommended/route.js (both — same isActive gap, same product-discovery domain as
  the core search fix), app/api/admin/metrics/route.js's active-product count (already a touched
  file), and app/api/users/route.js's unescaped regex (crash-safety only, no semantic change).
  Deliberately did NOT extend into Coupons/Categories/Special Sections/Banners/Pages/Notifications —
  confirmed these all have the same isActive:true pattern but are different domains untouched by any
  of the 6 reported issues, and some (Coupons) involve business-logic judgment about legacy
  documents that shouldn't be made unilaterally in this round. Confirmed lib/kaFormDocuments.js's
  own fillColor usage and lib/invoice.js (separate order-invoice system) are both genuinely
  unrelated to issue 1 (neither uses letterhead-as-background). All 4 new fixes tsc-verified clean.
  Wrote the durable summary to PROJECT_STATUS.md §21 (new "Batch 13" section, following the
  established per-round convention exactly), renumbering "Setup Reminder" to §22. Covers all 6
  issues with the same level of technical detail as this tracker, condensed for the durable record.
NEXT STEP: Phase 8 — package everything into a zip for delivery. Clean any leftover scratch/temp
  files from MY OWN work (not project files) if any remain, verify the project tree is otherwise
  untouched (node_modules never existed, no .next build artifacts were created), zip the whole
  project directory, present_files it, and write the final user-facing summary covering all 6
  issues + a clear note on what to expect after redeploy (especially issue 6's Server Components
  generic error, which is flagged as "should be resolved as a consequence" rather than conclusively
  proven, per the tracker's own honest accounting above).
BLOCKERS: none currently.
============================================================================

## THE 6 ISSUES THIS ROUND (verbatim from user, my numbering kept)
1. Packing List / BD Invoice / Buyer's Invoice PDFs: print preview for "letterhead" option shows
   ONLY the empty letterhead, no content at all (blank). Downloaded PDF with letterhead: content
   covers/obscures the letterhead in the middle instead of the letterhead being fully visible with
   only text + table row/column LINES drawn on top of it (i.e. table cells must not have an opaque
   fill hiding the watermark image underneath).
2. International buyers see campaign/flash-sale price as 0. Should show a price RANGE with the
   discounted rate applied (matching the non-campaign international price-range display).
3. Add a "Local Name" field to the product listing, alongside Botanical Name and Product Name.
4. ALL product search (storefront + admin) must match against local name, product name, botanical
   name, AND tags.
5. Shipment Details page's product search/picker must also match local name, product name,
   botanical name, tags — and selecting a result must still auto-fill Product Name + Botanical Name.
6. Vercel deploy errors: (a) GET /api/admin/metrics DYNAMIC_SERVER_USAGE (headers()) crash — exact
   stack trace provided; (b) /api/currency 500; (c) generic "Something went wrong" Server Components
   render error.

## KEY PRE-EXISTING CONTEXT (from reading all 12 prior AGENT_PROGRESS files + PROJECT_STATUS.md)
- This is a mature 12-batch project (Next.js 14 App Router, Mongoose/MongoDB, JS/JSX only, no TS).
- Batch 10 made the letterhead a real full-width-at-TOP-of-page image background (not a synthesized
  header) for Packing List/BD Invoice/Buyer's Invoice, shared via `lib/pdfLetterhead.js` between the
  jsPDF generator (`lib/exportDocuments.js`) AND the HTML print view
  (`app/(print)/print/export/[shipmentId]/page.jsx`). A `docStyle` toggle (letterhead vs plain A4)
  already exists in the shipment editor.
- Batch 12 (== this v15 upload) fixed a 66mm content-start gap bug by replacing a proportional
  calc with a fixed `LETTERHEAD_CONTENT_START_MM = 45` constant, and fixed the print view's 2-page
  overflow by making the letterhead `<img>` `position: absolute` + a spacer div. **This round's bug
  report describes different symptoms (blank content, not just a gap/overflow) — must verify current
  code directly, not assume batch 12 fully solved it.**
- International campaign pricing WAS built (batch 4/11 era): `PriceDisplay` + `getEffectivePricing`
  in lib/utils.js compute a discounted price RANGE for international buyers from a local discount
  ratio applied to `priceRangeMin/Max`. Current "shows 0" report is a bug in or near this path —
  needs direct code inspection, not a rebuild.
- Product search: `lib/utils.js` `buildProductQuery` already fixed for regex-escaping + isActive
  matching (batch 10/15). BUT a SEPARATE, simpler product search endpoint
  (`app/api/products/search/route.js`) does NOT escape regex and only matches name+scientificName —
  likely used by the admin/shipment picker. Need to check both this and the shipment page's own
  query builder.
- Vercel: batch 11 already did a hardening pass (cron schedule, node engine pin, image resize on 8
  upload points) but did NOT address dynamic-rendering. Confirmed by direct inspection this round:
  only 3 of 79 API routes have `export const dynamic = 'force-dynamic'`; 67 call getServerSession
  (which internally calls headers()/cookies()) without it — a live, reproducible crash risk matching
  the user's exact stack trace. 9 more routes have neither session nor the export (incl. /api/currency
  itself — prime suspect for the reported currency 500, since a DB-unreachable-at-build 500 could get
  statically cached forever without force-dynamic).
- No network access in this sandbox (confirmed: bash_tool network disabled) — cannot run
  `npm install`/`next build`/`next dev`. Must verify via `tsc --noEmit --allowJs --checkJs --jsx
  preserve --noResolve --skipLibCheck <file>` (established pattern, see below) plus careful manual
  review. Will check whether tsc is available in THIS environment before relying on it.

## ROADMAP (dependency-ordered)
- [ ] PHASE 1 — Vercel dynamic-rendering sweep (issue 6). Self-contained, mechanical, do first to
      clear it out of the way. Also directly fixes the /api/currency 500 (issue 6b) and will be
      re-touched again during issue 5 work (products/search route also needs the search-logic fix).
- [ ] PHASE 2 — Product schema: add `localName` field (issue 3). Foundational for phases 3 & 4.
      Model, admin product form (new + edit), validators, any product-card/detail display.
- [ ] PHASE 3 — Universal search: storefront + admin product search incl. localName + tags (issue 4).
      `lib/utils.js buildProductQuery`, `app/api/products/route.js`, `app/api/products/search/route.js`.
- [ ] PHASE 4 — Shipment Details product picker search incl. localName + tags, verify autofill
      (issue 5). Find the picker component under the shipment editor.
- [ ] PHASE 5 — International campaign price showing 0 (issue 2). Trace getEffectivePricing /
      PriceDisplay / FlashSale campaign-item pricing end to end for the international+campaign path.
- [ ] PHASE 6 — Letterhead watermark + blank content (issue 1). Highest complexity, most historical
      churn — do last, with a full independent re-read of the current pdfLetterhead.js /
      exportDocuments.js / print page code (not assumptions from history) before changing anything.
- [ ] PHASE 7 — Verification pass: tsc-check every touched file, re-grep known-bug patterns
      (unescaped regex, bare isActive:true, etc.) don't regress, update PROJECT_STATUS.md §21.
- [ ] PHASE 8 — Package zip, present to user.

## Files identified so far as relevant (will grow)
- Vercel: all 76 app/api/**/route.js files needing `export const dynamic = 'force-dynamic'` (full
  list captured via bash history this session — has getServerSession w/o dynamic: 67 files incl.
  app/api/admin/metrics/route.js; has neither: app/api/auth/[...nextauth]/route.js,
  app/api/auth/forgot-password/route.js, app/api/auth/reset-password/route.js,
  app/api/cron/update-currency/route.js, app/api/currency/route.js,
  app/api/payment/webhook/route.js, app/api/products/best-selling/route.js,
  app/api/products/search/route.js, app/api/quotation/route.js).
- Letterhead: lib/pdfLetterhead.js, lib/exportDocuments.js, app/(print)/print/export/[shipmentId]/page.jsx
- Campaign pricing: lib/utils.js (getEffectivePricing?), components/.../PriceDisplay.jsx (need to
  locate exact path), models/FlashSale.js
- Product model/search: models/Product.js, lib/utils.js (buildProductQuery), app/api/products/route.js,
  app/api/products/search/route.js, app/admin/products/new/page.jsx, app/admin/products/[id]/page.jsx
- Shipment product picker: need to locate exact component (likely under
  app/admin/export-dashboard/countries/[countryId]/buyers/[buyerId]/shipments/[shipmentId]/ or a
  shared components/admin/export-* file).

## Verification approach this round
Checking for tsc availability now; will document exact command used once confirmed. No network =
no build/dev server, same constraint every prior batch faced.
