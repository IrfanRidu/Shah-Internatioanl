# AGENT PROGRESS TRACKER — Shah International — Batch 3
> READ THIS FIRST on every resume. Working copy: /home/claude/work/site (contains completed batch 1
> [see AGENT_PROGRESS.md] and batch 2 [see AGENT_PROGRESS_2.md] work — do not re-touch those areas
> unless directly relevant to one of THIS batch's issues).
> Final deliverable: zip → /mnt/user-data/outputs/shah-international-v3.zip
> ENVIRONMENT: no node_modules, no network access this session (confirmed again — same as batch 2).
> No tsc. Manual review only. RE-VIEW FILES IMMEDIATELY AFTER EVERY EDIT — batch 2 caught a
> self-introduced bug this way; don't skip it.

## REFERENCE FILES (user uploaded, both already visible inline in the conversation — no need to
## re-open, just remember what they show)
- WhatsApp_Image_2026-07-19_at_8_26_17_AM.jpeg: the CORRECT/desired packing list output — full green
  Shah International letterhead banner at top w/ logo + contact info, proper bordered table, Pack
  Size/Total CTN/Quantity Kg columns all clearly legible, signature block bottom-right.
- Packing-List-SI-076590.pdf: what the site CURRENTLY generates — no letterhead/logo/banner at all
  (just a faint tiny watermark), plain minimal styling, looks nothing like the reference. This is the
  print/PDF output referenced by issue 7.

## THE 11 NEW ISSUES (user's own numbering, this batch)
1. Analytics/dashboard metrics must update in real time when an order is marked delivered/returned —
   currently shows 0 for everything.
2. Products marked NOT available for local buyers still show to local buyers — must also apply
   dynamically to special sections/campaigns (not just main listing).
3. Same as #2 but for International buyers (symmetric bug).
4. /products page shows "no products available" (empty) for the intended buyer type — must show all
   available products for that buyer.
5. Rename "Scientific Name" field label to "Botanical Name" everywhere (same concept, one name).
6. Export dashboard packing list product search: no autocomplete/suggestions while typing product
   name. ALL products (regardless of buyer-type restriction) must be searchable/selectable here —
   packing lists aren't storefront listings. Selecting a product must auto-fill its Botanical Name.
7. Printing/downloading of Packing List, Buyer's Invoice, BD Invoice with letterhead isn't working —
   currently outputs like the ugly reference PDF instead of the letterhead reference image. Must
   match the reference image's look.
8. CTN fields in packing list/buyer invoice/BD invoice are too small, values hidden — same class of
   bug as batch-2 issue 43's Pack(kg) fix, now specifically the CTN field (may be same file, may need
   the same invalid-Tailwind-class check across bd/buyer item tables too, and specifically the PRINT
   output's CTN column, not just the editor).
9. Product detail page: different campaigns not displaying properly.
10. Notifications: seen notifications still show the red unread dot.
11. Export Archive: for every shipment, alongside the individual PDFs there should be one combined
    "All Documents for (Shipment Name)" PDF merging all of that shipment's documents.

## PLAN (investigate each before touching code; group by shared files)
- [ ] P0. Deep-read: app/api/admin/metrics/route.js (issue 1 — likely a status-string mismatch after
      batch-2's own edits, or an order-webhook/mark-delivered route not triggering anything — metrics
      route is pull-based/on-demand so "real time" likely means the ADMIN ORDER LIST page isn't
      refetching metrics after a status change, or the delivered/returned status string used when
      marking doesn't match what metrics route matches against).
- [ ] P1 (2,3,4). Re-examine buyer-visibility filtering — batch 2 concluded lib/utils.js
      isProductVisibleToBuyer + /products page were ALREADY correct. User is now reporting they are
      NOT working, including in special sections/campaigns specifically. Must find the actual gap this
      time — check special-sections/campaign product-fetching code paths specifically (a likely
      separate code path from /products and homepage that wasn't audited last batch), and re-verify
      /products page isn't ACTUALLY broken (issue 4 says it's completely empty — contradicts batch 2's
      "already fine" conclusion, so something is wrong that wasn't caught, or a batch-2 edit elsewhere
      broke it, or it was never actually fine and I mis-verified). Re-test from scratch, don't assume.
- [ ] P2 (5). Grep for "Scientific Name" across models/forms/print templates, rename to "Botanical
      Name" consistently (both admin-facing labels AND underlying field key if safe/low-risk, or just
      the label if renaming the DB field risks breaking existing data — decide after reading).
- [ ] P3 (6). Packing list item search: find the product-name input in the shipment editor's items
      table (ItemsTable component or inline), see why no autocomplete fires, make it search ALL
      products unfiltered by buyer type, auto-fill botanical name on select.
- [ ] P4 (7). Print/PDF letterhead: compare lib/exportDocuments.js (jsPDF, used for "download") against
      app/(print)/print/export/[shipmentId]/page.jsx (browser print, used for "print") — the uploaded
      reference PDF looks like the jsPDF path output (plain, no letterhead banner), so likely the
      letterhead image isn't being drawn into the jsPDF doc even though exportLetterheadUrl exists
      (batch 1 built the letterhead upload feature per its own log — check whether generatePackingListPDF
      actually calls drawHeader/loadImageForPdf with the letterhead and whether that's wired end-to-end,
      or whether it silently fails / was never connected to the actual admin-uploaded URL).
- [ ] P5 (8). CTN field sizing — apply the same fix pattern as batch-2 Pack(kg) fix, but check: (a) the
      editor's CTN column specifically (may already be fixed since I touched CTN th width in batch 2 —
      verify), (b) the PRINT/PDF output's CTN column/cell width (lib/exportDocuments.js jsPDF table
      column widths, and the print page's HTML table) — these are likely NEVER touched by batch 2's
      fix since that only touched the admin editor screen, not the generated documents.
