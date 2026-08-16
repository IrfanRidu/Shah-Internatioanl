# AGENT PROGRESS TRACKER — Shah International — Batch 18 (R32)
# 2 new requirements: (1) Ka Form Section E "EXP No. & Date" field shows a redundant date next to
# the EXP No (both Bengali and English versions) — remove the date, EXP No alone is enough since it
# already carries a year. (2) Uploaded banners never appear anywhere on the site — should appear
# per their type (e.g. a "hero" banner should replace the default hero section on the homepage).
#
# >>> READ THIS FILE FIRST ON EVERY RESUME/CONTINUE. <<<
# Then AGENT_PROGRESS_17.md + PROJECT_STATUS.md if more historical context is needed.
# Continuing directly in the SAME working directory as batch 17 (/home/claude/work/extracted) —
# this already contains every batch-17 fix, verified and delivered as shah-international-v21.zip.
# No fresh extraction needed; this session's sandbox state persisted from the prior conversation
# turn. Do NOT re-extract shah-international-v20.zip — that would silently discard all of batch 17.

## ============ LIVE STATUS ============
CURRENT PHASE: Both requirements complete, fully verified, PROJECT_STATUS.md updated. Packaging.
LAST COMPLETED STEP: Consolidated tsc pass on all 8 touched files (clean); orphan-reference greps
  (expNoWithDate fully gone; heroBanners/promoBanners/popupBanners thread correctly end to end;
  new component exports match their imports everywhere); whole-project sweep — every .jsx (129)
  and .js (131) file in the entire project parses cleanly, 260 total (2 more than batch 17's 258,
  matching the 2 new component files). Updated PROJECT_STATUS.md with "## 26. Batch 18 — ..."
  (renumbered Setup Reminder to #27), verified section structure lands correctly.
NEXT STEP: Zip /home/claude/work/extracted -> shah-international-v22.zip, verify integrity +
  fresh-extraction spot checks (same discipline as batch 17's delivery), present to user.
BLOCKERS: none.

## ============ TASK COMPLETE ============
Both requirements implemented, individually tsc-verified, cross-checked for orphaned references,
and verified via a full whole-project syntax sweep (260/260 files clean). Ready to package as
shah-international-v22.zip.

## ============ REQUIREMENT 2 — FULL PLAN (banners never appear; should appear per type) ============
Scope decision: the user's literal example is hero ("hero banner should replace the default hero
section") but the stated PRINCIPLE is general ("it should appear according to it's type"), and the
Banner model was clearly built with all 4 types (hero/promotional/popup/side) + a `position` field
(home/products/all) in mind from the start — none of the 4 currently render anywhere. Fixing only
hero would leave 3 of 4 types silently broken despite the general principle being the actual ask,
so all 4 are in scope. Where a type's placement is genuinely ambiguous (no existing sidebar
anywhere on the site for a literal "side" placement), the most honest choice is a clearly-labeled,
well-reasoned interpretation rather than inventing new page layout structure — documented per-type
below and will be stated plainly in the final summary to the user, not hidden.

1. **API**: app/api/banners/route.js GET — add a `position` query param alongside the existing
   `type` one, matching `position === requested || position === 'all'` (a banner set to 'all'
   should satisfy either page's request). Support comma-separated `type` (e.g.
   `?type=promotional,side`) so the promo-strip fetch can grab both types in one request. Purely
   additive — no change to existing behavior for callers that don't pass these params (the admin
   page's own `?adminView=true` fetch, and any other existing caller, is unaffected).

2. **Hero** (components/home/HeroSection.jsx): when `banners.length > 0`, render the FIRST banner
   (banners[0] — already sorted by displayOrder from the query) as a full replacement of the
   default hero: full-bleed image (banners[0].image, or mobileImage on small screens if set) as
   the section background, a dark gradient scrim for text readability, banner.title as the heading
   (falls back to reasonable styling if very long/short), subtitle/description as supporting copy,
   ONE CTA button using buttonText (falls back to "Shop Now") + link (falls back to "/products").
   Keeps the scroll indicator and GSAP entrance animation for visual/motion continuity with the
   rest of the site. When `banners.length === 0` (the common case for any site that hasn't
   uploaded a hero banner yet), the EXISTING default hero renders completely unchanged — zero
   visual regression for sites with no banners configured. Only ever shows ONE hero banner even if
   several exist (matches the user's singular phrasing "hero banner should replace..."; a rotation/
   carousel between multiple concurrent hero banners is a reasonable future extension but not what
   was asked, and would be a materially bigger, riskier change to the animation-heavy existing
   component — noting this as a design choice, not silently deciding it).

3. **Promotional + Side** (new components/home/PromoBannerStrip.jsx): both types render through
   this ONE shared component, as a horizontal strip of clickable cards (image, title, subtitle,
   optional CTA button, optional backgroundColor/textColor override — mirrors the styling
   conventions already established in components/home/SpecialSection.jsx: max-w-7xl container,
   py-10 spacing, Playfair Display heading font, GSAP scroll-triggered fade-in). Renders nothing
   (returns null) when given an empty array, so a site with none configured sees no gap/empty
   section. Documenting plainly: the codebase has never established a visual distinction between
   "promotional" and "side" (no sidebar exists anywhere on the site to give "side" a literal
   meaning), so rather than inventing a fake distinct treatment, both render identically through
   this one component — an honest, maintainable choice over a speculative one. Homepage: shown
   after Categories, before Featured Products (a standard early-page promo placement). Products
   page: shown near the top, after the header/before the search bar.

4. **Popup** (new components/home/BannerPopup.jsx): renders the FIRST active popup banner (if any)
   as a centered, dismissible overlay — appears ~1.2s after mount (avoids jarring the very first
   paint), image-forward with a small corner close (X) button, optional title/subtitle/CTA below
   the image. Dismissal is remembered per-banner-ID via sessionStorage (so creating a NEW popup
   banner later still shows it, even if an old one was dismissed earlier in the same session; and
   it re-shows on the next browser session, which is standard/expected marketing-popup behavior).
   A bespoke component rather than reusing components/ui/Modal.jsx — that component's title-bar-
   plus-padded-body style is built for admin settings forms, not an edge-to-edge marketing image.

5. **Homepage wiring**: app/(shop)/page.jsx (server component) — add 2 more Promise.all queries:
   `promoBanners` (Banner.find({isActive:true, type:{$in:['promotional','side']}, position:{$in:
   ['home','all']}})) and `popupBanners` (same pattern, type:'popup'), both sorted by
   displayOrder, both .lean(). Return both from the page's data object. app/(shop)/
   HomeClientWrapper.jsx — accept the 2 new props, render <PromoBannerStrip> in the block list
   (see placement above) and <BannerPopup> once (order-independent, it's a fixed-position overlay).

6. **Products-page wiring**: app/(shop)/products/page.jsx (client component, fetches its own
   data) — add a small useEffect fetching `/api/banners?type=promotional,side&position=products`
   and another for `/api/banners?type=popup&position=products`, store in state, render
   <PromoBannerStrip> and <BannerPopup> at the placements described above.

FILES TO TOUCH: app/api/banners/route.js, components/home/HeroSection.jsx, NEW components/home/
PromoBannerStrip.jsx, NEW components/home/BannerPopup.jsx, app/(shop)/page.jsx, app/(shop)/
HomeClientWrapper.jsx, app/(shop)/products/page.jsx. Confirmed next.config.js already has
res.cloudinary.com in image domains — next/image will work in the new components without config
changes, matching the admin banners page's own already-working usage.

## ============ VERIFICATION TOOLING (carried over from batch 17, re-confirm still available) ============
tsc syntax-check command (tested working in batch 17):
  export PATH="$PATH:/home/claude/.npm-global/bin" && tsc --noEmit --allowJs --checkJs false \
    --jsx preserve --target es2020 --module esnext --moduleResolution bundler --noResolve \
    --skipLibCheck <file>
Known sandbox shell gotchas from batch 17 (this is /bin/sh, NOT bash):
  - No bash array literals (`FILES=(...)`) — use a plain-text file + `while IFS= read -r f`.
  - No process substitution (`<(...)`) — split into separate commands instead.
No network access (npm registry 403s) — no `npm install`, no real `next build`.
