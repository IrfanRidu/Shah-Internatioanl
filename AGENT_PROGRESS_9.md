# AGENT PROGRESS TRACKER — Shah International — Batch 9 (Export Contract, Ka Form, Stamp
# Application, Activity Log Readability)
> READ THIS FILE FIRST on every resume/continue, BEFORE reading anything else. Working copy:
> /home/claude/work (NOTE: unlike batch 8's convention of a nested /extracted subfolder, this
> batch's working copy is the top-level /home/claude/work itself — the zip was extracted directly
> there). Contains batches 1-8 already complete (AGENT_PROGRESS.md through AGENT_PROGRESS_8.md +
> PROJECT_STATUS.md §1-16 — do not re-touch those areas unless directly relevant to THIS batch).
> Source zip: /mnt/user-data/uploads/shah-international-v11.zip (this IS batch 8's own output)
> Final deliverable: zip of /home/claude/work (minus node_modules/.next/.git) →
> /mnt/user-data/outputs/shah-international-v12.zip
> ENVIRONMENT: no node_modules, no network (confirmed: curl → "Host not in allowlist"). GLOBAL tsc
> at /home/claude/.npm-global/bin/tsc (v6.0.3) — real syntax/JSX verifier, works without the
> project's own node_modules. Command to run after EVERY edit to a .js/.jsx file:
>   /home/claude/.npm-global/bin/tsc --noEmit --allowJs --checkJs false --jsx preserve --target es2020 --noResolve --skipLibCheck <file>
>   (empty output + exit 0 = clean)
> git initialized at /home/claude/work, baseline commit "baseline: v11 as uploaded" (bba0a18).
> COMMIT after every completed sub-step with a message referencing the requirement number —
> `git log --oneline` and `git diff <sha>` are the ground-truth recovery mechanism if this file and
> memory ever disagree. Trust git over prose. Run `git add -A && git commit -m "..."` liberally.

## THE TASK (verbatim requirements are numbered 18-23 in the source doc, continuing the numbering
## from whatever produced batch 8's R1-R16 — so I keep that same 18-23 numbering here, no renumbering)

**R18**: New "Export Contract" entity living under a Buyer (route becomes country→buyer→**Export
Contract**→shipments, was country→buyer→shipments). Creating one asks for: Export Contract No,
Date, Export Category, Value, Base Currency (shipments under the contract default to this currency
until individually overridden — same "auto-fill, stays editable" pattern used everywhere else in
this app). The existing "bulk-select shipments for incentive" flow's constraint changes from *same
Export Category + same Export License* to **same EXPORT CONTRACT NO + same Export License** (max
10, unchanged). Shipments belonging to one Export Contract No display grouped together. Selecting
shipments activates "Proceed for Incentive Documentation", which moves them from "Available for
Incentive Application" to "Incentive Documentations" (this move mechanism already exists from batch
8/R11-R12 — only the grouping RULE changes).

**R19**: The Incentive Details tab gets the full Bangladesh Bank "Ka Form" field set, mixing
auto-fetched and admin-editable data:
- **Section A** (Applicant): Name & Address ← Export License; ERC No ← Export License.
- **Section B** (Contract): L/C/Contract No, Date, Value ← the new Export Contract (R18).
- **Section C** (TT): TT No/Date/Value ← every selected shipment's TT Configuration entries.
- **Section D** (Source of goods): Supplier Name/Address (admin-editable, has a default); Goods
  Name (default = Export Category name, editable) & Quantity (default = Σ gross weight, editable);
  Value = Σ(order value + freight) across selected shipments (computed, not editable).
- **Section E** (per-shipment schedule — one row per selected shipment): Description = category
  name; Quantity = that shipment's gross weight; Date of Shipment; Invoice Value = order value +
  freight; EXP No & Date; Repatriated Export Value (FC) = Invoice Value, Date of Repatriation = that
  shipment's (latest) TT date.
- **Section F** (incentive math): AWB/BL No + Freight (FC) per shipment; Commission/Insurance (FC)
  — admin-editable, default "N/A"/0; Net FOB Export Value (FC) = ΣInvoice − (ΣFreight +
  Commission); Incentive Receivable = Net FOB × Export Category's incentivePercentage; Payable
  Incentive Amount (BDT) = Incentive Receivable (FC) × the resolved BDT rate (batch 8's existing
  live/manual rate mechanism on the application — R15 — is exactly this rate, now actually wired
  into a real calculation instead of standing alone).

**R20**: "Incentive after costing" = Incentive Receivable(BDT) − (Tax-on-Incentive-Receivable +
Incentive Application Cost + Others Cost) — the latter 3 all from Export Category settings
(incentivePercentage/taxPercentage/incentiveApplicationCost/othersCost — ALL FOUR fields already
exist on ExportCategory, confirmed by reading; this is clearly what they were added for). App
Cost + Others Cost count ONCE per application, not per shipment. The after-costing total divides
EQUALLY across member shipments; each shipment's share auto-appears in that shipment's TT
Configuration "Incentive" field and is what Export Analytics sums as incentive (analytics already
sums `shipment.incentive` — confirmed by reading — so correctly populating that field is sufficient,
no analytics-route change needed).

