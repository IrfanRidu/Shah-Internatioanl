# AGENT PROGRESS TRACKER — Shah International — Batch 8 (TT Configuration + Incentive workflow)
> READ THIS FILE FIRST on every resume/continue. Working copy: /home/claude/work/extracted
> (contains batches 1-7 already complete, folded into PROJECT_STATUS.md §1-15 — do not re-touch
> those areas unless directly relevant to THIS batch's requirements).
> Source zip: /mnt/user-data/uploads/shah-international-v10.zip
> Final deliverable: zip of /home/claude/work/extracted (minus node_modules/.next/.git) →
> /mnt/user-data/outputs/shah-international-v11.zip
> ENVIRONMENT: no node_modules, no network (curl → 403). GLOBAL tsc at
> /home/claude/.npm-global/bin/tsc (v6.0.3) — real syntax/JSX verifier, works without the
> project's own node_modules. Command to run after EVERY edit:
>   /home/claude/.npm-global/bin/tsc --noEmit --allowJs --checkJs false --jsx preserve --target es2020 --noResolve --skipLibCheck <file>
>   (empty output + exit 0 = clean)
> git is initialized at /home/claude/work/extracted with baseline commit "baseline: v10 as
> uploaded" (68d2d84). COMMIT after every completed sub-step below with a message referencing the
> requirement number — `git log --oneline` and `git diff` are the ground-truth recovery mechanism
> if this file and my memory ever disagree. Trust git over prose.

## THE TASK (new document this round, verbatim requirements below, my own numbering R1-R16)
User's own words: "read the provided file carefully before starting any changes. make a clear
roadmap. keep tracking every command. if messages run out, resume via 'continue' from exactly
where stopped. generate a whole functional website in a zip file after fixing and integrating ALL
features." This file IS that roadmap + resumption anchor.

**R1**: Base Currency / Export Category / Beneficiary Bank / Export License selectors currently
render as 4 full-width stacked banner cards in the shipment editor (~180px each) — compress into
1-2 rows of small cards (responsive grid, compact padding).

**R2**: New shipments start as `draft` (not persisted-and-active immediately). Draft can be saved
repeatedly (stays draft, holds latest data). Deleting a draft is NOT audit-logged / NOT sent to
recycle bin (plain hard delete).

**R3**: The (real) Save action automatically marks a shipment `active`. From that moment on, every
change is logged (audit log). Nothing before activation is logged.

**R4**: Add ERC Number, Address, Owner Name, Phone, Email fields to Export License Configuration
(Settings → License tab) — admin fills these per saved license.

**R5**: Packing List / Buyer's Invoice / BD Invoice downloadable+printable in DOCX, XLSX, PDF (PDF
already exists). Add an "Edit" option next to Download/Print so admin can edit hardcoded text
(declaration paragraph etc.) before generating.

**R6**: New "TT Configuration" section in the Shipment Details tab, positioned after "Financial
Details & Profit Analysis".

