# sheetsdb — Agent Guide

This file tells Claude Code agents everything they need to know about the sheetsdb project.

## What is sheetsdb?

A TypeScript ORM for Google Sheets. It turns any Google Spreadsheet into a typed database with a clean API:

```ts
const Vendor = defineModel(client, 'Vendors', {
  name:     t.string(),
  status:   t.enum(['Active', 'Contacted']),
  rating:   t.number(),
  notes:    t.string().optional(),
})

await Vendor.create({ name: 'AXT', status: 'Active', rating: 4.5 })
await Vendor.findMany({ status: 'Active' })
await Vendor.update({ name: 'AXT' }, { status: 'Contacted' })
await Vendor.delete({ name: 'AXT' })
```

## Tech stack

- **Language:** TypeScript (strict mode, no any in public API)
- **Runtime:** Node.js 20+
- **Core dependency:** `google-spreadsheet` npm package (transport layer)
- **Auth:** Google service account (JWT)
- **Tests:** Jest, e2e against real Google Spreadsheet (no mocks)
- **Lint:** ESLint with TypeScript rules

## Project structure

```
src/
  index.ts        ← public API exports only
  client.ts       ← createClient()
  model.ts        ← defineModel() and SheetsdbModel class
  types.ts        ← t.string(), t.number(), t.boolean(), t.date(), t.enum()
  filters.ts      ← in-memory filter engine
  coercions.ts    ← read/write value coercions
  errors.ts       ← SheetsdbError, SheetsdbAuthError, etc.
tests/
  e2e/            ← all tests run against real spreadsheet
  helpers/        ← createTestSheet, seedVendors, fixtures, delay
  setup.ts        ← Jest globalSetup
  teardown.ts     ← Jest globalTeardown
```

## Key rules

### Never break the public API
The public API is: `createClient`, `defineModel`, `t.*`, and the model methods (`findMany`, `findOne`, `create`, `update`, `delete`, `count`). These signatures must not change without a major version bump.

### No `any` in public API
TypeScript strict mode is on. The return type of `findMany` must be fully inferred from the schema. Use generics and mapped types.

### Tests are the spec
The e2e tests in `tests/e2e/` define correct behavior. If a test fails, the implementation is wrong — not the test. Never modify test assertions to make tests pass. Never use `.skip()`.

### Error messages must be human-readable
Every error must tell the developer exactly what went wrong and what to do:
- ❌ "Validation failed"
- ✅ "Field 'rating': expected number, got 'abc'"

### Bottom-up deletion
`delete()` must always process rows in descending row index order to avoid index shifting. This is non-negotiable.

### _id is sacred
The `_id` column (UUID v4) is auto-managed. It must never be overwritten. It must never be exposed as writable in the public API.

## Commit style

```
feat: add Model.findOne()
fix: bottom-up deletion order in Model.delete()
test: add edge cases for t.date() serial number parsing
docs: update README with filter operator examples
chore: add ESLint rule for no-explicit-any
```

## PR conventions

Every PR body **must** contain `Closes #N` (or `Fixes #N` / `Resolves #N`) linking to the GitHub issue it implements. This is required because:

- The CI review agents use this to build milestone context — they need to know which issue the PR covers so they don't flag intentionally deferred work as missing
- GitHub auto-closes the linked issue when the PR merges

## Running things locally

```bash
npm ci                    # install deps
npm run lint              # eslint
npx tsc --noEmit          # typecheck
npm run test:e2e          # e2e tests (needs env vars)
npm run test:cleanup      # delete leftover test_* sheet tabs
```

## Environment variables for testing

```bash
SHEETSDB_TEST_CLIENT_EMAIL=...
SHEETSDB_TEST_PRIVATE_KEY=...
SHEETSDB_TEST_SPREADSHEET_ID=...
```

## Current milestone: v0.1

See ROADMAP.md for full spec. See GitHub Issues for individual task breakdowns.
Every issue has exact acceptance criteria and a list of required e2e tests.