**R21**: Ka Form tab: English + Other-Language (Bengali default) sub-tabs, rendering the actual
form. Single A3 page. Downloadable/printable as DOCX/XLSX/PDF from both language tabs. Edit option
(alongside download/print) so admin can fix hardcoded boilerplate text before generating.
**UPDATE (post-initial-roadmap): the 3 reference PDFs were provided in the very next message** —
`Form_KA_Incentive_Application_English.pdf`, `Stamp_Application_English.pdf`,
`Stamp_Application_Bangla.pdf`. Fully extracted (pdftotext -layout, cross-checked against a
rasterized visual read of every page) into **KA_FORM_AND_STAMP_REFERENCE.md** — READ THAT FILE
before touching lib/kaFormDocuments.js, it is now the primary source of truth for exact field
layout/wording, superseding my own first-pass reading of the prose spec wherever the two disagree
(one real correction found: Section D's "Value" is the Net FOB total, not "order value + freight"
— see that file's own formula-confirmation section). Headline findings: the real form has **8
sections (A-H)**, not the 6 (A-F) the prose spec described — (G) Declaration and (H) Bank-filled
Payable Amount were both missing from R19's own text entirely. Both now fully speced (exact
wording extracted) in the reference file.

**R22**: Others tab gains a "Stamp Application" section: English + Other-Language (Bengali) tabs,
download/print as DOCX/PDF/XLSX, same Edit-hardcoded-text option. **UPDATE: full 3-page text in
BOTH languages now extracted** (KA_FORM_AND_STAMP_REFERENCE.md) — the original prose spec only had
paragraph 1 of what turns out to be 5 paragraphs across 3 pages; the Bengali version is REAL clean
extracted text from an embedded Unicode font (not the garbled text that first appeared pasted into
chat, which I now know was a bad OCR/extraction pass done before it reached me — using the
pdftotext-extracted version instead, which needed zero translation work from me since it's the
authentic original). Placeholders: Bank Name/Branch/Address ← Bank Account settings (first member
shipment's bank fields — same "first selected shipment" precedent batch 8 already established for
referenceCurrency); Owner Name/License Name ← Export License; Export Category name; Contract
No/Date ← Export Contract; repatriated value ← same Net-FOB-family total used on the Ka Form; EXP
No sequence + shipment dates ← member shipments, exact formatting rule confirmed against the real
sample (first EXP gets -year, middle ones bare, last gets -year, "and" before the last item).

**R23**: Activity Log's "View details" currently dumps raw `JSON.stringify(before/after)` — genuinely
illegible (confirmed by reading the current page). Replace with a real field-by-field diff: human
labels (not camelCase keys), formatted values (dates, currency, booleans, nested arrays summarized
sensibly), only changed fields shown for updates, full field list for create/delete.

## GROUND TRUTH FROM PHASE A READING (confirmed by reading actual files, not assumed)
- `ExportCategory` already has `incentivePercentage`, `taxPercentage`, `incentiveApplicationCost`,
  `othersCost` (all 4, from batch "Jul 28" round) — R20's entire formula maps onto these directly,
  zero new category fields needed.
- `ExportLicense` already has `licenseName`, `address`, `ownerName`, `ercNumber`, `phone`, `email`
  (batch 8 R4) — R19 Section A / R22's Owner Name map onto these directly.
- `IncentiveApplication` currently: `exportCategory`, `exportLicense`, `shipments[]`,
  `referenceCurrency`, `status`, `manualRateBDT`, `lockedRateBDT`, `kaForm:{notes,files}`,
  `others:{notes,files}` — batch 8's own R14 was implemented as a generic notes+uploads stub
  (explicitly flagged in AGENT_PROGRESS_8.md KEY DESIGN DECISIONS #6 as "no field spec was given,
  most defensible generic interpretation... flagged for the user to refine" — R19/21/22 IS that
  refinement arriving now). This model needs real expansion (see PHASE B below).
- `ExportShipment.ttEntries[]` ({ttNumber,ttDate,ttValue}), `.awbNo`, `.expNo`/`.expDate`,
  `.freightCost` (shipment's own base currency, NOT BDT despite a stale model comment — confirmed
  from `calculateShipmentFinancials`: `freightCostBDT = freightCost * exchangeRateBDT`),
  `.orderValueForeign` (now always == items total per batch 8 R8), `.incentive` (BDT, currently a
  free-editable field, fed straight into netProfit) — all of R19 Section C/E/F's per-shipment data
  sources already exist, nothing new needed on ExportShipment except the new `exportContract` ref.
- `lib/incentiveUtils.js` (pure, client+server safe): `resolveEffectiveRateBDT`,
  `isRateOverrideActive`, `isShipmentLockedByIncentive`, `canGroupForIncentive` (THE function R18
  changes — currently checks category+license only), `MAX_SHIPMENTS_PER_INCENTIVE_APPLICATION=10`.
