# AGENT PROGRESS TRACKER — Shah International — Batch 10 (9 reported bugs: product search,
# incentive rename/live rate, reload-on-edit, Ka Form/Stamp Application exact-match rewrite,
# Bengali rendering, incentive→shipment/analytics propagation, shipment delete, letterhead-as-
# background PDF rendering)
> READ THIS FILE FIRST on every resume/continue, BEFORE reading anything else. Contains batches
> 1-9 already complete (AGENT_PROGRESS.md through AGENT_PROGRESS_9.md + PROJECT_STATUS.md §1-17 —
> do not re-touch those areas unless directly relevant to THIS batch).
> Source zip: /mnt/user-data/uploads/shah-international-v12.zip (this IS batch 9's own output),
> plus 4 new reference PDFs this round (Form_KA_Bengali_Formatted.pdf is NEW — batch 9 never had a
> real Bengali Ka Form reference, only English) and a sample invoice photo (BD_Invoice.jpeg)
> showing what a document printed on the real physical letterhead looks like.
> Working copy: /home/claude/work/extracted. Final deliverable: zip of that tree (minus
> node_modules/.git) → /mnt/user-data/outputs.
> ENVIRONMENT: no node_modules, no network for the bash tool (confirmed). Global `tsc` available.
> VERIFICATION COMMAND (the one that actually catches real bugs — see note below):
>   tsc --noEmit --allowJs --checkJs --jsx preserve --noResolve --skipLibCheck <file> 2>&1 | \
>     grep -E "error TS2304|error TS2552|error TS2551"
>   Empty output = clean. IMPORTANT: plain `--allowJs` WITHOUT `--checkJs` only catches gross
>   syntax errors, NOT undefined-variable/typo bugs — confirmed directly with a deliberate typo
>   test before trusting it. `--checkJs` alone is too noisy to read raw (this codebase pervasively
>   uses `(opts = {}) => ...opts.x` default-param patterns that TS flags as TS2339/TS2345 on every
>   property access — confirmed false-positive, not a real bug, ignore that specific pattern
>   wherever it recurs). The 3-code grep above is the calibrated signal: confirmed quiet on
>   untouched baseline files, confirmed it catches a deliberate typo.
> This file replaces keeping a separate ROADMAP.md — that file (at /home/claude/work/ROADMAP.md,
> not part of the deliverable zip) has the blow-by-blow investigation log if anything here needs
> more detail than what's written below.

## THE TASK — 9 reported bugs, verbatim numbering kept as given
1. Product search/autocomplete for packing list product rows always shows "No catalog match".
2. "Incentive After Costing" → BDT (internal, not part of the Ka Form itself) is mislabeled
   "Payable Incentive (BDT)" (should be "Receivable Incentive (BDT)") and should use a LIVE
   currency rate until an admin sets a manual rate.
3. Editing Name of Goods / Quantity of Goods (KG) / anything on the Incentive Details page reloads
   the whole page.
4. Ka Form layout doesn't match the provided reference PDFs exactly (English AND Bengali); "FC"
   labels should read "in Foreign Currency".
5. Stamp Application must be exactly 3 pages, matching the reference PDF's own pagination.
6. Bengali rendering of both the Ka Form and Stamp Application is broken/unreadable.
7. Incentive amount doesn't appear on Shipment Details or count in Export Analytics; should be
   written into every member shipment once its Incentive Application is marked Claimed.
8. Need a way to delete a shipment from the Export Archive page, logged to the audit log, and
   recoverable (recycle bin).
9. PDF generation should stop synthesizing a header in code (logo/name/address/phone/banner/
   table) — use the admin's uploaded company letterhead image as the actual page background,
   full width, original aspect ratio preserved (no crop/stretch), on every generated PDF page.

## STATUS: all 9 done and verified this session.

---

## Issue 9 — Letterhead as PDF background (done first — foundational, touches every PDF generator)

**New shared module**: `lib/pdfLetterhead.js` — `loadImageForPdf(url)` (fetch → data URL + real
pixel dimensions) and `drawLetterheadBackground(doc, letterhead, pageWidthMm, pageHeightMm)` (draws
full-bleed at the top of the CURRENT page, width = full page, height DERIVED from the image's own
aspect ratio — never distorted, capped only by physical page height — returns the Y content should
start at: `min(max(renderedHeight + 5mm, 38mm), 90mm)`, a fixed reasonable floor/ceiling rather than
literally "wherever the image ends", since a real letterhead's blank content zone doesn't scale
linearly with the graphic's own height). Used identically by every PDF generator now.

**Root cause of the old behavior**: `drawHeader()` in `lib/exportDocuments.js` only used an upload
at all when width/height ratio ≥ 2 (i.e. banner-shaped), capped at a hardcoded 32mm — anything else
fell through to a fully coded green-rect + drawn company name/address "banner fallback". The Stamp
Application's own letterhead placement (`lib/kaFormDocuments.js`) drew it at a hardcoded 30mm height
regardless of native aspect ratio (the literal "don't stretch it incorrectly" bug). Both deleted;
replaced with the shared module. The coded banner fallback is GONE, not deprioritized — per the
explicit instruction, if no letterhead is uploaded yet, content just starts at the normal small
margin with no header graphic of any kind.

**Cloudinary preset widened**: `lib/cloudinary.js`'s `letterheads` preset was `{width:1200,
height:400, crop:'fit'}` — a landscape-biased box that would crush any portrait/full-page-shaped
upload. Changed to `{width:2480, height:3508, crop:'limit', quality:95}` (`limit` only ever scales
DOWN an oversized source and never crops/distorts; 2480×3508 ≈ A4 at 300dpi, a generous ceiling).

**Files**: `lib/pdfLetterhead.js` (new), `lib/cloudinary.js`, `lib/exportDocuments.js` (drawHeader
rewritten, `didDrawPage` hooks added to both autoTable calls so a packing list spilling onto page 2+
still gets the letterhead on every page), `lib/kaFormDocuments.js` (both generators),
`app/admin/export-dashboard/page.jsx` (upload help text updated to describe the new behavior
accurately), `app/admin/export-dashboard/incentives/[applicationId]/page.jsx` (both panels now
actually fetch `/api/settings` for `exportLetterheadUrl` and thread it through — the Stamp
Application's `letterheadDataUrl` param existed in the function signature already but no caller
ever actually passed it; it was dead code before this).

---

## Issues 4, 5, 6 — Ka Form + Stamp Application (the largest piece of this batch)

**Investigation method**: rasterized all 4 reference PDFs (`pdftoppm -r 150`) and read them
visually/zoomed rather than trusting `pdftotext` extraction — confirmed the same "reorders/garbles
complex Bengali conjuncts on copy-out even though the PDF itself is clean" phenomenon
`KA_FORM_AND_STAMP_REFERENCE.md` already flagged for the Stamp Application also applies to the new
Bengali Ka Form reference. Cross-checked pixel colors directly (`PIL`) for things like table header
fill and measured real row heights in mm from the rendered pixels (not estimated) when tuning
Bengali/A4 table density.

### Issue 6 — Bengali rendering, root cause and fix
jsPDF's built-in fonts have zero Bengali glyphs (→ blank/broken text). Embedding a Unicode Bengali
font on its own is STILL not enough — jsPDF has no OpenType shaping engine at all (no GSUB
conjunct-ligature substitution, no Indic vowel-sign reordering), so it would draw one glyph per
Unicode codepoint in logical string order regardless of font, which is wrong for real Bengali
(conjuncts and the pre-base vowel sign ি are basic to the script).

**Fix**: `lib/bengaliText.js` — renders Bengali (or any string containing Bengali chars — see
`hasBengaliChars`) to an offscreen `<canvas>` using a bundled web font first, letting the BROWSER's
own text-shaping engine do the work (the same one used for regular page text), then exports the
canvas as a PNG and embeds it via `doc.addImage()` instead of `doc.text()`. Pure-Latin/number
strings skip this entirely and stay fast vector text.

**Font**: `public/fonts/FreeSansBengali.ttf` — GNU FreeSans (`/usr/share/fonts/truetype/freefont/
FreeSans.ttf` on the build sandbox), NOT extracted from the user's own PDFs (checked first: the
embedded "Mukti"/"muktibold" fonts in the Bengali Ka Form PDF have literally no cmap table at all —
a dead end for reuse). FreeSans has a full Bengali cmap (95 codepoints) and GSUB tables with the
right script/feature tags (`beng`/`bng2`, `akhn`/`blwf`/`half`/`pref`/`rphf`/`vatu`/etc. — checked
directly with `fontTools`, not assumed). Subsetted to Bengali + basic Latin/punctuation with
`pyftsubset --layout-features='*'` (preserves the shaping tables) — 1.8MB → 218KB. **Verified**,
not just assumed correct: rendered real Bengali test strings containing known-tricky conjuncts
(ক্ষ, ঞ্চ, ন্দ্র, ত্ত্ব, ন্ধ, র্ম) through `wkhtmltopdf` (a real WebKit/shaping-capable engine) with
this exact font file before trusting it in the app. License note in `public/fonts/FONT_LICENSE.txt`
(GNU FreeFont, GPL + font-embedding exception).

Bold: FreeSansBold has ZERO Bengali coverage, so there's no real bold Bengali face — `renderBengaliLine`
uses a stroke-over-fill technique (fillText + strokeText at a modest lineWidth) for a clean heavier
weight instead, rather than a smeared double-draw.

### Digit convention — confirmed field-by-field, not "Bengali = Bengali digits everywhere"
Zoomed into individual cells of the real reference to confirm this precisely (it's easy to get
backwards and was clearly not fully correct before):
- **Ka Form** (both language references): serial/SL numbers, BDT/Taka amounts, and the bank's
  exchange rate → Bengali numerals when lang=bn. Foreign-currency amounts, dates, quantities/KG, and
  reference codes (TT/EXP/AWB/contract/ERC numbers) → ALWAYS Latin numerals, even in the Bengali
  form. `lib/kaFormDocuments.js` now has `moneyFC()` (always Latin, for FC values) split from
  `formatMoney()`/`MBDT` (Bengali-aware, for BDT/rate values) — used precisely per field, including
  within a single composed string that mixes both (Section H's rate line).
- **Stamp Application** (bn reference): genuinely everything (dates, EXP numbers, amounts) is
  Bengali numerals — this was already correct in the existing code, EXCEPT the currency-code token
  (`CCY`) had no digits to convert so it silently stayed "EUR" instead of becoming "ইউরো" (the real
  form spells the currency name out in Bengali). Fixed with a small `ccyLabel()` map
  (EUR/USD/GBP/INR/PKR/BDT/AED/SAR → their Bengali names).

### Ka Form structural differences confirmed (English vs Bengali) — see file comments for detail
- Page size: English A3 (unchanged), Bengali A4 (was incorrectly sharing English's A3 constants).
- Section C (TT list): English splits into two side-by-side tables past 5 rows (left column is
  always exactly 5 rows, confirmed visually); Bengali keeps one full-width table always (narrower
  page, no room to split).
- Section E: English 7 columns; Bengali 6 (EXP No./date and repatriated value/date merge into one
  stacked cell) — `sectionERows` (en) vs `sectionERowsBn` (bn) in `assembleKaFormData`.
- Section F: **was actually wrong for BOTH languages**, not just a Bengali gap — the previous
  implementation only had 3 real columns (Airway Bill, Repatriated, Freight) with the other 3
  figures (Commission, Net FOB, Incentive) squeezed into one merged footer text line. Both reference
  PDFs clearly show a real 6-column table (Airway Bill + 5 numbered figure columns, "1 2 3 4 5" sub-
  header row) with each shipment's own row carrying all 5 figures. Rebuilt to match — in the PDF
  (autoTable with `rowSpan` for English, the new hand-rolled `bnDrawGridTable` for Bengali), DOCX,
  AND XLSX (all 3 shared the same wrong 3-column shape before). Per-row Net FOB/Incentive use the
  SAME formula `calculateIncentiveCosting` (lib/incentiveUtils.js) already uses at the aggregate
  level (repatriated − freight, commission not distributed per-row — confirmed from that function
  directly, not guessed), so the new per-row figures are consistent with the existing totals.
- Section H: English keeps long descriptive column headers directly (no numbered sub-row, no
  caption — the citation already sits under the title). Bengali uses short numbered headers
  (referencing Section F's own 1-5 numbering) with a caption line AND the citation placed just above
  this table instead of under the title — confirmed visually, a real structural difference.
- Table header/footer fill: gray `rgb(232,232,232)` sampled directly from the reference pixels —
  was plain white.
- Every "(FC)" abbreviation → full "...in Foreign Currency" wording matching the real forms' exact
  headers (issue 4's literal ask) — fixed in the PDF, DOCX, and XLSX generators.
- `DEFAULT_KA_FORM_TEXT.bn` fully replaced with text transcribed from the real reference (previous
  version was flagged in its own comment as "no reference sample... my own translation guess" —
  that reference now exists). Bengali subtitle is one combined line (not two like English); section
  headings use "ঃ" (visarga) not a Latin colon; Bengali section LETTERS are the real ক/খ/গ/ঘ/ঙ/চ/ছ/জ,
  not transliterated A-H.

### Bengali tables: new hand-rolled `bnDrawGridTable`, not autoTable
autoTable's own column-width/row-height algorithm measures text using jsPDF's loaded (Latin-only)
font — it has no way to account for a cell whose real content is an embedded canvas image. Rather
than fight that, Bengali tables in the Ka Form are drawn with a small hand-rolled bordered-grid
function that computes widths/heights itself and chooses per-cell between a canvas image (Bengali
content) or plain vector text (Latin/numeric content). English tables are completely unaffected —
still autoTable, exactly as before, just with the styling/label/structure fixes above.

**Density tuning + safety net**: Bengali/A4 table padding and a couple of font sizes were tightened
(measured real reference row heights in mm from rendered pixels to calibrate, rather than guessing)
so a typical application still fits the single page the reference itself is. An `ensureSpace()`
pagination guard was ALSO added before each major section (both languages) that starts a fresh page
(redrawing the letterhead) if a section is about to run out of room — a safety net, not the expected
common case, since an unusually large application has no fixed upper bound on shipment/TT-entry
count and silently drawing content off the bottom of the page would be a much worse failure mode
than gracefully spilling onto an extra page.

### Issue 5 — Stamp Application forced to exactly 3 pages
Previous pagination was purely `if (y > 265) doc.addPage()` — reproduces roughly the right length
but not reliably an exact page count. Fixed by inserting an explicit `{{PAGE_BREAK}}` sentinel
paragraph into `DEFAULT_STAMP_TEXT` (both languages) at the same 2 points the real documents
actually break (confirmed from `pdftotext`'s own form-feed positions in both reference PDFs — after
paragraph 1; after the Applicant/নিবেদক signature line). The PDF/DOCX/XLSX generators all detect this
marker: PDF forces `doc.addPage()` + redraws the letterhead there; DOCX inserts a real `PageBreak()`;
XLSX just drops it (Excel has no page concept for a flowing text document). A custom admin text
override (via the existing text-override feature) won't contain the marker, so the old y>265
overflow pagination remains as a graceful fallback for that specific case.

**Files**: `lib/kaFormDocuments.js` (everything above lives here — this was close to a full
rewrite), `public/fonts/FreeSansBengali.ttf` + `FONT_LICENSE.txt` (new).

---

## Issue 1 — Product search always "No catalog match"

`lib/utils.js`'s `buildProductQuery()` used `isActive: true` (exact match) — MongoDB does not treat
a missing field as matching an exact-value filter, and Mongoose's schema `default: true` is a
write-time behavior only, never retroactively applied to a query against a document that never
actually had the field persisted (anything not created through the app's own product-creation code
path — a direct DB write/import, or anything predating when the field was added). Every OTHER
boolean visibility flag in this exact same function (`availableForLocal`/`availableForInternational`,
a few lines below) already used `{ $ne: false }` specifically to stay correct for that same class of
document — `isActive` was the one inconsistent holdout. Changed to match. Also fixed 2 assertions in
`tests/unit/utils.test.js` that were already stale against the current (pre-existing, unrelated to
this fix) `availableForLocal`/`availableForInternational` `$ne:false` behavior, noticed while there.

**Files**: `lib/utils.js`, `tests/unit/utils.test.js`.

---

## Issue 2 — "Receivable Incentive (BDT)" rename + live rate

A live exchange-rate hook (`useLiveRate`, → `/api/currency` → `lib/exchangeRates.js`, with DB
caching and a static fallback — a genuinely solid pre-existing piece of infrastructure) was already
being called and its result DISPLAYED in a small rate card on the Incentive Details page, but never
actually fed into the incentive calculation — `effectiveRateBDT` only ever consulted
`resolveEffectiveRateBDT()` (manual rate → claimed-and-locked rate → the shipment's own stored,
manually-typed-once rate; no notion of "live" at all). Fixed by computing the effective rate in the
page itself with the correct priority: manual rate (always wins) → claimed+locked rate (a finalized
historical figure, shouldn't keep moving after the fact) → live rate (the common "still deciding"
case) → the shipment's stored rate (last-resort fallback only if live hasn't loaded yet or the fetch
failed). Deliberately did NOT change `resolveEffectiveRateBDT` itself, since it's shared with the Ka
Form PDF generator, which needs to stay deterministic (a generated document shouldn't reflow to a
different number if reopened later) — the "prefer live" logic lives only in this page's own preview.
Label changed to "Receivable Incentive (BDT)".

**Files**: `app/admin/export-dashboard/incentives/[applicationId]/page.jsx`.

---

## Issue 3 — Whole page reloading on every field edit

Root cause: `load()` (the "refetch the application from the server" function, called after every
save — Name of Goods, Quantity, the manual rate, uploads, and the Ka Form/Stamp Application panels'
own `onSaved` callback) set the exact same `loading` state as the page's true INITIAL load, and
`if (loading) return <Loader />` a few dozen lines down in the same component unmounts literally
everything under it whenever that flag is true. So saving so much as one field replaced the whole
page with a spinner and then remounted everything from scratch on completion — which is exactly what
reads as "the whole page reloads". The actual refetch-after-save is correct and necessary (the PUT
route recomputes the whole group's incentive distribution server-side, so the client needs the fresh
numbers back) — only the full-page loading GATE around it was wrong. Fixed by making `load()` silent
by default (just updates `application` state in place — the same smooth re-render as any other prop
change) and only having the one genuine initial-mount call explicitly opt into the full-page loader
(`load({ showLoader: true })`). No other call site needed touching.

**Files**: `app/admin/export-dashboard/incentives/[applicationId]/page.jsx` (same file as issue 2 —
both fixed in the same pass since they're adjacent in the same component).

---

## Issue 7 — Incentive not appearing on Shipment Details / not counted in Export Analytics

Root cause, found by tracing the already-existing cascade architecture rather than assuming it was
missing: `lib/utils.js`'s `calculateShipmentFinancials()` computes `netProfit = shipmentMargin +
incentive` (correctly USING the incentive value) but never actually included `incentive` itself in
its own returned object. Every caller that persists the result via `{...computed}` — critically
`cascadeRecomputeShipments` in `lib/incentiveServer.js`, which already correctly computes each
shipment's distributed share of an application's incentive via `calculateIncentiveCosting` and is
already wired to run on application create/manual-rate-change/claim/unclaim/pending-shipment-edit
(all from batch 9) — was therefore silently never writing `incentive` to the database at all, no
matter how correctly the surrounding distribution logic had just calculated it. Shipment Details
reads `shipment.incentive` directly (now correctly populated); Export Analytics sums that exact same
stored field directly too (confirmed it does NOT read `computed.incentive` — no separate analytics-
route bug, it just needed the underlying stored value to actually be correct, which it now is).
One field added to a return statement fixes both. Checked all 4 call sites of
`calculateShipmentFinancials` — safe everywhere (either already passing the right value straight
through unchanged, or directly benefiting).

**Files**: `lib/utils.js`.

---

## Issue 8 — Delete shipment from Export Archive, audit log, recycle bin

Found the entire backend already existed and was already correct: `app/api/export/shipments/[id]/
route.js`'s DELETE handler already snapshots to `ExportRecycleBin` and writes an `ExportAuditLog`
entry via `moveToRecycleBin()` (which does both in one call), with server-side guards already in
place refusing to delete a draft/claimed/locked/pending-incentive shipment. A full Recycle Bin
restore UI already exists too, as a tab on the Audit Log page
(`/admin/export-dashboard/audit-log`). The ONLY actual gap was the Export Archive page itself never
exposing a delete button to call that already-correct endpoint. Added one (a `Trash2` icon +
`window.confirm`, matching this codebase's own established delete-confirmation pattern from the
buyer/contract page — no new UI pattern introduced), wired to the existing DELETE route, removes the
row from the local list and toasts on success, surfaces the server's own guard message on failure.
Added a small "Restore it →" link pointing at the Audit Log page for discoverability.

**Files**: `app/admin/export-dashboard/archive/page.jsx`.

---

## Full list of files touched this batch
- `lib/pdfLetterhead.js` (new)
- `lib/bengaliText.js` (new)
- `public/fonts/FreeSansBengali.ttf` (new)
- `public/fonts/FONT_LICENSE.txt` (new)
- `lib/cloudinary.js`
- `lib/exportDocuments.js`
- `lib/kaFormDocuments.js` (largest change — close to a full rewrite)
- `lib/utils.js`
- `tests/unit/utils.test.js`
- `app/admin/export-dashboard/incentives/[applicationId]/page.jsx`
- `app/admin/export-dashboard/archive/page.jsx`
- `app/admin/export-dashboard/page.jsx` (letterhead help text only)
- `PROJECT_STATUS.md` (§18 added)

## Known gaps / judgment calls, flagged honestly rather than silently glossed over
- A handful of the Ka Form's smaller italic note-field translations (particularly `noteE`) were
  reconstructed from a corrupted text extraction plus grammatical judgement rather than a fully
  certain pixel-level zoom read — the main headings, section labels, declaration, and signatory
  lines ARE directly visually confirmed. The existing admin text-override feature
  (`resolveKaFormText`) is exactly the intended fix path if any small wording still doesn't match
  the admin's actual paper form.
- Did not extend the letterhead-as-background change to the separate HTML print view
  (`app/(print)/print/export/[shipmentId]/page.jsx`) — issue 9 specifically scoped this to "the PDF
  generator"; flagging the print view as a place to apply the same treatment later if wanted.
- Code comments elsewhere in this codebase use an "R__" numbering for individual fixes within a
  batch; this batch is R24 (continuing directly from batch 9's R18-23, documented in
  `PROJECT_STATUS.md` §17).
