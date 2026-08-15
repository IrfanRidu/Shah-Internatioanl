# AGENT PROGRESS TRACKER — Shah International — Batch 17 (R31)
# 9 new requirements (product-category breakdown, BD Invoice restructure, CFR→Sales Terms,
# plain-A4 margin, Shipment Identifiers alignment, letterhead upload consolidation, mobile admin
# nav, product-page 500 investigation) + Vercel error re-investigation.
#
# >>> READ THIS FILE FIRST ON EVERY RESUME/CONTINUE. <<<
# Then PROJECT_STATUS.md §1-25 and AGENT_PROGRESS_16.md if more historical context is needed.
# Source: /mnt/user-data/uploads/shah-international-v20.zip, extracted to
# /home/claude/work/extracted. A screenshot (Shipment Identifiers section) and a text doc with 9
# numbered requirements + a browser/Vercel error log were provided alongside it.
#
# WORKFLOW REMINDER (per user instruction): update this file after EVERY meaningful step, not
# just at the end. If a session is interrupted, the next one must be able to read ONLY this file
# and know exactly what's done, what's next, and why each decision was made.

## ============ LIVE STATUS ============
CURRENT PHASE: Exploration complete. Roadmap FINAL (below). Starting implementation now.
LAST COMPLETED STEP: Finished reading EVERY file relevant to all 9 requirements (full list in
  FILE MAP below — every file there marked READ has been read in full). Confirmed verification
  tooling: node v22.22.2 + a global `typescript` package ARE available
  (/home/claude/.npm-global/bin/tsc), but bash_tool has NO network access (npm registry 403s) —
  so no `npm install`/real `next build`. Verification command (tested, works, fast even on the
  1654-line shipment editor):
    export PATH="$PATH:/home/claude/.npm-global/bin" && tsc --noEmit --allowJs --checkJs false \
      --jsx preserve --target es2020 --module esnext --moduleResolution bundler --noResolve \
      --skipLibCheck <file>
  Run this on every touched file right after editing it, and once more on the full touched-file
  list as a final pass before zipping.
NEXT STEP: Begin Phase 1 (data model) per the numbered plan below. Work strictly in order —
  later phases depend on earlier ones (e.g. the BD Invoice rewrite needs computeCategoryBreakdown
  from Phase 2, which needs the schema field from Phase 1). Check off each [ ] as completed, and
  update "LAST COMPLETED STEP"/"NEXT STEP" after every phase at minimum, ideally after every file.
BLOCKERS: none.

## ============ HOW TO RESUME IF THIS SESSION GETS CUT OFF ============
1. Read this ENTIRE file first — especially LIVE STATUS above and the checkboxes in the ROADMAP
   below (a checked [x] item is DONE, do not redo it — but DO spot-check it still looks right,
   since a cutoff mid-edit could theoretically leave a file partially changed; the tsc check
   re-run is the fastest way to confirm a file is in a good state).
2. `cd /home/claude/work/extracted` — this IS the project; every edit happens directly in this
   extracted copy, there is no separate "source" to resync from.
3. Cross-check the ROADMAP checkboxes against actual file contents with a quick grep (e.g.
   `grep -n "computeCategoryBreakdown" lib/exportColumns.js` to confirm Phase 2 really landed)
   before trusting a checkbox blindly — the checkbox is a strong signal but the file is ground
   truth.
4. Continue from the first unchecked [ ] item, in order.
5. Only after EVERY box below is checked: run the final verification pass (re-run tsc on every
   file touched across the whole task — the full list is kept in the ROADMAP's own items as they
   get done), then zip per the FINAL PACKAGING section, then present the file to the user.

## ============ THE 9 REQUIREMENTS (verbatim source: user-uploaded text doc) ============
1. Every product has its own product category. While adding products in shipment details page,
   count total CTN, total CTN Wt (kg), Qty (kg), Avg Price (Base Currency), Total (Base Currency)
   individually for every product category.
2. Generate a new section after the product table and before the Financial Details & Profit
   Analysis section named "category wise product details" where the metrics (mainly net weight,
   total ctn, avg price and total (Base Currency)) of individual product categories are shown.
3. In BD Invoice, instead of showing export category, show the product-category-wise breakdown
   (SL NO, Name of Products = category name, no botanical name; HS Code as its OWN column, not
   merged into name; Total CTN; Quantity KG; Unit Price (Base Currency); Total (Base Currency)
   (Sales Terms)). Totals auto-calculated and cross-verified against Shipment Details for
   consistency. Existing manual admin-editing of BD Invoice rows stays active.