- [ ] P6 (9). Product detail page campaigns display — find campaign-fetching/rendering code on
      products/[slug] page, debug why not displaying properly.
- [ ] P7 (10). Notification read/unread state — find notification bell component + read-state API,
      check why the red dot persists after marking seen.
- [ ] P8 (11). Export Archive: add "All Documents for (Shipment Name)" merged PDF — need a PDF-merge
      capability (check if pdf-lib or similar is already a dependency; jsPDF alone can't merge existing
      PDFs easily, may need to generate all docs as pages within one jsPDF session instead of merging
      separate PDF binaries — decide approach after reading lib/exportDocuments.js structure).
- [ ] P9. Final review pass (node --check on .js, brace-balance on .jsx, as batch 2 did) + zip + deliver.

## LIVE LOG (append-only)
- Batch 3 tracker created. Confirmed working directory /home/claude/work/site persisted from batch 2
  (no data loss). Starting P0 (analytics real-time issue) now.
- **Issue 1 investigated + hardened.** Traced the whole real-time chain: admin/orders/page.jsx's
  updateStatus() correctly PATCHes /api/orders/[id] (verified status='delivered'/'returned' persist
  correctly, order.save() runs) and dispatches a `order-status-changed` CustomEvent on success; both
  app/admin/page.jsx and app/admin/analytics/page.jsx already listen for that event and refetch (plus
  a 30s poll/SSE fallback) — this real-time wiring was ALREADY present and correct, likely from a
  pre-batch-2 pass. So "shows 0 for everything" isn't a wiring gap, it's the underlying data fetch
  failing/zeroing out. Found the most likely concrete cause: `app/api/admin/metrics/route.js` did
  `o.items.reduce(...)` with NO guard — if even ONE delivered order has a malformed/missing `items`
  array, this throws, the whole route 500s, and the frontend was silently rendering every KPI as ৳0
  with zero indication anything failed (matches "0 for everything" exactly, since nearly every KPI
  card reads from this one endpoint). FIXED: `(o.items || []).reduce(...)`. Also hardened
  dailyRevenue/revenueByType aggregates with $ifNull fallback (subtotal → total-deliveryCharge) for
  defense-in-depth against legacy orders predating the `subtotal` field. Added `console.error` in the
  catch block (was silent before) and frontend now toasts an error on `success:false` instead of
  quietly showing zero (both app/admin/page.jsx and app/admin/analytics/page.jsx) — so if this or any
  future failure happens, it's now visible/debuggable instead of a silent all-zero dashboard.
  Also separately verified `advanced.revenueByType` (analytics page's Revenue by Buyer Type widget)
  groups by Order's own `orderType` field, which DOES exist on the schema (required, enum
  local/international) — confirmed NOT a bug, no change needed there.
  NOTE: could not run the app to 100% confirm root cause (no node_modules/network this session,
  consistent with batch 2) — this is the most probable cause found via careful code tracing, and the
  added error-surfacing means if there's still an issue after this it will show a toast/console error
  instead of silently reading as "everything is broken" with no clue why.
