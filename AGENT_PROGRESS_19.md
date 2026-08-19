# AGENT PROGRESS TRACKER — Shah International — Batch 19 (R33)
# 13 numbered items from the user's new document (item 8 is blank/empty in their source — skip,
# not a typo on my part, verified by re-reading the raw doc). This is a LARGE batch, comparable in
# scope to batch 17. Working directly in /home/claude/work/extracted, which already has every fix
# through batch 18 (delivered as shah-international-v22.zip). Do NOT re-extract v20 — that would
# silently discard batches 17 and 18.
#
# >>> READ THIS FILE FIRST ON EVERY RESUME/CONTINUE. <<<
# Then AGENT_PROGRESS_18.md / _17.md / PROJECT_STATUS.md if more historical context is needed.

## ============ LIVE STATUS ============
CURRENT PHASE: Items 2, 10, 11, 12, 13 DONE (all tsc-verified). Moving to item 3 (collapsible
  admin sidebar sections) next, then 6, 7, 9, then the two big ones (1, 4+5).
LAST COMPLETED STEP:
  - Item 10 (uniform product cards): root cause found and fixed with high confidence.
    components/product/ProductCard.jsx had a hardcoded inline `width: 170px` + `flex-shrink-0` on
    its root element — but EVERY ONE of its 8 consumers (checked all 8 individually) already wraps
    it in their own sizing container (3 grid-based pages use CSS Grid columns; 5 carousel-based
    sections use a `flex-shrink-0 w-48/w-52...` wrapper div) — the card ignoring that wrapper and
    forcing its own fixed 170px is exactly why sizing looked inconsistent. Changed to `w-full`,
    letting every consumer's own already-correct wrapper be the single source of truth.
  - Item 11 (local name in brackets): added to ProductCard's title. Also checked EVERY product
    data source that feeds any of the 8 consumers for whether `localName` is actually selected —
    found it missing from exactly 2 (the homepage's FlashSale and SpecialSection populate() calls)
    and added it there; every other source (main /api/products route, best-selling, recommended,
    homepage's featured/harvesting/preOrder/categorySections queries, category page, wishlist's
    client store) already returns full documents with no restrictive select.
  - Item 12 (mobile footer 2 columns): components/layout/Footer.jsx grid was `grid-cols-1
    md:grid-cols-2 lg:grid-cols-4` — changed base to `grid-cols-2` (md/lg unchanged). Slightly
    tightened the gap on mobile (gap-6, was gap-10) since columns are now narrower.
  - Item 13 (mobile FAQ 2-then-expand): components/home/FAQSection.jsx's existing 3-column split
    was ALSO what mobile saw (grid-cols-1 stacked the 3 column-divs vertically, each showing ALL
    its FAQs — not 2 total, all of them, 3x over) — this is the actual root cause of "too long".
    Added a NEW mobile-only (`md:hidden`) flat list (2 shown, expand/collapse toggle showing count)
    using the faqs array's natural order (not split into thirds); the existing 3-column grid is now
    `hidden md:grid` (desktop only), completely unchanged internally.
  All 5 touched files (ProductCard.jsx, homepage page.jsx, Footer.jsx, FAQSection.jsx) individually
  tsc-verified clean.
  - Item 2 (Partners carousel restart glitch): root cause found — components/home/
    PartnersSection.jsx used requestAnimationFrame + a manually-tracked pixel position, resetting
    against `track.scrollWidth` READ FRESH EVERY FRAME. Plain <img> tags with no explicit width/
    height don't report their true size until they've actually finished loading, so scrollWidth
    kept GROWING as each partner logo loaded in — the "halfway" reset point kept shifting with it,
    causing repeated premature resets (scroll a bit, snap back, scroll a bit further, snap back
    again...) that looked exactly like "restarts instead of flowing." Replaced with a pure CSS
    @keyframes loop (translateX(0) -> translateX(-50%), added to app/globals.css) — a percentage
    transform is resolved against the track's actual current width continuously at paint time, not
    a value captured once in JS, so it's correct immediately regardless of image load timing.
    Preserved the exact same hover/touch pause UX (including the 1s grace period after touch ends)
    via animationPlayState instead of the old raf cancel/resume. Duration now scales with partner
    count (~4s/logo, 15s floor) for a consistent visual speed regardless of admin-configured list
    length, instead of a fixed px/frame speed that would take longer or shorter depending on total
    content width. tsc clean; CSS brace-balance manually verified (58/58, tsc can't check .css).
  - Item 3 (collapsible admin sidebar sections): added `openGroups` state (default {} = all
    closed) + localStorage persistence (same established pattern as the existing icon-only
    `collapsed` state) to components/layout/AdminSidebar.jsx. Each group's label is now a button
    toggling that group's own open/closed state, with a chevron (matching FAQSection's rotate-180
    convention for consistency) and a small red dot indicator on closed groups that contain a
    pending badge count, so a notification is never silently hidden by a collapsed section. Smooth
    height-transition via max-height, sized generously (32rem) with headroom already accounted for
    item 5's upcoming 8-item Export Dashboard group. Icon-only collapsed mode (the separate,
    pre-existing whole-sidebar concept) deliberately bypasses the accordion entirely — no labels to
    click there, and hiding items too would leave the icon rail empty. tsc clean.
  - Items 6 + 9 (SMTP quotation error / email marketing not sending): investigated together —
    confirmed they share one root: /api/quotation and /api/admin/send-email both call sendEmail()
    in lib/email.js, which creates ONE shared nodemailer transporter from process.env.SMTP_HOST/
    PORT/USER/PASS at module load. The reported error ("535-5.7.8 Username and Password not
    accepted... BadCredentials") is Gmail's standard, unambiguous response when SMTP auth uses a
    regular account password instead of a 16-character App Password (effectively required by
    Google once 2-Step Verification is on, which it now defaults to for most accounts) — this is
    an environment/Google-Account credentials issue, not fixable from code; said so plainly rather
    than pretending otherwise. Two REAL, contained code bugs found and fixed regardless:
    (a) app/api/admin/send-email/route.js used `.replace('{{name}}', u.name)` — a STRING argument
    to .replace() only replaces the FIRST occurrence, so a template mentioning {{name}} more than
    once left literal, unreplaced placeholder text after the first hit. Changed to a global regex
    (/\{\{name\}\}/g). Directly addresses "make sure customer names filled dynamically."
    (b) app/api/quotation/route.js was passing the raw SMTP error message straight through to the
    public-facing customer response (confusing, and a minor implementation-detail leak) — now logs
    the real error server-side (console.error, visible in Vercel Function Logs) and returns a
    friendly, actionable message pointing to WhatsApp/email alternatives instead. Confirmed via
    grep this is the ONLY quotation endpoint (QuotationModal.jsx is its one consumer), so this one
    fix covers the whole flow, including the specific "Taro Stems" product page in the report.
    Both files tsc clean. Will state the Gmail App Password guidance clearly in the final summary.
  - Item 7a (chat auto-scroll bug) DONE: root cause found in BOTH app/(shop)/messages/[id]/
    page.jsx and app/admin/messages/[id]/page.jsx (identical bug, identical fix, both files) —
    `useEffect(() => { bottomRef.current?.scrollIntoView(...) }, [messages])` re-fired on EVERY
    4-second poll, not just when a genuinely new message arrived, because `setMessages(data.
    messages)` creates a fresh array reference every poll (a new JSON parse) even when the content
    is byte-identical to what's already in state — React's effect dependency check is by
    reference, not content. This force-scrolled the user back to the bottom every 4 seconds
    regardless of whether they'd scrolled up to re-read something, which is exactly "gets scrolled
    down automatically." Fixed by changing the dependency to `messages.length` (only genuinely
    changes when a message is actually added — this app never edits/deletes past messages, so
    it's a safe, sufficient, minimal dependency). Both files tsc clean.

## ============ ITEM 7b (file upload, 50MB) — IN PROGRESS, full design below before any more code
## is written, so a resumed session has the complete plan without re-deriving it ============
Investigated: models/Message.js already has an `attachments: [{ type: String }]` field (bare URL
strings only — nobody ever finished building the feature) and `body` is currently REQUIRED (schema
level), which would block an attachment-only message with no text. app/api/messages/[id]/route.js
POST currently only accepts `{ body }` and 400s if it's empty/whitespace. The EXISTING
app/api/upload/route.js accepts a base64 image inside the JSON request body — CANNOT be reused for
this: Vercel serverless functions have a hard, non-configurable 4.5MB request body cap on the
standard Node runtime, and a 50MB file base64-encoded balloons to ~66MB, nowhere close to fitting.
Web-searched Cloudinary's own account-level size limits (can't inspect this project's actual plan
tier) — free-tier images commonly cap around 10-20MB while video/raw files often allow up to 100MB
even on free — so I can build correct 50MB-capable infrastructure, but the ACTUAL ceiling for a
given upload also depends on their Cloudinary plan, which I'll state honestly rather than promise
something Cloudinary itself might reject.