4. All hardcoded "(CFR)" replaced with dynamic "(Sales Terms)".
5. Plain A4 print/download mode (Packing List, Buyer's Invoice, BD Invoice) needs a safe 1" top
   margin, since it'll be printed on pre-headed paper and content must not overlap the header.
6. Shipment Identifiers section fields aren't aligned precisely (see screenshot) — fix alignment.
7. Too many Company Letterhead upload locations. Keep exactly ONE — inside Export License
   settings. The correct letterhead should be fetched from the selected Export License everywhere
   else. Remove all other upload UI.
8. No mobile navigation in the admin panel — admin dashboard needs a smooth, fully-usable mobile
   nav across every route/tab.
9. Browser console + Vercel deployment errors (verbatim, abbreviated): `GET /api/products?
   page=1&limit=20&adminView=true 500` when viewing the product page; `GET /api/admin/metrics`
   "Dynamic server usage… couldn't be rendered statically because it used `headers`"; a generic
   Server Components render error; `/api/currency` 500. Also an unrelated service-worker console
   error (`Failed to execute 'put' on 'Cache': Request scheme 'chrome-extension' is unsupported`)
   — this is a browser extension interacting with the SW cache, not an app bug; NOT in scope to
   "fix" (can't intercept another extension's fetches), will just confirm it's harmless/ignorable
   in the final summary rather than silently drop it.

## ============ KEY FINDINGS (root-caused, with evidence) ============

### FINDING A — Systemic `.populate()`-without-import bug (NEW this round, not previously found)
Mongoose keeps a single global model registry per Node process. `lib/mongodb.js`'s `connectDB()`
does NOT centrally import every model — each file that calls `.populate('fieldX')` MUST import
the model that field references directly in that same file, or `MissingSchemaError` throws on a
cold serverless start (whichever route happens to run first in a fresh Lambda). PROJECT_STATUS
§16 (batch 8) already fixed this exact class of bug, but ONLY under `app/api/export/*` — it was
never swept across the rest of the app. Ran a script cross-referencing every `.populate()` call
against each file's `@/models/*` imports (transitive imports, e.g. `User`/`Role` coming in free
via `import { authOptions } from '@/lib/auth'`, were treated as still-worth-fixing directly per
this codebase's own established explicit-import discipline, not relied upon). Confirmed 21 files
missing a direct import for the model they populate:

- app/api/admin/orders/export/route.js — missing User
- app/api/admin/reviews/route.js — missing User, Product
- app/api/special-sections/route.js — missing Product
- app/api/orders/[id]/invoice/route.js — missing User
- app/api/orders/[id]/verify-payment/route.js — missing User
- app/api/orders/[id]/route.js — missing Product
- app/api/cron/update-currency/route.js — missing Product
- app/api/export/licenses/route.js — missing ExportCategory (populates `licenseType`)
- app/api/reviews/route.js — missing User
- app/api/reviews/featured/route.js — missing User, Product
- app/api/inventory/route.js — missing Product
- app/api/roles/route.js — missing User
- app/api/products/best-selling/route.js — missing Category
- app/api/products/[id]/route.js — missing Category
- app/api/products/search/route.js — missing Category
- **app/api/products/route.js — missing Category** ← this is THE exact endpoint in the user's
  error log (`/api/products?page=1&limit=20&adminView=true`). Very high confidence this is the
  real root cause of requirement 9's product-page crash.
- app/api/products/recommended/route.js — missing Category
- app/api/messages/[id]/route.js — missing User, Product
- app/api/messages/route.js — missing User, Product
- app/api/coupons/route.js — missing Product
- app/api/flash-sales/route.js — missing Product
- **app/(shop)/products/[slug]/page.jsx — missing Category** ← customer-facing product DETAIL
  page (Server Component, not an API route) — same crash risk, high-impact.
PLAN: add the missing direct `import X from '@/models/X'` to all 21 files. Mechanical, low-risk,
one line each. This is now Roadmap Item 9a (see below) — the single highest-value fix in this
whole batch given it plausibly explains most of the "so many errors" experience site-wide, not
just the one reported endpoint.

### FINDING B — `/api/admin/metrics` and `/api/currency`: already correctly hardened in code
Verified directly:
- Both have `export const dynamic = 'force-dynamic'` already present (line ~15/9 respectively).
- Ran a full sweep: **79/79** `route.js` files that touch `getServerSession`/`headers`/`cookies`
  already have `force-dynamic` — batch 13's claimed fix is NOT regressed.
- `/api/currency` has a defensive try/catch that always returns usable rates (live → cached →
  STATIC_FALLBACK) even on total failure; `lib/exchangeRates.js`'s `fetchLiveRates()` independently
  verified to never throw (every provider call individually try/caught).
- Neither route calls `.populate()`, so Finding A doesn't apply to them either.
CONCLUSION: if these two are still 500ing on the LIVE site despite this code being correct, the
remaining explanation is deployment/infra (stale deploy not yet reflecting these fixes, or a
genuine MongoDB connectivity problem — bad/missing `MONGODB_URI`, Atlas Network Access, paused
cluster) — consistent with what batch 15/16 already concluded independently. Not silently
skipping this — will state it plainly in the final delivery summary rather than claim a fix that
isn't real, but will NOT re-litigate further since two independent investigation rounds (that one,
and this one) agree and the code-level evidence is conclusive both times.

