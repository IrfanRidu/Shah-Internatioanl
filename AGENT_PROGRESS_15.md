# AGENT PROGRESS TRACKER — Shah International — Batch 15 (R29): Vercel error investigation +
# service worker staleness fix, shipment rename, EXP No. year-duplication fix, per-field EXP/PC/AWB
# dates.
> READ THIS FILE FIRST on every resume/continue. If interrupted mid-batch, the "LIVE STATUS" block
> at the very top tells you exactly what's done and what's next. Then AGENT_PROGRESS_14.md (Ka Form
> spacing/column-split/alignment), AGENT_PROGRESS_13.md (Vercel dynamic-rendering sweep, local name,
> universal search, campaign price, letterhead watermark) — same conversation, then
> PROJECT_STATUS.md §1-22.
> Source: continuing directly against the project tree already on disk (v17.zip was the last
> delivered state) — no new zip uploaded this round.
> New evidence this round: 5 screenshots — browser console showing persisting /api/currency and
> /api/settings 500s + 2x generic Server-Components-render errors + a Service Worker registration
> line (Screenshot_..._182726.png); 3 Vercel dashboard screenshots (deployment overview, build/
> runtime settings, framework settings — 182759/182815/182856); 1 reference document photo showing
> EXP/AWB/PC each with their OWN distinct date column (194104.png).
> Working copy: /home/claude/work/project. Final deliverable → /mnt/user-data/outputs.

## ============ LIVE STATUS (update this block after every step) ============
CURRENT PHASE: ALL DONE. PROJECT_STATUS.md §23 written. Packaging final zip next.
LAST COMPLETED STEP:
  REQUEST 3 (EXP/PC/AWB per-field dates) DONE:
  - Discovered the schema ALREADY had all 3 date fields (expDate/awbDate/pcDate) — a prior batch
    (R25) had added expDate specifically to fix a DIFFERENT bug (the Ka Form year-blank issue), and
    awbDate/pcDate existed too but were never wired to anything. Confirmed via direct model read.
  - lib/exportDocuments.js: found the file ALREADY has an established "{value} DT:{date}" inline
    pattern (used for Invoice No, via a `fmtDate` helper defined identically in all 3 relevant
    generator functions) — followed this EXACT existing convention rather than inventing a new one.
    Applied to all 3 occurrences of the EXP/AWB/PC InfoGrid rows (generatePackingListPDF,
    generateInvoicePDF, and assembleDocData for DOCX/XLSX — included DOCX/XLSX this round since,
    unlike last round, this request didn't say "pdf" specifically, and it's the same trivial fix).
  - Shipment editor UI: expDate already had an input (`expDateStr` state + date input), but
    awbDate/pcDate had NEITHER form state NOR inputs despite existing in the schema. Added
    `awbDateStr`/`pcDateStr` to form state init, the edit-population readback, the save payload
    construction, and two new `<input type="date">` fields matching the EXP Date input's exact
    styling/pattern. Verified the shipment PUT API's general save path does `{...form}` spread with
    no allowlist filtering, so the new fields flow through to Mongoose (which already had them in
    the schema) with zero additional API changes needed.

  REQUEST 2 (EXP No. year duplication) DONE — found and fixed TWO independent instances of the same
  bug pattern, not just the one the user pointed at:
  - lib/kaFormDocuments.js's `expNoWithYear` (Section E's EXP column): renamed to `expNoWithDate`,
    stopped appending a year (root cause per the user: admin now enters the year AS PART OF expNo
    itself, e.g. "000367/2026", so appending another one produced "000367/2026/2026"), and — since
    the header genuinely says "EXP No. & Date" — properly wired in the real `expDate` field
    (formatted via the existing DDot() helper) for the actual "& Date" half, which the old code
    only ever half-delivered (a bare year, never a full date). Multi-line cell content (`\n`
    between number and date) follows this exact table's own pre-existing precedent for combining
    two pieces of info in one narrow-column cell.
  - `buildExpSequence` (feeds the declaration paragraph's "EXP Nos. X, Y, and Z" text): found
    INDEPENDENTLY while investigating the above — same underlying bug (appended "-{year}" to the
    first/last EXP number in the sequence, per an R19-era rule that assumed expNo was entered
    WITHOUT a year). Fixed by removing the year-appending logic entirely; every EXP number in the
    sequence now used exactly as entered. Not explicitly named by the user, but the same principle
    they stated applies directly — leaving it would have reproduced their exact complaint elsewhere.
  - Verified via grep: zero remaining references to the old `expNoWithYear` name (clean rename),
    and confirmed these are the ONLY 2 places in the file with EXP-number display/formatting logic.

  REQUEST 1 (shipment rename) DONE:
  - Investigated: no dedicated "name" field exists or is implied — `shipmentNo` (required, unique-
    indexed) is the shipment's identifying label throughout the app. "Rename" = edit this value.
    The shipment editor's own Details tab already had an editable Shipment No field, but that's deep
    in a full edit form — "an option to rename every shipment" reads as wanting something more
    convenient from wherever shipments are actually browsed/managed as a list.
  - CRITICAL finding before writing any UI: the shipment PUT route does a full-document REPLACE
    (confirmed by reading its code directly, and its own comment), not a $set — sending just
    `{shipmentNo: x}` from a lightweight rename button would have WIPED every other field on the
    shipment. Found an established, exact precedent already in the same route for this same problem
    (`documentTextOverridesOnly`, a dedicated $set-only branch) and followed it precisely: added a
    new `shipmentNoOnly` branch (app/api/export/shipments/[id]/route.js) — validates non-empty,
    catches the MongoDB duplicate-key error (shipmentNo has a unique index) with a specific,
    actionable message instead of a generic 500. Confirmed via grep this new branch sits AFTER the
    existing incentive-lock check, so a locked/claimed shipment correctly rejects a rename attempt
    the same way it already rejects other edits.
  - Found the two real shipment LIST views (not just the single-shipment editor): the Contract-
    scoped list (contracts/[contractId]/page.jsx) and the Export Archive
    (export-dashboard/archive/page.jsx) — both have full shipment-management actions (delete, etc.)
    already, making them the natural home for rename too. Added a small Pencil icon button next to
    the bold shipmentNo display in both, using `window.prompt()` for the actual rename input —
    deliberately matching each file's OWN already-established native-dialog pattern (both already
    use `confirm()` for delete) rather than introducing a new UI paradigm (modal/inline-edit) for
    just this one action.
  - Confirmed the Contract-scoped list already filters out claimed-incentive (locked) shipments
    entirely (pre-existing `.filter(s => s.incentiveApplication?.status !== 'claimed')`), so no
    additional disabled-state UI was needed there. The Archive list DOES show locked shipments (with
    an existing "🔒 Claimed via..." indicator) — added the rename button there too, relying on the
    same server-side lock check (already proven, same reasoning the page's own handleDelete comment
    already documents) to reject with a clear message rather than duplicating the lock logic
    client-side.
  - Deliberately did NOT add rename buttos to the 2 other places `shipmentNo` appears
    (incentives/page.jsx's shipment PICKER widget for building an application, and a flattened
    TT-entries summary table in incentives/[applicationId]/page.jsx) — read-only/selection-purpose
    views, not shipment-management views; adding an edit action there would be out of place relative
    to their actual purpose. "Every shipment" is satisfied in the sense that matters: any shipment
    can be renamed from the places it's actually managed.
  All 3 requests' edits verified individually via tsc as each was written.

