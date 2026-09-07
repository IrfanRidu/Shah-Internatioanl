# AGENT PROGRESS 22 — Implementation tracking

Follow-up round to Batch 21 (R34, Bengali Ka Form rebuild): user supplied a matching instruction
doc + a current-system ENGLISH Ka Form PDF + the same Bengali reference PDF already fully analyzed
in R34, asking for the ENGLISH PDF branch specifically to be brought in line — Bengali determines
section order/structure, the current English PDF determines English wording. Explicit scope: "the
system generated English ka form (Not bengali one)" — the Bengali branch must not be touched this
round. This file tracks execution; if interrupted, resume at the first unchecked step.

## Steps

- [x] 1. Rasterized the current English PDF (`pdftoppm` at 200dpi) and read it side-by-side against
      the new instruction doc's 35 numbered sections, rather than assuming the English branch needed
      the same scale of rework as Bengali did. Result: the English branch turned out to already be
      close to correct in most places — every stored English text constant (title, citation,
      subtitle, all 8 section headings, all 5 static notes, the full declaration, both signatory
      lines) was checked against the instruction doc's own exact quoted text and matched word for
      word already; Section F's headers already correctly line up against `sectionFFullRows`'
      data (unlike Bengali's, which needed relabeling); Section H already has all 4 full descriptive
      column headers (unlike Bengali's, which was missing them entirely); Section D's English
      "Self-collected / own arrangement" default is correct as-is, since that string genuinely is
      the schema's own default (the R34 Bengali bug was that Bengali was incorrectly inheriting this
      same English default — English inheriting it is correct behavior, not a bug).

- [x] 2. Resolved the same kind of page-orientation self-contradiction as R34's original instruction
      doc (section 1 says LANDSCAPE with exact dimensions; sections 24/29/34/35 and the closing
      summary say PORTRAIT five separate times). Given the user corrected me from landscape to
      portrait for Bengali literally one turn earlier, treated this as the same class of leftover/
      copy-paste mistake with high confidence and implemented A3 PORTRAIT directly without asking
      again. This also means English's page geometry needed no code changes at all — Bengali is
      already A3 portrait (297x420mm) since the R34 correction, and `pageGeometry()` already returns
      that unconditionally for both languages.

- [x] 3. Two concrete, confirmed gaps found and fixed (both isolated to English-only code):
      - `TABLE_STYLE` (the shared style object autoTable-based tables spread into every call) still
        had the gray (232,232,232) head/foot fill from an earlier round's own now-superseded finding
        (see its old comment, which cited "the reference PDF's own header-row fill" — that finding
        doesn't hold up against the actual official Bengali original this round's predecessor
        rasterized directly, nor against this round's own explicit "Do NOT use... gray UI headers"
        instruction). Changed to white, matching the identical fix already made to Bengali's own
        hand-rolled table renderer (`bnDrawGridTable`) in R34. `TABLE_STYLE` is consumed ONLY by
        `autoTable()` calls, all of which are English-only — zero effect on the Bengali branch,
        which never touches this constant.
      - Section D's English table was missing the "1 | 2 | 3" numbering row entirely (confirmed
        both from the rasterized current PDF and by reading the code's `head` array directly) —
        explicitly required by the instruction doc's own Section 7. Added as a second row in the
        existing `head` array, inside the `else` (English) branch only.

- [x] 4. Deliberately did NOT make several changes that seemed plausible at first glance but turned
      out to be explicitly contrary to the instructions on closer reading:
      - Did NOT blank the per-row incentive figure in Section F for English (which R34 did for
        Bengali, matching that specific reference's own visual behavior) — this round's instruction
        doc explicitly lists `incentiveReceivable` as one of Section F's per-row dynamic fields
        (its own Section 16) with no caveat about blanking it, and the current English PDF already
        shows it per row. Bengali's blank-per-row behavior is Bengali-reference-specific, not a
        universal rule to import.
      - Did NOT move Sections A/B to the inline heading+value-on-one-line layout R34 gave Bengali.
        The instruction doc's own Section 5 is explicit and specific for Section B: "Keep the entire
        value inline in the same visual style as the CURRENT ENGLISH PDF" — i.e. preserve the
        current heading-then-line-below layout exactly, not import Bengali's positioning. A more
        general instruction elsewhere ("Bengali PDF determines... positioning... spacing") reads as
        being about structure/order, not literally every micro-layout choice, and the section-
        specific instruction is more authoritative than the general framing where the two could be
        read as being in tension.
      - Did NOT hardcode explicit per-column pixel/percentage widths for Section E despite the
        instruction doc's own Section 26 suggesting specific relative sizing (widest: Description/
        Invoice Value/Repatriated&Date; narrowest: SL/Quantity/Date/EXP No). autoTable's existing
        default content-based auto-sizing already produces non-equal columns roughly matching that
        same distribution (confirmed on the rasterized current PDF — the longest-header columns are
        already visibly wider) since it sizes by content length already, satisfying the doc's actual
        stated constraint ("do NOT use equal-width columns") without the added risk of hand-tuning
        7 numbers for something not reported as visibly broken.

- [x] 5. Verification: extended the same mock-based Node smoke-test harness from R34 (no network/
      browser canvas available in this environment, same limitation as before) to also exercise
      `generateKaFormPDF('en')`, which meant building a substantially more realistic
      `jspdf-autotable` mock than R34 needed (R34 never exercised autoTable at all, since Bengali
      uses its own hand-rolled `bnDrawGridTable`) — one that approximates real greedy-word-wrap
      column-width behavior (every column gets at least its own longest-WORD width, then leftover
      page width is distributed by relative content length) rather than a naive stub. Caught and
      fixed a real flaw in the FIRST version of that mock along the way: an initial simpler
      "proportional-to-full-string-length" column model let Section E's one very long header
      column starve the other 6 columns below their own single-line width, wrapping ordinary body
      numbers onto 2 lines — a mock artifact, not something the real renderer would do (confirmed
      by checking row-by-row output and recognizing the pattern before treating the resulting "only
      12mm of margin" number as real). After the fix: 7 shipments (the target case) uses 368.7mm of
      the available 406mm — 37.3mm to spare, in the same comfortable range R34 achieved for Bengali
      (62mm) — and 10 shipments (the business rule's actual cap) overflows cleanly to a 2nd page via
      the existing safety net rather than being dropped. Bengali's own three fit numbers (1/7/10
      shipments) were re-run unchanged after every edit this round and never moved by a fraction of
      a mm, confirming zero cross-contamination between the two branches. Cross-checked the English
      trace's actual computed figures (repatriated/freight/net-FOB/incentive totals, the D-section
      value, the Section D numbering row's presence) against the same reference numbers R34 already
      hand-verified — all matched.

- [x] 6. Re-diffed the whole project tree against the pristine pre-R34 zip: only lib/
      kaFormDocuments.js (plus this file and PROJECT_STATUS.md) differ at all. Within
      kaFormDocuments.js, this round's only edits are the `TABLE_STYLE` constant and the Section D
      `else` branch's `head` array — both confirmed English-only by direct inspection (`TABLE_STYLE`
      has no Bengali consumers at all; the Section D edit sits explicitly inside `} else {`).
- [x] 7. This file + a PROJECT_STATUS.md batch entry written to close out the round. Final
      deliverable zip assembled and presented.

## Known limitations (same as R34, unchanged by this round)
- No real browser/canvas renderer was available to produce an actual visual proof image — this
  round's verification, like R34's, is real-code-path execution against a deliberately conservative
  mock, not a pixel-level render. A genuine PDF generated from the running app with real data
  (ideally with a full 7 shipments) remains the recommended final visual check for both languages.
- `MAX_SHIPMENTS_PER_INCENTIVE_APPLICATION` stays at 10 (business rule, untouched, same reasoning as
  R34) even though this round's instruction doc also frames 7 as a hard maximum — the English layout
  is tuned and verified for exactly 7, with the existing page-break safety net covering the rarer
  8-10 case rather than silently dropping rows.