- **Issues 2/3/9 — found the REAL root cause this time (batch 2's "already fine" conclusion was
  wrong).** The filtering logic itself (isProductVisibleToBuyer) was always correct, but the actual
  DATA feeding it was silently incomplete: `.populate('products', '...')` / `.populate('items.product',
  '...')` calls in app/(shop)/page.jsx (homepage FlashSale + SpecialSection), app/(shop)/products/[slug]/
  page.jsx (FlashSale), app/api/special-sections/route.js, and app/api/flash-sales/route.js were ALL
  missing `availableForLocal`/`availableForInternational` from their field projections — so every
  visibility check was silently comparing against `undefined`, which the check correctly treats as
  "visible" (by design, for products that never set a restriction) — meaning a REAL restriction became
  invisible to the filter too. Fixed all four field projections. ALSO discovered
  ProductDetailClient.jsx never filtered any of its five product lists (campaigns/sections, active
  flash-sale strip, related, recommended, best-selling) by buyer type at all — fixed by filtering all
- **Issue 7 — root cause confirmed via pdfplumber inspection, not just static reading.** Extracted the
  uploaded reference PDF's actual embedded image geometry: exactly one image, portrait-shaped (66pt
  wide × 91pt tall — width/height ratio ~0.73, i.e. TALLER than wide), positioned dead-center at the
  top margin — and its rendered height (91pt ≈ 32.1mm) matches `maxHeightMm=32` in drawHeader EXACTLY.
  This proves: whatever letterhead image was uploaded is portrait/near-square (not a proper wide
  banner), and the old aspect-ratio-preserving scale-to-fit logic crushed it down to a barely-visible
  thumbnail — matching the ugly reference PDF exactly. Separately, the coded no-letterhead fallback
  looked nothing like the reference design either way (plain black text vs. the reference's dark green
  banner + script wordmark). FIXED both: (1) drawHeader (lib/exportDocuments.js) now only trusts an
  uploaded image as a banner if its width/height ratio is ≥2 (genuinely wide) — otherwise it falls
  through to a rebuilt coded banner (dark green filled rect, bold-italic "Shah" wordmark, tracked-out
  "INTERNATIONAL" subtitle, right-aligned contact block) styled to match the reference image. (2) Same
  guard + same rebuilt coded banner added to the print path's DocHeader in
  app/(print)/print/export/[shipmentId]/page.jsx — checks the image's actual naturalWidth/naturalHeight
  on load (hidden via CSS until checked, to avoid a flash) and falls back identically if it isn't
  banner-shaped. Both paths now degrade gracefully AND look like the reference even without any correct
  upload; a properly-cropped wide letterhead will still render as the real uploaded banner in both.
- **Issue 8 — real cause found, distinct from the batch-2 Pack(kg) fix.** The column-width th fix from
  batch 2 was correct but insufficient: `.input-field`'s base Tailwind class (globals.css) applies
  `px-4` (32px total horizontal padding) and NONE of the compact table inputs (packSizeKg, totalCTN,
  quantityKg, unitPrice, totalValue) ever overrode it — so even a wide `<th>` column left almost no
  room for digits inside the actual `<input>`, since the padding alone nearly filled a 64-96px-wide
  cell. Fixed by adding `px-1.5` (overriding the inherited px-4) plus an explicit `min-w-[...]` to EVERY
  compact numeric input in this table (not just Pack(kg) — Total CTN, Qty(kg), Unit Price, and Total
  Value all had the exact same latent bug, just not yet reported by name). Separately verified the
  PRINT (HTML table) and DOWNLOAD (jsPDF autoTable, no columnStyles set → auto-sizes to content) CTN
