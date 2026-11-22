# AGENT PROGRESS 23 — Implementation tracking

Client request via the claude.ai Project "SI" (description: "Website features and fixes
deployment"), delivered as a zip of the v35 site plus a reference PDF ("Commercial Invoice" /
"Packing List" sample showing a "Bangla Name (বাংলা নাম)" column). Four parts:

1. All date formats site-wide → DD/MM/YY.
2. All currency displays site-wide → 2-decimal (`0.00`).
3. Add "Bangla Name" to Packing List, Buyer's Invoice, and BD Invoice (the "Bangla invoice").
4. Shipment Details page: 2 price rows — BD Price and Buyer's Price — allowed to differ from each
   other, but each must stay internally consistent with its own document's printed total.

Project's standing instructions: read the provided file carefully, make a roadmap, track every
command (this environment has repeatedly lost context mid-round), resume exactly where stopped on
"continue", and deliver a complete, working site as a zip at the end. This file is that tracker —
if interrupted, resume at the first unchecked step below.

**Environment constraints the whole round worked under:** Bash network access is OFF (no npm/pip
install — no `node_modules`), so nothing could be build- or runtime-tested. Verification is static
syntax checking only, via `/home/claude/.npm-global/bin/tsc --noEmit --allowJs --jsx preserve
--noResolve --target es2020 --module esnext "<file>"` on every touched file. The working directory
is not a git repo, so there's no `git diff` to lean on for "what changed" — tracking is manual
(this file + grepping for the new shared helpers' usage).

## Roadmap / steps

- [x] 1. Read the reference PDF and the zip's existing code structure (Export Dashboard: Country →
      Buyer → Export Contract → Shipments; documents are Packing List, Buyer's Invoice, BD Invoice;
      Ka Form/Stamp Application is a separate, unrelated incentive-claim document type). Confirmed
      interpretations (none contradicted by the user since, all still flagged in the final summary
      delivered to them): "Bangla invoice" = BD Invoice (not a 4th document type); Bangla Name = a
      new table COLUMN (matching the reference PDF's own layout), not a literal new table row;
      "2 price rows" = 2 summary display cards on Shipment Details, not per-item dual pricing.

- [x] 2. Built the shared formatting layer in `lib/utils.js` — `formatDate` (date-fns `'dd/MM/yy'`,
      returns `''` for missing/invalid input), `formatMoney2` (`Number(x||0).toLocaleString('en-US',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 })`), and `formatBDT`/`formatUSD`/
      `formatCurrency` convenience wrappers around it. Every other step below consumes these rather
      than reimplementing date/currency formatting per file.

- [x] 3. Bangla Name column — added to all 3 document generators that matter:
      `lib/exportDocuments.js` (the real PDF/DOCX/XLSX generator, single source of truth for
      Download + Archive) and the `/print` preview page (`app/(print)/print/export/[shipmentId]/
      page.jsx`), on Packing List unconditionally and on Buyer's Invoice / BD Invoice gated by the
      same `isBuyer || isBdProductMode` flag botanical name already used (BD Invoice's
      Category-HS-Code mode shows category rows, not individual products, so neither botanical nor
      Bangla name applies there — consistent with the existing botanical-name rule, not a new
      special case).

- [x] 4. BD/Buyer price summary — added a "Price Summary" card to the Shipment Details page
      (`.../shipments/[shipmentId]/page.jsx`) with 2 side-by-side totals, "Total BD Price" and
      "Total Buyer's Price", each wired directly to the same number (`bdTotalValue` /
      `itemsTotalValue`) its own document prints — not a separately-computed figure that could
      drift. Explicit on-screen note that the two are independent and allowed to differ. Confirmed
      the existing BD-vs-Buyer mismatch warning (if any existed from an earlier round) does not
      fire for this specific pair, per the client's instruction.

- [x] 5. Site-wide date sweep (DD/MM/YY) and currency sweep (2-decimal) — the bulk of this round,
      done in passes across the codebase grouped roughly by area (shop-facing pages, core admin
      pages, export-dashboard admin pages, then API export/report routes), each file: import
      `formatDate`/`formatMoney2` from `@/lib/utils` (or `./utils` from inside `lib/`), replace the
      raw `toLocaleDateString`/`format(d, 'dd MMM yyyy')`/bare `.toLocaleString()` call, verify with
      `tsc`. ~45 files touched in total; the full list is reconstructable via `grep -rlE
      "formatDate|formatMoney2|formatBDT|formatUSD|formatCurrency"` across `app/`, `components/`,
      `lib/` (a handful of those hits are unrelated same-named locals from `useCurrency()`, not this
      round's helpers — harmless overlap, not a tracking error).

- [x] 6. Mid-round, 4 parallel `fork` sub-agents were launched to parallelize the remainder of step
      5. All 4 hit this account's rate limit together and were cut off mid-file; worse, they proved
      unresumable afterward (`SendMessage` to each returned "this session has no saved settings for
      agent X... start a new agent"). Recovered by auditing their actual (partial) work directly
      rather than trusting their own narration: `grep` for the shared-helper imports to find
      candidate files → batch `tsc` for syntax sanity → full `Read` spot-checks to find files where
      an import had been added but 1-2 usages never actually converted (found and completed in
      `app/admin/flash-sales/page.jsx`, `app/admin/export-dashboard/analytics/page.jsx`, and —
      caught only in this round's final sweep, step 8 below — `app/(shop)/messages/page.jsx`).
      Decision made not to relaunch parallel forks afterward (same rate-limited capacity as the main
      session; likely contributed to hitting the limit faster) — all remaining step-5 work was done
      serially, in-thread, across several "continue" cycles.

- [x] 7. Finished the last tracked stragglers from step 5 after the fork incident: Export Dashboard's
      country→buyer→contract hierarchy pages (`buyers/[buyerId]/page.jsx`,
      `.../contracts/[contractId]/page.jsx`) and `ExportLicenseSection.jsx`; then the 4 API export
      routes (`app/api/admin/customers/export/route.js`, `app/api/admin/orders/export/route.js` —
      both fixed; `app/api/export/analytics/route.js`, `app/api/admin/export-overview/route.js` —
      read in full and confirmed they return raw numbers to an already-fixed frontend, so correctly
      need zero changes; their only date-like output is a chart/grouping label, not a display).

- [x] 8. Final whole-codebase verification sweep, done deliberately BEFORE declaring step 5 complete
      rather than trusting the tracked file list alone — broad greps for `toLocaleDateString`, bare
      `toLocaleString()`/`.toFixed(0)` on anything money-shaped, remaining date-fns `format(...,
      'dd MMM...')` calls, `getDate()`/`getMonth()` manual date concatenation, and both
      currency-symbol-prefixed (`৳`/`$`/`€`/`£`/`₹`) and currency-code-prefixed (`{currency}
      {amount}`) raw JSX interpolations with no formatter call. Found and fixed several stragglers
      the tracked list had missed:
      - `app/(shop)/messages/page.jsx` — an incomplete fork edit: `formatDate` had been imported but
        the one date display in the file was never actually converted.
      - `components/admin/export-settings/ExportCategorySection.jsx` — category card's "App. Cost"/
        "Other" cost figures.
      - `components/admin/export-settings/CtnConfigSection.jsx` — CTN cost table column.
      - `app/(shop)/products/compare/page.jsx` — "Import Price Range" row.
      - `lib/auditDiff.js` — the `ttEntries` (TT payment entries) array summary's total; left its
        sibling generic numeric-value formatter alone (see exemptions below).
      Also explicitly re-verified (no changes needed, already correct from earlier rounds or by
      design): `contexts/CurrencyContext.jsx` (`format`/`formatUSD` — the main shop price
      formatter, already 2-decimal), `components/product/PriceDisplay.jsx` (consumes that context
      correctly everywhere), cart/checkout pages (same), `lib/exportDocuments.js` and the `/print`
      page (already both DD/MM/YY and 2-decimal via their own established `.toFixed(2)` convention),
      the Shipment Details page's Price Summary card from step 4 (already `.toFixed(2)`).

- [x] 9. Ran a final batch `tsc` pass across every file touched (38 files found via the shared-helper
      grep, plus every file edited in steps 3/4/7/8 individually as each was edited) — all clean, no
      syntax regressions.

- [x] 10. Documentation + packaging (this round's closing step): this file; a new dated section in
      `PROJECT_STATUS.md` (§31, "Batch 23"); a roadmap/handoff doc written to the claude.ai Project
      itself (not just this repo, since the Project had zero docs before this round); a fresh zip of
      the complete site; delivered to the user with the interpretation/exemption decisions disclosed
      up front (see `PROJECT_STATUS.md` §31's "Deliberate exemptions" for the full list — Ka Form/
      Stamp Application's own date convention kept as-is, `<input type="date">` values staying ISO,
      chart/percentage/month-label displays staying as they were, the Orders Export spreadsheet's
      currency columns staying native numbers rather than 2-decimal text, and `.toFixed(2)` vs.
      `formatMoney2` in the document generators).

## If this gets interrupted again

Everything above is done — there is no unchecked step left in this round. A fresh agent picking
this up should treat the 4-part request as COMPLETE and verify via `tsc` (per-file command above)
before making further changes, not re-run the whole sweep from scratch. `PROJECT_STATUS.md` §31 is
the authoritative summary of what changed and why; this file is the step-by-step trace of how.
