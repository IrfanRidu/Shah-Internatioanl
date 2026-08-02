# AGENT PROGRESS TRACKER — Shah International — Batch 5 (Export Dashboard Settings System)
> READ THIS FILE FIRST on every resume/continue. Working copy: /home/claude/work/site (contains
> batches 1-4 already complete — AGENT_PROGRESS.md through AGENT_PROGRESS_4.md — do not re-touch
> those areas unless directly relevant to one of THIS batch's requirements).
> Final deliverable: zip of /home/claude/work/site (minus node_modules/.next/.git) →
> /mnt/user-data/outputs/shah-international-v6.zip
> ENVIRONMENT: identical to every prior batch — no node_modules, no network, no git. Verify with
> `python3 /home/claude/verify.py <file>` for .jsx (dependency-free bracket + JSX-tag balance
> checker, built in batch 4) and `node --input-type=module --check < file` for plain .js. Re-view
> every file immediately after editing it — mandatory habit, caught real bugs every batch so far.

## THE 11 REQUIREMENTS (user's own numbering, this batch — verbatim source is the uploaded doc)
1. New "Settings" tab in the export dashboard.
2. Within it, a CTN Configuration section: admin adds CTN size (kg), CTN weight (grams), CTN cost
   (currency = admin dashboard's current/default currency).
3. Rename "Pack Size (KG)" → "CTN Size (KG)" in Packing List, Buyer's Invoice, and BD Invoice line
   items; saved CTN sizes from #2 are suggested while typing this value.
4. Auto-calculate: per packing-list item, Total CTN × (that CTN size's configured weight) = that
   item's total CTN weight. Sum of all items' CTN weight + total quantity (net weight) = Estimated
   Gross Weight, auto-saved on the shipment (in what's becoming the "Shipment Details" tab).
   Estimated Gross Weight initially becomes the actual Gross Weight used across all 3 documents:
   admin can still change Gross Weight anytime from any document (single shared field, already true
   today) — doing so does NOT retroactively change the Estimated figure, and (implied) a manual
   change should stop being silently overwritten by future estimate recalculations.
5. Settings → Shipment Configuration section: admin pre-adds option lists for Mode of Carrying,
   Landing Port, Port of Discharge, Final Destination, Sales Terms, Country of Origin. The Shipment
   Details tab of every shipment lets the admin choose from these pre-added values for those 6
   fields.
6. Settings → Bank Account Configuration section: admin adds banks, each with Beneficiary Bank
   name, Account No, Branch, Bank Address, Routing No, SWIFT Code (all mandatory). In the Shipment
   Details tab, after base currency + export category, admin picks a saved Beneficiary Bank; the
   other 5 fields then auto-fill in the BD Invoice tab (where they already live).
7. Settings → Export License Configuration section: admin adds licenses, each with License Type
   (options = the Export Categories from #8), License Name (mandatory), License No, Activation
   Date, Expiry Date (mandatory), License Letterhead (mandatory), TIN (mandatory), BIN (mandatory).
   In Shipment Details, after currency + category + bank, admin picks a saved license; TIN, BIN,
   and the letterhead used for this shipment's documents then auto-fill from it.
8. Settings → Incentive Configuration section: admin adds Export Categories, each with an image,
   HS Code, incentive %, tax %, "incentive application cost", "others cost" (costs in the admin
   dashboard's current currency). Layout: 2 columns once there are >4 rows, 3 columns once there
   are >8.
9. Every shipment gets exactly 4 tabs, in this order: Shipment Details (renamed from the current
   "Other Details" tab, and now the FIRST/default tab on open) → Packing List → Buyer's Invoice →
   BD Invoice.
10. In Shipment Details, right after base currency, admin picks an Export Category (suggested from
    #8's saved list, offered right after creating a new shipment). That category's incentive %, tax
    %, application cost, and others cost drive this shipment's incentive calculation. Also: a
    buyer's shipment list becomes filterable by category — an "All" view plus one view per category
    that actually has shipments.
11. Shipment cards (in the buyer's shipment list) show their Export Category's image instead of the
    current generic box icon.

## KEY FILES MAP (confirmed via reading, not assumed)
- **Models needing changes**: `models/ExportShipment.js` (add `exportCategory`/`bankAccount`/
  `exportLicense` ObjectId refs, `estimatedGrossWeightKg`, `grossWeightOverridden`; rename
  `ShipmentItemSchema.packSizeKg`→`ctnSizeKg`, add `totalCtnWeightKg` to it). `models/Settings.js`
  (add 6 new `[String]` array fields for #5's option lists — reuses the EXISTING singleton +
  `$set`-based PUT at `app/api/settings/route.js`, confirmed that route already does a safe partial
  `$set` update, so no route change needed there, just new schema fields).
- **New models needed** (none of these exist yet — grepped `models/` fully): `ExportCategory`
  (name, image, hsCode, incentivePercentage, taxPercentage, incentiveApplicationCost, othersCost,
  displayOrder, isActive), `ExportBankAccount` (beneficiaryBank, accountNo, branch, bankAddress,
  routingNo, swiftCode, isActive — all required per #6 "all Mandatory"), `ExportLicense`
  (licenseType: ObjectId ref ExportCategory, licenseName, licenseNo, activationDate, expiryDate,
  letterheadUrl, tinNo, binNo, isActive), `CtnConfig` (ctnSize, ctnWeight, ctnCost, isActive).
  Decision: these 4 are proper referenced collections (not arrays inside Settings) because
  ExportCategory/BankAccount/License are all individually SELECTED and REFERENCED by a specific
  shipment (need stable IDs + auto-fill lookups), unlike #5's 6 fields which are just flat string
  suggestion-lists for existing plain-string ExportShipment fields with no reference/auto-fill
  needed — those 6 fit the Settings singleton's existing pattern directly. CtnConfig doesn't need a
  shipment-side reference either (a packing-list row just stores a CTN size NUMBER), but is grouped
  with the "referenced" models anyway since it needs the same full add/edit/delete CRUD UI as the
  other three, unlike the flat #5 lists.
- **Decision: no ExportAuditLog/ExportRecycleBin wiring for the 4 new models.** Read
  `lib/exportAudit.js` fully — its `labelFor()` is hardcoded to exactly `shipment`/`buyer`/`country`
  and both helpers are used consistently only for those three core transactional entities elsewhere.
  These 4 new models are config/reference data (same tier as Coupons/Categories/FlashSales, none of
  which are audit-logged either) — extending the audit system to them is unrequested scope.
- **Shipment editor** (`app/admin/export-dashboard/countries/[countryId]/buyers/[buyerId]/
  shipments/[shipmentId]/page.jsx`, 714 lines, read in FULL): tabs today are `packing` (default),
  `buyer-invoice`, `bd-invoice`, `other` — `other` has Financial Details/Profit Analysis, Status,
  Notes, Additional Documents. ABOVE all tabs (always visible regardless of active tab): header,
  Base Currency banner + live rate, GLOBAL company letterhead upload (issue 39 from batch 2/3 — a
  Settings singleton field, `exportLetterheadUrl`), and a "Shipment Identifiers" box
  (shipmentNo/contractNo/invoiceNo/date/TIN/BIN/ERC/EXP No/AWB No/PC No). The `packing` tab
  currently ALSO holds Mode of Carrying/Landing Port/Port of Discharge/Final Destination/Sales
  Term/Country of Origin (req #5 wants these moved into the new Shipment Details tab), plus
  Net/Gross weight, Freight Cost, Photos, and the packing ItemsTable. `bd-invoice` tab holds the
  bank fields (Beneficiary Bank/Account No/Branch/Routing No/SWIFT — req #6 auto-fills these,
  staying exactly where they are per the requirement's own wording "in the Bangladeshi Invoice
  section of Bd invoice"). The SAME shared `ItemsTable` function component (with a `showPackSize`
  prop) is reused for all three item tables (packing/buyerItems/bdItems), all three called with
  `showPackSize={true}` — confirmed by reading each call site — so renaming the column header +
  field name ONCE inside `ItemsTable` covers requirement #3 everywhere it's needed in one place.
  `packSizeKg` grepped across the whole repo: exactly 4 files reference it — this editor,
  `app/(print)/print/export/[shipmentId]/page.jsx`, `models/ExportShipment.js`,
  `lib/exportDocuments.js` — all 4 need the rename to `ctnSizeKg`.
- **Buyer's shipment list** (`app/admin/export-dashboard/countries/[countryId]/buyers/[buyerId]/
  page.jsx`, 109 lines, read in full): fetches ALL shipments for a buyer via
  `/api/export/shipments?buyer=${buyerId}` with no category filtering at all (req #10's gap) — each
  card currently shows a generic `<Package>` lucide icon in a colored box (req #11's "current box
  image" to replace with the shipment's category image).
- **Export dashboard main page** (`app/admin/export-dashboard/page.jsx`, 216 lines, read in full):
  top nav is 3 items — "🌍 Countries & Buyers" (in-page tab), "📊 Export Analytics" (Link),
  "🗂️ Export Archives" (Link) — will add a 4th, "⚙️ Settings" (Link), matching the exact same style.
- **API routes read in full**: `app/api/settings/route.js` (GET/PUT, PUT already does a safe
  `$set`-based partial update — confirmed no changes needed there for req #5's new fields),
  `app/api/export/shipments/route.js` (GET list + POST create — POST runs `withComputedFinancials`
  before create, server-side-authoritative for the financial calc fields; will NOT extend this to
  also override `incentive` from the category server-side, since — unlike the batch-4
  isHarvestingSeason case, which had an explicit "no manual override anywhere" requirement — nothing
  here says incentive can't still be manually adjusted after the category auto-fills it, so this
  stays a client-side convenience auto-fill like botanical-name-from-product-selection, matching
  that established pattern instead of the stricter server-enforced one), `app/api/export/shipments/
  [id]/route.js` (GET single + PUT update + DELETE — same `withComputedFinancials` pattern; GET's
  `.populate('buyer', ...).populate('country', ...)` will get 3 more `.populate()` calls added for
  `exportCategory`/`bankAccount`/`exportLicense` so the editor can show full selected-entity details
  from one fetch).

## DESIGN DECISIONS FOR AMBIGUOUS POINTS (recorded so a resumed session doesn't re-litigate these)
- **Incentive formula** (req #10 — the spec says the category's 4 numbers "will be used to
  calculate incentive" but doesn't give the exact formula): going with
  `netIncentive = max(0, receiveAmountBDT × incentivePercentage/100 × (1 − taxPercentage/100) −
  incentiveApplicationCost − othersCost)` — gross incentive as a % of the BDT amount actually
  received, less its own tax, less the two flat costs to claim it, floored at zero. This is the
  standard shape of a real government export-incentive scheme (a % rebate on realized export value,
  itself taxable, with a processing cost to claim) and is the most defensible literal reading of
  "used to calculate incentive" given the 4 fields provided. Computed CLIENT-SIDE as a starting
  value when the category (or order value/exchange rate) changes; admin can still edit
  `form.incentive` afterward same as every other auto-filled-but-editable field in this editor.
- **Letterhead precedence once a license is selected** (req #7 — "letterhead... will be filled
  automatically according to the license"): a shipment's EFFECTIVE letterhead becomes
  `selectedLicense.letterheadUrl` if a license is selected and has one, else falls back to the
  existing global `Settings.exportLetterheadUrl` (issue 39, batch 2/3) exactly as before. Backward
  compatible for every existing shipment/flow that predates licenses entirely — the global upload
  UI stays exactly where it is (untouched) as the fallback path, not removed.
- **Bank Account / License selectors' position relative to the "always visible" boxes**: the
  Base Currency banner and the GLOBAL letterhead upload banner stay exactly where they are (always
  visible above all tabs, since currency affects every tab's number formatting and the global
  letterhead is a site-wide fallback, not shipment-specific) — NOT moved into Shipment Details. The
  "Shipment Identifiers" box (shipmentNo/contractNo/invoiceNo/date/TIN/BIN/ERC/EXP/AWB/PC), however,
  DOES move into the new Shipment Details tab: req #7's own wording ("The TIN and BIN fields of
  Shipment Details tab... will be filled automatically") explicitly treats TIN/BIN as living IN that
  tab, which only makes sense if the whole identifiers box relocates there with them (splitting the
  box in half would be far messier than moving all of it together).
- **Tab id rename**: renaming the internal tab id from `'other'` to `'details'` (label becomes
  "🚢 Shipment Details") for code clarity — purely internal, exactly 3 occurrences in one file
  (tabs array id, the `useState` default, the content-gate `tab === 'other'`), zero external
  references to that string anywhere else in the codebase (confirmed via grep before deciding this
  was safe to rename).
- **CTN weight unit conversion**: req #2's own example enters CTN Weight in GRAMS ("CTN Weight –
  220 gm") while every shipment weight field is in KG — `CtnConfig.ctnWeight` stores grams (matching
  the admin's natural input unit from the spec's own example), converted to kg
  (`ctnWeight / 1000`) only at the point of computing `totalCtnWeightKg` per item.
- **Category filter tabs on the buyer's shipment page** (req #10): "All" plus one tab per category
  that has AT LEAST ONE shipment for this buyer (not one tab per category that exists globally,
  which could be a long, mostly-empty list for a buyer who only ever orders one type of product).

## PLAN (dependency order — models first, since almost everything else references them)
- [x] P1. COMPLETE. Created ExportBankAccount.js, ExportLicense.js, CtnConfig.js (ExportCategory.js
      already existed from before the gap). Extended Settings.js with exportShipmentOptions (6
      arrays). Extended ExportShipment.js: ShipmentItemSchema.packSizeKg→ctnSizeKg +
      totalCtnWeightKg; top-level exportCategory/bankAccount/exportLicense refs, bankAddress,
      estimatedGrossWeightKg, grossWeightOverridden. All 5 files verified + re-read in full.
- [x] P2. COMPLETE. Generated all 8 CRUD route files (list+create, [id] update+delete) for the 4
      new models via a script (mechanical, following the countries route pattern exactly minus
      audit-log/recycle-bin per the earlier decision) — categories, bank-accounts, licenses,
      ctn-configs, all under app/api/export/. licenses' list route also populates licenseType
      (→ExportCategory name). Extended both shipment routes:
      app/api/export/shipments/route.js (list) now populates exportCategory (name+image, for the
      buyer list's cards/filter tabs) and validates estimatedGrossWeightKg as non-negative too;
      app/api/export/shipments/[id]/route.js (single) now populates exportCategory/bankAccount/
      exportLicense in full (editor needs every field of whichever was selected) plus the same
      non-negative addition. All 10 files verified.
- [x] P3. COMPLETE. Built all 5 section components under components/admin/export-settings/
      (CtnConfigSection, ShipmentOptionsSection [tag-list editor for the 6 option arrays, saves the
      whole exportShipmentOptions object at once to avoid the $set nested-replace footgun],
      BankAccountSection, ExportCategorySection [image upload + the exact 1/4/8-threshold
      responsive grid], ExportLicenseSection [License Type dropdown sourced from categories,
      mandatory letterhead/TIN/BIN, expiry-date warning badge]) + the main orchestrating page
      (app/admin/export-dashboard/settings/page.jsx, internal tab nav in the requirements' own
      numbering order, fetches defaultCurrency + category list once and passes down as props) + nav
      link added to the export dashboard main page. All 7 files verified.
- [ ] P4. Shipment editor — BREAKING THIS DOWN INTO SUB-STEPS (714-line file, too large/risky to
      edit in one pass):
      4a. [DONE] Rename packSizeKg→ctnSizeKg throughout this file (ItemsTable's internal logic +
          all 3 call sites, EMPTY() row template) — verified via a Python script with assertion
          checks on old/new text rather than freehand str_replace, given the volume of occurrences.
      4b. [DONE] Added state (ctnConfigs/bankAccounts/exportLicenses/exportCategories/
          shipmentOptions) + fetch calls for all 5 on mount; extended the existing settings fetch
          to also grab exportShipmentOptions; fixed shipment-load to extract plain ids from the
          now-populated exportCategory/bankAccount/exportLicense refs (selects need id values, the
          full populated docs are looked up from the separately-fetched lists instead when needed).
          Added bankAddress/exportCategory/exportLicense/bankAccount/estimatedGrossWeightKg/
          grossWeightOverridden to the form's default state shape.
      4c. [DONE] ItemsTable: CTN Size datalist (shared <datalist>, referenced via each row's
          `list=` attribute — plain HTML, no new dependency), header relabeled, new read-only
          "CTN Wt (kg)" column showing the per-row auto-calc + a "Grand Total" row sum of it.
          totalCtnWeightKg computed in the same updateFields() that already handles the
          ctnSizeKg×totalCTN→quantityKg calc, matched against ctnConfigs by exact ctnSizeKg value.
          All of 4a-4c re-viewed + verified together (one coherent function rewrite).
      4d. [DONE] Added handleCategorySelect/handleBankSelect/handleLicenseSelect handler
          functions (category computes+sets `incentive` once at selection time via the tracker's
          formula, using order value known at that moment — kept as a normal editable field
          afterward rather than adding a second permanently-live auto-sync alongside Gross
          Weight's, since Incentive already feeds into Net Profit as a plain stored number in the
          existing architecture; bank/license auto-fill their respective fields the same
          auto-fill-then-editable way as everything else in this editor) + the 3 banners
          themselves, positioned right after Base Currency in the sequence the requirements
          describe (currency → category → bank → license), before the Letterhead banner (whose own
          text was updated to clarify it's now the fallback once a license is selected).
      4e. [DONE] Relocated the Shipment Identifiers box (shipmentNo/contractNo/dates/TIN/BIN/ERC/
          EXP/AWB/PC) from its old always-visible-above-the-tabs spot into the start of the Shipment
          Details tab's own content, right before the pre-existing Financial Details & Profit
          Analysis block that already lived in that tab — adopting the prior session's reasoning
          (requirement 7's own wording already treats TIN/BIN as living "of" this tab).
      4f. [DONE] Tab id renamed other→details (label "📎 Other Details"→"📋 Shipment Details"),
          moved to the front of the `tabs` array, default `useState` changed to 'details', and the
          one content-rendering conditional (`tab === 'other'`) updated to match. Both re-viewed +
          verified together (one coherent relocation).
      4g. [DONE] 6 logistics fields (Mode of Carrying/Landing Port/Port of Discharge/Final
          Destination/Sales Term/Country of Origin) now each have a `list=` attribute pointing at
          a plain HTML `<datalist>` sourced from `shipmentOptions` — still free-text inputs (a
          one-off value doesn't require adding it to Settings first), just with suggestions.
      4h. [DONE] `liveTotalCtnWeightKg`/`liveEstimatedGrossWeightKg` computed alongside the
          existing liveTotalCTN/liveTotalNetWeightKg. New `useEffect` keeps `totalGrossWeightKg`
          + the persisted `estimatedGrossWeightKg` following the live estimate UNTIL
          `grossWeightOverridden` flips true (set directly in the Gross Weight input's own
          onChange now, alongside the value) — a "Use estimated" one-click reset link appears next
          to that field once overridden. **Caught and fixed a real regression risk**: shipments
          saved before this feature existed all have `grossWeightOverridden` at its schema default
          (false) with a possibly carefully-set `totalGrossWeightKg` already on them — without a
          guard, the very first time such a shipment was opened post-update, this effect would
          have silently replaced that value with a fresh estimate. Fixed in the shipment-load
          logic: any already-present non-empty `totalGrossWeightKg` is now treated as
          intentional/overridden on load regardless of the stored flag. Also added a read-only
          "Estimated Gross Weight" reference display in the Shipment Details tab itself (bankAddress
          field also added to the BD Invoice tab's bank fields grid, a new field with nowhere to
          be edited yet until this point).
      4i. [DONE] Confirmed handleSave's existing `payload = {...form, ...}` spread already carries
          every new field through (exportCategory/bankAccount/exportLicense/bankAddress/
          grossWeightOverridden) since they're now part of form state (4b) — no changes needed
          there. Added one explicit inclusion, `estimatedGrossWeightKg: liveEstimatedGrossWeightKg`,
          matching the SAME defensive "recompute fresh at save time" pattern this function already
          uses for totalCTN/totalNetWeightKg, as a guard against any effect-timing edge case.
      **P4 COMPLETE — every sub-step re-viewed + verify.py'd individually as it landed.**
- [x] P5. COMPLETE. **Caught a real gap while updating this checklist item**: the original P5 plan
      (recovered from the pre-gap session) explicitly included renaming packSizeKg→ctnSizeKg in
      `lib/exportDocuments.js` and the print page too — I'd only done the shipment editor itself in
      4a and nearly marked this done without those two. Fixed both (PDF column header "Pack Size
      (KG)"→"CTN Size (KG)" + the `item.packSizeKg` field reference in exportDocuments.js; the
      print page's own "Pack Size in KG" header + field reference). Final repo-wide grep for
      `packSizeKg` now returns zero real references (one explanatory code comment only) — rename is
      complete everywhere. Also fixed letterhead resolution priority (selected license's own
      letterhead → falls back to the global company one) in all THREE places a shipment's documents
      get generated: the editor's own handleDownload (fresh-fetches the shipment right before
      generating, which now comes back with exportLicense populated thanks to P2), the separate
      print route (same fix to its data-loading effect, with an updated comment since the old one
      asserted letterhead "always comes from the GLOBAL company setting now" — no longer true), and
      the archive page's ShipmentFileGroup (discovered this ALSO needed the shipments LIST route to
      populate exportLicense, which P2 hadn't done since P2 predates this specific need — added a
      slim `.populate('exportLicense', 'letterheadUrl')` there; also had to make the archive page
      compute this PER-SHIPMENT rather than once for the whole page, since different shipments
      being archived together can have different licenses selected). All 6 touched files re-viewed
      + verified (exportDocuments.js, print page, shipment editor, shipments list route, archive
      page, ×2 edits already counted in earlier entries for the editor).
- [x] P6. COMPLETE. Rewrote the buyer shipment-list page: category filter tabs (requirement 10 —
      "All" plus one tab per category actually present among THIS buyer's shipments, computed via
      useMemo over the already-populated exportCategory field, each tab showing a live count; tabs
      only render at all once there's more than one category in play, since a single-category or
      no-category buyer gets nothing from an All/one-tab toggle) and each shipment card now shows
      its own Export Category image instead of the generic Package icon box (requirement 11,
      falling back to the icon when uncategorized or the category has no image). Also added a
      small category-name badge next to each card's status badge, and a distinct "no shipments in
      this category" empty state separate from the "no shipments at all" one. Verified.
- [x] P7. COMPLETE. Final verification pass across all 28 touched/created files (18 new, 10
      modified) — all .jsx via verify.py, all plain .js via node --check (real parser) — zero
      issues. Targeted grep sanity checks on the shipment editor specifically (the most-edited
      file): zero leftover 'other' tab references, zero leftover packSizeKg/showPackSize, all 5 new
      config state variables used consistently throughout. Updated PROJECT_STATUS.md with a new
      §12 Fix Round section matching the established format, renumbered Setup Reminder to §13.

## LIVE LOG (append-only, most recent last)
- Batch 5 tracker created after thorough investigation (all model reads, full shipment editor read,
  buyer list page, export dashboard main page, Settings/shipments API routes, exportAudit.js, full
  grep of packSizeKg consumers). Starting P1 (models) now.
- **RESUMED after a session gap.** Found this file already fully populated with the investigation
  above from the prior session, plus `models/ExportCategory.js` already created (P1 partially done).
  Re-verified nothing else from P1-P7 exists yet (grepped for the other 3 new models, the new API
  route directories, and the settings admin page — none present). Adopting this file's plan and
  design decisions as-is (independently re-derived a very similar plan while re-reading the same
  source files before discovering this file already existed — the two agree on every major point
  except this file's incentive-formula decision and its call to relocate the Shipment Identifiers
  box into the new Shipment Details tab, both of which are better-reasoned than what a fresh read
  alone had produced, so adopting this file's versions of those two decisions specifically).
  Continuing P1: creating the remaining 3 models (ExportBankAccount, ExportLicense, CtnConfig) and
  extending Settings.js + ExportShipment.js next.

## BATCH 5 COMPLETE — all 11 requirements implemented and verified. Deliverable:
## /mnt/user-data/outputs/shah-international-v6.zip