NEXT STEP: Full consolidated tsc pass across every file touched this round (public/sw.js,
  lib/exportDocuments.js, lib/kaFormDocuments.js, the shipment editor page,
  app/api/export/shipments/[id]/route.js, the contract-scoped shipment list, the archive page) as
  one final check, then package the zip and write the user-facing summary — which needs to include
  a clear, honest, actionable explanation of the Vercel DB-connectivity hypothesis (NOT something I
  fixed, since it's outside the codebase) alongside everything that WAS actually fixed this round.
BLOCKERS: none for the 3 feature requests. The Vercel error investigation's conclusion needs the
  user to check Vercel env vars + MongoDB Atlas Network Access — nothing further to verify from
  inside this sandbox.
============================================================================

## THE 3 NEW FEATURE REQUESTS THIS ROUND (verbatim from user, my numbering kept)
1. Add an option to rename every shipment.
2. EXP No. already includes the year as entered (e.g. "000367/2026") — the "EXP No. & Date" column/
   row in Section E of both Bengali and English Ka Form should not ALSO append a year on top of
   that (i.e. whatever `expNoWithYear`-style formatting currently does, remove the redundant part).
3. Per the reference photo: EXP No., PC Number, and AWB No. each have their OWN individual date in
   the real paperwork. Add date fields beside each of these three in the shipment details/editor
   page, store them, and print each identifier with ITS OWN date next to it in Packing List, BD
   Invoice, and Buyer's Invoice (not just the Ka Form — the user's wording covers "in shipment
   details page... add these date in Packing list, BD Invoice, Buyer's Invoice").

## Verification approach this round
Same tsc-based syntax check as every prior round (no network = no real build/dev-server). For the
service worker fix specifically — plain JS, no JSX/framework magic — tsc's allowJs/checkJs mode can
still syntax-check it directly.
