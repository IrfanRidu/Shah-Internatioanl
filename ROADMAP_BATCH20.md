# BATCH 20 ROADMAP — 9 fixes requested 2026-08-20

This is the durable plan for the current session. If work is interrupted, `view` this file plus
AGENT_PROGRESS_20.md (created alongside this) to see exactly what's done and what's left — every
item below gets checked off in AGENT_PROGRESS_20.md AS it's completed, not in batch at the end.

Investigation was exhaustive (full data-flow tracing, not guessing) before any code was touched —
see /home/claude/work/SESSION_NOTES.md for the raw investigation trail if the reasoning behind a
fix ever needs re-deriving.

## Execution order (dependency-aware — schema first, then admin forms, then display, then the rest)
1. models/Product.js — add additionalFields[] (issue 7) + minimumOrderQuantityLocal/International (issue 8)
2. lib/utils.js — add getMoqForBuyer helper (issue 8); add normalizeSearchTerm + export escapeRegex (issue 4)
3. lib/exportColumns.js — make hsCode mandatory on bdInvoice (issue 1)
4. components/ui/Carousel.jsx — named group fix (issue 9)
5. app/admin/products/new/page.jsx — additionalFields UI (7), split MOQ inputs (8), upload name-hint (3), alt fix (3)
6. app/(shop)/products/[slug]/ProductDetailClient.jsx — render additionalFields (7), buyer-aware MOQ (8), alt fix (3)
7. app/admin/products/page.jsx — URL-synced page/search/category + returnTo links (6) + mobile card view (5)
8. app/admin/products/new/page.jsx (again) — read returnTo, fix redirect (6)
9. app/(shop)/page.jsx — restructure exclusion groups (2)
10. app/(shop)/products/[slug]/page.jsx — restructure exclusion groups (2)
11. app/api/products/search/route.js — use shared normalize/escape (4)
12. components/admin/ProductNameCombobox.jsx + ProductMultiSelect.jsx — image thumbnails (4)
13. lib/cloudinary.js + app/api/upload/route.js — descriptive public_id slugs (3)
14. Wire name-hint through banners/categories admin upload calls (3)
15. generateMetadata: product page + category page OG images/description (3); root layout OG image (3)
16. Remaining alt="" fixes across admin + public components (3)
17. Final syntax verification pass on every touched file
18. Zip + present

## ISSUE-BY-ISSUE DETAIL

### 1. HS Code missing from BD Invoice
ROOT CAUSE: 'hsCode' is a togglable/optional column per ExportCategory.documentColumns.bdInvoice. Any
category whose saved config doesn't include it (legacy save, unchecked box) makes it vanish from
EVERY rendering surface for that category's shipments (PDF/DOCX/XLSX/print/admin editor), since all
of them derive `columns` from the one shared `getDocumentColumns()`. Full data-flow (Product.hsCode →
admin form → auto-fill on pick → computeCategoryBreakdown → seed → cellText/renderItemCell render)
verified correct end to end — no bug there.
FIX (lib/exportColumns.js only):
- Remove 'hsCode' from AVAILABLE_COLUMNS.bdInvoice (packingList/buyerInvoice keep it, unaffected/untouched).
- getDocumentColumns(): after resolving category-override-or-default, force-prepend 'hsCode' when
  docKey === 'bdInvoice' and it isn't already present.
- This automatically also removes the now-meaningless checkbox from the category editor's column
  picker (ExportCategorySection.jsx generically iterates AVAILABLE_COLUMNS[docKey] — confirmed, no
  edit needed there) and automatically flows into BdInvoiceTable/ReadOnlyItemsView/PDF-gen/print (all
  derive `columns` from the same function — confirmed, no edits needed there either).

### 2. Product sections under-populated / must show a full row / no dup on same page
ROOT CAUSE: excludeIds threading in app/(shop)/page.jsx and app/(shop)/products/[slug]/page.jsx
currently makes EVERY section mutually exclusive of every other section, including purely
algorithmic/dynamic groupings that were never "selected for a campaign or section" in the user's own
words. When a category is dominated by seasonal overlap, the algorithmic sections starve each other.
FIX (both SSR page files):
- GROUP 1 (stays exclusive of everything, claims first): FlashSale campaigns + SpecialSections — the
  literal admin-curated "campaign or section" per the user's own wording.
- GROUP 2 (excludes only what Group 1 claimed, NOT each other): home page = Featured, Currently
  Harvesting, Available for Pre-Order, per-category carousels. Product page = Related, Recommended,
  Best Selling. A product CAN legitimately appear in more than one Group-2 section at once (normal
  e-commerce pattern) — this is what restores enough inventory to fill a row.