- `lib/incentiveServer.js`: `cascadeRecomputeShipments(shipmentDocs, application, session,
  statusOverride?)` — per-shipment recompute+persist+audit-log, called from application
  create/rate-change/claim/unclaim. Currently passes `incentive: beforeSnapshot.incentive` straight
  through unchanged — THE hook point for R20's distribution (see KEY DESIGN DECISIONS #3 below).
- `lib/exportDocuments.js` (602 lines) — the exact pattern to mirror for R21/22's generators:
  client-side (Blob download, `docx`/`xlsx`/`jsPDF` packages, already project dependencies, no
  server round-trip), `DEFAULT_DOCUMENT_TEXT` + `resolveDocumentText(key, shipment, ...)` override
  pattern (default string, admin override wins if set) — I'm building `DEFAULT_KA_FORM_TEXT` /
  `DEFAULT_STAMP_TEXT` + `resolveKaFormText`/`resolveStampText` the same way, keyed by language.
  PDF is A4 via `new jsPDF({unit:'mm', format:'a4'})` — Ka Form needs `format:'a3'` (297×420mm)
  instead, everything else about the drawing approach (autoTable, drawInfoGrid-style boxes) carries
  over.
- Incentives list page (`incentives/page.jsx`) — 3 tabs (available/documentation/claimed), R11's
  bulk-select+constraint logic lives client-side in `isSelectable`/`toggleSelect`
  (mirrors `canGroupForIncentive`, needs the same R18 update, kept in sync manually since this
  particular check is duplicated client+server — same as batch 8 did it).
  Incentive detail page (`incentives/[applicationId]/page.jsx`) — 3 tabs (details/kaform/others),
  `DocSection` component is the current generic notes+files stub for BOTH Ka Form and Others; I'm
  keeping that component for the (still-wanted) free-form notes/files part but adding real
  structured sections above/alongside it.
- Buyer page (`buyers/[buyerId]/page.jsx`, 174 lines) — currently lists shipments directly with a
  category-filter-tabs + "New Shipment" button. Becoming the Export Contracts list per R18's route
  change (see KEY DESIGN DECISIONS #1).
- Shipment editor (1562 lines) — banner-card grid at ~1041-1101 (Base Currency/Category/Bank/
  License, R1's compact-card design from batch 8), free-text "Contract No" Input inside "Shipment
  Identifiers" at ~1261, Financial Details ~1360, TT Configuration ~1410-1453 (has the "Incentive
  (BDT)" input that R20 needs to make derived/read-only once part of an application, exactly
  mirroring how "Rate in BDT" already becomes derived when `rateOverrideActive`). `groupingLocked`
  (~979) currently gates Currency/Category/License while part of ANY (pending or claimed)
  application — extending to also gate the new Export Contract field.
- Shipments API (`shipments/route.js` + `[id]/route.js`) — `OBJECT_ID_FIELDS` sanitization list,
  `availableForIncentive=1` query filter (currently requires category+license non-null — R18 changes
  this to contract+license), the PUT route's pending-application field-lock check (~95-102, currently
  category/license/currency — extending to include exportContract).
