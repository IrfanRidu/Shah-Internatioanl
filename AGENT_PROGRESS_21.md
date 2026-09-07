# AGENT PROGRESS 21 — Implementation tracking

Single-feature round: rebuild the Bengali Ka Form PDF's layout to match a freshly-supplied,
higher-quality reference PDF exactly (structure/wording/tables), on user report that the
system-generated Bengali PDF was missing tables/rows and diverging from the official form. No
ROADMAP_BATCH21.md was created up front — the request came with its own very detailed 30-point
spec document (structure requirements) plus two reference PDFs (current-system output +
official/original), so that spec doc served as the plan. This file tracks EXECUTION + the research
that fed it. If interrupted, resume at the first unchecked step below.

## Steps

- [x] 1. Read the 30-point spec doc + both reference PDFs carefully before touching any code, per
      explicit instruction. Extracted the current codebase (shah-international-v32.zip) and
      confirmed via `pdfinfo`/`pdftoppm` rasterization + section-by-section visual inspection at
      200dpi (this document family's `pdftotext` output is known-unreliable — garbles Bengali
      conjuncts, reconfirmed again here) exactly what changed vs. what the spec doc's prose said,
      since the two didn't always agree (see step 2). Cross-referenced against this project's own
      prior research (KA_FORM_AND_STAMP_REFERENCE.md, and the Ka Form batches in PROJECT_STATUS.md
      — batches 9/10/11/14/16/18) to avoid re-deriving things already known and to catch where a
      prior finding no longer held up against this fresh reference (several didn't — see step 3).

- [x] 2. Resolved a real contradiction in the spec doc itself before writing any code: point 1
      ("PRIMARY OBJECTIVE") lists "Portrait orientation" as an original-PDF attribute to preserve;
      point 2 ("PAGE CONFIGURATION") explicitly mandates A3 **LANDSCAPE** with exact point
      dimensions, repeated, plus "do NOT use A4." `pdfinfo` on the actual supplied reference PDF
      shows it's genuinely A4 portrait (595x842pt, iLovePDF-produced — likely a scaled/printed
      export of the real A3 form, not the form's native size). Decision: treat point 2 as the
      deliberate, specific instruction (exact dims given, repeated emphasis) and point 1's
      "portrait" mention as a leftover inconsistency; use the reference PDF purely for
      content/structure/wording fidelity, rendered onto an A3 LANDSCAPE canvas as instructed. This
      is a judgment call, flagged clearly to the user rather than silently assumed.

- [x] 3. Full section-by-section diff of CURRENT (system) vs. REFERENCE (official) vs. the spec
      doc's own prose, all three cross-checked against each other since none was 100% reliable
      alone (spec doc had at least one clear typo — circular number "২৫/২০০৫" in the prose vs.
      "১৫/২০০৫" clearly visible in the actual reference image; deferred to the image). Confirmed
      concretely, not just from the prose description:
      - Legal citation sits at the TOP of the form next to the title, not above Section H where a
        prior round (batches 9-10, working from a different/lower-quality reference at the time)
        had concluded it belonged for Bengali specifically. That earlier finding doesn't hold up
        against this fresh, higher-resolution reference.
      - Sections (ক)/(খ): reference keeps heading+value on ONE line; current wraps to a new line.
      - Section (গ) TT list: reference is a compact bold WRAPPED PARAGRAPH ("TT NO: x DT: y
        {symbol}z" per entry, pipe-separated, ending "Total={sum}"), not a bordered table — current
        used a bordered ক্রম/টিটি নম্বর/তারিখ/মূল্য table with a gray header.
      - Section (ঘ): reference's supplier-source cell is Bengali ("রপ্তানী পণ্য নিজস্ব উদ্যোগে
        সংগৃহীত:"); current showed English ("Self-collected / own arrangement") in the Bengali PDF.
        Root cause traced to models/IncentiveApplication.js's own Mongoose schema `default` for
        `kaForm.supplierNameAddress` being hardcoded English — meant the PDF code's own existing
        lang-aware `||` fallback could never actually fire (field is never falsy once Mongoose
        applies its default). Also missing the ১|২|৩ numbering row.
      - Section (ঙ): reference has EXACTLY 6 columns, no separate serial/ক্রম column (the numbering
        row is a column index, not a per-row serial) — current had 7 (added a ক্রম column in an
        earlier round, working from a reference that apparently did have one; this fresh, higher-
        quality reference does not). Missing numbering row. No currency symbols on any figure
        anywhere in the table (or, in one spot, the Bengali currency WORD glued directly to the
        number with no space) — reference prefixes every single money figure with "€". TOTAL row
        used "মোট"; reference uses the English word "TOTAL".
      - Section (চ): the real bug, and worth stating precisely since it's not obvious from the
        rendered PDF alone — the underlying DATA (`sectionFFullRows`) was already completely
        correct (verified by hand: row 1's own printed numbers, 10,988 − 8,000 − 0(N/A) = 2,988,
        already matched the correct repat−(freight+commission)=netFOB formula). The bug was purely
        that this table's Bengali HEADER TEXT was mismatched against that same correct data —
        column 2 (holding repatriated value) was labeled "ইনভয়েসের মূল্য" (invoice value); column 3
        (holding freight) was labeled "প্রত্যাবাসিত রপ্তানী মূল্য" (repatriated value); freight and
        commission/insurance were described as one merged header despite being genuinely two
        separate columns already in the data and already correctly split in the (untouched)
        English header a few lines down. Also: reference leaves the per-shipment incentive figure
        BLANK on every row, showing it only once in the TOTAL row — current showed it per row.
      - Section (জ): current only rendered the ১-৪ numbering row with NO descriptive column headers
        above it at all (a real gap, not shorter labels) — reference has full multi-line headers for
        all 4 columns, and the calculation-description sentence current drew as a standalone caption
        above the table is, in the reference, actually the 4th column's own header text. Final
        rate line ("€2748.293 @ 144.5 BDT = 397127.905 BDT") is Latin-numeral in the reference;
        current had converted it to Bengali digits + "টাকা".
      - Gray header/total shading present throughout current's tables; reference is plain black-
        border-on-white everywhere (confirmed on every single table, no exceptions).

- [x] 4. Checked available tooling/constraints up front rather than discovering them mid-edit:
      confirmed no `@pdf-lib/fontkit`-style dependency is needed since Bengali rendering here is
      its own canvas-rasterize-then-embed-as-image pipeline (lib/bengaliText.js); confirmed the
      only Bengali font shipped in the repo is public/fonts/FreeSansBengali.ttf (network is
      disabled in this environment, so a different font — e.g. doc's own suggested Noto Serif/Sans
      Bengali — could not be fetched; flagging this to the user rather than silently working around
      it, since FreeSansBengali is a reasonable sans-serif stand-in but not a pixel-identical match
      to whatever produced the reference PDF's own glyphs).

- [x] 5. Rewrote lib/kaFormDocuments.js — Bengali PDF path ONLY. English's own autoTable/TABLE_STYLE
      rendering path is completely untouched (confirmed via full diff against a pristine re-extract
      of the original zip: only this one file differs at all, and within it every changed hunk sits
      inside an `if (lang === 'bn')` branch or a shared text/helper constant DOCX+XLSX also read —
      never inside an `else` English branch). Specific changes:
      - `pageGeometry()` and the `new jsPDF()` call are now lang-aware: `bn` → A3 landscape
        (420x297mm), `en` → unchanged A3 portrait (297x420mm, byte-identical to before).
      - `bnDrawGridTable`: removed the always-on gray (232,232,232) head/foot fill (Bengali-only
        function, so this is automatically English-safe); body rows now default to bold, matching
        the reference's own overwhelmingly-bold appearance.
      - New small self-contained helpers (matching the file's existing style, e.g. `ccyLabel`/
        `moneyFC` before them): `ccySymbol`/`mc()` (currency-symbol-prefixed money, used for every
        figure in Sections D/E/F/H), `ccyFullNameEn` (spells "EURO" etc. for Section B, matching the
        reference keeping currency names in Latin script mid-Bengali-sentence), `buildTTInlineText`
        (Section C's new paragraph builder), `resolveSupplierLabel` (the Section D schema-default
        fix — template-layer only, no schema/model change), `inlineHeadingValueBn` (shared by
        Sections A/B's one-line heading+value pattern).
      - Sections A, B, C, D, E, F, G, H's `lang==='bn'` branches rebuilt per the step-3 findings
        above. Ship-date (Section E) and Section B's contract line are rebuilt directly from the
        raw `d.shipments[i].date` / `d.contract` fields at the PDF-render call site rather than by
        editing the shared `assembleKaFormData()` output those fields come from — deliberately, so
        English/DOCX/XLSX (which also consume that shared function) are provably unaffected.
      - Removed manually-guessed `\n` line-breaks inside long table headers that had been copied
        from how they wrapped in the reference's own much-narrower A4 columns — on this round's
        wider landscape columns those forced extra, unnecessary wrapping height; left as plain
        strings so `bnCellLines`' own width-aware wrapping picks the genuinely optimal line count
        for the actual column width.
      - Trimmed cell padding/font size slightly on the two big 7-row tables (Sections E/F,
        6.8pt/0.7mm vs. an initial 7.2pt/default) and shaved a few inter-section gaps after an
        initial fit test came in about 25-30mm over budget — see step 6.
      - Margin: 14mm → 11mm (shared constant, so also touches English's table margins by the same
        3mm — inconsequential on English's own 420mm-tall page; freed real budget on Bengali's much
        shorter 297mm-tall landscape page, where the same margin now costs proportionally more).

- [x] 6. Verification, in the absence of a real renderer: this environment has no network (can't
      npm install) and ships no node_modules, and lib/bengaliText.js needs a browser canvas +
      FontFace to actually rasterize glyphs — so the real visual output could not be rendered here,
      same limitation this project's own prior rounds already hit and documented. Built a
      throwaway Node smoke-test harness instead (mocked `jspdf`/`jspdf-autotable`/`xlsx`/
      `./bengaliText` with a character-width-heuristic version of the real drawing API, deliberately
      biased conservative/wide so it's more likely to flag a real overflow than hide one) that
      executes the REAL `generateKaFormPDF('bn')` end to end against synthetic data built from the
      user's own reference PDF's exact numbers. Results:
      - 1-shipment case: no crash, no overflow.
      - 7-shipment case (the spec's stated target, matches the reference exactly): fits on one
        page with ~4mm to spare against the mock's own deliberately-pessimistic budget (max Y
        282.0mm vs. a 286mm limit); 0 forced page breaks.
      - 10-shipment case (the app's underlying MAX_SHIPMENTS_PER_INCENTIVE_APPLICATION business
        rule, in incentiveUtils.js, still allows up to 10 — intentionally NOT changed, see step 7):
        gracefully overflows to a clean 2nd page via the existing `ensureSpace`/`addPage` safety
        net rather than crashing or silently dropping rows.
      - Cross-checked the actual computed figures in the trace against the reference PDF's own
        printed totals: Section D value (€27,482.93), Section E/F TOTAL rows (€61,545.00 /
        €34,062.07 / N/A / €27,482.93 / €2,748.29), Section B's line format, and Section E's
        per-row ship-date (slash) vs. repatriated-date (dot) formatting all matched the reference
        exactly — strong confirmation the header/label fixes (step 3's Section F finding
        especially) didn't require and didn't get any accompanying data/formula changes.
      - Full trace of the 7-shipment run reviewed section-by-section (not just pass/fail) to
        confirm draw order and inline-vs-block-below placement matched the reference for every
        section, not only the ones with numeric totals to cross-check.
      - Caught and fixed one real bug introduced mid-edit during this process: an early draft of
        Section F's row-mapping used a `.find()` by AWB number that would have silently
        mis-attributed figures for shipments sharing a blank/duplicate AWB — replaced with plain
        positional destructuring before it reached the delivered file.

- [x] 7. Deliberately did NOT change (all confirmed via grep/diff, not just by intent):
      - `models/IncentiveApplication.js`'s `supplierNameAddress` schema default (English) — fixed
        at the PDF-template layer instead (step 5), preserving any real admin-entered value in
        either language and matching the "map data into the template, don't change the schema"
        constraint from the spec doc.
      - `lib/incentiveUtils.js` — `calculateIncentiveCosting`, `resolveEffectiveRateBDT`,
        `MAX_SHIPMENTS_PER_INCENTIVE_APPLICATION` (still 10) all untouched. The spec doc's
        repeated "maximum 7 shipments" is treated as the PDF's own design target (and it is now
        comfortably tuned for exactly that, per step 6), not as license to silently truncate real
        financial/legal data for the rarer 8-10 case the business rule still permits.
      - English PDF branch, DOCX generator, XLSX generator — all confirmed untouched (step 5); the
        only thing they inherit from this round is more accurate shared Bengali TEXT CONSTANTS
        (citation wording, declaration wording, a couple of note paragraphs — see the
        DEFAULT_KA_FORM_TEXT.bn diff), which they already consumed as plain strings before this
        round and still do identically now, just corrected.

- [x] 8. This file + PROJECT_STATUS.md batch entry written to close out the round (this project's
      own established continuity convention — see PROJECT_STATUS.md's batch list).
- [x] 9. Final deliverable zip assembled from the full extracted project tree (this one file
      changed, everything else byte-identical to the uploaded shah-international-v32.zip) and
      presented.

## Known limitations / assumptions flagged to the user (not silently resolved)
- A3 LANDSCAPE was chosen over the spec doc's conflicting "portrait" mention (step 2) — a
  one-constant change (`pageGeometry`'s `lang==='bn'` branch) if this reading is wrong.
- Bengali font is still FreeSansBengali.ttf — no network available in this session to fetch the
  doc's own suggested Noto Serif/Sans Bengali alternative.
- No real browser/canvas renderer was available to produce an actual visual proof image this
  round (step 6's mock-based verification is real code-path execution, not a pixel-level render) —
  recommend generating one real PDF from the running app with actual data as the final visual check.
- `MAX_SHIPMENTS_PER_INCENTIVE_APPLICATION` stays at 10 (business rule, untouched) even though the
  spec doc frames 7 as a hard maximum — the PDF layout itself is tuned for exactly 7 per that spec,
  with a safe (not silently-lossy) overflow path for the 8-10 case the code still permits.

## POST-DELIVERY CORRECTION — reverted to A3 portrait
User clarified immediately after the first delivery (v33) that A3 landscape was a mistake on their
own part — A3 PORTRAIT is what's actually wanted. Reverted:
- `pageGeometry()` back to a single, non-lang-parameterized function returning 297x420mm (this
  also simplified the function back to its pre-this-round signature, since both languages are once
  again identical page geometry — the `lang` parameter it briefly took is gone).
- `jsPDF` constructor back to unconditional `orientation: 'portrait'`.
- `MARGIN` back to 14mm (was dropped to 11mm specifically to claw back room on landscape's tight
  297mm-tall canvas — portrait's 420mm doesn't need that squeeze, and this also restores exact
  margin parity with English, removing the small shared side-effect the landscape detour had
  introduced).
- Table/heading/note font sizes and cell padding relaxed back up (Section D/E/F/H tables: was
  6.8-7.5pt/0.7-0.8mm padding for landscape's tight fit, now 7.6-8pt/0.9-1mm; section headings
  9→9.5pt; notes 7→7.3pt; declaration 7.6→8.3pt; header block citation/subtitle sized back up
  slightly too) — re-verified via the same mock smoke-test harness rather than assumed: portrait's
  420mm-tall canvas (vs. landscape's 297mm) gives dramatically more headroom even though the
  narrower ~269mm content width (vs. landscape's ~392mm) means more per-cell text wrapping, so
  fonts could come back up substantially and still fit comfortably. Confirmed: 7-shipment case now
  uses 344.1mm of the available 406mm (14mm margin) — 62mm to spare, vs. landscape's final ~4mm —
  and even the 10-shipment above-spec edge case now fits on a single page (380.1mm), which
  landscape could not do (needed a 2nd page for that case).
- All Section E/F/D/H structural content (columns, labels, currency prefixes, blank per-row
  incentive, etc. — everything from steps 3/5 above) is unchanged; only page geometry and the
  font/spacing tuning that depends on it were touched. Re-diffed against the pristine original zip
  after this correction: still only lib/kaFormDocuments.js (+ this file + PROJECT_STATUS.md)
  differ from the untouched project.
