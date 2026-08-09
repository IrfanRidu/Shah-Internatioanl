# AGENT PROGRESS TRACKER — Shah International — Batch 11 (R25): follow-up correction round on
# batch 10's own output — Ka Form/Stamp Application back to plain paper, signature block removed,
# "(In Foreign Currency)" bracket style, EXP year fix, Vercel deployment hardening.
> READ THIS FILE FIRST on every resume/continue, then AGENT_PROGRESS_10.md for the round this one
> corrects, then PROJECT_STATUS.md §1-19 for everything before that. Don't re-touch those areas
> unless directly relevant to what's below.
> Source: batch 10's own zip output, no new reference files this round — just direct feedback on
> what batch 10 produced.
> Working copy: /home/claude/work/extracted. Final deliverable: zip of that tree (minus
> node_modules/.git) → /mnt/user-data/outputs.
> VERIFICATION COMMAND (see AGENT_PROGRESS_10.md for why this exact form, not a plainer one):
>   tsc --noEmit --allowJs --checkJs --jsx preserve --noResolve --skipLibCheck <file> 2>&1 | \
>     grep -E "error TS2304|error TS2552|error TS2551"
>   Empty output = clean. Full-codebase re-sweep at the end of this batch came back byte-identical
>   to batch 10's own known 7-hit baseline (all in files neither batch ever touched — Node globals
>   the checker doesn't know about without full @types/node resolution, plus one unrelated
>   pre-existing issue) — zero new issues from anything in this batch.

## THE 5 NEW REQUIREMENTS THIS ROUND, verbatim numbering kept as given
1. Ka Form and Stamp Application should NOT use the letterhead. Ka Form: both languages on plain A3,
   ALWAYS a single page for 1-7 shipments (this app's own min/max group size), no top margin (no
   letterhead = nothing to reserve space for). Stamp Application: plain LEGAL size paper, not A4/
   letterhead. Plus a literal, exact text correction for the Bengali Stamp Application's opening
   salutation block.
2. Packing List / BD Invoice / Buyer's Invoice: keep both modes (letterhead — sourced from the
   Export License primarily — and plain A4), but remove the bottom Proprietor/signature/stamp
   section from all 3 — a physical stamp is added by the admin afterward.
