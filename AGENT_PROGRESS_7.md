# AGENT PROGRESS TRACKER — Shah International — Batch 7 (Shipment Details as master record)
> READ THIS FILE FIRST on every resume/continue. Working copy: /home/claude/work/site (contains
> batches 1-6 already complete — AGENT_PROGRESS.md through AGENT_PROGRESS_6.md — do not re-touch
> those areas unless directly relevant to THIS batch's requirements).
> Source zip: /mnt/user-data/uploads/shah-international-v7.zip (= batch 6's deliverable)
> Final deliverable: zip of /home/claude/work/site (minus node_modules/.next/.git) →
> /mnt/user-data/outputs/shah-international-v8.zip
> ENVIRONMENT: no node_modules in the project, no network (confirmed: curl blocked, "Host not in
> allowlist"), no git. BUT: this session has a GLOBAL typescript install at
> /home/claude/.npm-global/bin/tsc (v6.0.3) that WORKS as a real syntax/JSX verifier without
> needing the project's own node_modules. Verified against known-good files (exit 0) AND two
> deliberately-broken test copies (unbalanced paren, missing </div>) — both correctly caught with
> precise line numbers. THIS IS BETTER than batches 2-6's dependency-free verify.py heuristic — use
> real tsc as primary verification method this batch:
>   /home/claude/.npm-global/bin/tsc --noEmit --allowJs --checkJs false --jsx preserve --target es2020 --noResolve --skipLibCheck <file>
>   (empty output + exit 0 = clean; run after EVERY edit, not batched at the end)
> Still cannot run next dev/build (no node_modules to resolve real imports) — careful reading +
> tsc + re-viewing every file immediately after edit remains mandatory (every prior batch caught
> real self-introduced bugs this way, incl. a Rules-of-Hooks violation tsc/verify.py COULDN'T catch
> in batch 6 — stay alert for React-semantics bugs tsc can't see: hooks-after-early-return, stale
> closures, effect dependency arrays).

## THE TASK (new document provided this round, verbatim requirements below, my own numbering R1-R5)
User also said (their own words): "read the provided file/zip carefully before starting any
changes. make a clear roadmap. track every command. if messages run out, resume via 'continue'
from exactly where left off. generate a whole functional website in a zip file after fixing and
integrating ALL features." This file IS that roadmap + the resumption anchor.

**R1 — Shipment Details tab** (the MASTER tab — "every data will pass to packing list, buyer's
invoice, BD invoice" from here): Base Currency (unchanged) + ALL identifiers: Exporter Name,
Exporter Address, Importer Name (buyer company name), Importer Address (buyer company address),
Shipment No, Contract No, Invoice No, Shipment Date, TIN, BIN, ERC, EXP No, AWB No, PC No, Mode of
Carrying, Landing Port, Port of Discharge, Final Destination, Sales Terms, Country of Origin, Bank
Account No, Branch, Bank Address, Routing No, SWIFT Code, **REX No** (new field — grep needed).
Product table: SL No, Name+Botanical (searchable picker, auto-fill botanical), HS Code, Pack Size
KG (chosen from saved CTN config), Total CTN (manual), Quantity KG (auto = pack×total), Unit Price
(manual, base currency), **Average Price (auto)**, Total EUR/CFR (auto = qty×unit price). Grand
totals (Net Weight, Total CTN) auto. Gross Weight admin-added, initially = estimated gross weight.

**R2 — Packing List tab**: ONLY Net Weight/Total CTN/Gross Weight/Freight Cost fields + product
table (SL No, Name+Botanical, Pack Size KG, Total CTN, Quantity KG — all read-only, from Shipment
Details). Print/download as a SINGLE plain-A4-page PDF matching a reference layout (image not
re-attached this round — rely on batch-3's confirmed-correct reproduction, don't regress it).
Letterhead mode = the uploaded letterhead image itself IS the page (not a recreated replica).
PDF heading = "Packing List". Header info block auto-filled from Shipment Details. Declaration:
"We hereby certify that the information on this invoice is true and correct and that contents of
this shipment are as state above." + Total Carton/Net Weight/Gross Weight lines.

**R3 — Buyer's Invoice tab**: same print/letterhead mechanics as packing list. PDF heading =
"Commercial Invoice". Same auto-filled header block. Declaration = the long BDREX/GSP paragraph +
the SAME Total Carton/Net/Gross lines as packing list. Product table: SL No, Name+Botanical,
Quantity, Unit Price, Total EUR (CFR) — all read-only from Shipment Details.
**Cross-check requirement**: Total Carton/Net Weight/Gross Weight/grand totals must match across
Shipment Details, Packing List, Buyer's Invoice, BD Invoice — mismatches shown in red w/ an error
message at the point of mismatch.

**R4 — BD Invoice tab**: same print/letterhead mechanics. PDF heading = "Commercial Invoice".
Same auto header block. Declaration = SAME simple one as packing list (NOT the BDREX one — that's
Buyer's Invoice only). Product table is a **single consolidated row concept, editable**: Name
(Botanical) — admin-editable, initially = Export Category name; HS Code — admin-editable, initially
= Export Category's HS code; Total CTN — admin-editable, initially = shipment's Total CTN; Quantity
KG — admin-editable, initially = shipment's Net Weight; Unit Price — admin-editable, initially =
shipment's "Average Price" (base currency); Total EUR/CFR — auto from shipment details (base
currency). Grand total auto. Same cross-check-and-flag-red requirement as R3.

**R5 — Known bug, reportedly STILL happening after batch 6's attempted fix**: "shipment
configuration page gets empty after refreshing" + "settings tab always returns to CTN settings tab
after refresh." Batch 6 found NO code bug for the first part (applied only defensive/cosmetic
fixes — a Mongoose-schema-cache theory that doesn't actually fix anything in the delivered code)
and DID fix the second part (URL `?tab=` param). Since the user is re-reporting item 1 as still
broken, batch 6's theory was likely wrong or incomplete — MUST find a real, concrete, code-level
root cause this time, not another speculative non-fix. Treat this as unsolved; re-investigate from
scratch with fresh eyes (see INVESTIGATION LOG below once done).

## GROUND TRUTH — WHAT BATCH 5/6 ALREADY BUILT (from reading AGENT_PROGRESS_5.md + _6.md, to be
## RE-VERIFIED against actual current file contents before trusting, per every prior batch's own
## hard-learned lesson — progress-file claims are a lead, not a fact, until re-confirmed by reading)
- Settings page has 5 tabs: CTN Configuration, Shipment Configuration (option lists), Bank Account
  Configuration, Export License Configuration, Export Categories (renamed from "Incentive Config").
- 4 new models: ExportCategory, ExportBankAccount, ExportLicense, CtnConfig — full CRUD API routes
  under app/api/export/{categories,bank-accounts,licenses,ctn-configs}.
- Settings.js gained `exportShipmentOptions` (6 string arrays for the datalist-suggested logistics
  fields) — NOT the bank/license/category data (those are the 4 separate collections above).
  Settings PUT already does `$set: body` — batch 6 read this fresh and found it correct.
- Shipment editor has 4 tabs: Shipment Details (was "Other Details", now first/default) → Packing
  List → Buyer's Invoice → BD Invoice. ONE shared `ItemsTable` component reused across
  packing/buyer-invoice/bd-invoice tabs (each with different column visibility flags) — THIS
  CONTRADICTS what R1-R4 now ask for (R1 wants the table edited ONLY in Shipment Details, R2-R4
  want READ-ONLY derived views with DIFFERENT column sets, R4's BD table is conceptually a
  different, single-row, admin-overridable structure, not a per-product-row mirror). This is the
  central architectural change this batch must make — CONFIRM by reading the actual file before
  committing to a rewrite plan.
- `packSizeKg` already renamed to `ctnSizeKg` everywhere (batch 5's P4a/P5).
- Bank fields (account no/branch/address/routing/swift) currently live in the BD Invoice tab
  content (batch 5 design decision — explicitly NOT moved to Shipment Details) — R1 now explicitly
  DOES want them in Shipment Details. Another confirmed architectural change needed.
- Shipment Identifiers box (shipmentNo/contractNo/invoiceNo/date/TIN/BIN/ERC/EXP/AWB/PC) already
  lives in the Shipment Details tab (batch 5 P4e) — good, matches R1, just needs REX No added.
- Estimated Gross Weight auto-calc (CTN config weight × total CTN, summed + net weight) already
  exists (batch 5 P4h, refined in batch 6 to a derived value instead of an effect). R1 confirms
  this design ("Gross weight added by admin but initially same as estimated") — likely just needs
  re-verification, not a rebuild.
- Cross-document consistency red-flagging (R3/R4's requirement) — NOT mentioned as built in any
  prior batch. Likely does not exist yet. New feature.
- REX No, HS Code (per-product-row), Average Price — NOT mentioned in any prior batch's field list.
  Likely all 3 are genuinely new fields. Need grep to confirm none exist under a different name.

## ROADMAP (phases — will refine into concrete file-level steps after Phase A reading)
- [ ] PHASE A — Deep-read current actual code (not just progress-file claims) for every file in
      the "KEY FILES" list below. No edits yet. Confirm/refute every "GROUND TRUTH" bullet above.
- [ ] PHASE B — Design the Shipment Details→documents data-flow architecture precisely (single
      source of truth in ExportShipment.items[] edited ONLY in Shipment Details tab; Packing
      List/Buyer's Invoice/BD Invoice become read-mostly views computed FROM it, BD Invoice keeping
      its own small admin-override layer per R4). Write the design down before touching code.
- [ ] PHASE C — Model changes (ExportShipment: add reX No, per-item hsCode, per-item averagePrice
      or computed equivalent, bdInvoiceOverride sub-doc; confirm exporterName/Address source).
- [ ] PHASE D — Shipment editor UI rewrite: Shipment Details tab (add missing identifier fields +
      bank fields + REX No + the full editable product table with HS Code/Average Price columns),
      Packing List tab (strip to summary fields + read-only derived table), Buyer's Invoice tab
      (same pattern, its own read-only column set), BD Invoice tab (admin-overridable single/derived
      row structure seeded from Export Category + shipment totals).
- [ ] PHASE E — Cross-document consistency check (shared computation, red-flag mismatches + error
      message) — likely lives in a shared helper used by whichever tab/print view needs to display
      Total Carton/Net Weight/Gross Weight, since with a true single-source-of-truth architecture
      from Phase B this may become largely structurally impossible to mismatch — but BD Invoice's
      admin-override fields (R4) CAN genuinely diverge from Shipment Details, so the check is still
      meaningful there specifically. Confirm exact scope once Phase B design is locked in.
- [ ] PHASE F — lib/exportDocuments.js (PDF) + app/(print)/print/export/[shipmentId]/page.jsx (HTML
      print) updated to match: new headings ("Packing List" vs "Commercial Invoice" ×2), new
      per-document column sets, new declaration text blocks (verbatim from R2/R3/R4), REX No shown
      wherever the BDREX declaration references it.
- [ ] PHASE G — R5 settings-refresh bug: real investigation from scratch (see INVESTIGATION LOG).
- [ ] PHASE H — Full verification sweep (tsc every touched file + re-read), update
      PROJECT_STATUS.md with a new §14 Fix Round entry, zip, present.

## KEY FILES (to read in Phase A — paths confirmed to exist via `find`, listed here so a resumed
## session doesn't need to re-discover them)
- models/ExportShipment.js, models/Settings.js, models/CtnConfig.js, models/ExportCategory.js,
  models/ExportBankAccount.js, models/ExportLicense.js, models/ExportBuyer.js, models/Product.js
- app/admin/export-dashboard/countries/[countryId]/buyers/[buyerId]/shipments/[shipmentId]/page.jsx
  (the big shipment editor)
- app/admin/export-dashboard/settings/page.jsx + components/admin/export-settings/*.jsx (5 files)
- app/api/settings/route.js
- app/api/export/shipments/route.js + [id]/route.js
- app/api/export/{ctn-configs,categories,bank-accounts,licenses}/route.js + [id]/route.js
- lib/exportDocuments.js
- app/(print)/print/export/[shipmentId]/page.jsx + app/(print)/layout.jsx
- lib/utils.js (calculateShipmentFinancials + any shipment helpers)
- lib/exportAudit.js (only if new models need audit wiring — batch 5 decided no, re-confirm still
  true, no reason it'd change)

## ⚠️ SCOPE CHANGE (mid-batch-7, user's 2nd message) — READ THIS BEFORE TRUSTING "ROADMAP" ABOVE
User uploaded 3 REAL reference PDFs (rasterized + visually inspected, saved at
/home/claude/work/refs/*.jpg, originals at /mnt/user-data/uploads/{BD_Invoice,Buyer_s_Invoice_,
Packing_List}.pdf — KEEP THESE, do not let them get lost) showing the actual target layout for a
real shipment (SI-001/2026, buyer "Sarl Espoir", France) and gave a MAJOR new architectural
requirement:
> "make export category the most central point of the export dashboard t[h]an the shipment
> details tab will be the second central point. as different shipment category needs different
> types of packing list, Bd invoice and Buyer's Invoice one type... won't solve the problem the
> format... will change according to export category. the current format that i commanded is only
> for Fresh fruits and vegetables. please save them for your reference and continue."

**Meaning:** everything in R1-R4 above (exact fields/columns/declarations) is the template for ONE
category ("Fresh Fruits and Vegetables") — NOT a global hardcoded format. I must build a
**per-Export-Category document template system**: each ExportCategory defines which columns show
in its Packing List / Buyer's Invoice / BD Invoice / Shipment Details product table. Export
Category becomes the dashboard's primary navigation concept; Shipment Details is secondary
(subordinate to / configured by the shipment's category).

**Decision (locked in, don't re-litigate on resume):**
- NOT restructuring URL routing (categories/[id]/countries/[id]/buyers/... would be too risky —
  breaks all existing links/bookmarks for a nav-hierarchy change that doesn't strictly need it).
  Instead: (a) give Export Categories its own first-class top-level page under the export
  dashboard (pulled OUT of the generic Settings tab-page, since it's no longer "just settings"),
  prominently linked/first on the dashboard home; (b) each category gets a `documentColumns`
  config (which of a FIXED KNOWN vocabulary of column keys shows in each of the 4 tables, in what
  order) — a checkbox/reorder UI per document per category, NOT a fully generic form-builder (too
  much scope for the value it'd add); (c) shipment editor + PDF/print generation read the
  shipment's selected category's `documentColumns` to decide what to render, falling back to the
  full default (= exact R1-R4 spec = "Fresh Fruits and Vegetables" preset) when no category is set
  yet, so nothing is ever blocked/blank.
- Declaration TEXT stays fixed/shared across categories (not templated) — user said "format"
  which reads as columns/structure, not asking for a full rich-text-per-category system. Can
  revisit if user explicitly asks later.
- "CNF" (seen once on the BD Invoice reference's column header) is being treated as an isolated
  typo in that one legacy sample — using "CFR" everywhere (matches the ORIGINAL written spec doc
  verbatim + both other reference PDFs which say "CFR" correctly).
- Packing List AND BD Invoice declarations both get the leading "1." (matches written spec's exact
  text for both; the BD_Invoice.pdf reference sample is missing it, treating that as the sample's
  own small inconsistency, written spec taking precedence).

**Reference layout notes (from visual inspection of the 3 rasterized PDFs), Fresh F&V category:**
All 3 share: title line ("Packing List" / "Commercial Invoice" / "Commercial Invoice") → 2-column
header info block [LEFT: Exporter name, Contract No + Invoice No (+ DT) same row, TIN, BIN, ERC,
EXP (+date), AWB (+date), (Buyer's Invoice & Packing List ALSO show PC + date here — BD Invoice
reference sample did NOT show a PC line, minor inconsistency, I'm including PC on all 3 per the
written spec listing PC No as a standard identifier)] [RIGHT: Country of Origin, Sales Term,
Importer name, Mode of Carrying, Landing Port, Port of Discharge, Final Destination] → full-width
"Beneficiary Bank : {name}" line → product table → Gross Weight + Freight Cost line (Buyer's
Invoice & Packing List refs show this; applies to BD too per spec's "same as packing list") →
declaration text block → Total Carton/Net Weight/Gross Weight 3 lines → footer block (Exporter
address, Importer/Buyer address, shipping-route repeat strip [mode + landing port + port of
discharge as plain text, not clearly tied to the header labels in the raw extraction — TREATING
AS A RENDERING QUIRK OF THE LEGACY SAMPLE, not replicating; my version will populate the header
labels directly with their real values and not worry about matching this specific footer quirk],
bank details [Account Number, Branch/"Foreign Exchange Corporate Branch", Routing Number, Swift
Code]).
Per-document table columns confirmed visually (matches written spec R2-R4 exactly):
- Packing List: SL NO. | Name of Products (Botanical Name) | Pack Size in KG | Total CTN |
  Quantity Kg — Grand Total row (blank/blank/423/2190).
- Buyer's Invoice: SL NO. | Name of Products (Botanical Name) | Quantity Kg | Unit Price | Total
  EURO(CFR) — Grand Total row (2190 / — / 11,813.80€).
- BD Invoice: SL NO. | Name of Products (Botanical Name) | Total CTN | Quantity KG | Unit Price |
  Total EURO(CFR) — ONE data row, Name cell = category name ("Vegetables & Fruits") with
  "H.S Code : 07119000" as a SECOND LINE INSIDE THE SAME CELL (not its own column!) — Grand Total
  row (423 / 2190.00 / — / 10,950.00€). CORRECTION to my own earlier roadmap: HS Code is NOT a
  separate table column for BD Invoice, it's a sub-line under the product-name cell. Keep this in
  mind when building the BD Invoice table UI/PDF — render an HS Code sub-line under the name, not
  a 7th column.
- Shipment Details master table: not shown in any reference (admin-only screen, never printed) —
  still build per written spec R1 (SL No, Name+Botanical, HS Code, Pack Size KG, Total CTN,
  Quantity KG, Unit Price, Average Price, Total EUR/CFR) as the FRESH F&V DEFAULT column set for
  that table too, since the doc groups it under the same "different category = different format"
  concern.

NEXT STEP WAS: read app/(print)/print/export/[shipmentId]/page.jsx and lib/exportDocuments.js in
full to see how close current code already is to this reference (they may be the literal source
that generated these exact sample PDFs) before designing the templating layer — do this first on
resume if not yet done (check LIVE LOG below for whether this happened).

## CONCRETE BUG LIST FOUND IN print/PDF CODE (verified by reading, not guessed) — fix all of these
Both `app/(print)/print/export/[shipmentId]/page.jsx` (React preview/print) AND
`lib/exportDocuments.js` (jsPDF download) render EVERY document (plain or letterhead) with a dark
colored table header / colored banner / alternating row colors — this does NOT match the plain
reference PDFs at all (which are pure black-text-on-white, simple bordered table, no fill colors,
no banner graphic in plain mode). Both files must be rewritten to a plain/minimal style for PLAIN
mode; LETTERHEAD mode = same plain content, real uploaded letterhead image at top instead of blank
space (remove the fake green "Shah International" coded-banner from ever showing in PLAIN mode;
keep it only as a letterhead-mode fallback when no real letterhead is uploaded yet).
1. BD Invoice title renders as "Bangladeshi Invoice" in BOTH files — spec says it must be
   "Commercial Invoice" (same heading text as Buyer's Invoice).
2. BD Invoice's declaration currently renders the long BDREX/GSP paragraph in BOTH files — spec
   says BD Invoice's declaration should be the SIMPLE one (same as Packing List); the GSP/BDREX
   paragraph belongs to Buyer's Invoice ONLY. Currently `InvoiceDoc`/`generateInvoicePDF` render the
   GSP text unconditionally for both isBuyer=true and isBuyer=false — needs an if-branch.
3. BDREX declaration hardcodes "BDREX04343" instead of interpolating a real `shipment.rexNo` field
   (which doesn't exist yet anywhere in the schema — new field needed).
4. Exporter name/address hardcoded as literal strings in ≥4 places (print page ×2 inline JSX,
   exportDocuments.js `EXPORTER` const used ×2) — must source from Settings' new exporterName/
   exporterAddress fields instead (see model plan below).
5. `generateInvoicePDF`/`InvoiceDoc` read from `shipment.buyerItems`/`shipment.bdItems` (the old
   independent arrays) — must switch to the new architecture: Buyer's Invoice reads the master
   `items` (read-only view), BD Invoice reads its own small override array (repurposed `bdItems`).
6. HS Code doesn't render anywhere. Per the BD_Invoice.pdf reference, it must appear as a SECOND
   LINE inside the product-NAME cell (not a separate column) for BD Invoice specifically.
7. Average Price doesn't exist anywhere — new derived (not stored) field: per-row = totalValue/
   quantityKg; shipment-wide = sum(totalValue)/sum(quantityKg), used to seed BD Invoice's unit price.
8. "CFR" must be used consistently (BD_Invoice.pdf reference had one isolated "CNF" typo — not
   propagating it, per the scope-change note above).
9. No per-category document column variability at all (the whole point of the scope change) — both
   files must read `shipment.exportCategory?.documentColumns` (falling back to the Fresh F&V
   default set) to decide which optional columns render, instead of a hardcoded fixed column list.

## COLUMN REGISTRY DESIGN (the mechanism for "format changes per export category")
New shared file `lib/exportColumns.js` — single source of truth used by BOTH the admin UI
(category editor checkboxes + shipment editor's read-only document-tab tables) AND print/PDF
generation, so they can never drift from each other.
- Fixed vocabulary of togglable column keys (mapped to {key, label}): `hsCode`, `packSizeKg`,
  `totalCTN`, `quantityKg`, `unitPrice`, `averagePrice`, `totalValue`. (`name`/product+botanical and
  `slNo` are ALWAYS shown on every document, not togglable — every document needs a product
  identifier.)
- Per-document AVAILABLE subsets + DEFAULT (= exact Fresh F&V spec, verified against all 3
  reference PDFs):
  - packingList: available [hsCode, packSizeKg, totalCTN, quantityKg] — default
    [packSizeKg, totalCTN, quantityKg] (matches Packing_List.pdf exactly: no HS code shown there)
  - buyerInvoice: available [hsCode, quantityKg, unitPrice, averagePrice, totalValue] — default
    [quantityKg, unitPrice, totalValue] (matches Buyer_s_Invoice_.pdf exactly)
  - bdInvoice: available [totalCTN, quantityKg, unitPrice, averagePrice, totalValue] — default
    [totalCTN, quantityKg, unitPrice, totalValue] + a SEPARATE non-column boolean
    `showHsCodeSubline` (default true) since HS Code renders as a sub-line under the name cell for
    BD Invoice specifically, never its own column (confirmed from the reference image).
- Shipment Details MASTER table (data entry) is DELIBERATELY NOT category-configurable — always
  shows the full field set (name, hsCode, packSizeKg, totalCTN, quantityKg, unitPrice,
  averagePrice, totalValue). Rationale (write this in the final summary too): keeping data ENTRY
  consistent avoids fragile category-conditional calculation logic; only the PRESENTATION on the 3
  output documents varies per category, which is what "different categories need different
  formats" actually calls for and is safe to vary since it's pure display of already-captured data.
- ExportCategory model gets `documentColumns: { packingList: [String], buyerInvoice: [String],
  bdInvoice: [String] }` + `bdInvoiceShowHsCode: Boolean` with defaults = the Fresh F&V set above.
  A shipment with NO category chosen yet (or a category saved before this field existed) falls back
  to these same defaults via `?.documentColumns?.packingList || DEFAULT_PACKING_LIST_COLUMNS` — so
  nothing is ever blank/broken pre-category-selection.

## EXPORT CATEGORY ELEVATION (UX/nav change, "most central point")
Decision: NOT restructuring URL routing (too risky). Instead: (1) new first-class page
`/admin/export-dashboard/categories` (pulled OUT of the generic Settings tab-page — it's no longer
"just settings", it now owns document-template config, a bigger responsibility) — reuses/extends
the current `ExportCategorySection.jsx` component, adding the column-picker UI; (2) add it as the
FIRST nav item on the export-dashboard main page (ahead of Countries & Buyers), with copy
explaining its role ("defines the packing list / invoice format for its shipments"); (3) Settings
page keeps the remaining 4 sections (CTN Config, Shipment Options, Bank Accounts, Export Licenses)
— becomes a 4-tab page instead of 5; (4) shipment editor keeps Export Category as its first/most
prominent selector (already true), copy updated to mention it drives document format.

## MODEL CHANGES NEEDED (final list, Phase C)
- ExportShipment: add `rexNo` (String, Shipment Identifiers box); add `hsCode` to
  ShipmentItemSchema (per-row, manual/auto-fill-from-product); repurpose `bdItems` semantics (still
  an array field, but now = admin-editable override rows seeded from category+totals, not a mirror
  of `items`); keep `buyerItems` field in schema for backward-compat (unused going forward, Buyer's
  Invoice now derives from `items`) — DO NOT delete the field (avoid data loss for old docs); add
  `exporterName`/`exporterAddress` to ExportShipment? — NO, decided these come from Settings
  (single global company identity), not per-shipment (see below).
- ExportCategory: add `documentColumns` + `bdInvoiceShowHsCode` (see registry design above).
- ExportLicense: add `rexNo` (String) so it can auto-fill into a shipment the same way TIN/BIN
  already do from a selected license.
- Product: add optional `hsCode` (String) so the shipment-details product combobox can auto-fill it
  (same "auto-fill then editable" pattern as botanical name); not required.
- Settings: add `exporterName` (default 'Shah International') and `exporterAddress` (default
  '111 South Bashabo, Opposite of Sabujbagh Thana, Dhaka 1214' — matches current hardcoded text
  exactly, zero behavior change until admin edits it) — global company identity, editable from a
  new small card on the export-dashboard main page (next to the existing Letterhead card).

## R5 INVESTIGATION — CONCLUSION (settings-goes-empty-after-refresh bug)
Ruled out (verified by reading the actual current code, not assumption):
- Next.js static-route caching: `/api/settings` GET already has `export const dynamic =
  'force-dynamic'`, `export const revalidate = 0`, and explicit no-store headers. Not the cause.
- Other export-settings GET routes (ctn-configs/bank-accounts/licenses) all call getServerSession
  in GET, which forces dynamic rendering implicitly anyway. Not the cause.
- CtnConfigSection.jsx (separate collection, per-record CRUD, no shared-singleton-overwrite risk)
  — read it fully, looks correct, not the source of the reported symptom.
- ShipmentOptionsSection.jsx's own fetch/save logic — re-read fully, always sends the COMPLETE
  6-key object on save, correctly reads `d.settings.exportShipmentOptions` with a sane fallback on
  load. No logic bug found in this component itself.
Remaining genuine lead (can't fully confirm without a live Mongo instance — no network in this
sandbox to install/run one): Mongoose's `$set` on a *shorthand nested-object* schema field
(`exportShipmentOptions: { modeOfCarrying: {type:[String],...}, ... }`, not an explicit
sub-Schema) casting the WHOLE nested object at once via `findOneAndUpdate` is a known historically
fragile pattern in Mongoose, though version 8.x (used here) is much more mature about it than
older versions — I cannot rule it in or out with certainty via static reading alone.
**Decision:** apply a defensive, unambiguously-correct hardening fix regardless of whether it's
THE historical root cause, since it can only improve correctness: change the Settings PUT route to
flatten any plain-object top-level key in the request body into dot-notation `$set` paths (e.g.
`exportShipmentOptions.modeOfCarrying`, `exportShipmentOptions.landingPort`, ...) instead of
`$set`-ing the whole nested object in one shot — this is the most explicit, least-ambiguous update
form MongoDB/Mongoose supports, removing any possible whole-object-casting edge case for
`exportShipmentOptions` AND `contact`/`social`/`payment` (same pattern, same theoretical risk,
currently unreported but silently exposed to the same class of issue). Will also make
`ShipmentOptionsSection.jsx` re-sync its local state from the PUT response's returned `settings`
object (not just assume its pre-save local state was already correct) so any future discrepancy
becomes IMMEDIATELY visible in the UI right after saving, not just discovered later on refresh.
Will note honestly in the final user-facing summary that this is a robustness fix for the most
concrete mechanism found via code review, not a 100%-confirmed root cause (I don't have a live DB
to prove it conclusively) — being honest about this rather than overclaiming.

## REVISED ROADMAP (supersedes the earlier one — phases C onward)
- [ ] PHASE C — Model changes (this list above). Verify each with tsc after edit.
- [ ] PHASE D — lib/exportColumns.js (column registry, shared).
- [ ] PHASE E — Settings PUT route dot-notation fix + ShipmentOptionsSection resync.
- [ ] PHASE F — ExportCategory API/model wired for documentColumns; new
      /admin/export-dashboard/categories page (column-picker UI); nav elevation on dashboard home;
      slim Settings page to 4 tabs; Exporter Name/Address card on dashboard home.
- [ ] PHASE G — Shipment editor rewrite: Shipment Details tab = master (identifiers incl. REX No,
      logistics fields moved in, bank fields moved in, full product table w/ HS Code + Average
      Price columns, CTN-size <select>, Gross Weight+estimate). Packing List tab = stripped to
      Net/CTN/Gross/Freight + read-only category-templated table. Buyer's Invoice tab = read-only
      category-templated table + read-only summary mirror. BD Invoice tab = its own small
      admin-editable override rows (auto-seed-if-empty from category+totals) + mismatch red-flag
      banner vs Shipment Details' true totals.
- [ ] PHASE H — Print page + lib/exportDocuments.js rewrite: plain/minimal styling matching
      reference PDFs, correct titles/declarations per doc type, REX No interpolation, Exporter
      name/address from Settings, category-templated columns, HS Code sub-line on BD Invoice.
- [ ] PHASE I — Full verification sweep (tsc every touched file, re-view each after edit), update
      PROJECT_STATUS.md with new §14 entry, zip to shah-international-v8.zip, present to user.

## INVESTIGATION LOG for R5 (append findings here as discovered)
See "R5 INVESTIGATION — CONCLUSION" above (kept as one block since the investigation was done in
one continuous pass rather than incrementally).

## LIVE LOG (append-only, most recent last)
- Batch 7 tracker created. Read all 6 prior AGENT_PROGRESS files + PROJECT_STATUS.md (§10-13) in
  full. Confirmed environment: no node_modules/network/git, but a working GLOBAL tsc for real
  verification (better than prior batches had). Extracted zip to /home/claude/work/site. Starting
  Phase A (deep read) now.
- [Turn 2] PHASE C, D, E COMPLETE, all re-verified on disk + tsc-clean at start of this turn:
  - models/ExportShipment.js: rexNo, per-item hsCode, bdItemsSeeded flag, architecture comments.
  - models/ExportCategory.js: documentColumns + bdInvoiceShowHsCode (imports lib/exportColumns.js).
  - lib/exportColumns.js: NEW — the shared column registry (COLUMN_LABELS, AVAILABLE_COLUMNS,
    DEFAULT_DOCUMENT_COLUMNS, DOC_KEYS, DOC_LABELS, getDocumentColumns(), shouldShowBdHsCode(),
    avgPrice(), shipmentAveragePrice()).
  - models/ExportLicense.js: optional rexNo.
  - models/Product.js: optional hsCode.
  - models/Settings.js: exporterName/exporterAddress (defaults = the old hardcoded text, zero
    behavior change until admin edits).
  - app/api/settings/route.js: flattenForSet() dot-notation hardening for the R5 investigation.
  - components/admin/export-settings/ShipmentOptionsSection.jsx: resyncs from server response
    after save.
  Noted for Phase G: shipment editor's `selectProductForRow`/add-row/EMPTY-row-template (3 spots,
  lines ~143/152/257 as of last read) need `hsCode: product.hsCode || ''` added alongside the
  existing `botanicalName: product.scientificName || ''` auto-fill, and new rows' hsCode field.
  NEXT: Phase F (Settings split + new Export Categories page + nav elevation + Exporter card).
- [Turn 2 cont'd] PHASE F COMPLETE, all tsc-clean:
  - app/admin/export-dashboard/settings/page.jsx: removed Export Categories tab (now 4 sections),
    added a callout card linking to the new /categories page.
  - components/admin/export-settings/ExportCategorySection.jsx: added the documentColumns +
    bdInvoiceShowHsCode picker UI inside the add/edit modal (checkboxes per document, normalized to
    canonical AVAILABLE_COLUMNS order on save regardless of click order); updated header copy.
  - app/admin/export-dashboard/categories/page.jsx: NEW — dedicated first-class page wrapping
    ExportCategorySection, with back-link + framing copy ("the starting point for every shipment").
  - app/admin/export-dashboard/page.jsx: added Exporter Name/Address editable card (green, next to
    the amber Letterhead card, 2-col grid) wired to Settings' new exporterName/exporterAddress;
    added "🏷️ Export Categories" as the FIRST, brand-colored nav item (Countries & Buyers demoted
    to a plain secondary tab); updated header subtitle.
  NEXT: Phase G — the shipment editor rewrite (the big one). Plan: re-read the full current 913-line
  file fresh (previous read is several turns back, context may have drifted) before restructuring,
  to avoid losing any currently-working functionality (financial/profit analysis, status/notes,
  additional docs, photos, license/category/bank selectors, letterhead) that this batch does NOT
  touch. Given the scope of interdependent changes (shared ItemsTable component, 4 tabs' content,
  several new state pieces), will rewrite the file as one coherent whole (rm + create_file) rather
  than many piecemeal str_replace edits, to avoid leaving orphaned/inconsistent code — but only
  AFTER a careful fresh full read.
- [Turn 3] Did the fresh full 914-line re-read (7 chunks). Confirmed hsCode WILL flow through
  automatically once added to Product model: /api/products uses `Product.find(query)` with no
  `.select()` projection, and ProductNameCombobox.jsx passes the full product object through
  `onSelect(p)` already — no changes needed to either of those files.
  Added `columnHeaderLabel(key, currency)` to lib/exportColumns.js (currency-interpolated header
  text for unitPrice/averagePrice/totalValue) so the admin editor's read-only views and the future
  print/PDF code render identical headers — tsc-clean.
  LOCKED-IN DESIGN for the shipment editor rewrite:
  - New local components: `ReadOnlyItemsView` (Packing List/Buyer's Invoice read-only tables) and
    `BdInvoiceTable` (BD Invoice's small editable override rows; totalValue+averagePrice
    auto-computed read-only cells per R4's "filled automatically" wording).
  - `ItemsTable` (master) gains: hsCode column (auto-fills from product.hsCode WITHOUT clobbering
    an existing value when the picked product has none), Average Price column (read-only,
    avgPrice()), ctnSizeKg becomes a real `<select>` sourced from ctnConfigs (+ synthesized
    "(custom)" option preserving any non-matching existing value).
  - Form state: add `rexNo: ''`; `bdItems` initial/fallback becomes `[]` (not EMPTY()'s 3 blank
    rows) — the new auto-seed effect populates it once real data exists.
  - `handleLicenseSelect` also sets rexNo from lic.rexNo (non-clobbering, same pattern as hsCode).
  - New plain consts placed AFTER all hooks but BEFORE `if (loading) return` (verified safe —
    every real hook already sits above that line, only plain declarations follow):
    liveShipmentAveragePrice, selectedCategory, itemsTotalValue, bdTotalCTN/bdTotalQty/
    bdTotalValue + bdMismatches (tolerance 0.01, only when bdItems has real data — Gross Weight
    excluded from this check since it's one shared field mirrored everywhere, can't mismatch).
  - seedBdItemsFromShipment() shared by an auto-seed useEffect (guarded: not seeded yet, bdItems
    empty, category-or-totals exist, not still loading) AND a manual "Re-fill" button. Old
    shipments' pre-existing multi-row bdItems are left untouched (isBdEmpty guard).
  - Tab moves: Shipment Details GAINS Identifiers+REX No, Exporter/Importer card, Logistics
    fields (from Packing List), Bank fields (from BD Invoice), the master ItemsTable (from Packing
    List), then existing Financial/Status/Notes/Docs, then Photos (from Packing List) last.
    Packing List SHRINKS to summary fields + ReadOnlyItemsView. Buyer's Invoice becomes read-only
    (ReadOnlyItemsView on form.items, not old buyerItems) + new summary mirror row. BD Invoice:
    bank fields removed, new summary mirror row, mismatch banner, BdInvoiceTable.
  NEXT: write the full replacement file (rm + create_file), tsc-verify, then re-view end-to-end to
  manually confirm hook ordering (tsc cannot catch Rules-of-Hooks violations).
- [Turn 4] Found the shipment editor file ALREADY REWRITTEN on disk (1200+ lines, all my planned
  pieces present) — apparently completed in a prior turn not fully reflected in this log before it
  got cut off. Per the "always re-verify against the filesystem, not the log" lesson from every
  prior batch, did a full careful end-to-end re-read (9 chunks) rather than trusting it blindly.
  tsc was clean, but manual reading caught 3 REAL bugs tsc/syntax-checking can't see, all now fixed
  and re-verified tsc-clean:
  1. Photos section (issue 43, pre-existing feature) was completely dropped from the JSX during the
     rewrite — addPhoto/updatePhotoCaption/removePhoto handlers existed but were never rendered
     anywhere (confirmed via grep: each only had its 1 definition, 0 call sites). Restored the full
     Photos UI (upload button + caption-editable thumbnail grid) at the end of the Shipment Details
     tab, matching the Additional Documents section's established style.
  2. seedBdItemsFromShipment() computed the seeded row's totalValue as quantityKg × the *rounded*
     (2dp) unit price, instead of the exact itemsTotalValue — since averagePrice = itemsTotalValue
     ÷ totalQty exactly, rounding the price to 2dp before multiplying back out across a potentially
     large quantity (e.g. 2000+ kg) can drift the result by more than MISMATCH_TOLERANCE (0.01),
     which would have shown a false "doesn't match Shipment Details" warning on a FRESHLY-SEEDED,
     never-touched-by-admin row — undermining the whole point of the mismatch feature. Fixed to seed
     totalValue directly from itemsTotalValue (exact).
  3. BdInvoiceTable's updateRow() recomputed totalValue (qty × price) on EVERY field edit, including
     productName/hsCode/totalCTN — so editing just the product name on a freshly-seeded row would
     immediately re-derive totalValue from qty × the *rounded* price, silently discarding the exact
     seeded value from fix #2 and reintroducing the same false-positive risk the instant the admin
     touched anything at all. Fixed to only recompute totalValue when k is 'quantityKg' or
     'unitPrice' (mirrors how ItemsTable's updateFields was already correctly gated).
  Also reconsidered and fixed the auto-seed guard: was `!form.exportCategory && liveTotalCTN<=0`
  (fires if EITHER is already present) — changed to `!form.exportCategory || liveTotalCTN<=0`
  (requires BOTH). Reasoning: realistic workflow is pick-category-then-add-items; the OR version
  would seed a mostly-blank row right after category selection alone (no totals yet), then never
  refresh itself once real items are added since bdItemsSeeded is already true by then — the AND
  version waits for both, producing a complete initial seed. BdInvoiceTable's existing empty-state
  copy ("Pick an Export Category and add products...") already implied this, now the code matches.
  Verified hook ordering is correct: ALL real hooks (useState/useEffect/useLiveRate) sit above
  `if (loading) return`, including the new BD auto-seed useEffect — only plain const/function
  declarations follow between them and the return, which is legal (Rules of Hooks only constrains
  actual hook calls, not plain code) — confirmed by reading, not assumed.
  Verified field persistence: ExportShipment's PUT route does `findByIdAndUpdate(id, body, {new:
  true})` with NO `$set` wrapper — this is a MongoDB full-document REPLACE, not a partial update
  (different from Settings' singleton, which is why THAT route needed explicit $set/flattening).
  This is safe here specifically because handleSave's payload is always `{...form, ...}` — the
  COMPLETE form state, never partial — so replacement semantics are equivalent to an update in
  practice; confirmed rexNo/hsCode/bdItems/bdItemsSeeded all flow through since they're already
  part of `form`. Pre-existing pattern from prior batches, not something this batch needs to change.
  Checked shipments GET routes populate exportCategory — turns out irrelevant either way, since
  `selectedCategory` is resolved by matching form.exportCategory's plain ID string against the
  SEPARATELY-fetched exportCategories list (which does carry documentColumns), not from whatever
  the shipment GET response's own population happens to include.
  PHASE G NOW COMPLETE AND VERIFIED. NEXT: Phase H — print page (app/(print)/print/export/
  [shipmentId]/page.jsx) + lib/exportDocuments.js rewrite: plain/minimal styling matching the 3
  reference PDFs (remove dark-header/colored-row/fake-banner styling), correct BD Invoice title
  ("Commercial Invoice" not "Bangladeshi Invoice"), correct declaration text per document (simple
  for Packing List + BD Invoice, BDREX/GSP for Buyer's Invoice only, with real rexNo interpolated
  instead of hardcoded "04343"), Exporter name/address from Settings instead of hardcoded strings,
  category-templated columns via getDocumentColumns()/shouldShowBdHsCode() (same registry the
  editor now uses), HS Code as a sub-line under the name cell specifically for BD Invoice. Read
  both files fresh before editing (this turn's lesson: always re ready actual current file content
  immediately before editing, never trust a summary of what "should" be there).
- [Turn 4 cont'd] Print page (app/(print)/print/export/[shipmentId]/page.jsx) REWRITTEN (rm +
  create_file, 324→379 lines) and tsc-verified clean:
  - All style constants now pure black-border/white-background (no backgroundColor anywhere except
    the letterhead-mode coded-banner fallback, which is unchanged/unaffected) — TITLE_STYLE,
    CELL/CELL_LAST (2-col info grid), TABLE_STYLE/TH/TD/TDC, SUMMARY_LINE, DECLARATION_STYLE.
  - `DocHeader` gained a `plain` prop with an early `return null` — plain mode now shows genuinely
    nothing above the title (was previously always showing the fake green coded banner whenever no
    letterhead existed, even in plain mode — that was the core visual-fidelity bug). Letterhead
    mode's fallback banner still exists for when letterhead mode is chosen but nothing's uploaded
    yet, now sourced from exporterInfo instead of a hardcoded EXPORTER const.
  - New shared `InfoGrid` component (2-col bordered grid: Exporter/Contract+Invoice+Date/TIN/BIN/
    ERC/EXP/AWB/PC on the left, Country of Origin/Sales Term/Importer/Mode of Carrying/Landing
    Port/Port of Discharge/Final Destination on the right, Beneficiary Bank+account details full
    width below) used by all 3 doc types — also fixed a real gap: Invoice No was completely
    missing from the old header grid (only Contract No showed) despite appearing on all 3 reference
    PDFs; now shown combined with Contract No + date on one line, matching the references.
  - `PackingListDoc`/`InvoiceDoc` both now resolve columns via getDocumentColumns(shipment.
    exportCategory, docKey) — confirmed shipment.exportCategory comes back populated from the GET
    route (`.populate('exportCategory')`), carrying documentColumns straight through with no extra
    fetch needed here (this file always operates on an already-saved, freshly-fetched shipment,
    unlike the editor which also has to handle an unsaved draft).
  - InvoiceDoc: BD Invoice's H.S Code now renders as a second line inside the name cell (matching
    the reference's actual layout), gated on shouldShowBdHsCode(); title unconditionally "Commercial
    Invoice" for both isBuyer true/false (was "Bangladeshi Invoice" for BD); declaration branches on
    isBuyer (full BDREX/GSP paragraph, now interpolating real shipment.rexNo instead of hardcoded
    "04343", exporter name also dynamic — vs BD Invoice's simple declaration, same text+"1." prefix
    as Packing List, previously BD incorrectly got the long paragraph too).
  - Main PrintPage component now also fetches exporterName/exporterAddress from Settings (alongside
    the pre-existing letterhead fetch) and threads exporterInfo through to both Doc components; also
    now passes exporterInfo to generateShipmentDocPDF for the Download button's parity with Print.
  NEXT: lib/exportDocuments.js (the jsPDF generator behind the Download button) — same set of fixes,
  jsPDF/autoTable primitives instead of HTML/CSS. Read fresh before editing (352 lines, unchanged
  since the very first read this session — confirmed via wc -l match, so no surprise prior-turn
  edits here unlike the shipment editor).
- [Turn 4 cont'd] lib/exportDocuments.js REWRITTEN (rm + create_file) and tsc-verified clean. Same
  fixes as the print page, translated to jsPDF/autoTable primitives: drawHeader gained a `plain`
  param with early return (was unconditionally falling through to the coded-banner-fallback path in
  plain mode too, since loadImageForPdf('') returns null dataUrl — same bug as the print page had);
  drawInfoGrid gained Invoice No (was missing) + is now wrapped in an actual border rect (doc.rect)
  instead of floating borderless text; PLAIN_TABLE_STYLE constant (white fills, black grid lines,
  alternateRowStyles forced white) replaces the old dark-header/colored-footer/zebra-striped autoTable
  theme; BD Invoice title fixed to "Commercial Invoice"; declaration branches on isBuyer (GSP/BDREX
  with real shipment.rexNo vs Packing-List-style simple text for BD); BD's H.S Code renders as a
  '\n'-joined second line within the name cell (autoTable supports embedded newlines for wrapping);
  cellText()/grandCellText() mirror the print page's renderItemCell/renderGrandCell exactly, both
  reading the same lib/exportColumns.js registry; generateAllDocumentsPDF's buyer-invoice
  availability check fixed from `shipment.buyerItems` to `shipment.items` (same bug class as found
  in the print page, caught by comparing against it directly this time rather than missing it twice).
  All functions now accept an optional `exporterInfo` param (defaulting to DEFAULT_EXPORTER, which
  matches Settings' own schema defaults verbatim) so any caller that doesn't pass it explicitly still
  behaves exactly as before — zero regression for un-updated call sites — while callers that DO pass
  it get the fully dynamic Settings-sourced identity.
  Grepped every caller of generate*PDF across the repo (4 files) and updated the other 2 I hadn't
  already covered:
  - app/admin/export-dashboard/archive/page.jsx: added exporterInfo state (fetched alongside its
    existing letterhead fetch) threaded through ShipmentFileGroup → both PDF calls; ALSO found and
    fixed the exact same stale `shipment.buyerItems` availability-check bug here too (this file has
    its own independent copy of that has:/filter logic for its UI badges, not shared code with
    exportDocuments.js's internal copy — both needed the identical fix, now applied to both).
  - shipment editor's handleDownload: now passes its existing exporterInfo state through (was
    fetching it since Phase G's dashboard-page work but not yet threading it into this specific call).
  Final grep sweep confirmed zero remaining active-code references to `buyerItems` anywhere in the
  repo (only the deliberately-kept legacy schema field + explanatory comments remain) and zero
  remaining "Bangladeshi Invoice"/hardcoded-"BDREX04343" strings anywhere.
  Completed two small UI-completeness gaps found while double-checking the new model fields actually
  have a way to be SET, not just read: ExportLicenseSection.jsx gained a REX No input (optional,
  next to the required TIN/BIN fields, plus shown on the license card) so the license→shipment
  auto-fill has something to draw from; the product catalog's shared ProductForm (app/admin/
  products/new/page.jsx, also used for editing via the [id] route's thin wrapper) gained an optional
  HS Code field next to Botanical Name, so the shipment editor's product-picker auto-fill has
  something to draw from too — confirmed both flow through their respective save payloads via
  existing generic spreads, no other file needed touching for either.
  ALL PHASES (C through H) NOW COMPLETE. Final comprehensive tsc sweep across all 16+ touched files
  passed clean in one combined invocation. NEXT: update PROJECT_STATUS.md with a new §14 entry,
  final full-repo sanity grep pass, zip to shah-international-v8.zip, present to user.
- [Turn 4, final] v8 delivered. BATCH 7 marked complete (see note below — turned out premature,
  real-world testing surfaced 4 more real bugs, now Round 2 of batch 7, tracked below rather than
  starting a new AGENT_PROGRESS_8.md since this is still a direct continuation of the same task).

## ROUND 2 (user tested the delivered v8 against a real shipment, reported 4 real bugs via a
## screenshot + save error — none of these were caught by tsc/manual-review since they're either
## runtime data-flow bugs or pure CSS/layout issues, both outside what static reading can catch)
1. **SAVE CRASHES**: `ExportShipment validation failed: exportLicense: Cast to ObjectId failed for
   value "" (type string)`. Root cause (confirmed by reading the model): `exportLicense` and
   `exportCategory` are `mongoose.Schema.Types.ObjectId` refs; the shipment editor's `<select>`
   defaults to `''` when nothing is chosen, and handleSave was sending that empty string straight
   through — Mongoose can't cast `""` to an ObjectId. This is a PRE-EXISTING latent bug (not
   introduced this session), just never triggered before because testers always picked a license.
   Fix: sanitize both fields to `undefined` at save time if empty, PLUS harden the API routes
   (POST/PUT) as defense-in-depth so no future caller can trigger the same crash.
2. **BD Invoice shows stale numbers that never catch up** (screenshot: BD shows Total CTN=5/Net
   Weight=7.5kg/Total=0.00 while Shipment Details is actually at 660 CTN/2950kg/13050 EUR — the red
   mismatch banner is correctly detecting this, but the underlying UX is wrong). Root cause: my R4
   design deliberately seeds BD Invoice ONCE (bdItemsSeeded flag) then freezes it as independently
   admin-owned data — but this shipment was very likely seeded early (when Shipment Details had far
   fewer items), then the admin kept adding products to Shipment Details afterward, and BD Invoice
   never got a reason to re-sync since bdItemsSeeded was already true. User's expectation, stated
   directly: "the values of bd invoice should be as same as the shipment details... " — i.e. it
   should track automatically, not require remembering to click "Re-fill". REDESIGNING: instead of
   seed-once-then-frozen, BD Invoice's row(s) should CONTINUOUSLY auto-sync to Shipment Details'
   current totals for as long as the admin hasn't manually touched them — only freezing (going
   admin-owned/independent) the moment they actually edit a field, or add/remove a row. Repurposing
   the existing `bdItemsSeeded` boolean's meaning to "locked/detached from auto-sync" rather than
   adding a new field (renaming to `bdItemsLocked` in the model for clarity, small cost since it's
   only referenced in the editor).
3. **Table UI/spacing**: "not looking align... make the fields more space so that the values can
   fit properly and become more visible" across Shipment Details/Packing List/Buyer's Invoice/BD
   Invoice tables. Needs wider column allocation, more cell padding, less cramped inputs — visible
   directly in the screenshot (BD Invoice's numeric inputs look squeezed relative to the wide name
   column).
4. **Product suggestion dropdown renders UNDER the table** ("product suggesting list is getting
   under the table"). Root cause hypothesis (to verify while reading): the product combobox's
   suggestion dropdown is a normal absolutely-positioned child inside a cell that's inside the
   table's `overflow-x-auto` wrapper — per CSS spec, setting overflow-x to anything other than
   `visible` forces overflow-y to compute to `auto` too (browsers don't allow one axis `visible` and
   the other clipped), so the dropdown gets vertically clipped/hidden behind the table's own scroll
   boundary regardless of z-index (z-index only resolves sibling stacking order, it cannot escape an
   ancestor's overflow clipping). PLAN: render the suggestion list through a React portal attached to
   document.body, positioned via the input's getBoundingClientRect() — the standard, robust fix for
   "dropdown trapped inside a scrollable/clipped ancestor", used by essentially every serious
   combobox implementation (react-select, downshift, radix-ui, etc.) for exactly this reason.

PLAN: (a) fix #1 first (save-blocking, most severe) (b) #2 (data-correctness, user's core complaint)
(c) #4 (portal dropdown — self-contained, testable in isolation via careful reasoning since no live
browser) (d) #3 (spacing/padding pass across all 4 tables, lowest risk, do last so it doesn't need
redoing if the portal work changes any table markup). Re-read every file fresh before editing per
established practice — do NOT trust this summary once written, re-verify against actual current
file content at edit time.

**#1 FIXED & VERIFIED (tsc clean, 3 files: lib/utils.js, both shipment API routes, the editor).**
While fixing, found the SAME vulnerability on a 3rd field the user hadn't hit yet: `bankAccount`
(the Beneficiary Bank picker) — also defaults to `''`, also never sanitized, same crash waiting to
happen the first time someone saves without picking a bank. Fixed identically. Checked every
ObjectId-typed path on the model (`grep Schema.Types.ObjectId`) to make sure nothing else was
missed: `productId` (nested per-item) is ALSO ObjectId-typed but is never actually read/written
anywhere in the editor (grep found zero references) — dead/vestigial field, not a live risk, left
alone. `buyer`/`country` always come from route params (never user-selectable empty) but added to
the server-side sanitizer list anyway as harmless defense-in-depth. Approach: client (handleSave)
converts '' → undefined before sending (so JSON.stringify drops the key entirely — correctly CLEARS
the field server-side via the existing full-document-replace semantics if the admin deselected
something, rather than trying to null it out some other way); server (both POST and PUT routes) got
the identical sanitizer as a backstop via a new shared `sanitizeObjectIdFields()` in lib/utils.js,
so no future caller of these routes can trigger this crash either, not just the editor's own save
button.

**#2 FIXED & VERIFIED (tsc clean, models/ExportShipment.js + the editor).** Renamed `bdItemsSeeded`
→ `bdItemsLocked` (checked first: only referenced in these same 2 files, safe rename) and inverted
the whole mechanism from "seed once, freeze forever" to "continuously auto-sync until the admin
takes manual control": the sync `useEffect` now re-runs (and re-applies `seedBdItemsFromShipment()`)
on every change to category/master-items totals as long as `bdItemsLocked` is false, with a
value-diff check so it doesn't loop/re-render needlessly when nothing actually changed. A new
`setBdItems` wrapper (used as BdInvoiceTable's `onChange`, replacing the old direct `set('bdItems',
v)`) sets `bdItemsLocked: true` on any call — safe to do unconditionally because BdInvoiceTable only
ever calls onChange from its own internal user-interaction handlers (updateRow/addRow/removeRow),
never on mount or automatically, so any call through this specific prop unambiguously means the
admin just edited something directly. The sync effect itself calls setFormState directly (bypassing
this wrapper), so auto-sync updates never trip the lock. `handleReseedBd` (the "Re-fill" button) now
sets `bdItemsLocked: false` instead of staying locked after a one-time re-seed — an explicit way
back into auto-sync mode if the admin wants to abandon manual edits. Added a small 🔒Locked/
🔄Auto-syncing status badge + updated the tab's subtitle copy so this state is visible at a glance,
not just inferred. Direct consequence: the mismatch banner can now ONLY ever appear once
bdItemsLocked is true (while auto-syncing, BD Invoice is computed to exactly equal Shipment
Details' totals by construction) — it's fully meaningful now, no false-positive path left.
- [Turn 4, final] PROJECT_STATUS.md §13 added (numbering double-checked sequential 1→14, Setup
  Reminder correctly stays last). Final tsc sweep across all 17 touched files: clean. Final repo-wide
  grep for merge markers/leftover debug artifacts: none found. Zipped /home/claude/work/site (minus
  node_modules/.next/.git, none of which existed anyway) to
  /home/claude/work/shah-international-v8.zip (730KB, 476 files) and round-trip verified by
  re-extracting to a scratch dir and spot-checking key files' presence + content — matches.
  BATCH 7 COMPLETE. Full file list touched this batch: models/{ExportShipment,ExportCategory,
  ExportLicense,Product,Settings}.js; lib/{exportColumns(new),exportDocuments}.js;
  app/api/settings/route.js; components/admin/export-settings/{ShipmentOptionsSection,
  ExportCategorySection,ExportLicenseSection}.jsx; app/admin/export-dashboard/{settings,
  categories(new),page,archive}.jsx; the shipment editor page.jsx; the print page.jsx;
  app/admin/products/new/page.jsx. If resuming after this point: everything is DONE and verified —
  only reason to still be reading this file is to answer a follow-up question or make a further
  requested change, not to redo any of the above.

**#4 FIXED & VERIFIED (tsc clean, components/admin/ProductNameCombobox.jsx — confirmed via grep
this is the ONLY real usage site; ProductMultiSelect.jsx just mentions it in a comment, doesn't
import it).** Confirmed the exact mechanism: this combobox renders inside a `<td>` inside the
Shipment Details table, which sits inside an `overflow-x-auto` wrapper (needed for horizontal
scroll on narrow screens) — CSS forces overflow-y to also compute as `auto` once overflow-x isn't
`visible`, so the old `position:absolute` dropdown was being clipped vertically by that same
wrapper regardless of its z-index (z-index only settles stacking order between siblings, it can't
escape an ancestor's overflow clipping — a common, easy-to-miss CSS trap). Rewrote to render the
suggestion list through a React portal into document.body, positioned via the real input's
getBoundingClientRect() with position:fixed (viewport-relative, matching what getBoundingClientRect
returns) and re-synced on scroll (capture-phase, so it also catches the table's own internal
horizontal scroll, not just window-level scroll) and resize while open — the standard fix for
"dropdown trapped in a scrollable/clipped ancestor" used by essentially every serious combobox
implementation. Click-outside detection now checks both the input's wrapper AND the portaled
dropdown (two different DOM subtrees once portaled, so one ref can't cover both). `mounted` state
guards the portal call to avoid an SSR/hydration mismatch (document.body doesn't exist during
server rendering). While rewriting, also found and fixed a small PRE-EXISTING dead-code bug: the
old outer render condition was `open && (results.length > 0 || loading)`, which meant the "No
catalog match" empty-state message (which only shows when `results.length === 0 && !loading`)
could structurally never actually render — simplified the outer gate to just `open`, since the
inner content already fully handles all 3 sub-states (loading / has results / no results).
Considered applying the same portal treatment to `ProductSearch` (the other, local combobox used
above the table for adding a new row) but confirmed via reading that it sits OUTSIDE the
overflow-x-auto wrapper already (not nested in the clipped table), so it isn't subject to the same
bug — left it as its simpler absolute-positioned self rather than touching a component that isn't
actually broken.

NEXT: #3, the table spacing/padding/alignment pass across all 4 tables (master ItemsTable,
ReadOnlyItemsView, BdInvoiceTable) — user specifically asked for "more space so that the values can
fit properly and become more visible." Doing this last since it's the lowest-risk, most purely
visual change and doesn't need redoing regardless of what the other 3 fixes touched.

**#3 FIXED & VERIFIED (tsc clean).** Root cause confirmed by reading the actual markup (matches the
screenshot exactly): in all 3 table components (master ItemsTable, ReadOnlyItemsView used for both
Packing List & Buyer's Invoice, BdInvoiceTable), the "Name" column's `<th>` had NO width class at
all while numeric columns next to it did — under the browser's default table-layout:auto, an
unconstrained column absorbs whatever space is "left over" after sized columns take their hints,
which is exactly why Name ballooned and Total CTN/Quantity KG/Unit Price/Total got squeezed illegible
in the screenshot. Fixed all 3: added `table-fixed` layout (makes widths authoritative instead of
just hints) with an explicit width on EVERY column including Name (which didn't have one) and the
SL/delete-button columns (which also didn't); added a shared `DOC_COLUMN_WIDTH` lookup so
ReadOnlyItemsView and BdInvoiceTable's dynamic (category-dependent) columns get consistent,
generous widths instead of none; bumped padding across all 3 (px-2 py-1.5 → px-3 py-2/2.5 for cells,
similar bump for headers) and input py (py-1 → py-1.5) per the user's explicit ask for "more space
so the values can fit properly." Each table now has an explicit `minWidth` (1120px / 640px / 620px
respectively) — wider than before, but the existing `overflow-x-auto` wrapper on all 3 handles this
via horizontal scroll on narrower screens, which is the right tradeoff for a data-dense admin table
versus cramming everything down to illegible widths again.

ROUND 2 COMPLETE — all 4 reported bugs fixed and tsc-verified individually and together (final
combined sweep across all 6 touched files: models/ExportShipment.js, lib/utils.js, both shipment API
routes, ProductNameCombobox.jsx, the shipment editor). Re-zipping and re-delivering next.

## ROUND 3 (user reported "No catalog match" showing in the Shipment Details product search when
## it shouldn't — wants all products shown initially, filtered results after typing)
Investigated thoroughly since the client-side combobox logic (rewritten in round 2) already
*attempted* both behaviors correctly on paper. Traced the full request path: buildProductQuery
treats an empty search as "no filter" (correct — should return real products), isActive defaults
to true on the Product model (correct — new products aren't hidden by default), paginateQuery's
skip/limit math is correct for page 1. All looked right in isolation.

**Found the actual bug** by testing the hypothesis directly rather than continuing to guess: the
search filter builds a MongoDB `$regex` directly from raw user input with ZERO escaping. Botanical
names throughout this exact catalog are written like "Mango (Mangifera indica)" — verified with a
real Node regex test that typing that string character-by-character (the natural way a person
types) throws `Invalid regular expression: ... Unterminated group` the MOMENT the opening `(` is
typed but before the matching `)` arrives — i.e. on every keystroke during a very plausible, very
common real search, not as some rare edge case. That server-side crash gets caught by the route's
generic try/catch and returned as a failed response with zero products, which a search combobox can
only render as "no results" — structurally indistinguishable from a genuine empty match without
inspecting the actual server error, exactly matching what was reported.

Fix: added `escapeRegex()` to `lib/utils.js`, applied to `filters.search` before building any of the
4 `$regex`/`RegExp` clauses in `buildProductQuery` — verified against 6 realistic inputs (including
the exact "Mango (Mangifera indica" case) via a standalone Node script, all now compile cleanly, and
confirmed the escaping preserves literal-match semantics correctly (searching "C.O.D" now matches
literal "C.O.D" text specifically, not "C" + any-char + "O" + any-char + "D", a nice correctness
side-effect). This fix lives in a function shared by `/api/products`'s main listing route — so it
also protects the customer-facing storefront search from the exact same crash, not just this
combobox. Checked `tests/unit/utils.test.js` for existing coverage first (none for the search path
specifically, so no conflict) and added two new test cases per good practice, both manually verified
correct via Node since no test runner is installed in this sandbox (no node_modules/network) —
flagging honestly that I could not execute the actual test suite, only reason about it directly.

While fixing, also hardened `ProductNameCombobox.jsx` itself (defensive, not proven root causes, but
correctness improvements regardless): `handleFocus` now ALWAYS re-searches instead of reusing
possibly-stale cached `results` (removes any chance of a one-time failure leaving the dropdown stuck
empty on later foceus); added a request-sequence guard (`requestSeqRef`) so an older/slower response
can never overwrite a newer one's results if two searches happen to resolve out of order (a real,
if secondary, correctness gap — matters more now that focus always re-fires); bumped the
"browse all" case's limit from 8 to 15 since it's showing the whole catalog rather than a narrowed
search. All verified tsc-clean.

ALL 3 ROUNDS COMPLETE. Re-zipping and delivering as v10 next.