### FINDING C — Req 6 alignment bug: root cause confirmed precisely
Shipment Identifiers grid (`app/admin/.../shipments/[shipmentId]/page.jsx`, ~line 1330-1357) mixes
the reusable `Input` component (label: text-sm/gray-700/dark:gray-300/mb-1.5, input: bare
`input-field` class → py-3 padding from app/globals.css) for most fields with 4 hand-rolled
`<div><label>...</label><input type="date" className="input-field py-2 text-sm" /></div>` blocks
(Shipment Date, EXP Date, AWB Date, PC Date) whose label is text-xs/gray-600/no-dark-variant/mb-1
and whose input explicitly overrides padding to py-2 and font to text-sm — both smaller than the
Input component's defaults, since Tailwind's utilities layer (loaded after @tailwind components,
where `.input-field`'s own `py-3` lives) always wins over component-layer padding regardless of
which utility class is present. Net effect: the date fields render visibly shorter/smaller-text
than their sibling Input-component fields in the same CSS grid row → the exact misalignment in
the screenshot.
FIX CONFIRMED SAFE: this exact codebase already establishes the correct pattern elsewhere —
`components/admin/export-settings/ExportLicenseSection.jsx` and
`app/admin/export-dashboard/countries/[countryId]/buyers/[buyerId]/page.jsx` both already do
`<Input label="..." type="date" value={...} onChange={...} />` directly (Input forwards all props
including `type` to the underlying `<input>`, no special date handling needed). Swapping the 4
raw blocks for `<Input type="date" .../>` is a drop-in, zero-logic-change fix that matches
established precedent exactly.

### FINDING D — Req 7 letterhead: exactly 2 redundant upload locations found (of 3 total)
1. `components/admin/export-settings/ExportLicenseSection.jsx` (~line 48-61, 174-185) — per-
   LICENSE letterhead upload, `letterheadUrl` already a REQUIRED field to save a license. This is
   the ONE to keep, per requirement 7's own wording.
2. `app/admin/export-dashboard/page.jsx` (~line 54-97, 156-169) — GLOBAL letterhead upload,
   writes to `Settings.exportLetterheadUrl`. TO REMOVE.
3. Shipment editor page itself (~line 473, 478, 614-620, 749-775, 1174-1185) — ANOTHER global
   upload writing to the SAME `Settings.exportLetterheadUrl`. TO REMOVE.
Both #2/#3 exist only as a *fallback* used via `shipment.exportLicense?.letterheadUrl ||
settingsLetterheadUrl` in: shipment editor's own generateDoc, `app/admin/export-dashboard/
archive/page.jsx`'s ShipmentFileGroup. DECISION: remove the UPLOAD UI in both #2 and #3 (per
"remove all other unnecessary Company Letterhead uploading options" — the operative word is
upload UI, not the underlying fallback mechanism). Leave the fallback READ (`|| letterheadUrl`)
in place for graceful behavior on any shipment that has no license selected (older shipments, or
an admin who hasn't picked one yet) — removing the read path entirely isn't what was asked and
would silently blank documents for such shipments; the point is consolidating the *upload entry
point*, which becomes exclusively the license editor. Still need to check
`app/api/export/shipments/route.js`/`[id]/route.js` in case they ALSO read/write
`exportLetterheadUrl` directly (unlikely — this is a Settings field — but confirm before final
pass) and `app/admin/export-dashboard/incentives/[applicationId]/page.jsx` (shows up in the
`letterhead` grep — need to check what it actually does with the term before editing anything
there; from the earlier grep it looks unrelated — Ka Form/Stamp Application explicitly don't use
a letterhead per batch 11 notes — likely just a comment mentioning that fact, not real code to
change, but confirm on next read-through).

### FINDING E — Requirement 1/2/3 data-model gap: `productId`/category never actually captured
`ShipmentItemSchema` (models/ExportShipment.js) already HAS a `productId` ref field, but NEITHER
`selectProductForRow` nor `addFromProduct` in the shipment editor's `ItemsTable` ever sets it when
a catalog product is picked — only `productName`/`botanicalName`/`hsCode` are copied across. This
means there is currently NO reliable way to know which catalog category a shipment line item
belongs to. `app/api/products/route.js`'s GET (used by `ProductSearch`'s autocomplete) already
`.populate('category', 'name slug')`, so the category NAME is available client-side at the moment
a product is selected — need to confirm `ProductNameCombobox` (used by the per-row picker) does
the same populate (next read step).
PLAN: add a `category: String` field to `ShipmentItemSchema` (snapshot the catalog category's
NAME at selection time — same "auto-fill once, then independently editable" pattern already used
everywhere else in this file for botanicalName/hsCode/bank fields/etc. — deliberately NOT a live
join against Product/Category on every read, consistent with why botanicalName is copied rather
than looked up live: category names change rarely, and a snapshot survives the referenced Product
being deleted later, exactly like every other auto-fill-then-edit field in this schema). Wire it
into `selectProductForRow`/`addFromProduct` (page.jsx) alongside the existing hsCode auto-fill.
Also store `productId` at the same time (the schema field already exists and is currently always
empty — cheap, correct thing to fix alongside touching this exact code) for potential future use,
though the category BREAKDOWN feature itself will group by the snapshotted `category` string, not
by re-deriving from productId, to keep the aggregation synchronous/client-side with no extra
fetches (items already carry everything needed to group instantly as the admin types/adds rows —
satisfies requirement 1's "while adding products… count total… individually for every product
category" wording, which implies a live, no-extra-round-trip computation).
A shared helper `computeCategoryBreakdown(items)` (grouping key: `item.category || 'Uncategorized'`,
summing totalCTN/totalCtnWeightKg/quantityKg/totalValue, deriving avgPrice = totalValue/quantityKg)
will be used by BOTH the new "Category Wise Product Details" section (req 2) AND the BD Invoice
auto-seed (req 3 — replacing the current single Export-Category-named row with one row per product
category), so the two features can never drift apart from each other — matches this codebase's own
repeatedly-stated DRY philosophy (see PROJECT_STATUS batch 7 "single source of truth" language).
For BD Invoice's HS Code per category row (req 3's example shows one HS code per category, e.g.
"Fresh Fruits" → 124247): since HS Code is captured per PRODUCT not per catalog Category, the seed
will use the first non-empty `hsCode` found among that category's items as a sensible default —
the row stays admin-editable afterward (per requirement 3's own "existing manual admin editing
option... will remain active"), so an imperfect auto-guess is correctable, consistent with how
every other auto-fill field in this codebase already behaves.
Where to put the new section: directly after the existing `<ItemsTable ... />` call (page.jsx line
~1440) and before the `<h3>Financial Details & Profit Analysis</h3>` header (line ~1443) — exact
requested position.

## ============ ROADMAP — FINAL (work strictly top to bottom; phases have dependencies) ============

### PHASE 1 — Data model foundation (blocks Phases 2-4) — ✅ DONE, tsc-verified clean
[x] 1.1. models/ExportShipment.js — added `category: String` to ShipmentItemSchema, right after
      `botanicalName`, with full comment.
[x] 1.2. Shipment editor page — `selectProductForRow`: now sets `productId`+`category`.
[x] 1.3. Same file — `addFromProduct`: now sets `productId`+`category`.
[x] 1.4. Same file — `addRow` blank object AND top-level `EMPTY` constant: both now include
      `productId: '', category: ''`.
      tsc: models/ExportShipment.js OK, shipment editor page.jsx OK.

### ⚠ ROADMAP CORRECTION (found while executing Phase 2, before Phase 4 started): the original
Phase 4 plan only listed the shipment editor's `BdInvoiceTable` component for the "hsCode becomes
its own column, no botanical name for BD Invoice" rendering change. lib/exportDocuments.js (PDF +
DOCX/XLSX) and the print page's `InvoiceDoc` have their OWN parallel copies of this exact same
name/hsCode logic and needed the identical treatment — otherwise the editor's on-screen BD Invoice
tab would show the new format while the actual downloaded/printed documents kept the old one.
Caught via grepping for `shouldShowBdHsCode` importers right after removing it from
exportColumns.js (Phase 2.5) and seeing 3 files still referenced it, not just 1. Fixed immediately,
inline, while already in this code (both files' `columnHeaderLabel` salesTerm threading — Phase 5's
job — was naturally done in the very same edits, since they're the same lines). Both files are
DONE and tsc-verified as of this note: lib/exportDocuments.js (all 3 generators: Packing List PDF,
shared Buyer's/BD Invoice PDF, shared DOCX/XLSX data assembler) and app/(print)/print/export/
[shipmentId]/page.jsx (`InvoiceDoc`, `PackingListDoc`). Both files' now-broken `import {...
shouldShowBdHsCode...} from '@/lib/exportColumns'` were also fixed (that name no longer exists as
an export — tsc's --noResolve mode does NOT catch cross-file import/export mismatches like this,
only grepping does — worth remembering for the Phase 10 final sweep). Remaining Phase 4 work is
now ONLY the shipment editor's own `BdInvoiceTable` + `seedBdItemsFromShipment` (still not started
as of this note) — everything else originally under Phase 4/5 for these 2 files is complete.

### PHASE 2 — Shared category-math helper (blocks Phases 3-4) — ✅ DONE, tsc-verified clean
[x] 2.1. computeCategoryBreakdown(items) added to lib/exportColumns.js.
[x] 2.2. columnHeaderLabel now takes (key, currency, salesTerm); totalValue header uses it.
[x] 2.3. AVAILABLE_COLUMNS.bdInvoice now leads with 'hsCode'.
[x] 2.4. DEFAULT_DOCUMENT_COLUMNS.bdInvoice now leads with 'hsCode'.
[x] 2.5. shouldShowBdHsCode() removed from exportColumns.js, with a breadcrumb comment. ALSO (see
      correction note above) removed from its 2 other importers (lib/exportDocuments.js, print
      page) since leaving either import in place would have been a hard build error.
[x] 2.6. models/ExportCategory.js: bdInvoiceShowHsCode field kept, comment added noting it's
      unused now.
      tsc: lib/exportColumns.js OK, models/ExportCategory.js OK, lib/exportDocuments.js OK,
      print page OK.

### PHASE 3 — "Category Wise Product Details" section + Shipment Identifiers alignment (req 1/2/6)
— ✅ DONE, tsc-verified clean
[x] 3.1. computeCategoryBreakdown imported (shouldShowBdHsCode dropped from same import line).
[x] 3.2. `categoryBreakdown` computed right after `itemsTotalValue`.
[x] 3.3. New "Category Wise Product Details" section inserted between Products and Financial
      Details, with empty-state, per-category rows, and a Grand Total footer reusing the already-
      computed liveTotalCTN/liveTotalCtnWeightKg/liveTotalNetWeightKg/liveShipmentAveragePrice/
      itemsTotalValue (no duplicate math).
[x] 3.4. All 4 raw date divs (Shipment/EXP/AWB/PC Date) replaced with `<Input type="date" .../>`,
      matching every sibling field exactly. Zero logic change — same value/onChange as before.
      tsc: shipment editor page.jsx OK.

### PHASE 4 — BD Invoice restructure (req 3) — depends on Phases 1-2 — ✅ DONE, tsc-verified clean
[x] 4.1. `seedBdItemsFromShipment()` rewritten: one row per `computeCategoryBreakdown` entry.
      `hasSomethingToShow` replaced by `categoryBreakdown.length > 0` (no longer tied to Export
      Category at all). Auto-sync effect's dependency array replaced with a string
      `categoryBreakdownSignature` (not the array itself — would re-run every render pointlessly)
      — ALSO fixes a real edge case the old aggregate-only deps missed: a row's category changing
      without the shipment-wide totals changing. bdMismatches cross-check confirmed to already
      work generically across N rows via `.reduce()` — no change needed there.
[x] 4.2. `BdInvoiceTable` rewritten: `showHsCode` prop removed, `has('hsCode')` drives a real
      HS Code `<th>`/`<td>` column (input) positioned right after Name; header text is now
      "Name of Products" (no botanical name — rows are category names now); footer has a matching
      blank HS Code cell; empty-state and placeholder text updated to reflect category-based
      seeding instead of Export-Category-based.
[x] 4.3. Call site updated: `showHsCode` prop dropped, `salesTerm={form.salesTerm}` added.
      tsc: shipment editor page.jsx OK. Confirmed via grep: zero remaining references to
      `shouldShowBdHsCode`/`showHsCode` anywhere in this file.

### PHASE 5 — CFR → Sales Terms (req 4) — ✅ DONE for the shipment editor (lib/exportDocuments.js
and the print page were already done earlier, during the Phase 2 correction — see that note above)
[x] 5.1. `ReadOnlyItemsView` now takes a `salesTerm` prop, threaded into its one
      `columnHeaderLabel` call (a LIVE fix, not inert — buyerInvoice's column set does include
      totalValue). Both call sites (Packing List tab, Buyer's Invoice tab) now pass
      `salesTerm={form.salesTerm}`. `BdInvoiceTable`'s 3 `columnHeaderLabel` calls (unitPrice/
      averagePrice/totalValue) now pass its new `salesTerm` prop, set from `form.salesTerm` at the
      call site (done together with Phase 4.3 above, same lines).
[x] 5.2. lib/exportDocuments.js — done earlier (see the ROADMAP CORRECTION note above Phase 2).
[x] 5.3. print page — done earlier (see the same correction note).
[x] 5.4. Final grep sweep for stray "CFR"/"(CFR)" strings — see verification below.

### ⚠ SECOND ROADMAP CORRECTION (found while doing the Phase 5.4 final CFR sweep): grepping for
`COLUMN_LABELS` usage (to check whether the fallback `COLUMN_LABELS.totalValue` string I hadn't
directly edited was ever actually rendered anywhere, vs. just being dead fallback code) turned up
`components/admin/export-settings/ExportCategorySection.jsx` — the category editor's Document
Format column-picker DOES render `{COLUMN_LABELS[colKey]}` directly as each checkbox's label,
bypassing `columnHeaderLabel()` entirely (this context has no specific shipment to pull a real
currency/sales term from — it's a category-level setting, not a shipment). So the hardcoded
"Total Value (CFR)" string WAS a second, real, user-visible instance of requirement 4's bug, not
just the one inside columnHeaderLabel. Fixed: COLUMN_LABELS.totalValue → 'Total Value (Sales
Terms)' (generic wording, since no specific shipment/currency exists in this context).
This SAME file also still had the OLD dedicated "Show H.S. Code under the product name on the BD
Invoice" checkbox (bound to bdInvoiceShowHsCode) — now fully redundant since hsCode is a normal
entry in AVAILABLE_COLUMNS.bdInvoice (Phase 2.3) and therefore already gets its own ordinary
checkbox via the generic column-picker loop right above it. Removed the stale checkbox AND all 3
remaining bdInvoiceShowHsCode references in this file's form state/load/save logic (form default,
openEdit load, handleSave payload) — confirmed safe: Mongoose's findByIdAndUpdate never resets a
field just because it's absent from an update payload, so existing categories' stored values are
simply left untouched and permanently inert, consistent with the Phase 2.6 decision to leave the
schema field itself in place. Final grep confirms bdInvoiceShowHsCode now appears in exactly 2
places in the whole codebase — models/ExportCategory.js and lib/exportColumns.js — both just the
intentional deprecation-note comments, zero live code left anywhere. Both files tsc-verified
clean. Final "(CFR)" grep across the entire codebase: zero rendered-text matches remain (only 2
code comments referencing the old behavior for historical context).

### PHASE 6 — Plain A4 top margin (req 5) — ✅ DONE, tsc-verified clean
[x] 6.1. lib/exportDocuments.js: PLAIN_TOP_MARGIN=25.4 added; drawHeader rewritten so BOTH plain
      mode AND "letterhead requested but nothing loadable" fall back to this safe constant instead
      of the too-small 12mm MARGIN. Left/right/bottom margins untouched — top-only, as asked.
[x] 6.2. print page: PLAIN_TOP_MARGIN_MM=25.4 added; DocHeader's two separate null-returning
      branches unified into one spacer-rendering branch, mirroring the existing letterhead-image
      spacer's own height formula. No DOCX/XLSX changes (confirmed no letterhead/plain concept
      exists there — native Word/Excel documents, not page-layout-matched to the PDF).
      tsc: both files OK.

### PHASE 7 — Letterhead upload consolidation (req 7) — ✅ DONE, tsc-verified clean
[x] 7.1. app/admin/export-dashboard/page.jsx: removed letterheadUrl/setLetterheadUrl/uploadingLH
      state, handleLetterheadUpload function, the exportLetterheadUrl line in the settings-fetch
      effect, and the whole amber Company Letterhead card. Un-gridded the wrapper (was
      lg:grid-cols-2 for 2 cards, now a plain max-w-xl block for the one remaining Exporter Details
      card). Removed now-unused `Upload` icon and `resizeImageFile` imports (verified: neither used
      anywhere else in this file).
[x] 7.2. Shipment editor page: removed uploadingLH state and handleLetterheadUpload function, and
      the visible amber "Company Letterhead (fallback...)" card. KEPT letterheadUrl/setLetterheadUrl
      state and its read in the settings-fetch effect (updated that comment for accuracy — it's now
      a passive fallback, not "the" upload path) — still feeds effectiveLetterheadUrl. Confirmed
      `Upload` icon import still legitimately used elsewhere in this file (Additional Documents /
      Photo upload sections) — correctly NOT removed.
[x] 7.3. Confirmed via targeted greps: ExportLicenseSection.jsx unchanged (the one correct upload
      location); archive/page.jsx and incentives page unchanged (both were already read-only
      consumers, no upload UI); models/Settings.js unchanged (schema field stays, harmlessly loses
      its last UI writers). ALSO found (not in original plan) a THIRD, already fully orphaned
      `letterheadUrl` field directly on the ExportShipment model itself (separate from both
      Settings.exportLetterheadUrl and ExportLicense.letterheadUrl) — grepped every `.letterheadUrl`
      access codebase-wide and confirmed nothing reads or writes `shipment.letterheadUrl` directly
      anywhere (every access is either the license's own field, or that same field accessed via
      `shipment.exportLicense?.letterheadUrl` — a populated reference, not this direct field) — this
      is pre-existing dead schema weight from an early design iteration, not a 4th live upload path
      needing removal. Added a breadcrumb comment matching the bdInvoiceShowHsCode pattern.
      tsc: all 3 touched files OK.

### PHASE 8 — Mobile admin navigation (req 8) — ✅ DONE, tsc-verified clean
[x] 8.1. New file app/admin/AdminShell.jsx: owns mobileNavOpen state, renders AdminSidebar (with
      mobileOpen/onMobileClose) + AdminTopBar (with onMenuClick) + main (p-4 md:p-6, was flat p-6).
[x] 8.2. app/admin/layout.jsx: session/redirect/badge-count logic untouched; now renders
      `<AdminShell session pendingOrders unreadMessages>{children}</AdminShell>` instead of the
      raw aside/main markup directly. AdminSidebar/AdminTopBar imports moved into AdminShell.jsx.
      Caught and fixed a background-color mismatch risk: wrote AdminShell.jsx from memory first
      with `dark:bg-gray-950`, then re-viewed the real original (`dark:bg-gray-900`) before editing
      layout.jsx and corrected AdminShell.jsx to match exactly — verifying instead of trusting
      recall avoided a subtle, easy-to-miss dark-mode background regression.
[x] 8.3. components/layout/AdminSidebar.jsx: added mobileOpen/onMobileClose props (both default to
      safe no-op values, so any other future caller without them degrades gracefully rather than
      crashing). Extracted nav-groups and footer rendering into renderNav(isCollapsed)/
      renderFooter(isCollapsed), called once for the desktop aside (real `collapsed` state) and
      once for the new mobile drawer (hardcoded `false` — a temporary overlay doesn't need the
      icon-only collapsed mode) — one shared map(), can't drift between desktop/mobile. Added
      auto-close-on-route-change and body-scroll-lock effects. New drawer: fixed inset-0 overlay +
      w-72 max-w-[85vw] panel, own logo row with an explicit X close button, reuses renderNav/
      renderFooter.
[x] 8.4. app/admin/AdminTopBar.jsx: added onMenuClick prop; renders a `md:hidden` hamburger button
      (Menu icon) as the first flex child, before the search box, so it never competes for space;
      button only renders when onMenuClick is actually passed (graceful degradation). px-6 → px-3
      sm:px-6 for tighter mobile spacing.
      tsc: all 4 files OK. Confirmed via grep: AdminSidebar/AdminTopBar have no other consumers
      anywhere in the codebase besides AdminShell.jsx — the refactor is fully self-contained.

### PHASE 9 — populate()-without-import sweep (req 9 root cause) — ✅ DONE, tsc-verified clean
[x] 9.1. Added the single missing direct model import to all 22 files (re-confirmed via a fresh,
      independent re-scan before starting edits — same 22 files, same targets, as originally found
      in FINDING A; the earlier "21 files" figure in this doc's prose was just an arithmetic slip,
      the actual itemized list was always complete and correct). Every added import carries a
      comment explaining the root cause, pointing back to the fullest version of that comment in
      app/(shop)/products/[slug]/page.jsx (done first) to avoid 22 near-duplicate paragraphs.
      Category → app/(shop)/products/[slug]/page.jsx, app/api/products/[id]/route.js,
        app/api/products/best-selling/route.js, app/api/products/recommended/route.js,
        app/api/products/route.js (**the exact endpoint from the user's error log**),
        app/api/products/search/route.js.
      Product → app/api/admin/reviews/route.js, app/api/coupons/route.js, app/api/cron/
        update-currency/route.js, app/api/flash-sales/route.js, app/api/inventory/route.js,
        app/api/messages/[id]/route.js, app/api/messages/route.js, app/api/orders/[id]/route.js,
        app/api/reviews/featured/route.js, app/api/reviews/route.js, app/api/special-sections/
        route.js.
      User → app/api/admin/orders/export/route.js, app/api/admin/reviews/route.js, app/api/
        messages/[id]/route.js, app/api/messages/route.js, app/api/orders/[id]/invoice/route.js,
        app/api/orders/[id]/verify-payment/route.js, app/api/reviews/featured/route.js, app/api/
        reviews/route.js, app/api/roles/route.js.
      ExportCategory → app/api/export/licenses/route.js.
[x] 9.2. Re-ran the exact static-analysis approach from FINDING A, independently and fresh (not
      just trusting the 22 individual edits), across BOTH app/ and lib/ this time (36 total files
      using .populate() anywhere in the codebase) — confirmed ZERO remaining missing-import
      findings anywhere.
[x] 9.3. No other code changes made for req 9, per Finding B's earlier conclusion (re-affirmed, not
      re-investigated further): /api/admin/metrics and /api/currency are already correctly
      hardened in this code (force-dynamic present on both; currency has genuine defensive
      fallbacks). The chrome-extension service-worker console error is out of this app's control
      entirely — will be explained as such, not claimed as "fixed", in the final summary.
      tsc: all 22 touched files OK (verified via a while-read loop over a plain file list — an
      earlier attempt using a bash array literal failed outright because this environment's shell
      is /bin/sh, not bash, and doesn't support that syntax — worth remembering: no bash arrays,
      ever, in this sandbox).

### PHASE 10 — Final verification & packaging
[x] 10.1. Ran tsc across all 35 individually-touched files (zero errors), THEN went further than
      originally planned: ran tsc across literally every .jsx file in app/+components/ (127 files)
      and every .js file in app/+lib/+models/+components/ (131 files) — 258 files total, entire
      project, zero syntax errors anywhere. Confirms no collateral damage outside the files I
      intentionally edited.
[x] 10.2. Targeted orphan-reference greps, all clean: exportColumns.js's actual exports (10
      confirmed) vs. what importers expect; zero remaining `shouldShowBdHsCode` importers (only 2
      self-referential comments in exportColumns.js itself); zero remaining `showHsCode` prop
      usage anywhere; `bdInvoiceShowHsCode` down to exactly the 1 intentional schema field + 2
      breadcrumb comments; `Input` component and lucide icons used by edited sections confirmed
      already imported where used; `computeCategoryBreakdown` import name matches its export
      exactly; zero remaining references to the old category-seed logic (`selectedCategory?.
      hsCode`/`selectedCategory?.name` inside seedBdItemsFromShipment).
[x] 10.3. Updated PROJECT_STATUS.md with a new "## 25. Batch 17 — ..." section, matching the exact
      established per-batch format (dense prose paragraphs per topic, references to exact
      files/functions, root-cause framing) used by every prior batch entry. Renumbered "Setup
      Reminder" from #25 to #26 to stay last, per the existing convention.
[x] 10.4. Zipped /home/claude/work/extracted → /home/claude/shah-international-v21.zip (1.1MB, 519
      files, no node_modules/.next/.git to exclude — none were present). Verified thoroughly, not
      just assumed: zip integrity test clean; fresh extraction to a separate directory; re-ran tsc
      on the 5 most heavily-edited files from that FRESH extraction (all OK); md5sum-compared 3 of
      those files byte-for-byte against the working copy (exact match — confirms the zip round-trip
      introduced zero corruption). Learned mid-check that `<(...)` process substitution ALSO isn't
      supported by this sandbox's /bin/sh (same root cause as the earlier bash-array failure) —
      split into separate commands instead.
[x] 10.5. Final summary message delivered to the user.

## ============ TASK COMPLETE ============
All 9 requirements implemented, individually tsc-verified, cross-checked for orphaned references,
and verified once more in the final packaged zip. Every file in the entire 258-file project (not
just the ~35 touched) parses cleanly. Delivered as /mnt/user-data/outputs/shah-international-v21.zip.

## ============ VERIFICATION APPROACH (this session) ============
Will confirm at the next step whether `npm install`/network access is available in THIS sandbox
(may differ from prior sessions' sandboxes — don't assume prior "no network" notes still apply
without re-checking). If nodejs/npm + real deps are available, prefer actually running
`next build`/`npm run lint` for real verification over syntax-only checks. If not, fall back to
the established pattern from prior rounds: `tsc --noEmit --allowJs --checkJs --jsx preserve
--noResolve --skipLibCheck` (or a dependency-free brace/paren/JSX-tag balance check if even a bare
`tsc` binary isn't available) on every touched file, individually as each is edited and again as
one final consolidated pass.

## ============ FILE MAP (for quick reference on resume — paths relative to project root) ============
- Shipment editor (the big one): app/admin/export-dashboard/countries/[countryId]/buyers/
  [buyerId]/shipments/[shipmentId]/page.jsx (1654 lines)
- Print preview: app/(print)/print/export/[shipmentId]/page.jsx (398 lines, not yet fully read)
- PDF/DOCX/XLSX generation: lib/exportDocuments.js (630 lines, not yet fully read)
- Letterhead-as-PDF-background shared helper: lib/pdfLetterhead.js (86 lines, not yet read)
- Column registry / shared math: lib/exportColumns.js (99 lines, READ IN FULL)
- Models: models/ExportShipment.js (READ), models/Product.js (READ), models/Category.js (READ),
  models/ExportCategory.js (READ), models/Settings.js (not yet read), models/ExportLicense.js
  (not yet read)
- Admin nav: components/layout/AdminSidebar.jsx (not yet read — req 8's main target)
- Letterhead upload UI: components/admin/export-settings/ExportLicenseSection.jsx (partially
  read), app/admin/export-dashboard/page.jsx (grepped, not fully read)