- No changes needed to Carousel.jsx's rendering (confirmed it renders 100% of what it's given), nor to
  /api/products/recommended or /api/products/best-selling routes (confirmed they're dumb "top-N
  excluding X" utilities driven entirely by the caller's exclude list — the orchestration lives only
  in the two page.jsx files being changed).
- Note for the user's final summary: if a section is STILL thin after this fix, the residual cause is
  most likely legitimate buyer-type (local/international) visibility restrictions on those specific
  products, not a bug — worth a quick look at the admin's own category/product data.

### 3. Dynamic slug/meta for images/icons/logo/banners (SEO)
Practical scope decided: (a) descriptive Cloudinary public_id slugs for NEW uploads going forward
(can't rename already-uploaded images without re-uploading — that's expected/acceptable), (b) proper
non-blank dynamic alt text everywhere, (c) OG/meta tag coverage on product + category pages + a
site-wide fallback OG image, (d) sitemap.js already thorough — confirmed, no change needed.
FIX:
- lib/cloudinary.js: uploadImage(base64Image, folder, seoName) — when seoName given, slugify it
  (reuse generateSlug from lib/utils.js) and pass as Cloudinary's public_id (+ short random suffix to
  avoid collisions), so new URLs read like `.../products/fresh-alphonso-mango-<id>.webp` instead of a
  random hash. app/api/upload/route.js: accept optional `name` in body, pass through.
- Wire a `name` hint from the 3 storefront-relevant admin upload call sites only (product form →
  form.name; banners page → form.title; categories page → form.name) — NOT the internal/admin-only
  upload sites (shipment docs, letterheads, incentive attachments — zero public SEO value, out of
  scope, avoids unnecessary risk).