DESIGN (direct-to-Cloudinary signed upload — the standard pattern for bypassing a serverless
body-size cap; the file's bytes never touch our own backend/Vercel at all, only a short signature
does):
1. NEW app/api/upload/sign/route.js — POST, requires ANY authenticated session (not admin-only,
   customers need this too — different from the admin-gated folders in the existing /api/upload).
   Generates a Cloudinary signature via cloudinary.utils.api_sign_request() reusing the same
   CLOUDINARY_* env vars lib/cloudinary.js already uses. Returns {signature, timestamp, cloudName,
   apiKey, folder: 'chat-attachments'}.
2. NEW lib/clientDirectUpload.js — shared helper (used by BOTH chat pages) that (a) fetches a
   signature from the route above, (b) POSTs the actual File object as FormData DIRECTLY to
   `https://api.cloudinary.com/v1_1/{cloud}/auto/upload` via XMLHttpRequest specifically (not
   fetch — fetch has no cross-browser-reliable upload-progress event; XHR's upload.onprogress is
   needed to show a progress bar for what could be a genuinely slow 50MB upload), (c) returns
   {url, name, type, size} on success.
3. models/Message.js: `body` required:true -> default:'' (validated at the app layer instead:
   require EITHER body text OR >=1 attachment, not both). `attachments` upgraded from bare
   `[String]` to `[{ url, name, type, size }]` — bare URLs aren't enough to render a sensible UI
   (no filename to label a download, no mimetype to decide image-thumbnail vs generic-file-card).
