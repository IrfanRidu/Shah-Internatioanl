# AGENT PROGRESS TRACKER — Shah International — Batch 16 (R30): EXP/AWB/PC 3-column identifier
# table (precise reformat of last round's fix), Vercel src/-folder theory addressed (no code change
# — explained why it doesn't fit the evidence).
> READ THIS FILE FIRST on every resume/continue. Then AGENT_PROGRESS_15.md (previous round, same
> conversation — Vercel investigation/service worker fix, shipment rename, EXP No. year dedup,
> original EXP/AWB/PC date wiring), then _14/_13, then PROJECT_STATUS.md §1-23.
> Source: continuing directly against the project tree on disk (v18.zip was the last delivered
> state) — no new zip uploaded this round.

## ============ LIVE STATUS ============
CURRENT PHASE: DONE (this file now also covers a same-day follow-up fix, see below).
LAST COMPLETED STEP: [ORIGINAL R30 CONTENT ABOVE THIS LINE STILL ACCURATE] Follow-up: user sent a
  real screenshot of the actual generated Packing List showing two concrete problems with R30's
  drawIdentifierTable:
  1. "Doesn't appear in printing preview" — confirmed: R30 only touched the jsPDF/downloaded-PDF
     path (lib/exportDocuments.js). The separate HTML print-preview page's own InfoGrid component
     (app/(print)/print/export/[shipmentId]/page.jsx) still had the OLDER inline "value date" text
     format from R29, never updated. Fixed: added a nested flex sub-layout (label/value/date, date
     right-aligned via a bordered flex item) to that component's EXP/AWB/PC cells — CSS naturally
     contains this within the existing 1fr grid column, no manual width math needed the way jsPDF
     required, so no equivalent "too wide" risk on this side.
  2. "Table too wide" — measured precisely (cropped + pixel-compared against the row above in the
     user's actual screenshot, not just eyeballed): drawIdentifierTable used the FULL CONTENT_WIDTH,
     but it's drawn directly under drawInfoGrid's LEFT column (where TIN/BIN/ERC live) — so its
     right edge cut across into the space the right column (Final Destination etc.) occupies on the
     rows above, instead of stopping level with them. Fixed: changed TABLE_W to
     `CONTENT_WIDTH/2 + 1`, matching drawInfoGrid's own center-divider x-position EXACTLY (confirmed
     by reading that function's own `doc.line(PAGE_WIDTH/2+1, ...)` call), and re-tuned the internal
     label/value/date proportions (17/51/32%) for the new narrower width. Re-verified empirically
     with an updated HTML/CSS mockup (same technique as before, no jspdf available locally) that
     ALSO included a mock ERC/Port-Of-Discharge row above it for direct alignment comparison — the
     table's right edge now lines up exactly with the row above, confirmed visually.
  Both fixes tsc-clean.
NEXT STEP: none — packaging.
BLOCKERS: none.
  1. Vercel `src/` folder theory — investigated and explained why it doesn't fit (no code change,
     the theory doesn't hold up): confirmed app/lib/components/models are all correctly at project
     root, jsconfig.json's `@/*` → `./*` alias confirms this is deliberate and used everywhere,
     the existing .github/workflows/ci.yml is an independent lint/test/build check unrelated to
     Vercel's actual deploy mechanism (uses a dummy local MONGODB_URI explicitly marked as not
     connecting to any live service), and the build succeeding ("Ready" in Vercel) rules out a
     genuine routing/structure problem (that would fail the build or 404 everything, not produce
     isolated 500s on specific DB-touching routes). Pointed the user at Vercel's Function Logs
     (shows the real un-redacted server error, unlike the browser's generic digest) as the concrete
     next diagnostic step, since I have no way to inspect their live logs/env vars from here.
  2. EXP/AWB/PC identifier formatting — user clarified last round's inline "value DT:date" text
     wasn't what they wanted; they want a REAL 3-column layout (Label | Value | Date) with a
     vertical divider and the date right-aligned, matching the reference photo precisely. Built a
     new dedicated `drawIdentifierTable` function in lib/exportDocuments.js (manual jsPDF coordinate
     drawing — labelW 14%/valueW 56%/dateW 30% of CONTENT_WIDTH, rowH 6mm, vertical dividers at both
     column boundaries, horizontal dividers between rows, date drawn with align:'right') rather than
     bolting a 3rd-column special case onto the shared `drawInfoGrid` (which is fundamentally a
     [label,value] 2-per-row single-line design with no concept of per-column alignment). Removed
     EXP No/AWB/PC from both InfoGrid calls (Packing List, Invoice) — replaced with [null,null]
     placeholders to preserve the existing pairing for Final Destination (which shared a row with
     EXP No) — and call drawIdentifierTable right after drawInfoGrid instead. Deliberately left the
     DOCX/XLSX path's inline format from last round untouched: fundamentally different rendering
     system (a real Word table, not manual coordinate drawing), and this round's request was
     specifically about the PDF's visual grid — matches this file's own established, repeatedly-
     stated DOCX design philosophy (native/editable, not pixel-matched to the PDF).
  Verified geometry empirically: no jspdf available locally (same constraint as every prior round),
  so built an HTML/CSS mockup using the EXACT same proportions (14/56/30%, 6mm rows) and rendered it
  with the locally-available Playwright/Chromium — result closely matches the reference photo's
  layout, and confirmed the longest realistic EXP value ("00000336/000367/2026") fits within its
  column without overflowing into the date column. tsc clean on lib/exportDocuments.js.
NEXT STEP: none — pack aging.
BLOCKERS: none.