- Fix confirmed blank `alt=""` instances (public-facing priority, admin ones too since they're trivial):
  ProductDetailClient.jsx thumbnail gallery (line 134), components/ui/ImageLightbox.jsx, 
  components/home/FlashSaleSection.jsx banner, admin products/new + banners preview thumbnails,
  ExportCategorySection.jsx, ExportLicenseSection.jsx, contracts/[contractId]/page.jsx.
- generateMetadata: product page → add openGraph{images,title,description}+twitter card, prefer
  product.metaTitle/metaDescription when set. Category page → currently only returns {title: cat.name},
  ignoring the metaTitle/metaDescription fields the schema already has (confirmed gap) — fix to use
  them + add openGraph image (cat.image).
- app/layout.jsx: add a site-wide fallback openGraph.images (site logo/settings) so any page without
  its own OG image still has one.

### 4. Search: case/punctuation/whitespace + images in suggestions
CONFIRMED already-working: main case-insensitivity ($options:'i') in buildProductQuery; header
SearchAutocomplete already shows product images. CONFIRMED gaps: no trim/punctuation normalization
anywhere (leading/trailing whitespace or stray punctuation breaks matches against clean product
names); ProductNameCombobox.jsx (shipment details page picker, explicitly named by the user) and
ProductMultiSelect.jsx (admin product pickers) show no thumbnail. Both comboboxes already hit the
shared /api/products endpoint (not a separate case-sensitive client-side filter) — confirmed via
full read, so fixing buildProductQuery fixes them too, no separate logic needed.
FIX:
- lib/utils.js: export escapeRegex (currently module-private); add + export normalizeSearchTerm()
  (trim → replace punctuation/symbols with space, unicode-aware → collapse whitespace → trim). Apply
  inside buildProductQuery's search branch. This one change covers: main /products listing page,
  admin products page, ProductNameCombobox, ProductMultiSelect (all 4 hit buildProductQuery via
  /api/products).
- app/api/products/search/route.js: import + reuse the same two helpers instead of its own local
  escapeRegex + bare .trim() (removes duplication, keeps header-search behavior identical/consistent).
- ProductNameCombobox.jsx + ProductMultiSelect.jsx: render a small thumbnail (`p.images?.[0]`) per
  suggestion row, matching SearchAutocomplete's existing pattern. images field already returned by
  /api/products (confirmed no .select() restriction on that route).

### 5. No product edit option in admin product list on mobile
CONFIRMED: no JS device-detection anywhere in admin (grep-verified zero hits); the Edit link itself
has no hiding classes. Root cause is structural: the whole 10-column table has no mobile-alternative
layout anywhere in this codebase (checked orders/customers too, same gap), so Actions (last column) is
off-screen without horizontal scroll — effectively undiscoverable on a phone.
FIX: app/admin/products/page.jsx — add a `md:hidden` stacked card list (image, name, category, price,
stock/status, and a clearly-tappable Edit button) above/instead of the table for small screens; wrap
the existing table in `hidden md:block` so desktop is unaffected.

### 6. Admin product edit always returns to page 1
CONFIRMED: AdminProductsPage's `page` state is plain useState(1), never reflected in the URL. Edit
links carry no return context. ProductForm's handleSubmit does `router.push('/admin/products')`
unconditionally on success (Cancel already correctly uses router.back(), which is why only "after
editing" is broken, not Cancel).
FIX (deterministic, not reliant on browser-history quirks):
- app/admin/products/page.jsx: read initial page/search/category from useSearchParams() on mount;
  useEffect to router.replace() the URL whenever they change (keeps the address bar accurate); reset
  page to 1 specifically in the search/category onChange handlers (adjacent legitimate bug: currently
  possible to get stuck on e.g. page 3 of a brand new filtered set with no results). Build Edit/Add
  links with `?returnTo=<encoded current querystring>`.
- app/admin/products/new/page.jsx (ProductForm): read `returnTo` via useSearchParams(); compute
  listUrl = returnTo ? `/admin/products?${returnTo}` : '/admin/products'; use listUrl for BOTH Cancel
  and the post-submit-success redirect (replacing router.back() and the unconditional push) so both
  paths are consistent and deterministic.

### 7. Admin: dynamic custom fields for new products, shown on product details page
FIX:
- models/Product.js: add `additionalFields: [{ label: String, value: String }]`.
- app/admin/products/new/page.jsx: repeatable add/remove row UI (label + value text inputs) in its
  own Section; included in the submit payload.
- ProductDetailClient.jsx: extend the EXISTING spec-grid array (the one already rendering Origin/
  Season/Min.Order/etc. as icon+label+value tiles, lines ~180-194) with one entry per additionalFields
  row — reuses the existing visual pattern exactly, no new UI component needed.

### 8. MOQ must differ for local vs international buyers
CONFIRMED gap: schema has exactly one `minimumOrderQuantity` field; admin form has one input; product
page reads it unconditionally regardless of viewer type.
FIX:
- models/Product.js: add `minimumOrderQuantityLocal` and `minimumOrderQuantityInternational` (both
  Number, default 1). KEEP the legacy `minimumOrderQuantity` field as-is (unused going forward by the
  UI, but left so nothing breaks) — do NOT delete it, avoids any migration risk.
- app/admin/products/new/page.jsx: replace the single "Min. Order Qty" input with two — Local MOQ /
  International MOQ.
- lib/utils.js: add `getMoqForBuyer(product, buyerType)` mirroring the existing getPriceForBuyer
  pattern exactly — falls back to legacy minimumOrderQuantity (then 1) if the new fields are unset, so
  existing products before this change still work sensibly.
- ProductDetailClient.jsx: use getMoqForBuyer(product, buyerType) (buyerType/isLocal already available
  in this component for other buyer-aware logic) everywhere minimumOrderQuantity was read — the qty
  state initializer, the decrement-button clamp, and the "Min. Order" spec tile.

### 9. Hover effect bleeds to every card in a section
CONFIRMED root cause: components/ui/Carousel.jsx wraps content in a PLAIN unnamed Tailwind `group`
(for its own arrow-hover-reveal), and ProductCard.jsx ALSO uses a plain unnamed `group` (for its own
image-zoom/overlay). Nested unnamed groups both respond to `group-hover:`, so hovering anywhere in the
carousel (including gaps/arrows) activates every card's hover effect at once. Confirmed
FlashSaleSection.jsx already correctly uses a NAMED group (`group/track`) — proves the pattern was
known but not applied to the generic Carousel component. Confirmed exactly which of ProductCard's 9
consumers are affected (the 6 that go through Carousel) vs safe (the 3 plain-grid ones) — matches the
user's "every section" report precisely.
FIX: components/ui/Carousel.jsx only — rename its wrapper's `group` → `group/carousel`, and its two
arrow buttons' `md:group-hover:opacity-100` → `md:group-hover/carousel:opacity-100`. ProductCard.jsx
needs NO change (its plain group becomes correctly isolated once Carousel stops using the same
unnamed namespace). Also fix the same latent pattern in PromoBannerStrip.jsx if it's multi-instance
under a shared group wrapper (lower priority, check while in the area).

## Verification approach (no live server/DB available — no network access)
- `node --check file.js` for plain JS files (syntax only).
- `npx tsc --noEmit --allowJs --jsx preserve <file>` style check for .jsx where useful, or careful
  manual re-read of the diff — tsc alone won't catch React/logic issues, just parse errors.
- Manual trace of every changed data path against what was verified during investigation.
- Re-`view` a file immediately before editing it (tool requirement) and immediately after (confirm
  the change landed as intended) for anything non-trivial.