4. app/api/messages/[id]/route.js POST: accept `attachments` in the body; the empty-message 400
   becomes `!body?.trim() && !attachments?.length`; Message.create includes attachments;
   conversation.lastMessage falls back to '📎 Attachment' when body is empty but attachments exist
   (otherwise a conversation-list preview would show nothing); sendNewMessageEmail's body param
   gets the same fallback so the notification email isn't blank either.
5. Both chat page.jsx files: paperclip button next to the textarea -> hidden file input -> client-
   side validates size (<=50MB, clear toast if over) and a SMALL denylist of dangerous executable
   extensions (.exe/.bat/.cmd/.sh/.msi/.scr/.com/.jar — "secure...all types file" reasonably
   implies broad support, not reckless; images/PDFs/docs/sheets/video/audio/zips etc. all remain
   allowed) -> uploads immediately via the helper, showing a small pending-attachment chip
   (filename + progress) above the textarea with a remove (x) option -> actually attaches to the
   message only when Send is pressed (same moment as whatever text is in the textarea, if any).
   Rendering: image/* attachments show an inline thumbnail (click opens the original in a new tab
   — a full lightbox is a nicer touch but out of scope for this ask); everything else renders as a
   compact file card (icon + filename + size + download link).
"Secure" is addressed by: the signature is server-generated and short-lived, gated behind a real
authenticated session — a stranger can't upload directly to this Cloudinary account without going
through our own auth first; Cloudinary's own `secure:true` (already configured) serves everything
over HTTPS; the executable denylist above.
NEXT STEP: Item 7 is now FULLY COMPLETE. Step 5 done: both app/(shop)/messages/[id]/page.jsx and
app/admin/messages/[id]/page.jsx now have a paperclip button, hidden file input, client-side
validation (validateAttachment: 50MB cap + executable denylist), immediate upload-on-select with a
progress chip, remove-before-send option, and attachment rendering in the message list (inline
image thumbnail or a filename+size+download card, via a small shared AttachmentView component
duplicated in each file — matching this codebase's existing convention of NOT sharing components
across the /admin and /(shop) route groups even for parallel features). Send is now enabled by
text OR attachment, not just text. All 6 touched/created files for item 7 tsc-verified clean in one
consolidated pass (app/api/upload/sign/route.js, lib/clientDirectUpload.js, models/Message.js,
app/api/messages/[id]/route.js, both chat page.jsx files).

Item 7 is DONE. Remaining items: 1 (BD Invoice HS-code-mode dropdown) and 4+5 (Export Dashboard
restructure) — both large, still not started. These are the last 2 items in the whole batch.
BLOCKERS: none.

## ============ ITEM 1 (BD Invoice Category/Product HS-code mode) — FULL DESIGN, no code written
## yet — write this out completely first, given the scale, matching the established discipline
## for every other large item this project has done ============

RE-READING THE REQUIREMENT CAREFULLY: the opening line ("There is No HS code column in BD invoice")
is stale relative to the CURRENT code — batch 17 already added an HS Code column to BD Invoice.
The substantive, actionable part of the requirement is unambiguous regardless: add a dropdown
(living in/near the HS Code column header) toggling between two modes:
- "Category HS Code" (default) — explicitly described as "the BD Invoice will be printed or
  downloaded AS IT IS RIGHT NOW" — this phrase is doing a lot of work: it means the EXISTING batch-
  17 behavior (rows grouped by product category, computeCategoryBreakdown, editable bdItems with
  auto-sync/lock/reseed) is simply RENAMED to "Category HS Code" mode and gets ZERO logic changes.
  Not touching seedBdItemsFromShipment's category-mode computation at all.
- "Product HS Code" (new) — BD Invoice shows one row per INDIVIDUAL PRODUCT (name + botanical name,
  "as in the packing list"), all metrics per-product, HS code = each product's own hsCode.

KEY DESIGN INSIGHT: "as in the packing list" for Product mode means this should be a READ-ONLY
mirror of `form.items`, not a second independently-editable copy — i.e., it should work exactly
like Buyer's Invoice/Packing List already do via ReadOnlyItemsView (which ALREADY shows botanical
name and ALREADY handles hsCode generically as a normal column since batch 17). This means Product
mode needs NO new auto-sync/lock/mismatch machinery at all — it just reads form.items directly,
live, same as Buyer's Invoice. Category mode keeps ALL its existing bdItems/lock/reseed complexity
untouched. This is the single biggest scope-reducer for this item: I'm not building two editable
table variants, only one (Category, unchanged) plus one read-only reuse (Product, reusing
ReadOnlyItemsView almost as-is).

SCHEMA: models/ExportShipment.js — add `bdHsCodeMode: { type: String, enum: ['category','product'],
default: 'category' }`. Persisted per-shipment (the dropdown lives in the shipment editor's BD
Invoice tab, a per-shipment editing context — not a per-download transient choice like docStyle).

SHIPMENT EDITOR (app/admin/export-dashboard/.../[shipmentId]/page.jsx):
- Add `bdHsCodeMode` to form state (loaded/saved with the rest of the shipment, default 'category'
  for both new shipments and any pre-existing shipment that predates this field).
- The BD Invoice tab's content becomes conditional on `form.bdHsCodeMode`:
  - 'category': render <BdInvoiceTable .../> exactly as today, completely unchanged.
  - 'product': render <ReadOnlyItemsView items={form.items} columns={getDocumentColumns(
    selectedCategory, 'bdInvoice')} currency={form.baseCurrency} salesTerm={form.salesTerm} />
    (the SAME component Buyer's Invoice already uses — reusing it here means botanical name and
    generic hsCode-as-a-column both come for free, zero new rendering code needed for the editor).
  - The mode dropdown itself sits in a small toolbar ABOVE the table (can't live literally inside
    BdInvoiceTable's own <th> since the whole table swaps between two different components across
    modes) — positioned clearly enough that it's still obviously "the HS Code column's mode", per
    the spirit of the request, even though it's not textually inside one specific header cell.
  - The mismatch-cross-check banner (bdMismatches) only makes sense for Category mode's editable,
    independently-lockable bdItems — Product mode is always a live, direct mirror of form.items so
    there's nothing for it to ever drift out of sync with. Only show/compute that banner in
    Category mode.

DOWNSTREAM GENERATORS — all four need the same category-vs-product branch, sourcing from
shipment.items instead of shipment.bdItems when bdHsCodeMode==='product', with the SAME
showBotanicalName-and-header treatment Buyer's Invoice already gets (isBuyer) extended to also
cover this case (isBuyer || isBdProductMode) — but the COLUMN SET stays 'bdInvoice' (not
'buyerInvoice') in both BD modes, since Product mode should still show whatever metrics BD Invoice
is normally configured to show (including totalCTN, which buyerInvoice's own column set omits) —
only the item source + botanical-name/header treatment changes, not which columns are configured:
- lib/exportDocuments.js: generateInvoicePDF (isBuyer already exists there) and assembleDocData
  (isPacking/isBuyer already exist there) both need an isBdProductMode check added alongside.
- app/(print)/print/export/[shipmentId]/page.jsx: InvoiceDoc component, same pattern.
declaration/signatory text stays 'bdInvoice' regardless of HS-code mode — the mode only changes
product-grouping granularity, not the document's fundamental legal type.
grandTotals() needs NO changes — it's already generic over whatever items array it's given, and
summing all individual products directly gives the identical total to summing category groups
first, so this works correctly for both modes with zero modification.

NEXT STEP: Item 1 is now FULLY COMPLETE. Implemented exactly per the design above: schema field
(models/ExportShipment.js, default 'category'); shipment editor gets the mode dropdown (in its own
toolbar above the table, not literally inside a <th> — the two modes render structurally different
tables) + conditional BdInvoiceTable/ReadOnlyItemsView rendering + mode-aware bdTotalCTN/Qty/Value/
bdMismatches (Product mode can never mismatch, same reasoning as Buyer's Invoice/Packing List) +
Locked/Auto-syncing badge and Re-fill button hidden in Product mode (don't apply — it's always a
live mirror); lib/exportDocuments.js's generateInvoicePDF AND assembleDocData (DOCX/XLSX) both get
the isBdProductMode branch (item source + botanical name/header, column SET stays 'bdInvoice'
either way); print page's InvoiceDoc gets the same. A final sweep (grepping for every remaining
`bdItems.some`/`.length` check across the whole codebase, not just the 4 files in the original
plan) caught 2 MORE spots needing the identical fix that weren't anticipated up front:
generateAllDocumentsPDF's "does BD Invoice have anything to show" check (would have silently
excluded BD Invoice from the combined "generate all documents" PDF for any Product-mode shipment),
and the Export Archives page's identical per-shipment availability check (same silent-exclusion
bug, different surface). Both fixed with the same shipment.bdHsCodeMode==='product' branch. All 6
touched files (models/ExportShipment.js, the shipment editor, lib/exportDocuments.js, the print
page, app/admin/export-dashboard/archive/page.jsx) tsc-verified clean, individually and in a final
consolidated pass. Confirmed via reading handleSave/the PUT+POST shipment API routes that
bdHsCodeMode saves/loads for free (full-object spread both directions, no field whitelist
anywhere) — no API route changes were needed at all for persistence.

ALL 12 SUBSTANTIVE ITEMS EXCEPT 4+5 ARE NOW DONE. Only the Export Dashboard restructure (items 4
and 5, done together since 5 depends on 4's renaming) remains — the last piece of this entire
batch.
BLOCKERS: none.

## ============ ITEMS 4+5 (Export Dashboard restructure) — DONE ============
KEY DISCOVERY that simplified this significantly: Export Categories/Analytics/Archives/Incentives/
Settings were ALL already separate, working pages/routes — they were just duplicated as quick-link
buttons at the top of the main /admin/export-dashboard page instead of living in the sidebar. So
"remove these tabs from the Shipment page" + "add them as a sub section under Export Dashboard"
meant: delete 5 <Link> buttons from one page, add 5 items to the sidebar. No new pages needed for
any of those 5. Import Dashboard also already existed as a proper "Coming Soon" placeholder,
already satisfying "will remain empty" — just needed to become its OWN top-level sidebar group
instead of one item nested inside the old "Export & Import" group. The ONLY genuinely new page was
Overview.

Implemented: components/layout/AdminSidebar.jsx — navGroups split into 2: "Export Dashboard" (8
items: Overview [new], Shipments [renamed main page, exact:true since its href prefixes every
sibling], Export Categories [Tag icon, was imported-unused], Export Incentives, Export Analytics,
Export Archives, Audit Log & Recycle Bin, Settings) and a separate "Import Dashboard" group (1
item, unchanged page). app/admin/export-dashboard/page.jsx — header "Export Dashboard"->"Shipments",
subtitle updated, the 5-button quick-link row removed (Countries & Buyers content completely
untouched). Caught and fixed my own mistake while editing this file: an unclosed JSX comment that
accidentally (but harmlessly, per JS block-comment semantics) swallowed a neighboring label comment
— worth remembering to always write the closing */ explicitly rather than relying on a subsequent
comment's own closer.

