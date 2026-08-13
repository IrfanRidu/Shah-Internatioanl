# AGENT PROGRESS TRACKER — Shah International — Batch 14 (R28): Declaration/Total-Carton line
# spacing, Bengali Ka Form Section E column split (EXP No. vs Repatriated Value), Ka Form Section A
# company name/address spacing, center-alignment of ALL table headers+values across every PDF type.
> READ THIS FILE FIRST on every resume/continue. If interrupted mid-batch, the "LIVE STATUS" block
> at the very top (updated after every meaningful step) tells you exactly what's done and what's
> next — resume from there, don't restart. Then AGENT_PROGRESS_13.md (previous round, same
> conversation — Vercel sweep, local name field, universal search, campaign price populate fix,
> letterhead watermark layering) for everything before that, then PROJECT_STATUS.md §1-21.
> Source: continuing directly from the shah-international-v16.zip deliverable of the previous round
> (still on disk at /home/claude/work/project, NOT a fresh upload this round). New reference files
> this round: Screenshot_2026-08-11_171637.png (declaration/Total-Carton spacing), Screenshot_2026-
> 08-11_171557.png (Ka Form Section A name/address spacing), ka_from.pdf (reference Bengali Ka Form
> showing the CORRECT Section E 6-column layout — rasterized + zoomed at
> /home/claude/work/ka_ref/section_e_zoom.png, confirmed pixel-by-pixel: Description/Quantity/
> Invoice Value/Ship Date/EXP Number/Repatriated-Value-and-Date, 6 real columns, NO leading serial-
> number column).
> Working copy: /home/claude/work/project. Final deliverable: zip of that tree → /mnt/user-data/outputs.

## ============ LIVE STATUS (update this block after every step) ============
CURRENT PHASE: ALL DONE. PROJECT_STATUS.md §22 written. Packaging final zip next.
LAST COMPLETED STEP: ISSUE 4 (center-alignment sweep) DONE — surveyed every table in both files via
  grep before touching anything: lib/exportDocuments.js has exactly 2 autoTable() calls, both
  sharing PLAIN_TABLE_STYLE (fixed once — added halign:'center' to styles/headStyles/bodyStyles/
  footStyles); lib/kaFormDocuments.js has 7 autoTable() calls, all sharing TABLE_STYLE (fixed once,
  same pattern) and 5 bnDrawGridTable() calls each with their own `aligns` array (Section C/D/E/F/H
  — all changed to all-'center'; confirmed no per-column columnStyles overrides existed anywhere in
  either file that could conflict with a shared style-object fix). Also centered the print-preview
  HTML path's `TD` constant (app/(print)/print/export/[shipmentId]/page.jsx) — found `TH` was
  already centered by design but `TD` (used only for the Name/Botanical/HS-code cell) was left-
  aligned; centering the base TD constant fixes it without touching individual call sites, and
  leaves TDC (which spreads TD) harmlessly redundant rather than broken. Verified with a final
  arithmetic check that Section E's new 7-column widths still sum to exactly 1.0, and that
  colW/head/each body row/foot/aligns are all consistently 7 elements (re-read the complete block
  once more end to end as a final proofread, given this was the highest-risk single fix this round).
  Confirmed DOCX/XLSX Section E output (2 separate call sites) already used sectionERows before
  this round and is completely unaffected by any of these changes — untouched, matches this round's
  explicit PDF-only scope (user said "pdf" three times in issue 1 alone, "all of the pdfs" in issue
  4). Full consolidated tsc pass across all 4 touched files (lib/exportDocuments.js,
  lib/kaFormDocuments.js, the print preview page, lib/bengaliText.js — read-only reference, not
  edited but re-verified anyway) — all clean.

  Honest verification-method note: unlike last round's CSS stacking-order fix (empirically verified
  with a real Playwright/Chromium screenshot), this round's Bengali column-split fix (issue 2) could
  NOT be empirically rendered — no jspdf/jspdf-autotable/node-canvas available locally and no
  network to install them, so there's no way to produce an actual PDF or rasterize the custom
  canvas-based Bengali text pipeline in this sandbox. Confidence instead rests on: (a) exact
  structural/arithmetic verification (array-length matching across colW/head/body/foot/aligns,
  width sum = 1.0), (b) reusing Bengali phrase fragments already proven to render correctly
  elsewhere in this exact file/pipeline rather than fresh transcription, (c) tsc syntax
  verification. This is real, evidence-based confidence, but a categorically different (weaker)
  kind than an actual rendered screenshot — worth being upfront about in the final summary rather
  than overclaiming the same certainty as last round's fix.