- **Issue 9 — already fixed as a side effect of the issues 2/3 fix above.** "Different campaigns not
  displaying properly" on the product detail page was the exact same ProductDetailClient.jsx
  unfiltered-lists bug already fixed. No additional change needed.
- **Issue 10 done.** Root cause in components/admin/NotificationBell.jsx: `seenIds` was a `useRef(new
  Set())` — in-memory only, wiped to empty on every remount (page reload, or navigating away and back
  re-mounts the admin layout's NotificationBell instance). So a notification the admin had already
  opened/seen would show the red dot again after any reload, exactly matching the report. Fixed by
  persisting seen IDs to localStorage (capped at the most recent 300 to avoid unbounded growth over
  months of use). While fixing this, caught a SECOND, subtler bug my own first attempt at this fix
  introduced: I initially moved the "mark as seen" mutation into a `useEffect`, but mutating a ref
  inside an effect doesn't itself schedule a re-render — so the red-dot badge (computed inline during
  render from `seenIds`) wouldn't actually clear on screen until some UNRELATED state change caused a
  re-render later (e.g. the next 60s poll), which would have made the fix feel broken/laggy in
  practice. Caught this via careful re-reading before finalizing, not after shipping — refactored
  `seenIds` from a ref into real React state (`useState` + a `markSeen()` setter that unions in new IDs
  and persists), so marking something seen now reactively re-renders and clears the badge immediately,
  same as the original (pre-bug) synchronous-click-handler behavior, while ALSO surviving reloads now.
