# AGENT PROGRESS TRACKER — Shah International — Batch 12 (R26): letterhead gap/2-page print fix,
# missing campaigns root-caused (isActive query bug + a real timezone bug).
> READ THIS FILE FIRST on every resume/continue, then AGENT_PROGRESS_11.md, then _10.md, then
> PROJECT_STATUS.md §1-20 for everything before that.
> Source: batch 11's own output, plus one new uploaded file this round — an actual DOWNLOADED
> Packing List PDF (Packing-List-SI-2026-6285.pdf), used to measure the reported margin bug
> precisely rather than guess at it.
> Working copy: /home/claude/work/extracted. Final deliverable: zip of that tree (minus
> node_modules/.git) → /mnt/user-data/outputs.
> VERIFICATION COMMAND (see AGENT_PROGRESS_10.md for why this exact form):
>   tsc --noEmit --allowJs --checkJs --jsx preserve --noResolve --skipLibCheck <file> 2>&1 | \
>     grep -E "error TS2304|error TS2552|error TS2551"
>   Full-codebase re-sweep at the end of this batch came back byte-identical to the known 7-hit
>   baseline established in batch 10 (all in files no batch has ever touched) — zero new issues.

## THE 2 ISSUES THIS ROUND
1. Print preview/printed Packing List, BD Invoice, Buyer's Invoice show as 2 pages — page 1 is just
   the letterhead, page 2 is the actual content. The downloaded PDF (attached, an actual real
   output) is "almost correct" but has too large a top margin — "1 inch margin is fine". Print
   should match the PDF once the margin is fixed.
2. "My campaign sections are not appearing in the user UI" — a new, previously-unreported bug (not
   a follow-up on prior work).

## STATUS: both done and verified this session.

---

## Issue 1 — letterhead gap + print 2-page overflow

**Measured the actual bug directly rather than estimating**: rasterized the attached PDF
(`pdftoppm`) and measured pixel positions with PIL. The green banner graphic ends at ~20.5mm down
the page; the "Packing List" title doesn't start until ~86.5mm — a 66mm (2.6") gap, not the "1 inch"
that's appropriate.