NEW app/api/admin/export-overview/route.js: aggregates ExportShipment (grouped by month/country/
category/buyer, currency-normalized to USD via the live exchange-rate cache) + IncentiveApplication
(reusing lib/incentiveUtils.js's calculateIncentiveCosting — the SAME formula the Incentive
Application detail page itself uses — rather than a separate, riskier reimplementation). Verified
IncentiveApplication's real field names first (status enum is ['documentation','claimed'], not
what I initially assumed; ExportBuyer's name field is `name` not `companyName`; commission value is
nested at kaForm.commissionInsuranceValue) rather than guessing and silently producing wrong/zero
numbers.

NEW app/admin/export-dashboard/overview/page.jsx: KPI cards + recharts (Area/Bar/Pie) — matches
the established visual pattern from app/admin/analytics/page.jsx exactly (same KPICard shape,
COLORS palette, ResponsiveContainer usage) for visual consistency with the rest of the admin panel.
Caught and fixed a real risk before it shipped: initially used 3 lucide-react icon names (Weight,
Boxes, Gift) that aren't confirmed anywhere else in this codebase and couldn't be verified without
network/package access — swapped all 3 for icons directly confirmed already working elsewhere in
this exact codebase (Truck, Layers, and reusing DollarSign) rather than risk an invalid import.