3. "in Foreign Currency" (batch 10's fix for the original "(FC)" abbreviation) should be bracketed:
   "(In Foreign Currency)".
4. Section (E) "EXP No. & Date" is missing the year (should show EXPNO/YEAR, matching Section C's
   own reference-number style — e.g. "000367/2026").
5. Make the whole site Vercel-deployment-ready; fix any potential Vercel errors anywhere.

## STATUS: all 5 done and verified this session.

---

## Issue 1 — Ka Form + Stamp Application off the letterhead, onto plain paper

**Ka Form** (`lib/kaFormDocuments.js`, `generateKaFormPDF`): `pageGeometry()` no longer takes a
`lang` argument — always returns A3 (297×420mm) now, for both languages. Previously Bengali used A4
(matching its own real reference PDF's actual page size, confirmed in batch 10) — that's now
overridden by this round's explicit "both on plain A3, always a single page for 1-7 shipments, no
top margin" requirement, which needed A3's extra room to guarantee reliably. The
`drawLetterheadBackground` call and the `letterheadUrl` parameter are gone from the function
signature entirely; `y` starts at the plain `MARGIN` (14mm) unconditionally — no reserve. The
Bengali-specific content structure from batch 10 (6-column Section E, single-table Section C, the
numbered Section H layout — all confirmed against the real Bengali reference PDF) is untouched, just
rendered on the larger A3 canvas instead of A4. The `ensureSpace()` pagination safety net (added in
batch 10 for the letterhead-reserve case) is simplified to a 2-arg form (`curY, neededMm`) since
there's no letterhead to redraw on a spillover page any more — still kept as a genuine safety net for
a pathological edge case, not because the 1-7 shipment range is expected to need it in practice (A3 +
no reserve is substantially roomier than what batch 10's Bengali/A4-with-reserve density tuning was
already working within).

**Stamp Application** (`generateStampApplicationPDF`): format switched from `'a4'` to `'legal'`
(215.9×355.6mm — jsPDF's built-in named format). Letterhead loading/drawing removed; content starts
at the plain margin on every page. Overflow-fallback thresholds (only relevant when there's no
`{{PAGE_BREAK}}` marker to force pagination — e.g. a custom admin text override) recomputed for the
taller legal page (`H - 30` / `H - 20` instead of the old hardcoded `265` / `275`, which were tuned
for A4's 297mm).

**A real bug found and fixed while correcting the Bengali salutation text**
(`lib/bengaliText.js`'s `wrapBengaliText`): it split the input on whitespace via `/\s+/`, which
matches `\n` the same as a plain space — so a short multi-line block (several deliberately separate
lines, like a letter's opening address) had its line breaks silently discarded and got re-flowed as
one continuous run of wrapped prose instead. This is exactly why the Bengali salutation was showing
as one run-on line ("Is in a single line" in the request) instead of the several short lines it
should be. Fixed at the source: now splits on `\n` FIRST into hard-broken segments, then word-wraps
each segment independently by width. This is a general correctness fix, not narrowly scoped to the
one block that surfaced it — anywhere else Bengali paragraph text has an embedded `\n` benefits too
(table-cell rendering already handled this correctly via a separate code path — `bnCellLines` — this
was specifically a gap in the paragraph-text path, `drawBengaliText`/`wrapBengaliText`).

The salutation block itself (`DEFAULT_STAMP_TEXT.bn`) was replaced with the user's exact given text
for the Bengali version specifically (hardcoded, replacing the `{BANK_NAME}`/`{BRANCH_NAME}`/
`{BANK_ADDRESS}` token-filled lines that were there):
```
বরাবর,
ডেপুটি জেনারেল ম্যানেজার,
Sonali Bank,
Toyenbee Circular Road, Dhaka।
```
English's own salutation is untouched (still uses the 3 tokens) — only Bengali was flagged/corrected
this round. The 3 tokens themselves are untouched in `assembleStampApplicationText` (English still
needs them; removing a token from one language's template just means `.replace()` is a no-op for it
there, nothing breaks).

**Files**: `lib/kaFormDocuments.js`, `lib/bengaliText.js`,
`app/admin/export-dashboard/incentives/[applicationId]/page.jsx` (both panels no longer fetch or
thread a letterhead URL at all — that fetch/state/effect-dependency was removed cleanly, not just
left unused).

---

## Issue 2 — Packing List/BD Invoice/Buyer's Invoice: remove signature block, keep both modes

Confirmed first, not assumed: `ExportLicense.letterheadUrl` is a `required: true` field on that
model already (i.e. genuinely the primary source, matching "saved in export license"), with the
shipment page's existing resolution already `shipment.exportLicense?.letterheadUrl || <global
Settings letterhead>` — this was already correct from batch 10, no change needed for letterhead
*sourcing* itself. Also confirmed the "plain" mode (no letterhead/banner at all) already existed as
a `docStyle` toggle in the shipment editor's UI and remains fully intact.

The actual ask — removing the signature/stamp block — meant deleting it in 4 separate places it
existed, all now gone entirely (not hidden behind a flag):
- `lib/exportDocuments.js`: the `drawSignature()` function (drew a line + "Proprietor" + company
  name) and its 2 call sites (`generatePackingListPDF`, `generateInvoicePDF`).
- Same file's DOCX generator: the 2 trailing `Paragraph`s for signatory title + company name.
- Same file's XLSX generator: the 2 trailing rows for the same.
- `app/(print)/print/export/[shipmentId]/page.jsx`: the separate HTML print view had its own
  `SignatureBlock` component with 2 usages (Packing List, Invoice) — removed too, for consistency
  between the printed and downloaded copies (this round's wording — "printed or downloaded" — covers
  both pathways explicitly, unlike batch 10's letterhead work which was scoped to just "the PDF
  generator"). The declaration/certification text paragraph itself (a legal statement, unrelated to
  the physical signature) is untouched in all 4 places — only the signature/stamp portion is gone.

**Found while there, fixed for consistency (not explicitly asked, but directly adjacent and the
round's own "printed or downloaded" wording covers it)**: the print view's own header component
(`DocHeader`) still had the exact same stale "coded banner fallback + only-if-banner-shaped
restriction" that batch 10 had already replaced in the PDF generator with a clean "any aspect ratio,
full width, no coded fallback ever" approach — the print view was quietly left behind at the time
(noted as an explicit known gap in batch 10's own writeup). Brought it in line so Print and Download
produce the same result again.

**Files**: `lib/exportDocuments.js`, `app/(print)/print/export/[shipmentId]/page.jsx`.

---

## Issue 3 — "(In Foreign Currency)" bracket style

Confirmed the exact pattern via `grep -o` before touching anything (every " in Foreign Currency"
occurrence ends the descriptive phrase, immediately followed by either end-of-string or " &..." — no
overlap risk with the one structurally different string, "Payable Incentive Amount (in Taka: ... at
the TT Buying Rate of the Relevant Foreign Currency on the Date of Repatriation)", which describes a
formula rather than labeling a value's own currency — that one says "Relevant Foreign Currency", not
"...in Foreign Currency", so a literal find-replace on the space-prefixed pattern correctly leaves it
alone). Applied via a single sed pass across `lib/kaFormDocuments.js`, converting all 8 real
occurrences across the PDF, DOCX, and XLSX generators from "...in Foreign Currency" to
"...(In Foreign Currency)". Verified the untouched string afterward.

**Files**: `lib/kaFormDocuments.js`.

---

## Issue 4 — Section E "EXP No. & Date" missing year

Root cause, confirmed against the actual schema rather than assumed: `ExportShipment.expDate` is a
real, already-defined field (`Date` type), but the shipment editor form had NO input for it anywhere
— only `expNo` ("EXP No.") had a field. So `expDate` was always `null`/`undefined` in the database,
and the existing Ka Form code (`s.expDate ? new Date(s.expDate).getFullYear() : ''`) was already
correct in principle, just always hitting the empty fallback since the data literally never existed.
Confirmed this also affects a second, separate display (the Packing List/Invoice print view's own
"EXP: {no} {date}" info-grid line) — same root cause, same fix benefits it once admins start filling
the new field in, though that display wasn't itself part of this fix.

Two-part fix:
1. Added an actual "EXP Date" `<input type="date">` next to "EXP No." in the shipment editor,
   wired to the real `expDate` schema field, using the exact same date-input pattern already
   established for the (working) Shipment Date field — state (`expDateStr`), population from an
   existing shipment, and the save-payload conversion (`expDate: form.expDateStr ? new
   Date(form.expDateStr) : null`) all mirror `dateStr`/`date`'s own existing handling for
   consistency, not a new pattern.
2. In `assembleKaFormData` (`lib/kaFormDocuments.js`), added a fallback (`expNoWithYear` helper):
   when `expDate` isn't set, derive the year from the shipment's own `date` field instead (always
   populated — it's a required field) rather than showing nothing. This means already-saved
   shipments show a correct year immediately, not only ones saved after this fix went in. DOCX/XLSX
   automatically inherit this since both already consume the same `sectionERows`/`sectionERowsBn`
   from this one function — no separate fix needed there.

**Files**: `app/admin/export-dashboard/countries/[countryId]/buyers/[buyerId]/shipments/
[shipmentId]/page.jsx`, `lib/kaFormDocuments.js`.

---

## Issue 5 — Vercel deployment audit

Systematic sweep across the categories that actually cause real Vercel failures, each checked
directly rather than assumed clean:
- **Filesystem writes** (Vercel Serverless Functions have a read-only filesystem outside `/tmp`) —
  none found anywhere in `app`/`lib`/`scripts`. The `XLSX.writeFile()` calls that DO exist are all in
  confirmed `'use client'` browser modules, where SheetJS's `writeFile` triggers a browser download,
  not a server-side write — not a Vercel issue at all.
- **`middleware.js`** (runs on Vercel's Edge runtime by default — a restricted subset of Node) —
  already clean: uses only `next-auth/jwt`'s `getToken` (Edge-compatible by design) and
  `next/server`'s `NextResponse`, no Mongoose/`fs`/other Node-specific APIs.
- **`next.config.js`** — `images.domains` already includes `res.cloudinary.com` and the other
  external hosts actually used; `output: 'standalone'` researched specifically (a legitimate
  question, since it's primarily meant for self-hosted Docker) — confirmed via search this does not
  break a standard Vercel Git-integration deployment (Vercel has its own internal output tracing
  regardless of this flag; the file's own existing comment already noted this correctly). Left as-is.
- **Env var handling** — `lib/mongodb.js`'s fail-fast `throw` if `MONGODB_URI` is missing at import
  time is a deliberate, standard pattern (matches the official Next.js+MongoDB example), not a bug.
  NextAuth config (`lib/auth.js`) has no hardcoded URLs. No `child_process`/`worker_threads`/
  `process.exit` usage anywhere. No hardcoded `localhost` URLs in app/lib code. No routes declare
  `runtime = 'edge'` (so every API route gets the full Node.js runtime by default — fine, since
  Mongoose/bcryptjs/etc. all need it).

**3 concrete things found and fixed, not just confirmed-clean:**

1. **The cron job was never actually scheduled.** `app/api/cron/update-currency/route.js` already
   existed (currency rate refresh + low-stock inventory alerts) and already correctly checks a
   `CRON_SECRET` bearer token — but nothing told Vercel to actually call it on a schedule. Added
   `vercel.json` with a `crons` entry. Specifically scheduled once/day (`0 6 * * *`), not more
   frequently, because — confirmed via research, not assumed — Vercel's Hobby plan hard-rejects
   (fails the entire deployment, not just the cron feature) any cron expression more frequent than
   once per day. Documented in `.env.example` that Pro+ plans can safely tighten the schedule.

2. **No Node.js version pinned.** Added `"engines": {"node": "22.x"}` to `package.json`. Directly
   relevant right now: confirmed via research that Vercel is deprecating Node 20 for new deployments
   effective October 1, 2026 (about 7 weeks from this session), and the project's own devDependencies
   (`@types/node": "^20.11.20"`) suggested it was originally built Node-20-oriented with nothing
   pinning it away from whatever Vercel's own shifting default resolves to.

3. **Request body size limit — the significant one.** Confirmed via research this is a genuine,
   hard, non-configurable Vercel infrastructure limit: 4.5MB per request to a Serverless Function,
   enforced at the platform level, not something `next.config.js` or any app code can raise.
   `/api/upload` takes images as base64 inside a JSON body — a real risk for anything resembling an
   unresized phone-camera photo (routinely 3-8MB+ raw, before base64's own ~33% size overhead on top).
   Found that a prior round had already correctly diagnosed and solved exactly this
   (`lib/clientImageResize.js`'s `resizeImageFile` — client-side canvas resize/recompress before
   upload, with a code comment citing this exact reasoning) — but had only wired it into 3 of the
   app's 11 actual image-upload call sites (category admin thumbnails, Settings/branding images, the
   customer avatar uploader). The other 8 were still using raw, unresized `FileReader.readAsDataURL`:
   export categories, export licenses (the per-license letterhead), the main Settings company
   letterhead, the shipment editor's letterhead/photo/additional-document uploaders, product images,
   and banners. Wired all 8 into `resizeImageFile`, sized per use case — 2000px for letterheads
   (now used as full PDF page backgrounds per batch 10, so kept a higher ceiling to stay crisp; even
   at that resolution a banner/logo-style graphic compresses to well under the size budget), 1920 for
   banners (wide hero images), 1600 for photos/products/documents, 1200 for category thumbnails
   (matching the resolution already established for similarly-sized existing uses). 2 of the 8
   (the incentive application's file uploader, the shipment editor's "Additional Documents"
   uploader) accept PDFs as well as images — `resizeImageFile` rejects non-image files by design, so
   both were made conditional: an image goes through `resizeImageFile`, a PDF falls through to the
   original raw-FileReader path exactly as before. A large PDF specifically remains a real but
   smaller/rarer residual gap — client-side PDF recompression is a meaningfully bigger addition than
   reusing an existing image utility, and wasn't attempted this round; noted honestly rather than
   silently left unmentioned. Final sweep (`grep -rl "readAsDataURL"`) confirmed zero remaining
   unresized image upload call sites anywhere in the app — the only 2 `readAsDataURL` hits left are
   the intentional PDF-fallback branches just described.

**Files**: `vercel.json` (new), `package.json`, `.env.example`, `app/admin/export-dashboard/page.jsx`,
`components/admin/export-settings/ExportLicenseSection.jsx`,
`components/admin/export-settings/ExportCategorySection.jsx`,
`app/admin/export-dashboard/incentives/[applicationId]/page.jsx`,
`app/admin/export-dashboard/countries/[countryId]/buyers/[buyerId]/shipments/[shipmentId]/page.jsx`,
`app/admin/products/new/page.jsx`, `app/admin/banners/page.jsx`.

---

## Full list of files touched this batch
- `vercel.json` (new)
- `lib/exportDocuments.js`
- `lib/kaFormDocuments.js`
- `lib/bengaliText.js`
- `app/(print)/print/export/[shipmentId]/page.jsx`
- `app/admin/export-dashboard/incentives/[applicationId]/page.jsx`
- `app/admin/export-dashboard/countries/[countryId]/buyers/[buyerId]/shipments/[shipmentId]/page.jsx`
- `app/admin/export-dashboard/page.jsx`
- `components/admin/export-settings/ExportLicenseSection.jsx`
- `components/admin/export-settings/ExportCategorySection.jsx`
- `app/admin/products/new/page.jsx`
- `app/admin/banners/page.jsx`
- `package.json`
- `.env.example`
- `PROJECT_STATUS.md` (§19 added)

## Known gaps / judgment calls, flagged honestly
- Large PDF uploads (as opposed to images) at the 2 mixed-type upload points are not protected by
  the body-size-limit fix — see issue 5 above. A genuinely large scanned PDF could still hit
  Vercel's 4.5MB request limit. Client-side PDF compression would be the proper fix; not attempted.
- Did not audit function execution time limits (Vercel's default Serverless Function timeout) against
  the heavier DB-aggregation routes (e.g. Export Analytics) — no evidence of an actual problem, but
  also not something verifiable without a live database and real data volume to test against.