**Root cause**: `lib/pdfLetterhead.js`'s `computeLetterheadLayout` computed `contentStartY =
clamp(renderH + 5, 38, 90)`, where `renderH` is the FULL uploaded image's rendered height at full
page width (derived purely from its own width:height ratio). Backed out what that ratio must
actually be for this specific upload from the measured 86.5mm gap: ~81.5mm rendered height — meaning
the real letterhead FILE is roughly 4x taller than its own visible banner graphic (~20.5mm), i.e. it
has a lot of blank space baked into the file itself past the colored/visible part. Reserving space
proportional to that FULL height (the previous design) was the mistake — it works fine for a
tightly-cropped banner image, but this real upload isn't one, and there's no way to detect "where
does the visible content actually end" from just width/height without real pixel analysis.

**Fix**: replaced the render-height-based clamp entirely with one fixed constant:
```js
export const LETTERHEAD_CONTENT_START_MM = 45; // ~1" past a typical banner's own height
```
exported so it's the one shared source of truth (used by both the PDF path and, new this round, the
print view — see below). The image itself is still always drawn at its own full, undistorted
natural size underneath (`computeLetterheadLayout` still computes `renderW`/`renderH` for that
purpose) — only where CONTENT starts drawing ON TOP of it changed. Since `drawHeader` in
`lib/exportDocuments.js` already just forwards whatever `drawLetterheadBackground` returns as the Y
to start content at, **no changes were needed there at all** — fixed automatically for the PDF
download path by this one shared module.

**The print view had a second, compounding bug specifically causing the 2-page overflow**:
`DocHeader`'s `<img>` was a normal-flow element with `height: 'auto'` — so its own ~81.5mm-
equivalent rendered height was physically pushing the title/info-grid/table down by that same
amount in the page's REAL layout (not just visually creating a gap — actually consuming that much
vertical space in the document flow). With everything shifted down that far, the combined content
no longer fit within one printed page's height, so the browser's own print pagination pushed the
overflow onto page 2 — matching "page 1 is just the letterhead, page 2 is the content" exactly.

Fixed in `app/(print)/print/export/[shipmentId]/page.jsx`:
- `DocHeader`'s `<img>` is now `position: absolute` (taken out of normal document flow entirely —
  its own height can no longer affect layout or pagination), plus a small spacer `<div>` (normal
  flow) that reserves the actual clearance.
- Added `position: relative` to the outer per-document container (`maxWidth: '210mm', padding:
  '12mm', ...`) so the absolutely-positioned image anchors to that specific box, not the whole page.
- Worked through the CSS math specifically rather than assuming it would just line up: an absolutely
  positioned element's `top`/`left`/percentage-`width` all resolve against its containing block's
  PADDING box (i.e. it deliberately ignores/spans across the ancestor's own padding — this is
  actually the desired "full bleed" behavior here, matching the PDF's own edge-to-edge letterhead
  placement), whereas the spacer `<div>` is a NORMAL flow child and so DOES sit inside that same
  12mm padding. That means the spacer alone needs `LETTERHEAD_CONTENT_START_MM - 12` (`33mm`), not
  the full `45mm`, so that spacer-height + already-present-padding together land content at the same
  effective 45mm offset the PDF generator uses — not 12mm further down than that. Introduced a
  `CONTAINER_PADDING_MM = 12` constant so this relationship stays explicit and won't silently drift
  if the container's own padding value is ever changed later.
- `LETTERHEAD_CONTENT_START_MM` is imported directly from `lib/pdfLetterhead.js` rather than
  redeclared — print and download are now guaranteed to agree, not just coincidentally similar.

**Files**: `lib/pdfLetterhead.js`, `app/(print)/print/export/[shipmentId]/page.jsx`.

---

## Issue 2 — campaigns not appearing (2 real, separate bugs)

First established the terminology: there's no separate "Campaign" model — the admin's own Campaigns
page (`app/admin/flash-sales/page.jsx`, literally titled "Campaigns" in its own UI, "New Campaign"
button, etc.) manages the `FlashSale` model. Customer-facing, this renders as `FlashSaleSection` on
the homepage and `ActiveCampaignsStrip` on product detail pages. Traced the full pipeline end to end
(server query → prop → client buyer-type filter → render) before concluding where the actual bugs
were, rather than guessing at any one layer.

**Bug 1 — same exact-match `isActive` bug already fixed once before (search round), recurring in a
different model.** Found in 3 separate `FlashSale.find(...)` queries, all using bare `isActive:
true` instead of the established `{ $ne: false }` pattern (which is already correctly used a few
lines away in the very same functions, e.g. `buyerVisibilityQuery`'s `availableForLocal: { $ne:
false }`) — meaning any campaign document missing the field entirely (predates it, or was inserted
outside the normal admin-create flow) would be silently excluded from ever appearing anywhere:
- `app/(shop)/page.jsx` (homepage)
- `app/(shop)/products/[slug]/page.jsx` (product-detail campaign strip)
- `app/api/flash-sales/route.js` (the API route the admin list and the component's fallback fetch
  both use)

All three switched to `isActive: { $ne: false }`. Deliberately did NOT expand this to the many other
unrelated `isActive: true` occurrences found elsewhere in the app (Category, SpecialSection, etc.)
while searching — out of scope for what was actually reported, and while `$ne:false` only ever
WIDENS a result set (never narrows it, so it's structurally low-risk), touching unreported code
paths for no confirmed benefit wasn't worth the (small) risk this session.

**Bug 2 — a genuine timezone bug, likely the more impactful of the two for a freshly-created
campaign specifically.** The admin Campaigns page's `DateTimePicker` built a plain
`` `${date}T${time}` `` string (e.g. `"2026-08-09T14:30"`) with NO timezone marker and sent that
directly to the server as the value for a `Date`-typed field. A timezone-naive datetime string is
interpreted as local time in WHATEVER ENVIRONMENT ULTIMATELY PARSES IT — not the environment it was
written in. This server runs on Vercel's Node runtime (UTC), while this business operates from
Bangladesh (UTC+6). So an admin picking "start right now" (their own local time) was unknowingly
having that string reinterpreted as UTC once the server cast it to a real `Date` — storing a start
time 6 REAL HOURS in the future from the server's own perspective. Since every FlashSale query
requires `startTime <= now` to show a campaign, a freshly-created one wouldn't satisfy that
condition for up to 6 hours after creation — a very plausible, direct explanation for "I made this
and it's not showing up."

Fixed in `app/admin/flash-sales/page.jsx`:
- `DateTimePicker`'s write path (`handleConfirm`) now builds a real `Date` via
  `new Date(year, month-1, day, hours, minutes)` — the browser's own local-time constructor,
  correctly interpreting those picked values in the ADMIN's actual timezone — then normalizes with
  `.toISOString()` before calling `onChange`. That produces an unambiguous, timezone-aware value
  that resolves to the exact same absolute moment no matter where it's later parsed.
- The same component's read/display path now uses the `Date` object's own local getters
  (`getFullYear`/`getMonth`/`getDate`/`getHours`/`getMinutes`) instead of slicing the raw ISO
  string (which is always UTC, and would show the wrong time back to an admin outside UTC+0).
- Found + fixed a third, related bug this uncovered while checking every other place `startTime`/
  `endTime` are touched in this file: `openEdit()` (populating the form when reopening an existing
  campaign) was ALSO pre-converting via `.toISOString().slice(0, 16)` before handing the value to
  the picker — stripping the "Z" and leaving a naive-but-UTC-valued string, which the NOW-correct
  picker would (correctly, per its own new local-time handling) interpret AS local time all over
  again — silently reintroducing the same 6-hour-class error on every single re-edit, even after
  the write-path fix above. Fixed by passing the raw stored value straight through unmodified —
  the picker's own (now correct) conversion is the only place this needs to happen.
- Confirmed the rest of the pipeline was already correct, not part of the bug:
  `isCampaignVisibleToBuyer`/`isProductVisibleToBuyer` (`lib/utils.js`), the `campaignAudienceQuery`
  buyer-targeting filter (defaults to no restriction for guests/unset buyerType, matches the
  intended design), and the server→client prop wiring on both the homepage
  (`HomeClientWrapper.jsx`) and product-detail page (`ProductDetailClient.jsx`).

**Files**: `app/(shop)/page.jsx`, `app/(shop)/products/[slug]/page.jsx`,
`app/api/flash-sales/route.js`, `app/admin/flash-sales/page.jsx`.

---

## Full list of files touched this batch
- `lib/pdfLetterhead.js`
- `app/(print)/print/export/[shipmentId]/page.jsx`
- `app/(shop)/page.jsx`
- `app/(shop)/products/[slug]/page.jsx`
- `app/api/flash-sales/route.js`
- `app/admin/flash-sales/page.jsx`
- `PROJECT_STATUS.md` (§20 added)

## Known gaps / judgment calls, flagged honestly
- The `isActive: true` exact-match pattern almost certainly exists in other, unrelated models too
  (Category and SpecialSection were both spotted using it while searching for the FlashSale
  instances) — not touched this round since neither was actually reported as broken. Worth
  proactively fixing in a future round if it's ever raised, or as a standalone cleanup pass.
- The 45mm `LETTERHEAD_CONTENT_START_MM` constant is a considered, measured default (banner height
  ~20mm + ~1" clearance) but is still necessarily a guess for any OTHER admin's differently-shaped
  letterhead upload — a genuinely tall letterhead with real visible content past 45mm would have
  that content overlapped by whatever text starts drawing at the fixed offset. This is an accepted,
  explicit trade-off (matches the explicit "1 inch is fine, reduce the gap" direction this round),
  not an oversight — flagging it as a real limitation of a fixed-constant approach regardless.
