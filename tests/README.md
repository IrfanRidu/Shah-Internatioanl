# Tests

Unit tests for the project's pure-logic modules — no database, no DOM, no Next.js runtime required, so they run in well under a second.

```bash
npm test          # run once
npm run test:watch  # watch mode
```

## What's covered

| File | Tests |
|---|---|
| `lib/utils.js` | Slug generation, currency formatting/conversion, financial metrics calculation (gross/net revenue, COGS, AOV), order number generation, WhatsApp link building, role helpers, pagination, product query building |
| `lib/permissions.js` | The granular RBAC `hasPermission()` gate — superAdmin/admin bypass, editor role respecting (or correctly denying) their assigned permission matrix, buyer roles always denied |
| `lib/validators.js` | Zod schemas for registration, login, orders, coupons, and quotations — valid/invalid cases including the coupon-code uppercase transform and schema defaults |

## What's intentionally *not* covered here

This is a unit-test suite for pure functions, not an end-to-end test suite. It does not cover:

- API routes (would need a running MongoDB + mocked `next-auth` session)
- React component rendering/interaction (would need `@testing-library/react` + jsdom)
- The actual Next.js build/runtime

If you want to extend this, a reasonable next step is `@testing-library/react` + `jsdom` for component tests, and a separate integration suite (e.g. against a `mongodb-memory-server` instance) for the API routes — particularly worth covering: `hasPermission()` actually being enforced end-to-end on the products/orders routes, and the order status → inventory deduction logic in `app/api/orders/[id]/route.js`.

## A note on verification

`lib/utils.js` and `lib/permissions.js` have **zero dependency on database/session/Next.js internals**, so during development every assertion in their test files was actually executed against the real implementation (via a throwaway Node script, working around this sandbox's lack of npm registry access) and confirmed passing — 62 assertions total. `lib/validators.js` depends on the `zod` package, which could not be installed in this sandbox (no network access), so its test file is written against zod's well-documented v3 API but has **not** been executed here. Run `npm test` after `npm install` to confirm it for yourself — it should pass, but treat it as unverified until you do.