- **Issue 11 done.** No PDF-merge library was present (only jspdf/jspdf-autotable, which can only
  build a PDF from scratch, not import pages from an existing one — needed for merging in uploaded PDF
  attachments). Added `pdf-lib` to package.json dependencies (flagging clearly in the final summary
  that `npm install` is needed for this one, since it's a genuinely new dependency, not just code).
  Added `generateAllDocumentsPDF()` to lib/exportDocuments.js: generates each available document
  (Packing List / Buyer's Invoice / BD Invoice — whichever has line items) via the exact same
  generateShipmentDocPDF used everywhere else, converts each to bytes via jsPDF's
  `.output('arraybuffer')`, then uses pdf-lib to load + copy every page from each into one merged
  PDFDocument, and does the same for any uploaded PDF attachment (fetched and merged in, with a
  per-attachment try/catch so one broken/unreachable attachment can't sink the whole merge). Wired a
  new "All Documents for {shipmentNo}" row + Download All button into
  app/admin/export-dashboard/archive/page.jsx's ShipmentFileGroup, styled distinctly (brand-tinted
  background) above the existing individual-document rows, using client-side blob download (no new API
  route needed since everything's already generated in the browser).
  **CAUGHT+FIXED A SELF-INTRODUCED BUG WHILE WIRING THIS IN**: the str_replace that inserted the new
  "All Documents" button row accidentally dropped the `{generatedDocs.map(d => (` line that opens the
  existing per-document list right after it — caught immediately via the same paren/brace balance
  check used throughout this batch (117/115 parens, 99/98 braces — off by exactly one open-paren/brace,
  pointing straight at a dropped opening tag), located the missing line by re-viewing the file, and
  restored it. Re-checked balance afterward (117/117, 99/99 — clean) and did a full visual re-review of
  the component before moving on.
- **FINAL REVIEW DONE.** All 16 touched files (found via `find -newer AGENT_PROGRESS_2.md`): 5 plain
  `.js` files syntax-checked clean with `node --input-type=module --check`; package.json validated as
  parseable JSON; 11 `.jsx` files paren/brace-balance-checked, all 0/0 diff.
- **BATCH 3 COMPLETE.** All 11 issues addressed. One new dependency added (pdf-lib, for issue 11) —
  will need `npm install` before `npm run build`, same as previously advised. Zipping and delivering
  next.
- **Issue 4 — found the REAL root cause (also invalidates batch 2's "already fine" conclusion for the
  matching issue 51).** In lib/utils.js `buildProductQuery`: `if (filters.isHarvesting !== undefined)
  query.isHarvestingSeason = filters.isHarvesting === 'true';`. The frontend only sends the
  `isHarvesting` query param when the season filter is actually touched, so on every normal page load
  `searchParams.get('isHarvesting')` returns `null` (param absent) — and CRITICALLY, `null !== undefined`
  is `true` in JS. So this condition fired on EVERY normal request, forcing `query.isHarvestingSeason =
  (null === 'true') = false` — silently hiding every single in-season product from the listing, on
  every page load, for everyone. Since most/all of the demo catalog is seasonal
  (isHarvestingSeason:true, and the whole point of issue 51 was "seasonal products first"), this alone
  is a very strong candidate for making the /products page appear completely empty. FIXED: changed the
  condition to `filters.isHarvesting === 'true' || filters.isHarvesting === 'false'` — only applies the
  filter when the param was actually, explicitly set to one of those two string values. Confirmed only
  one call site (app/api/products/route.js) so this single fix covers the whole app. Also grepped for
  the same anti-pattern (`!== undefined` against a searchParams-derived value) elsewhere — the other
  hits are all against `request.json()` bodies, where undefined-vs-absent is meaningful and safe, so no
- **Issue 5 done.** Only one actual visible label needed changing — app/admin/products/new/page.jsx's
  product form had `<Input label="Scientific Name" .../>` bound to the `scientificName` field.
  Everywhere else (product cards, product detail page, packing-list combobox, shipment editor) already
  either displays the VALUE with no label, or already correctly calls it "Botanical Name" (the packing
  list column header, and the shipment editor's `botanicalName` row field, were already right). Renamed
  the one remaining label to "Botanical Name"; left the underlying DB field key `scientificName`
  unchanged (renaming a persisted field key is a real migration, not what this ask needed — same name,
  no schema change). Grepped for any other "Scientific" text afterward — none left.
- **Issue 6 — same root cause as issue 4, now already fixed by that change.** Traced
  components/admin/ProductNameCombobox.jsx (used by the packing-list item rows, confirmed actually
  wired in via `selectProductForRow` which already correctly auto-fills botanicalName from
  `product.scientificName` — this part was already built correctly in an earlier pass). It calls
  `/api/products?search=...&limit=8` with NO `isHarvesting` param — which is exactly the request shape
  that was silently forced to `isHarvestingSeason:false` by the issue-4 bug, hiding all seasonal
  products from every suggestion dropdown too. Now that buildProductQuery is fixed, this should return
  results correctly. Also confirmed (separately, deliberately) that this combobox never passes a
  `buyerType` param, so buildProductQuery's buyer-restriction branch never triggers here — meaning ALL
  active products are already searchable regardless of buyer-type restriction, satisfying the "all
  available products regardless of buyer types must be selectable" part of issue 6 with no extra
  change needed (this was already correct by omission, just blocked by the same isHarvesting bug).

## ROUND 2 (user reported: 500 on dashboard/analytics, issue 9 still broken, issue 11 still broken)
- **500 error — root cause found and fixed.** app/api/admin/metrics/route.js was doing
  `fetch(`${NEXTAUTH_URL||'localhost:3000'}/api/currency`)` — an API route calling BACK into its own
  Next.js server over HTTP. This is a fragile, known-problematic pattern (host resolution, connection
  handling, and blocking behavior all depend on the exact runtime/environment) and reproduced on every
  request regardless of query params, matching the reported errors exactly (both `?currency=BDT` and
  `?from=...&to=...` failed identically — pointing at shared, always-executed code, not date-range
  logic). FIXED: replaced the self-fetch with a direct call to the same underlying logic
  /api/currency/route.js itself runs (CurrencyRate lookup + staleness check + fetchLiveRates()
  fallback), imported and inlined as a local `getCurrencyRates()` helper — same caching behavior, zero
  network round-trip back into the app's own server.
- **Issue 9 — could not find a NEW separate display bug via static analysis** (re-checked
  ActiveCampaignsStrip.jsx and SpecialSection.jsx rendering code line by line, checked for null-safety,
  checked prop-name wiring end-to-end from page.jsx → ProductDetailClient.jsx — all correct). Given the
  batch-3 visibility-leak fix was real and confirmed, but the user still sees the same issue, hardened
  the fix further: buyer-type visibility is now ALSO applied SERVER-SIDE (not just client-side) for any
  SIGNED-IN buyer, since their buyerType is known via session (guests still rely on the client-side
  filter, since their buyer-type choice only lives in localStorage, which the server can't read — no
  cookie mirror exists for it, confirmed by checking BuyerTypeContext.jsx). Applied
  `session.user.buyerType` as a real Mongo query filter (or populate `match` option, for the two
  populate-based queries) across ALL FIVE product lists (sections, activeCampaigns, related,
  recommended+fallback, best-selling), so a product invisible to a signed-in buyer never occupies a
  dedup "slot" in the first place — previously it could still consume a slot server-side (fetched,
  excluded from later sections) and then get filtered out client-side, silently leaving that section
  short a product instead of backfilling with something visible. This is a genuine improvement
  regardless of whether it's THE remaining cause; flagging honestly that I could not 100% confirm what
  else might be wrong without live reproduction.
- **Issue 11 — found the REAL cause, distinct from the merge code itself.** lib/cloudinary.js's
  `uploadImage()` had a 'shipment-docs' preset of `{ quality: 85, format: 'webp' }`, and the function
  unconditionally applied `fetch_format: preset.format` to EVERY upload to that folder — including PDFs
  uploaded via the shipment editor's "Upload Document (PDF/Image)" field in the Other Details tab
  (confirmed this is the exact field: `folder: 'shipment-docs'`, `set('additionalDocs', ...)`).
  Cloudinary's fetch_format transform re-encodes the delivered asset into that format regardless of
  what was uploaded — so a PDF uploaded there was being silently converted into a corrupted
  webp-formatted asset at the URL Cloudinary returns. When generateAllDocumentsPDF later tried
  `PDFDocument.load()` on that corrupted asset, pdf-lib would throw — caught by the per-attachment
  try/catch, which is exactly why it silently vanished from the merge with no error, matching the
  report precisely. FIXED at the actual source: 'shipment-docs' no longer goes through ANY image
  transform (no forced format/quality) — added a `NO_TRANSFORM_FOLDERS` list and a document-upload
  code path that only sets `resource_type: 'auto'`, preserving whatever was actually uploaded exactly
  as-is. ALSO hardened generateAllDocumentsPDF to return `{ blob, skipped }` instead of just a blob, so
  if an attachment ever fails to merge again (e.g. an OLD document uploaded before this fix, whose
  Cloudinary asset is already corrupted from the old preset and can't be un-corrupted retroactively —
  will need re-uploading), the admin gets a toast naming exactly which file(s) couldn't be included,
  instead of it disappearing with zero indication. Updated the archive page's handleDownloadAll to
  match the new return shape and surface that toast.
  **IMPORTANT CAVEAT for the final summary**: any PDF document uploaded via Other Details BEFORE this
  fix is likely already corrupted in Cloudinary from the old preset and will need to be re-uploaded to
  merge correctly — this code fix only prevents the corruption from happening to NEW uploads going
  forward, it can't repair already-corrupted existing assets.
- All newly touched files this round re-syntax/balance-checked clean:
  app/api/admin/metrics/route.js (node --check, OK), lib/cloudinary.js (node --check, OK),
  app/(shop)/products/[slug]/page.jsx (parens/braces 0/0), lib/exportDocuments.js (node --check, OK),
  app/admin/export-dashboard/archive/page.jsx (parens/braces 0/0).
- Re-zipping as shah-international-v4.zip next.