**R7**: Move "Rate in BDT (live)" (rename → "Rate in BDT") and "Incentive" fields from Financial
Details into the new TT Configuration section. Admin can add TT entries per shipment: TT Number,
TT Date, TT Value (shipment's base currency).

**R8**: Order Value (in base currency) becomes AUTO = Packing List Total (= Shipment Details items
total). It drives Receive Amount (BDT) auto — initially. Once ≥1 TT entry has a value, the SUM of
TT values overrides Order Value for Receive Amount purposes (in both the shipment editor and the
Export Analytics dashboard), from then on.

**R9**: New "Incentive" tab in the export dashboard (top-level nav, alongside Categories/Countries/
Analytics/Archives/Settings).

**R10**: Inside it, an "Available for Incentive Application" tab lists all eligible shipments
(with company/category shown), oldest → newest.

**R11**: Bulk-select up to 10 shipments — must share the same Export Category AND Export License
(picking the first constrains what else is selectable). "Proceed for Incentive Documentation"
moves selected shipments out of "available" into a new tab: "Incentive Documentations".

**R12**: Each proceed action creates a card "Incentive Application – N" (serial, admin-renamable)
in Incentive Documentations, with 3 buttons: Mark as Incentive Claimed / View / Delete.

**R13**: Marking claimed moves the card to "Claimed Incentive Applications" tab (from there: only
Unclaim + View). All member shipments become fully locked (no edits at all) with their BDT rate
frozen at whatever was live/manual at claim time, get `status = completed`, and automatically
surface in Export Archive (archive already filters `status: 'completed'` — confirmed by reading).

**R14**: Viewing an application shows 3 tabs: Incentive details → Ka Form → Others.

**R15**: Incentive details tab: "Rate in BDT (live)" (live rate for the group's base currency) +
"Input manual rate" (overrides live; once set, it is THE rate for every member shipment,
everywhere that shipment shows a rate — TT Configuration's Rate in BDT, Export Analytics).

**R16**: Below that, the selected shipments render as cards, same info as the buyer's shipment
list, max 5 per row (wraps to a 2nd row; 10 max ÷ 5 = 2 rows).

## GROUND TRUTH FROM PHASE A READING (confirmed by reading actual files, not assumptions)
- `ExportShipment.status` enum already `['draft','active','completed','archived']` but DEFAULTS
  to `'active'` in both the schema and the editor's initial form state — needs to flip to `'draft'`.
- `lib/exportAudit.js`: `recordAuditLog` + `moveToRecycleBin` — called unconditionally today from
  shipments POST/PUT/DELETE routes. Need to gate on status.
- `lib/utils.js`'s `calculateShipmentFinancials({..., orderValueForeign, exchangeRateBDT, ...})` is
  the SINGLE shared formula (`receiveAmountBDT = orderValueForeign * exchangeRateBDT`) used by: the
  shipment editor's live preview, shipments POST/PUT (`withComputedFinancials`), and
  `/api/export/analytics` (recomputed per-row from stored raw fields, NOT trusting stored
  receiveAmountBDT). All 3 call sites need the TT-aware effective value + rate-override resolver.
- Banner cards to compress (R1) are literally 4 back-to-back `<div className="... p-4 mb-5 flex
  flex-wrap items-center gap-4">` blocks around line 857-922 of the shipment editor.
  "Financial Details & Profit Analysis" section (R6/R7/R8 target) is ~line 1181-1192, ends before
  the Status/Notes block — TT Configuration goes right after it, before Status/Notes.
  "Rate in BDT (live)" input is literally `<Input label="Rate in BDT (live)" ... value={form.
  exchangeRateBDT || bdtPerUnit...} .../>` and "Incentive (BDT)" right next to it — both move.
  `Order Value (${form.baseCurrency})` is currently a free `<Input>` — becomes a read-only auto
  display (matching the existing "Net Weight (kg) — auto" pattern already on this page).
- Export License Configuration UI = `components/admin/export-settings/ExportLicenseSection.jsx` +
  `models/ExportLicense.js` + `app/api/export/licenses/*` — plain CRUD (`ExportLicense.create(body)`
  / `findByIdAndUpdate(id, body)`), so any new schema field flows through automatically once added
  to the model + the form's payload object. This is R4's target.
- R5: `lib/exportDocuments.js` (client-side jsPDF generation) + print route
  `app/(print)/print/export/[shipmentId]/page.jsx` are the two renderers that must stay in sync
  (already share `lib/exportColumns.js`'s column registry). `docx` (^8.5.0) and `xlsx` (^0.18.5)
  ARE ALREADY project dependencies — confirmed a full working DOCX+XLSX+PDF-in-one-route example
  already exists at `app/api/admin/customers/export/route.js` (server-side, Buffer response). The
  shipment-document subsystem is architected client-side instead (browser generates + downloads
  directly, see `handleDownload`/`handleDownloadAll` in the editor + archive page) — I will follow
  THAT existing sub-system's own convention (client-side generation via Blob) for consistency,
  using the same `docx`/`xlsx` packages, not spin up a parallel server-route architecture.
  "Hardcoded texts" identified for the Edit feature = the declaration paragraph (3 variants: buyer
  invoice's long BDREX/GSP paragraph, packing-list/BD-invoice's short cert paragraph) + the
  "Proprietor" signature label. Will store overrides in a new `ExportShipment.documentTextOverrides`
  object, defaulting to current hardcoded strings, editable per-shipment via a new modal.
- R9-16: brand-new subsystem, nothing pre-existing to reuse beyond patterns (CRUD sections, Modal,
  Badge, the buyer-shipment-list card style for R16). `ExportCategory` already carries
  incentivePercentage/taxPercentage/incentiveApplicationCost/othersCost (used today for a simpler
  PER-SHIPMENT `incentive` field estimate on category-select — unrelated to the new bulk
  Incentive Application claim workflow; leaving that existing per-shipment calc alone). Archive
  page already filters `status: 'completed'` — confirmed, no archive-page changes needed for R13's
  auto-surfacing, it "just works" once shipment status flips.
- Sidebar nav: `components/layout/AdminSidebar.jsx` lines ~60-69, flat list of
  `{href,label,icon}` under "Export & Import" group, no `module` gate on export-dashboard items
  (unrestricted to any admin/superAdmin) — add "Export Incentives" here the same way. Also add a
  link into the in-page top nav of `app/admin/export-dashboard/page.jsx`.
- UI primitives confirmed reusable as-is: `Button`, `Modal`, `Input`, `Badge`, `Pagination`,
  `Loader` (components/ui/*.jsx) — all read, no surprises, same props as used throughout.

## KEY DESIGN DECISIONS (writing these down BEFORE coding so a resumed session doesn't have to
## re-derive them — see full reasoning in my own analysis, condensed here)
1. **Draft/Active (R2/R3)**: two explicit actions in the editor header — "Save Draft" (forces
   status='draft', persists silently, no log) and "Save" — wording depends on current status:
   when currently draft, label reads "Save & Activate" and forces status='active'; once active,
   only a single "Save" persists without touching status. Server-side: once a shipment's *stored*
   status is non-draft, a PUT can never move it back to draft (defensive clamp) — preserves "once
   active, always logged" invariant even against a stale/buggy client payload.
   Logging: POST logs only if body.status !== 'draft'. PUT: if before.status==='draft' and
   after!=='draft' → this IS the first-ever log entry, recorded as action:'create' (before:null) —
   the activation moment IS the "start of logging", not an update against a never-logged prior
   state. If before.status!=='draft' (already logged before) and after!=='draft' → normal
   action:'update'. If after==='draft' (still draft) → no log at all. DELETE: snapshot status
   BEFORE deleting; draft → plain `findByIdAndDelete`, no recycle bin, no audit log; anything else
   → existing moveToRecycleBin+audit flow, unchanged.
2. **Order Value / Receive Amount / TT (R6-R8)**: `calculateShipmentFinancials` gains a `ttTotal`
   param (sum of ttEntries[].ttValue, computed by the caller). Formula becomes
   `effectiveForeign = ttTotal > 0 ? ttTotal : orderValueForeign; receiveAmountBDT = effectiveForeign
   * exchangeRateBDT`. `orderValueForeign` itself stops being a free input — always set server+
   client side to the live items-total (Packing List Total), matching how totalCTN/
   totalNetWeightKg already work on this same page.
3. **Incentive-application rate override (R15)**: NOT written destructively into
   `shipment.exchangeRateBDT` (would lose the shipment's own original value with no way back on
   unclaim). Instead a pure resolver `resolveEffectiveRateBDT(shipment, application)`: returns
   `application.manualRateBDT` if set, else `application.lockedRateBDT` if status is claimed, else
   the shipment's own stored `exchangeRateBDT`. Every call site that needs "the real rate" for a
   shipment (editor's TT Configuration display, POST/PUT financial computation, analytics rows)
   goes through this resolver — the TT Configuration input becomes a disabled/readonly display of
   the resolved value (with a note + link) whenever an override is active, satisfying "will be
   counted everywhere... even in the Rate in BDT field" without any destructive write.
4. **Selection grouping (R11) currency note**: the requirement's selection rule is explicitly only
   "same category + same license" (no currency clause) — implemented literally as written, not
   augmented with an extra currency constraint. R15's "the shipments base currency" (singular) is
   handled by taking the FIRST selected shipment's baseCurrency as `referenceCurrency` for display/
   live-rate-fetch purposes; the manual-rate number is still applied identically to every member
   shipment's resolver output regardless of its own currency, per the literal "counted everywhere
   for the selected shipments" wording. Documented here in case real usage needs mixed-currency
   handling refined later.
5. **R16 grid**: "max 5 shipments in a row, maximum 2 columns" read as 5-per-row wrapping to at
   most 2 rows (5×2=10, matching the max-10 cap in the same sentence) — implemented as
   `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5`.
6. **Ka Form / Others tabs (R14)** have no field spec given anywhere in the source document —
   implemented as a notes textarea + multi-file upload each (mirrors the existing "Additional
   Documents" pattern already on shipments), the most defensible generic interpretation given zero
   detail was provided. Flagged clearly in PROJECT_STATUS.md for the user to refine if they had
   something more specific in mind.
7. **Locking enforcement (R13)** is real on the server (PUT/DELETE reject with 403 if the
   shipment's `incentiveApplication` resolves to a claimed application), not just a UI courtesy.
   Claim/Unclaim are their OWN dedicated POST endpoints (not the generic shipment PUT), so they can
   freely modify locked shipments through a separate code path without needing a bypass flag.
8. **IncentiveApplication is NOT wired into the existing ExportAuditLog/RecycleBin system** — same
   tier as ExportCategory/License/BankAccount/CtnConfig (plain config/workflow CRUD, already
   established as unlogged in this codebase — see lib/exportAudit.js's own comment). The SHIPMENT
   side-effects of claim/unclaim (status + rate changes) DO go through normal shipment
   recordAuditLog calls, since shipments themselves are a logged entity type per R3.

## ROADMAP (phases, in dependency order — earlier phases are inputs to later ones)
- [x] PHASE A — Deep-read current actual code. DONE (see Ground Truth above).
- [x] PHASE B — Model changes. DONE, committed (2021572).
- [x] PHASE C — lib/utils.js TT-aware + lib/incentiveUtils.js. DONE, committed (08527c5).
- [x] PHASE D — R2/R3 draft/active + conditional logging (server-side: shipments POST/PUT/DELETE,
      analytics route). DONE, committed (03d952f).
- [x] PHASE E — R1 banner-card compression + R2/R3 editor UI (status badge, Save Draft/Save &
      Activate buttons, lock banner). DONE, committed (8f409b4).
- [x] PHASE F — R6/R7/R8: TT Configuration section, Order Value auto, Receive Amount override wired
      into the live preview + handleSave payload, Status dropdown restricted, locked-shipment fields
      disabled. Also fixed a consistency issue in the pre-existing (prior-batch) handleCategorySelect
      incentive estimate, which referenced the now-defunct manually-typed orderValueForeign — now
      uses itemsTotalValue directly. DONE, committed (30bf436).
      NOTE for future me: I deliberately did NOT retrofit a `disabled` mode into the ItemsTable /
      BankDetails / other deeply-nested Shipment Details inputs when locked — the server-side 403
      block on PUT is the actual correctness guarantee (nothing typed there can ever persist once
      locked), and doing a full disabled-prop plumb through ItemsTable's per-row inputs was judged
      not worth the time cost vs. the top-level lock banner + disabled Financial/TT/Status/Notes
      fields already in place. Flagged in PROJECT_STATUS.md too.
- [x] PHASE G — R4 complete: ERC Number/Address/Owner Name/Phone/Email added to Export License
      Configuration (Settings > License tab). API routes already passed arbitrary body fields
      through, so no route changes were needed. Committed (10fff6d).
- [x] PHASE H — R5 complete: DEFAULT_DOCUMENT_TEXT + resolveDocumentText (exported, shared by PDF
      generators, the new DOCX/XLSX generators, AND the print route — one source of truth for the 3
      declaration paragraphs + signatory title), new generateShipmentDocDOCX/XLSX (client-side, same
      Blob-download / XLSX.writeFile pattern already established elsewhere in this codebase), safe
      documentTextOverridesOnly $set-only PUT path (avoids a risky full-replace from the edit
      modal — this route replaces the whole doc otherwise, see its own comment), DocActionBar gained
      a format selector + Edit Text button/modal, print page updated to match so Print and Download
      both always reflect the same saved text. ALSO fixed a real pre-existing bug found while in
      this area: the footer "Save Shipment" button called handleSave() with no argument, so
      `activate` was always undefined/falsy — every save via that specific button would have kept
      forcing draft-preserving behavior, never actually activating a shipment. Fixed to mirror the
      header buttons' logic exactly. Committed (eadfd63, plus this file + print-page follow-up).
- [x] PHASE I — R9-16 complete. Committed across 5 commits (5a0aaa8 foundation: shipments
      availableForIncentive param + lib/incentiveServer.js + collection/[id] routes; 988fd71 claim/
      unclaim routes, refactored cascadeRecomputeShipments to take an optional statusOverride so
      claim/unclaim combine the status change + rate recompute into one update/one log entry;
      12d1ea6 the list page — 3 tabs, R11 bulk-select+constraint logic, rename/claim/view/delete/
      unclaim cards; 14571ab the detail page — 3 tabs, live+manual rate, R16 shipment grid, Ka
      Form/Others with notes+uploads, sidebar nav link).
      NOTE: phases I and most of J actually happened across a context/session gap — the work was
      committed correctly but this file didn't get updated at the time. On the next resume I treated
      git log as ground truth (per this file's own top-of-file instruction) and did a full read-
      through verification of every file I hadn't personally reviewed yet before trusting it. That
      verification is itself now folded into Phase J below, since it's where the real bugs it found
      got fixed.
- [x] PHASE J — Cross-cutting verification + fixes, done as a genuine read-through of every new/
      changed file (not just a git-log skim), since Phase I happened across the gap noted above.
      Confirmed correct: claim/unclaim's rate-then-status sequencing, the list/detail pages' tab
      logic, both nav link additions, the buyer-list claimed-shipment exclusion, the archive page's
      "claimed via" link. Found and fixed 3 real bugs along the way (see PROJECT_STATUS.md §16 for
      the user-facing writeup of all three):
        1. Footer Save button called handleSave() with no `activate` arg (dead zone from Phase H,
           never caught because Phase H's own verification only checked the header button).
        2. Buyer-list delete handler never checked its DELETE response — always toasted "deleted"
           regardless of outcome. Harmless before this batch; not anymore, since deletes can now
           legitimately be rejected (locked/grouped shipment).
        3. Systemic: several routes under app/api/export/ called .populate() on a field without
           importing the model it references — relying on that model already being registered via
           some other route. Fixed with a full Python-script sweep of the whole app/api/export/
           directory (not just batch-8 files) cross-referencing every populate() call against that
           file's own imports — caught 3 batch-8-introduced instances plus 4 pre-existing ones
           (buyers/shipments routes populating country/category/license/bank-account). Re-ran the
           sweep after fixing until it reported clean.
      ALSO added one more guard beyond the original design (see KEY DESIGN DECISIONS #7 above, which
      only covered the fully-claimed lock): a shipment belonging to a still-*pending* Incentive
      Application now has Base Currency / Export Category / Export License specifically locked
      (server-side in the PUT route, 409 on an attempted change; client-side, the 3 cards disabled
      with an explanatory note) — everything else on a pending-application shipment stays editable.
      Without this, editing one member shipment's category after grouping would silently break the
      "all members share one category+license" invariant R11 establishes. Same DELETE route also
      extended to block removing a shipment from a still-pending application directly (only whole-
      application delete frees shipments) — a dangling-reference gap, not literally asked for by
      R13 but needed to avoid real data corruption.
      Committed: 9923bba, 328d27a, 0808392, b7bc458, 0d7cccd.
- [x] PHASE K — Verification sweep: full tsc pass across every changed file (clean), PROJECT_STATUS.
      md §16 added, this file brought up to date. Final step remaining: zip and present.

## KEY FILES (paths confirmed to exist)
- models/ExportShipment.js, ExportLicense.js, ExportCategory.js (read, unchanged), Settings.js
- models/IncentiveApplication.js — NEW
- app/admin/export-dashboard/countries/[countryId]/buyers/[buyerId]/shipments/[shipmentId]/page.jsx
  (the 1291-line shipment editor — by far the biggest single edit target)
- app/api/export/shipments/route.js + [id]/route.js
- app/api/export/analytics/route.js
- app/api/export/licenses/route.js + [id]/route.js, components/admin/export-settings/
  ExportLicenseSection.jsx
- lib/utils.js, lib/exportDocuments.js, lib/exportColumns.js (read for context, minimal edits)
- app/(print)/print/export/[shipmentId]/page.jsx
- app/admin/export-dashboard/page.jsx (nav), components/layout/AdminSidebar.jsx (nav)
- app/admin/export-dashboard/incentives/page.jsx — NEW (list, 3 internal tabs: available/
  documentation/claimed)
- app/admin/export-dashboard/incentives/[applicationId]/page.jsx — NEW (detail, 3 internal tabs:
  incentive details/ka form/others)
- app/api/export/incentive-applications/route.js + [id]/route.js + [id]/claim/route.js +
  [id]/unclaim/route.js — NEW

## LOG (append-only, newest at bottom — this is the literal record of what happened)
- Phase A complete. This file created. Starting Phase B next.