Final verification: all 4 touched/created files individually tsc-clean; a full whole-project sweep
(264 files — 130 .jsx + 134 .js, every single file in app/lib/models/components) parses cleanly,
zero exceptions; confirmed no orphaned "Export & Import" text references remain anywhere (only 2
intentional historical comments); confirmed all 3 ReadOnlyItemsView call sites (Packing List,
Buyer's Invoice, and the new BD Invoice Product mode) use a consistent prop signature; confirmed
the Import Dashboard page is completely untouched and intact.

## ============ ENTIRE BATCH 19 (all 12 items) IS NOW COMPLETE ============
Remaining: update PROJECT_STATUS.md with the batch-19 summary section, then final packaging
(zip, integrity check, fresh-extraction spot checks + checksum comparison, present_files) —
matching the exact delivery discipline established in batches 17/18.

## ============ POST-BATCH BUG REPORT (screenshot, before final zip) ============
User provided a screenshot: on the Exporter/Contract No row of the InfoGrid (Packing List, BD
Invoice, Buyer's Invoice — "in both with letterhead and plain A4 paper"), the Exporter address
text wraps to a 2nd line ("...Sabujbagh Thana, Dhaka 1214") and visually OVERLAPS the "Contract
No:" line below it. This is a genuine layout bug — the Exporter row's allocated height doesn't
account for its address text wrapping to 2 lines, so the next row is positioned as if it were only
1 line tall. Must investigate BOTH independent InfoGrid implementations this project has (per
established history): the print page's HTML/CSS InfoGrid (app/(print)/print/export/[shipmentId]/
page.jsx) and the PDF generator's drawInfoGrid (lib/exportDocuments.js, jsPDF-based) — these are
two separate renderers of the same visual layout and could each have this bug independently, or
only one might. Must fix before the final zip is packaged, per the user's explicit instruction.
NEXT STEP: read both InfoGrid implementations in full before touching either.

## ============ OVERLAP BUG — ROOT CAUSE FOUND AND FIXED ============
Read both independent InfoGrid renderers:
- app/(print)/print/export/[shipmentId]/page.jsx's InfoGrid (HTML/CSS, browser print path): a
  standard CSS Grid (gridTemplateColumns: '1fr 1fr', no explicit gridTemplateRows) — this auto-
  sizes each row to its tallest cell by default, which is exactly what's needed here. Checked CELL/
  CELL_LAST for anything that could defeat that (fixed height, overflow:hidden) — found neither;
  the only oddity is a leftover `verticalAlign: 'top'` that has zero effect on a grid item (that
  property only applies to table-cell/inline elements) — harmless dead CSS, not a bug. No code-
  level defect found in this path.
- lib/exportDocuments.js's drawInfoGrid (jsPDF, the PDF download path): CONFIRMED, definite bug.
  jsPDF's `doc.text(val, x, y, {maxWidth})` wraps text automatically when it's too long for
  maxWidth, but that only affects HOW the text is drawn — it does NOT reserve any extra vertical
  space for the wrapping on its own. The function's cursor (`cursorY`) was advanced by a flat,
  unconditional `5` (mm) per row-pair regardless of how many lines either cell's text actually
  wrapped to. The Exporter row's value is built as `${exporterInfo.exporterName}, ${exporterInfo.
  exporterAddress}` (confirmed at all 3 call sites — Packing List, the shared Buyer's/BD Invoice
  generator, and the combined-documents generator — so this ONE function fix covers every document
  type the user listed) — long enough to wrap to 2 lines at 8.5pt font within the constrained
  column width, exactly matching the screenshot. The NEXT row (Contract No) then started only 5mm
  below the START of the Exporter row — enough room for 1 line, not the 2 the address actually
  needed — landing directly on top of the wrapped 2nd line.
FIX: before drawing each row-pair, compute how many lines each cell will wrap to via jsPDF's own
`doc.splitTextToSize(text, width)` (the exact same wrapping logic `.text(maxWidth)` applies
internally, so the reserved height always matches what's actually drawn) and take the larger of
the two cells' line counts. Advance the cursor by `5 + (maxLines - 1) * lineH` instead of a flat
`5` — exactly 5mm, unchanged, for the overwhelming majority of rows that don't wrap; only a row
that genuinely needs more room gets it. `lineH` (the height of one EXTRA wrapped line) is derived
from `doc.getFontSize() * 1.15 * (25.4/72)` — plain arithmetic (points -> mm, times jsPDF's own
default 1.15 line-height factor) built only on the well-established `getFontSize()` method,
deliberately avoiding any less-certain jsPDF-internal line-height API I couldn't verify without
being able to run the library.
ALSO CHECKED (same bug class, deliberately NOT touched): drawIdentifierTable (EXP No/AWB No/PC No/
REX No, 3-column table) has the identical `maxWidth`-without-reserved-wrap-space pattern in
principle, but positions rows by a fixed `i * rowH` INDEX rather than a running cursor — making it
wrap-aware would mean restructuring to a cumulative cursor (affecting the divider lines and outer
rect height too), a materially bigger, riskier change. Given EXP/AWB/PC/REX values are short
reference codes/numbers by nature (nothing like a full street address), this is a low-probability
theoretical risk, not the reported bug, and not worth that scope expansion right now given the
user's explicit urgency to get the CONFIRMED fix into the final zip — documenting this as a
deliberate, reasoned choice rather than an oversight. A third maxWidth usage (bank details block,
~line 175) was also checked and found to be a DIFFERENT, already-correct pattern (each line is a
discrete pre-known string with its own explicitly-computed Y position; the container height is
already computed as `lines.length * lineHeight` before drawing) — not vulnerable to this bug at all.
## ============ ENTIRE BATCH 19 COMPLETE — INCLUDING THE POST-DELIVERY OVERLAP FIX ============
Final whole-project sweep re-run after the InfoGrid fix (the very last code change this batch):
264 files total (130 .jsx + 134 .js) across app/lib/models/components — every single one parses
cleanly. Run in 2 separate calls this time (a combined single call hit an execution time limit —
worth remembering: split the .jsx and .js sweeps into 2 commands, not 1, in future batches too).
PROJECT_STATUS.md updated with "## 27. Batch 19 — ..." (renumbered Setup Reminder to #28),
verified section structure lands correctly.
NEXT STEP: zip /home/claude/work/extracted -> shah-international-v23.zip, verify integrity + fresh-
extraction spot checks + checksum comparison (same discipline as every prior delivery), present to
user.
BLOCKERS: none.

## ============ THE 13 ITEMS (verbatim from user's uploaded doc, item 8 genuinely blank) ============
1. No HS code column in BD Invoice. Add one. Admin gets a dropdown in the HS code table header:
   "Category HS Code" (default — current behavior unchanged: rows grouped by product category,
   metrics computed per category, HS code = the export category's own HS code) vs "Product HS
   Code" (NEW: BD Invoice product table shows every individual product with botanical name, like
   the packing list; all metrics computed per-product; HS code = each product's own HS code).
2. Partners & Buyers homepage section's slide/carousel is janky — starts from center, slides left,
   restarts from center (visible reset). Should be a continuous, never-stopping loop: starts from
   center, slides left, exits/reappears from the right seamlessly.
3. Admin sidebar has many sections already grouped — let admin expand/collapse each section.
   Default: ALL sections closed; admin opens/closes per their own need.
4. Rename "Export & Import" to "Export Dashboard". Add a new, separate "Import Dashboard" section
   — currently left EMPTY, instructions for it will come later. Do not build import features now.
5. Restructure Export Dashboard into 8 sub-items:
   1. Overview — NEW page, export KPI overview with interactive charts/graphs: volume & shipment
      trends, value & performance metrics, country/market performance, product/category
      performance, incentive overview, "other relevant export metrics".
   2. Shipments — renamed from the CURRENT main Export Dashboard page; functionality unchanged
      (countries/buyers/contracts/shipments managed here) EXCEPT remove these tabs from within it:
      Export Analytics, Export Archives, Incentive, Export Categories, Settings.
   3. Export Categories — promoted to its own top-level sub-section (currently a tab inside the
      main export-dashboard page).
   4. Export Incentive — promoted to its own top-level sub-section (currently the Incentives tab).
   5. Export Analytics — promoted to its own top-level sub-section (currently a tab).
   6. Export Archives — promoted to its own top-level sub-section (currently a tab).
   7. Audit Log & Recycle bin — stays exactly as is (already its own thing per batch-17 sidebar).
   8. Settings — promoted to its own top-level sub-section (currently a tab).
6. "Request Import Quotation" throws a Gmail SMTP auth error (535-5.7.8 bad credentials) —
   /api/quotation 500s. Need to find the actual code path and confirm whether this is a pure
   credentials/env issue (can't fix from code) or if there's a code-level bug too.
7. Direct-message site chat auto-scrolls unexpectedly; needs secure image + all-file-type support
   up to 50MB.
8. [blank — nothing here, genuinely empty in the source document]
9. Email Marketing emails aren't sending to customers; also ensure customer names are filled in
   dynamically in the email content (not hardcoded/placeholder).
10. Product images should all normalize to the same size; ALL product cards should be uniformly
    sized (currently inconsistent — some bigger/smaller than others).
11. Product card: show the product's local name (if available) in brackets next to the product
    name.
12. Mobile footer should be 2 columns, not 1 (current single column is too long/tall on mobile).
13. Mobile FAQ section should show only 2 FAQs initially, with an expand/collapse control to
    reveal/hide the rest.

## ============ VERIFICATION TOOLING (unchanged from batch 17/18) ============
export PATH="$PATH:/home/claude/.npm-global/bin" && tsc --noEmit --allowJs --checkJs false \
  --jsx preserve --target es2020 --module esnext --moduleResolution bundler --noResolve \
  --skipLibCheck <file>
Shell is /bin/sh (no bash arrays, no process substitution — use plain files + while-read loops).
No network access. Whole-project sweep (every .jsx/.js) is mandatory before final packaging, not
just individually-touched files — this has caught real issues in every batch so far.