- `ExportAuditLog`/`ExportRecycleBin` models: `entityType` enum currently `['shipment','buyer',
  'country']` — adding `'exportContract'` to both (contracts sit at the same hierarchical tier as
  buyers/countries, unlike the deliberately-unlogged config entities per batch 8 KEY DESIGN DECISION
  #8 — ExportCategory/License/BankAccount/CtnConfig/IncentiveApplication itself). Recycle-bin
  restore route has a `MODELS = {shipment,buyer,country}` map needing the same addition.
  Audit-log page (148 lines) — `JSON.stringify(log.before/after, null, 1)` inside a `<pre>` is
  literally R23's complaint; the underlying data (full before/after snapshots) is already correct
  and complete, this is purely a display-layer fix.
- Analytics route (`api/export/analytics/route.js`) — confirmed line 119 `acc.incentive +=
  r.incentive`, already sums per-shipment `incentive` field — R20's "counted in export analytics"
  falls out automatically once `shipment.incentive` is populated correctly, no analytics changes
  needed.
- `Settings.exportIncentiveApplicationCounter` exists for auto-numbering application titles — Export
  Contract numbers are admin-typed (R18 says "admin will ask to add EXPORT CONTRACT NO"), not
  auto-numbered, so no new counter needed.
- UI primitives confirmed reusable as-is (same as batch 8 found): `Button`, `Modal`, `Input`,
  `Badge`, `Loader` (components/ui/*.jsx).

## KEY DESIGN DECISIONS (writing these down BEFORE coding, same discipline batch 8 used)

1. **R18's route change — nav restructuring, NOT a physical URL/folder move.** The literal
   "country→buyer→contract→shipments" is implemented as a CLICK-PATH: buyer page now lists Export
   Contracts (replaces its current shipment list); clicking a contract opens a NEW page
   (`buyers/[buyerId]/contracts/[contractId]/page.jsx`) that shows that contract's shipments (this
   reuses ~90% of the current buyer-page shipment-list JSX, adapted). The shipment editor itself
   STAYS at its existing physical path (`buyers/[buyerId]/shipments/[shipmentId]`) rather than moving
   under `contracts/[contractId]/` — moving a 1562-line file and hunting down every internal link
   across the app (incentive ShipmentMiniCard, archive page, etc.) for a purely cosmetic URL-string
   win is a real risk for zero functional benefit; the admin's actual click-path is what "route"
   means to them day-to-day, and that fully matches country→buyer→contract→shipment regardless of
   what's in the address bar. New-shipment creation from a contract page passes `?contract=<id>` so
   the editor can pre-associate + auto-fill from that contract. Documenting this explicitly in case
   a future me (or the user) expects to find shipments physically nested under contracts/ in the
   file tree — they're not, by deliberate choice, for the reasons above.
2. **Pre-batch-9 shipments with no Export Contract set.** Since every OLD shipment predates this
   entity, the contracts list page also shows an "Shipments without a Contract (N)" card (only when
   N>0) linking to a filtered view (`contracts/none`) so nothing existing silently vanishes from the
   admin's view — they can open any such shipment and assign it a contract via the new selector,
   same as any other field.
3. **Currency consistency added to `canGroupForIncentive` (R18).** The literal rule is "same
   contract + same license"; I'm ALSO requiring same `baseCurrency` across the group. Reasoning: R19
   Section D/F sums raw numbers across every member shipment into single "(FC)" totals with ONE
   currency label — mixing currencies there would silently produce a wrong number with no error
   shown anywhere. Since shipments under one contract already default to that contract's currency
   (R18), this constraint is a no-op for the common case and only blocks the genuine edge case where
   an admin individually overrode one member's currency — exactly the kind of "needed to avoid real
   data corruption, not literally asked for" call batch 8 made repeatedly (its own Phase J dangling-
   reference guard is the precedent). Flagged here for visibility, same as batch 8's own §4 note
   about the currency question it deliberately left unaddressed — this batch is now resolving that
   exact flagged gap.
4. **Incentive-after-costing (R20) formula, reconciling the source doc's own slightly-inconsistent
   column-numbering prose** (I read it multiple times — "Incentive Receivable (4)x10/100" vs.
   "Payable...3x10/100...Net FOB Export Value(FC)(Column 3)*Rate=Answer in BDT" don't perfectly
   agree on which column is which number, almost certainly because the prose is paraphrasing a
   PDF table I can't see). Resolved as: `netFobFC = ΣinvoiceValueFC − (ΣfreightFC +
   commissionInsuranceFC)`; `incentiveReceivableFC = netFobFC × category.incentivePercentage/100`;
   `payableIncentiveBDT = incentiveReceivableFC × effectiveRateBDT`. This is internally consistent,
   matches ordinary real-world cash-incentive math (confirmed via web search — incentive is a % of
   net FOB, converted to BDT at the realization rate), and directly reuses the category's own
   existing `incentivePercentage`. R20 then layers on top of `payableIncentiveBDT`:
   `afterCostingBDT = payableIncentiveBDT − (payableIncentiveBDT × taxPercentage/100 +
   incentiveApplicationCost + othersCost)`, `perShipmentShareBDT = max(0, afterCostingBDT) /
   shipmentCount`. All of this lives in one new pure function, `calculateIncentiveCosting()` in
   lib/incentiveUtils.js, shared by the live client preview AND the server-side cascade (exact same
   "one shared formula" discipline `calculateShipmentFinancials` already established for the rest of
   this app).
5. **R20's distribution is PERSISTED, not just resolved-on-read**, extending
   `cascadeRecomputeShipments` (which already recomputes+persists derived fields whenever group
   context changes) to compute the group's `perShipmentShareBDT` ONCE at the top (needs every member
   shipment together) and feed that in as the `incentive` value for each shipment's own
   `calculateShipmentFinancials` call, replacing the old `beforeSnapshot.incentive` passthrough —
   this one change point is inherited by every existing call site (application create, rate/
   commission change, claim, unclaim) automatically. NEW trigger added: the shipments PUT route now
   ALSO re-runs this cascade (for the whole sibling group, not just itself) when the saved shipment
   belongs to a still-pending application — otherwise editing one member's freight cost after the
   application already has a computed distribution would silently go stale. Verified this can't
   recurse (the cascade does direct `findByIdAndUpdate` calls, not nested HTTP/API calls).
6. **TT Configuration's "Incentive (BDT)" field** becomes derived/read-only (same visual/UX
   treatment as "Rate in BDT" already gets from `rateOverrideActive`) the moment a shipment belongs
   to ANY incentive application with a computed distribution — a new `isIncentiveOverrideActive`
   alongside the existing `isRateOverrideActive` in lib/incentiveUtils.js.
7. **Ka Form / Stamp Application editable text model.** Ka Form is fundamentally a grid of computed
   values with a SMALL set of fixed boilerplate/label strings around them (title, section headers,
   the 4 italic submission-requirement notes under C/D/E/F, Section G's declaration paragraph) —
   modeled as `kaForm.textOverrides.{en,bn}[key]`, defaulting to a new `DEFAULT_KA_FORM_TEXT[lang]
   [key]` map (now fully populated with the REAL extracted wording for every one of these — see
   KA_FORM_AND_STAMP_REFERENCE.md — nothing here is invented boilerplate anymore), exactly mirroring
   `DEFAULT_DOCUMENT_TEXT`/`resolveDocumentText`'s existing default-then-override shape. Stamp
   Application is flowing paragraphs (full 5-paragraph, 3-page text now extracted verbatim for BOTH
   languages — see reference file) — modeled as a single overridable string per language,
   `stampApplication.textOverride.{en,bn}`: absent → auto-assembled fresh from current data every
   time (so it never goes stale as shipments/rates change); admin clicks Edit, sees the CURRENT
   auto-assembled text pre-filled in a textarea, saves → that exact text is frozen as the override
   from then on (same "override wins verbatim once set" contract as R5's existing document-text-
   override feature).
   UPDATED — no translation work needed from me after all: the Bengali Stamp Application text is
   REAL extracted text (clean embedded font) from the reference PDF, used directly with placeholder
   substitution, not my own translation. Ka Form has no Bengali sample, so ITS Bengali section
   labels/notes/declaration ARE my own professional-register translation — flagged here, correctable
   via Edit same as everything else. Bengali digit convention (০-৯) applies to every numeral shown
   on a bn-language render of EITHER document — simple char-substitution map, applied at final
   string-assembly time only (never touches the underlying stored numbers).
   Section G's declaration text and Section H's bank-fill block are now REAL extracted wording (see
   reference file) — not invented boilerplate as originally planned before the PDFs arrived.
8. **Export Contract is audit-logged** (create/update/delete → ExportAuditLog + ExportRecycleBin),
   same tier as buyer/country, per Ground Truth note above. IncentiveApplication itself stays
   deliberately unlogged, consistent with batch 8's own explicit call on that (KEY DESIGN DECISION
   #8 there) — R19-22 don't ask for that to change, only for the Ka Form/Stamp Application CONTENT
   to exist, which is a details-tab feature, not a new logged-entity requirement.
9. **contractNo stays on ExportShipment as a free string** (not removed), auto-filled from the
   selected Export Contract at selection time and independently editable after — identical pattern
   to how picking a Bank Account auto-fills 5 snapshot fields that then stay editable. This means
   ZERO changes needed to exportDocuments.js/the print route (both already just read
   `shipment.contractNo` for the Packing List/Invoice header) — R18 is additive there, not breaking.

## ROADMAP (phases, dependency order)
- [x] PHASE A — Deep-read current actual code + one round of web research to ground the Ka Form's
      real-world context. DONE (see Ground Truth + Key Design Decisions above).
- [x] PHASE B — Models: new `ExportContract.js`; `ExportShipment.exportContract` ref;
      `IncentiveApplication` expansion (exportContract ref, kaForm/others new sub-fields per Key
      Design Decision #7); `ExportAuditLog`/`ExportRecycleBin` entityType enum +'exportContract'.
      DONE, tsc-clean on all 5 files. NOT yet wired into recycle-bin restore route's MODELS map
      (that's a 1-line addition, doing it at the start of Phase C alongside the contracts API).
- [x] PHASE C — Export Contract CRUD API (`api/export/contracts/route.js` + `[id]/route.js`,
      audit-logged + recycle-bin per Decision #8, following the buyers/route.js CRUD template).
      DONE. No dependent-shipment block on DELETE — verified country/buyer DELETE routes have no
      equivalent cascade guard either, so this stays consistent with that existing (unguarded)
      pattern rather than introducing new asymmetric behavior; a shipment left pointing at a
      deleted contract must render gracefully wherever displayed (Phase E/I code needs to handle
      populated exportContract being null). recycle-bin `[id]/route.js` MODELS map updated. NOTE
      for Phase L: audit-log page's entity-type filter dropdown (line ~75-80) needs an
      `<option value="exportContract">Export Contracts</option>` added alongside the existing
      shipment/buyer/country options.
- [x] PHASE D — Buyer page becomes Export Contracts list; new `contracts/[contractId]/page.jsx`
      (shipments-under-a-contract, adapted from the current buyer page's shipment list) +
      `contracts/none` fallback view for legacy unassigned shipments (Decision #2). DONE. Buyer
      page now has its own "New Export Contract" modal (contractNo/date/category/value/
      baseCurrency/notes), mirroring the country page's existing "Add Company" modal pattern
      exactly. contracts/[contractId]/page.jsx handles BOTH a real contract AND contractId==='none'
      (the legacy-shipments fallback) in one component — no separate route needed, ~95% shared
      logic. Also did the minimum slice of Phase F needed for this to function: shipments GET route
      now accepts `contract=<id>` and `contract=none`, added exportContract to OBJECT_ID_FIELDS and
      the populate chain. Rest of Phase F (availableForIncentive query switch, pending-lock check,
      cascade trigger) still pending. Both new/changed page files tsc-clean.
- [x] PHASE E — Shipment editor: 5th banner card (Export Contract selector, auto-fills contractNo/
      baseCurrency/exportCategory, R1-style compact card), groupingLocked extended, back-nav to the
      contract page, `?contract=` query param pre-association for new shipments. DONE. Used plain
      `URLSearchParams(window.location.search)` for the `?contract=` param, NOT next/navigation's
      useSearchParams — matches an explicit precedent/comment already in settings/page.jsx
      deliberately avoiding that hook to sidestep a Suspense-boundary requirement. Banner grid is
      now `grid-cols-2 lg:grid-cols-3 xl:grid-cols-5` (was `grid-cols-2 lg:grid-cols-4` for 4
      cards) — Export Contract card leads the row. tsc-clean on the full 1617-line file after all
      edits landed together (state, handler, 2 effects, banner card, back-nav).
- [x] PHASE G — `lib/incentiveUtils.js`: `canGroupForIncentive` → contract+license+currency
      (Decision #3, done); new `calculateIncentiveCosting()` (Decision #4, done — formulas verified
      against the real Ka Form PDF's own numbers, not just the prose spec, see comments in the
      function itself); new `isIncentiveOverrideActive()` (Decision #6, done). tsc-clean.
      Incentives list page DONE too: isSelectable/toggleSelect now check exportContract+license+
      currency (was category+license); AvailableTab groups shipments into one section per contract
      with a "Contract: X · N shipments" header, group order following each group's earliest
      shipment (list already arrives oldest→newest from the API, so no extra sort needed); Applica-
      tionCardGrid's subtitle line now leads with the contract no. Phase G fully complete.
- [x] PHASE F — pending-application field-lock check uses exportContract (done earlier). Post-save
      cascade trigger DONE: shipments/[id]/route.js PUT now calls the new
      `recalculateGroupIfPending` after every save, which re-runs cascadeRecomputeShipments for the
      whole sibling group whenever the saved shipment belongs to a still-pending application. Found
      and fixed a real bug while wiring this in: naively cascading would have produced a redundant
      near-duplicate audit-log entry for the shipment that was JUST saved+logged by the same PUT
      request (recordAuditLog never deduplicates — confirmed by reading it). Fixed with a
      `skipLogForId` option threaded through cascadeRecomputeShipments — the just-saved shipment's
      derived fields (specifically `incentive`) still get silently corrected by the cascade, just
      without a second log line for it; every OTHER sibling still logs normally, since for them
      it's a genuinely new, first-time-logged change. Also fixed lib/exportAudit.js's `labelFor`,
      which had no case for 'exportContract' (fell through to a raw ID) — now shows contractNo.
- [x] PHASE H — `lib/incentiveServer.js`: `cascadeRecomputeShipments` now computes the group's R20
      distribution ONCE up front (via calculateIncentiveCosting, self-fetching the Export Category
      if not already populated on `application`) and feeds each member's equal share in as its
      `incentive` — every existing call site (create/PUT rate-or-commission-change/claim/unclaim)
      gets this for free. New `recalculateGroupIfPending` covers the one remaining gap (a member
      shipment's own data changing via the plain shipments PUT route) — wired in as part of Phase F
      above. Verified ALL FOUR existing call sites (incentive-applications POST — added the
      exportContract field + an initial cascade call that didn't exist before, since applications
      were never cascaded on creation; PUT — broadened the trigger condition from
      manualRateBDT-only to also fire on any kaForm change, since commissionInsuranceValue lives
      inside it; claim/route.js and unclaim/route.js — both needed NO changes, already compatible
      since `application.exportCategory` being an unpopulated ObjectId is handled correctly by the
      new self-fetch fallback). Every touched file tsc-clean.
- [x] PHASE I — Incentive Details tab UI: full Section A-F display (fetched + editable pieces per
      R19), Incentive-after-costing summary block (R20, clearly separated from the government-form
      Section F per Decision #4's own note on scope). DONE. API route's populate chain broadened
      substantially (full exportLicense/exportContract, exportCategory's rate fields, each
      shipment's bankAccount for R22 later). Live client-side preview uses the EXACT same
      `calculateIncentiveCosting`/`resolveEffectiveRateBDT` the server uses (imported, never
      reimplemented) so the number shown always matches what gets persisted. Editable Section D/F
      fields (supplierNameAddress, goodsNameOverride, goodsQuantityOverrideKg,
      commissionInsuranceValue/Label) save on blur via a new `saveKaFormField` merge-and-PUT
      helper, mirroring the existing notes-textarea pattern. Money formatting deliberately uses
      plain `.toLocaleString()` here (matches the rest of the admin UI) — the real Ka Form's own
      South-Asian/lakh-style grouping is reserved for the actual document tab/output in Phase J, a
      documented intentional distinction, not an inconsistency. tsc-clean.
- [x] PHASE J+K (generation engine) — `lib/kaFormDocuments.js` (new file, ~520 lines) mirrors
      exportDocuments.js's architecture exactly: DEFAULT_KA_FORM_TEXT + resolveKaFormText (default-
      then-override, every key real extracted text from the reference PDF — see
      KA_FORM_AND_STAMP_REFERENCE.md — none invented, Bengali is my own translation, flagged as
      such in the file's own comments); DEFAULT_STAMP_TEXT (both languages VERBATIM from the
      reference PDFs — English quoted directly, Bengali via a real pdftotext extraction of an
      embedded-font PDF, not a translation) + assembleStampApplicationText (token substitution,
      confirmed EXP/date sequence formatting against the real sample) + resolveStampApplicationText
      (override-wins-once-set, same contract as R5's existing feature); assembleKaFormData (one
      shared data-assembly feeding all 3 formats, "assemble once render 3 ways" — same discipline
      exportDocuments.js's assembleDocData established); generateKaFormPDF (A3, autoTable per
      section, Sections A-H all present including G/H which weren't in the original prose spec at
      all); generateKaFormDOCX/XLSX; generateStampApplicationPDF (A4, multi-page, reserves
      letterhead space matching the real reference PDF's own layout)/DOCX/XLSX. Bengali digit
      conversion (toBengaliDigits) and South-Asian lakh-style money grouping both implemented and
      applied only at final render time, never touching stored numbers. tsc-clean.
      REMAINING (the rest of Phase J/K): the actual Ka Form tab UI (language sub-tabs, preview,
      download-format-selector/print/edit buttons) and the Others-tab Stamp Application section —
      this file only built the engine, not yet wired into the incentive detail page's UI.
- [x] PHASE J+K (UI) — DONE. `KaFormPanel`/`StampApplicationPanel` (new components in the incentive
      detail page): language sub-tabs, a LIVE PREVIEW that's the actual generated PDF embedded via
      an iframe+blob URL (`doc.output('bloburl')`) — deliberately the same object Download/Print
      use, not a second parallel HTML re-implementation of the layout, so the preview can never
      drift from the real output. Print opens that same blob URL in a new tab (the browser's native
      PDF viewer handles printing from there) rather than building a whole second server-rendered
      print-preview route — a deliberate scope simplification given jsPDF already produces a
      complete, correct document; building a parallel print route would only be pixel-matching
      something that already exists. Download offers PDF/DOCX/XLSX exactly like the shipment
      editor's own DocActionBar. Edit Text: Ka Form opens a modal with every DEFAULT_KA_FORM_TEXT
      key as its own field (declaration/notes as textareas, everything else as single-line inputs);
      Stamp Application opens ONE big textarea pre-filled with the current auto-assembled text plus
      a "Reset to Auto-filled" button — matches each document's own actual shape (many small labels
      vs. one flowing paragraph). Both save via a merge-and-PUT into kaForm.textOverrides.{lang} /
      others.stampApplication.textOverride.{lang}. Old generic "Ka Form"/"Others" DocSection
      (notes+files) kept, relabeled "Notes & Uploads", now sitting below the new panels rather than
      being the whole tab. Skipped wiring an actual letterhead image into the Stamp Application PDF
      (a deliberate scope call — the reference PDF's own blank top margin could just as easily mean
      a physical pre-printed letterhead the bank/admin already has on paper, and chasing down this
      app's existing letterhead-to-dataURL conversion pipeline for a feature nobody asked for
      explicitly wasn't a good time trade — the blank margin renders correctly either way).
      tsc-clean on the full page after all changes landed together.
- [x] PHASE L — `lib/auditDiff.js` (new): field-label map (comprehensive, covering ExportShipment/
      Buyer/Country/Contract/License fields) + value formatter (dates, booleans, currency numbers,
      arrays summarized sensibly — items/ttEntries/files get meaningful counts+summaries rather than
      a dump, populated refs show their name/shipmentNo/contractNo rather than a raw {_id} object) +
      `buildFieldDiff()` (create/delete show every meaningful field the document had; update/restore
      show ONLY fields that actually changed, via a JSON-stringify deep-equal check per field). Audit
      log page: replaced the `JSON.stringify(log.before, null, 1)` `<pre>` dump with a real
      `FieldDiffTable` component (Field / Before / After columns for updates, single Value column
      for create/delete) — purely presentational, all the actual logic lives in lib/auditDiff.js.
      Also added the missing `exportContract` option to the entity-type filter dropdown (noted back
      in Phase C). tsc-clean on both files.
- [x] PHASE M — Verification sweep: tsc every changed file (already doing this per-file, this is
      the final full re-pass), populate()-import sweep (the recurring bug class from batch 8 Phase
      J) across every touched API route, full read-through of every new/changed file.
      DONE. Full tsc sweep across all 23 changed/new code files (excluding the 2 tracking .md
      files) — every one clean, run as one batch to be certain nothing regressed from an earlier
      edit touching a later one. populate()-import sweep across all 7 touched API routes — every
      `.populate('field')` call cross-referenced against that file's own model imports, all
      consistent (no repeat of batch 8's own Phase J bug class). Grep sweep for stale "same Export
      Category" language and broken buyer-page links — none found. Verified the shipments POST
      route (creation, not just PUT) needs no special-casing for exportContract — it already flows
      through generically via sanitizeObjectIdFields. Verified app/api/export/analytics/route.js
      and the archive page are both unaffected by this batch (neither has category/contract
      grouping assumptions). Verified recycle-bin GET (list) route is fully generic, needs no
      entityType-specific changes for 'exportContract'. Confirmed a real edge case is left
      unresolved by design, not by oversight: a hypothetical pre-batch-9 IncentiveApplication would
      lack the newly-required `exportContract` field — checked this can't crash anything (every
      read path uses optional chaining / defensive fallbacks; PUT doesn't run schema validators by
      default so existing docs stay editable) even though no migration UI was built for it, which
      would be significant extra scope for an edge case unlikely to exist in a dev/demo database.
      Fresh full re-reads of the 3 most-edited/highest-risk files (incentive-applications POST,
      incentive-applications/[id] PUT, shipments/[id] PUT) confirmed fully coherent end-to-end.
      Found and fixed one minor doc-comment inaccuracy (IncentiveApplication.js referenced a
      function by the wrong name — code review catch, not a functional bug). Zero console.log/
      debugger statements found across all changed files.
- [x] PHASE N — PROJECT_STATUS.md §17 write-up, this file finalized, zip, present.
      PROJECT_STATUS.md §17 written (Setup Reminder renumbered to §18). Proceeding to zip + present.

## KEY FILES (new files marked NEW; existing files this batch touches)
- models/ExportContract.js — NEW
- models/ExportShipment.js, IncentiveApplication.js, ExportAuditLog.js, ExportRecycleBin.js
- app/api/export/contracts/route.js + [id]/route.js — NEW
- app/api/export/recycle-bin/[id]/route.js (MODELS map)
- app/admin/export-dashboard/countries/[countryId]/buyers/[buyerId]/page.jsx (→ contracts list)
- app/admin/export-dashboard/countries/[countryId]/buyers/[buyerId]/contracts/[contractId]/page.jsx — NEW
- app/admin/export-dashboard/countries/[countryId]/buyers/[buyerId]/shipments/[shipmentId]/page.jsx
- app/api/export/shipments/route.js + [id]/route.js
- lib/incentiveUtils.js, lib/incentiveServer.js
- lib/kaFormDocuments.js — NEW
- lib/auditDiff.js — NEW
- app/admin/export-dashboard/incentives/page.jsx, incentives/[applicationId]/page.jsx
- app/admin/export-dashboard/audit-log/page.jsx
- app/api/export/incentive-applications/route.js + [id]/route.js + [id]/claim + [id]/unclaim

## LOG (append-only, newest at bottom)
- Phase A complete, this file created and committed. Starting Phase B next.
- User provided the 3 reference PDFs (Ka Form English, Stamp Application English + Bangla) right
  after this file's first save. Extracted fully (text + visual rasterization) into
  KA_FORM_AND_STAMP_REFERENCE.md — new required reading before Phase J/K. Updated R21/R22 and Key
  Design Decision #7 above accordingly. One real correction to my own earlier reading: Section D's
  "Value" = Net FOB total, not "order value + freight". One real addition: Ka Form Sections G
  (Declaration) + H (Bank-filled Payable Amount) exist and are now fully specced — the original
  prose doc only ever described A-F. Stamp Application's real full 3-page/5-paragraph text (both
  languages, Bengali via clean pdftotext extraction, not translation) replaces the single paragraph
  + "my own translation" plan. No change to the roadmap's phase order or any other model/API
  decision — this only sharpens Phase J/K's content, everything in Phase B-I stands as designed.
  Committing this update now, then proceeding to Phase B (models) for real.
- Phase B done: models/ExportContract.js created; ExportShipment.exportContract ref added;
  IncentiveApplication expanded (exportContract ref, kaForm.{supplierNameAddress,
  goodsNameOverride, goodsQuantityOverrideKg, commissionInsuranceValue/Label, textOverrides.en/bn},
  others.stampApplication.textOverride.en/bn); ExportAuditLog + ExportRecycleBin entityType enums
  += 'exportContract'. All 5 files tsc-clean individually. Committing now, moving to Phase C.
- ALL PHASES (B through N) NOW COMPLETE. Every requirement R18-23 implemented, verified via a full
  tsc sweep + populate-import audit + coherence re-reads (Phase M), PROJECT_STATUS.md §17 written.
  23 code files changed/added across models/API routes/lib/UI, 2 new lib files (kaFormDocuments.js,
  auditDiff.js), 1 new model (ExportContract), 2 new pages (buyer contracts list rewrite + contract
  detail page). 13 commits total this batch, full history in `git log --oneline`. Final step:
  zip (excluding node_modules/.next/.git) → /mnt/user-data/outputs/shah-international-v12.zip and
  present to the user.