NEXT STEP: Write PROJECT_STATUS.md §22 (new "Batch 14" section, following established convention),
  renumbering "Setup Reminder" from §22 to §23. Then final packaging: re-verify project tree has no
  stray scratch files (check /home/claude/work/ka_ref isn't inside the project dir — it isn't, it's
  a sibling scratch directory, confirmed safe to leave out of the zip), zip the whole project,
  present_files, write user-facing summary covering all 4 issues plus the honest verification-
  confidence distinction noted above for issue 2 specifically.
BLOCKERS: none currently.

## THE 4 ISSUES THIS ROUND (verbatim from user, my numbering kept)
1. In Packing List, BD Invoice, Buyer's Invoice: the certify-declaration sentence and the
   "Total Carton: X CTN" line right below it are touching with almost no gap (screenshot 1
   confirms) — needs real line spacing between them.
2. Bengali Ka Form Section E (রপ্তানী চালানের বিবরণ): EXP Number and the repatriated-value+date
   are currently stacked into ONE column: reference PDF proves these must be TWO separate columns.
3. Bengali Ka Form Section A: "(ক) আবেদনকারীর নাম ও ঠিকানা" label and the actual
   name/address value below it are too close together (screenshot 2) — needs line gap.
4. ALL table headers AND values, across EVERY PDF type (Bengali Ka Form, English Ka Form, Packing
   List, BD Invoice, Buyer's Invoice) — currently a mix of left/right alignment — should be
   center-aligned instead, comprehensively.

## Files relevant this round (confirmed from last round's full read + this round's investigation)
- lib/exportDocuments.js — Packing List / BD Invoice / Buyer's Invoice PDF generator (issue 1, and
  part of issue 4's alignment sweep — PLAIN_TABLE_STYLE + any other alignment settings)
- lib/kaFormDocuments.js — Ka Form PDF generator, both langs (issues 2, 3, and part of issue 4)
- app/(print)/print/export/[shipmentId]/page.jsx — HTML print-preview for Packing List/Invoices,
  should mirror issue 1's spacing fix and issue 4's alignment fix for consistency with the PDF
- Ka Form's own print-preview page (not yet located — need to find it; likely under
  app/admin/export-dashboard/.../incentive-applications/ or similar, given kaFormDocuments.js is
  used by an "incentive application" feature per earlier grep hits like
  "incentive-applications/[id]/claim") — check whether one exists before assuming it does or doesn't

## Verification approach this round
Same as established: tsc --noEmit --allowJs --checkJs --jsx preserve --noResolve --skipLibCheck for
syntax/reference safety (no network = no real build/dev-server available, same constraint every
round has faced). For the Bengali PDF's custom bnDrawGridTable rendering specifically, tsc alone
can't visually confirm correct column rendering — consider whether an empirical Playwright/Chromium
check (like last round's CSS stacking-order verification) is feasible here too, though jsPDF output
is a binary PDF not an HTML/CSS render, so the same screenshot technique doesn't directly apply;
may instead rasterize the actual GENERATED pdf (if I can produce one without full app dependencies)
or rely on careful manual arithmetic/column-count verification instead — decide once I reach that
step.
