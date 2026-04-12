# sheetsdb Roadmap

This document describes the full development plan for sheetsdb — from a minimal working ORM to a production-grade database layer for Google Sheets. Each milestone includes a specification, acceptance criteria, and e2e test requirements that must pass before the milestone is considered complete.

Tests are written first. No milestone ships without full e2e coverage.

---

## Guiding principles

- **Ship something working fast.** v0.1 should be usable in a real project within a week of starting to build.
- **Layer complexity deliberately.** Each version builds on the last without breaking it.
- **Tests first, always.** Every feature is specified as an e2e test before implementation begins.
- **Honest about limitations.** sheetsdb is not a replacement for a production relational database. We document what it can't do.

---

## v0.1 — It works

**Goal:** The absolute minimum to be genuinely useful. Connect to a spreadsheet, define a typed model, perform CRUD operations. No relations, no CLI, no magic. Just a typed interface to a sheet that works reliably.

### Spec

#### `createClient(config)`
- Connects to a Google Spreadsheet via service account credentials
- Accepts `spreadsheetId`, `clientEmail`, `privateKey`
- Validates connection on init — throws if spreadsheet is unreachable or credentials are invalid
- Exposes `client.raw` for direct access to the underlying `google-spreadsheet` instance

#### `defineModel(client, sheetName, schema)`
- Maps a sheet tab to a TypeScript model
- Reads the first row as column headers on first use
- Auto-manages a `_id` column (UUID v4) — creates it if missing, never overwrites it
- Infers TypeScript types from schema definition — `findMany` return type is fully typed
- Throws if the sheet tab does not exist

#### Type system (`t.*`)
| Type | Accepts | Returns |
|------|---------|---------|
| `t.string()` | any string | `string` |
| `t.number()` | numeric string | `number` |
| `t.boolean()` | `"TRUE"`, `"FALSE"`, `"true"`, `"false"`, `"1"`, `"0"` | `boolean` |
| `t.date()` | ISO 8601 string or Google Sheets date serial | `Date` |
| `t.enum([...])` | any listed value | literal union type |
| `.optional()` | empty cell | `T \| null` |

#### `Model.create(data)`
- Appends a new row to the sheet
- Auto-generates `_id` (UUID v4)
- Auto-sets `createdAt` if defined in schema
- Validates all required fields before writing
- Returns the created record with its `_id`

#### `Model.findMany(filter?, options?)`
- Returns all rows matching the filter
- No filter returns all rows
- Filtering is in-memory (full sheet fetch)
- Options: `limit`, `offset`, `sortBy`, `sortOrder`

#### `Model.findOne(filter)`
- Returns the first matching row or `null`

#### `Model.update(filter, data)`
- Updates all rows matching the filter
- Partial update — only specified fields are changed
- Returns the number of updated rows

#### `Model.delete(filter)`
- Deletes all rows matching the filter
- Processes deletions bottom-up to avoid index shifting
- Returns the number of deleted rows

#### `Model.count(filter?)`
- Returns the count of matching rows

#### Filter operators (v0.1)
```ts
{ field: value }                    // equality
{ field: { gt: value } }            // greater than
{ field: { gte: value } }           // greater than or equal
{ field: { lt: value } }            // less than
{ field: { lte: value } }           // less than or equal
{ field: { contains: string } }     // substring match (case-insensitive)
{ field: { startsWith: string } }   // prefix match (case-insensitive)
{ field: { endsWith: string } }     // suffix match (case-insensitive)
{ field: { isNull: true } }         // empty cell
{ field: { isNull: false } }        // non-empty cell
{ field: { in: value[] } }          // value in array
{ field: { notIn: value[] } }       // value not in array
```

### Acceptance criteria
- [ ] Can connect to a private spreadsheet with a service account
- [ ] Throws a clear error if credentials are invalid
- [ ] Throws a clear error if the sheet tab does not exist
- [ ] Creates a `_id` column if one does not exist
- [ ] `create` appends a row and returns it with `_id`
- [ ] `findMany` with no filter returns all rows typed correctly
- [ ] `findMany` with filter returns only matching rows
- [ ] `findOne` returns `null` when no match exists
- [ ] `update` modifies only specified fields
- [ ] `delete` removes rows without corrupting adjacent rows
- [ ] All type coercions work correctly (string → number, string → boolean, string → Date)
- [ ] `.optional()` fields return `null` for empty cells
- [ ] TypeScript infers return types correctly — no `any`

### e2e tests required
```
✓ connect with valid service account credentials
✓ throw on invalid credentials
✓ throw on missing sheet tab
✓ create a row and return it with _id
✓ create multiple rows sequentially without collision
✓ findMany with no filter returns all rows
✓ findMany with equality filter
✓ findMany with gt/gte/lt/lte on number field
✓ findMany with contains on string field
✓ findMany with startsWith on string field
✓ findMany with isNull filter
✓ findMany with in operator
✓ findMany with limit and offset
✓ findMany with sortBy asc and desc
✓ findOne returns first match
✓ findOne returns null when no match
✓ update changes only specified fields
✓ update returns count of affected rows
✓ delete removes correct rows
✓ delete bottom-up (no index shift corruption)
✓ delete returns count of affected rows
✓ count with no filter
✓ count with filter
✓ boolean type: TRUE/FALSE/true/false/1/0 all cast correctly
✓ number type: numeric strings cast to number
✓ date type: ISO strings cast to Date
✓ enum type: rejects values not in enum
✓ optional field: empty cell returns null
✓ TypeScript: findMany return type matches schema
```

---

## v0.2 — It's smart

**Goal:** Make sheetsdb safe to use in production. Caching, batching, rate limit handling, and query-pushed filtering for large sheets.

### Spec

#### In-memory caching
- Sheet data is cached after first fetch
- Cache TTL is configurable per client (default: 60 seconds)
- Write operations (`create`, `update`, `delete`) invalidate the cache for that model
- `Model.sync()` forces a cache refresh
- Cache is per-model, not per-spreadsheet

#### Request batching
- Multiple write operations queued within a configurable window (default: 50ms) are grouped into a single `batchUpdate` API call
- Batch counts as 1 request against Google's rate limit regardless of sub-request count
- Explicit flush via `client.flush()`
- Batch can be disabled per-operation: `create(data, { batch: false })`

#### Rate limit handling
- Built-in token bucket rate limiter (60 reads/min, 60 writes/min per user)
- Requests that would exceed the limit are queued, not dropped
- Exponential backoff with jitter on 429 responses
- `onRateLimit` callback for observability

#### Query-pushed filtering via `gviz/tq`
- For `findMany` calls with filters, sheetsdb optionally translates filters to Google Visualization Query Language and uses the `gviz/tq` endpoint
- Only matching rows are fetched — dramatically reduces payload for large sheets
- Enabled automatically when sheet row count exceeds a configurable threshold (default: 5000 rows)
- Can be forced: `findMany(filter, { strategy: 'push' })`
- Falls back to in-memory filtering if the filter cannot be translated

#### Pagination
```ts
const page = await Vendor.findMany(
  { status: 'Active' },
  { limit: 20, offset: 0 }
)
// page.rows → Vendor[]
// page.total → number
// page.hasMore → boolean
// page.nextOffset → number | null
```

### Acceptance criteria
- [ ] Second `findMany` call hits cache, not the API
- [ ] Cache invalidates after `create`/`update`/`delete`
- [ ] Multiple creates within 50ms are batched into one API call
- [ ] 429 responses are retried with backoff, not surfaced as errors
- [ ] `gviz/tq` filtering returns only matching rows from Google
- [ ] Pagination returns correct `total`, `hasMore`, `nextOffset`
- [ ] `Model.sync()` forces fresh fetch

### e2e tests required
```
✓ second read hits cache (assert API call count = 1)
✓ write invalidates cache
✓ Model.sync() forces API refetch
✓ 10 creates within 50ms result in 1 API write call
✓ rate limit: 61st request is queued, not dropped
✓ 429 response triggers retry with backoff
✓ findMany with strategy: push fetches only matching rows
✓ findMany fallback to in-memory when filter untranslatable
✓ pagination: limit and offset work correctly
✓ pagination: hasMore is true when more rows exist
✓ pagination: total reflects full unfiltered count
```

---

## v0.3 — It's relational

**Goal:** Link models together. `hasMany`, `belongsTo`, `manyToMany`. This is the feature that separates sheetsdb from every prior attempt — none of them got here.

### Spec

#### Relation definitions
```ts
Vendor.hasMany(Contact, { foreignKey: 'vendorId' })
Contact.belongsTo(Vendor, { foreignKey: 'vendorId' })

Product.manyToMany(Category, {
  through: ProductCategory, // junction model
  foreignKey: 'productId',
  otherKey: 'categoryId',
})
```

#### Eager loading
```ts
const vendors = await Vendor.findMany(
  { status: 'Active' },
  { include: { contacts: true } }
)
// vendors[0].contacts → Contact[]

// Nested include
const vendors = await Vendor.findMany(
  {},
  { include: { contacts: { include: { interactions: true } } } }
)
```

#### Lazy loading
```ts
const vendor = await Vendor.findOne({ name: 'AXT' })
const contacts = await vendor.contacts() // fetches on demand
```

#### Relation integrity
- `create` with a `belongsTo` relation validates the foreign key exists in the parent sheet
- `delete` with `hasMany` children throws by default — configurable with `onDelete: 'cascade'` or `onDelete: 'setNull'`

### Acceptance criteria
- [ ] `hasMany` eager load returns correct children per parent
- [ ] `belongsTo` eager load returns correct parent per child
- [ ] `manyToMany` resolves through junction model correctly
- [ ] Nested includes work two levels deep
- [ ] Lazy loading fetches on demand without caching parent
- [ ] Delete with children throws unless `cascade` or `setNull` configured
- [ ] Foreign key validation on create

### e2e tests required
```
✓ hasMany: findMany with include returns children per parent
✓ hasMany: parent with no children returns empty array
✓ belongsTo: findMany with include returns parent per child
✓ belongsTo: child with invalid foreignKey throws on create
✓ manyToMany: resolves through junction
✓ nested include: two levels deep
✓ lazy load: contacts() fetches correctly
✓ delete with hasMany children throws by default
✓ delete with onDelete: cascade removes children
✓ delete with onDelete: setNull nulls foreign keys
```

---

## v0.4 — It's ergonomic

**Goal:** CLI tools and full-text search. Developers can scaffold sheets from schemas. Non-developers can set up a sheet and have sheetsdb instantly wrap it.

### Spec

#### CLI: `sheetsdb init`
- Interactive setup: prompts for spreadsheet ID, service account credentials
- Generates a `sheetsdb.config.ts` file
- Creates missing sheet tabs based on defined models
- Writes header rows from schema

#### CLI: `sheetsdb introspect`
- Connects to an existing spreadsheet
- Reads all sheet tabs and their header rows
- Generates TypeScript model definitions
- Output: `models.generated.ts`

#### CLI: `sheetsdb migrate`
- Compares current schema to live sheet headers
- Adds missing columns (appended to the right)
- Warns about columns present in sheet but missing from schema
- Never deletes columns automatically

#### Full-text search
```ts
// Search across all string columns
const results = await Vendor.search('indium phosphide')

// Search specific columns
const results = await Vendor.search('AXT', { columns: ['name', 'notes'] })

// Combined with filters
const results = await Vendor.findMany(
  { status: 'Active' },
  { search: 'indium', searchColumns: ['notes'] }
)
```

#### Fuzzy matching
```ts
const results = await Vendor.findMany(
  {},
  { fuzzy: 'coheant', fuzzyColumn: 'name', threshold: 0.8 }
)
// Returns 'Coherent' despite typo
```

#### Cursor-based pagination
```ts
const page1 = await Vendor.findMany({}, { limit: 20 })
const page2 = await Vendor.findMany({}, { limit: 20, cursor: page1.nextCursor })
```

### Acceptance criteria
- [ ] `sheetsdb init` creates config and sheet tabs
- [ ] `sheetsdb introspect` generates valid TypeScript models from existing sheets
- [ ] `sheetsdb migrate` adds missing columns without data loss
- [ ] Full-text search returns rows containing the search term
- [ ] Fuzzy search returns close matches above threshold
- [ ] Cursor pagination is stable across row insertions

### e2e tests required
```
✓ init: creates sheet tab if missing
✓ init: writes header row from schema
✓ introspect: generates model matching sheet headers
✓ migrate: adds new column without touching existing data
✓ migrate: warns on unrecognised columns
✓ search: returns rows matching search term across columns
✓ search: case-insensitive
✓ fuzzy: returns close match above threshold
✓ fuzzy: excludes results below threshold
✓ cursor: page 2 starts after page 1
✓ cursor: stable when rows inserted during pagination
```

---

## v0.5 — It's live

**Goal:** Near-realtime change detection via polling. MCP server with one-click Cloudflare deploy. This is the version that makes sheetsdb viral.

### Spec

#### Polling watch
```ts
const unsub = Vendor.watch({ interval: 5000 }, (event) => {
  switch (event.type) {
    case 'created':
      console.log('New row:', event.row)
      break
    case 'updated':
      console.log('Changed:', event.id, event.diff)
      // event.diff → { field: { from: oldValue, to: newValue } }
      break
    case 'deleted':
      console.log('Removed:', event.id)
      break
  }
})

// Stop watching
unsub()
```

- Polls at configurable interval (minimum 2000ms to respect rate limits)
- Diffs against cached state to detect changes
- Field-level diffs for updates — `event.diff` shows exactly what changed
- Multiple watchers on the same model share a single poll

#### MCP server
A ready-to-deploy MCP server that exposes sheetsdb models as tools to Claude and other MCP clients.

**Tools exposed:**
```
sheets_find_many     — query rows with filters
sheets_find_one      — find a single row
sheets_create        — insert a new row
sheets_update        — update matching rows
sheets_delete        — delete matching rows
sheets_count         — count matching rows
sheets_search        — full-text search
sheets_list_models   — list available models and their schemas
sheets_watch_start   — start polling a model (SSE stream)
sheets_watch_stop    — stop polling
```

**One-click Cloudflare deploy:**
- "Deploy to Cloudflare" button in README
- Worker deploys to user's free Cloudflare account
- OAuth flow connects their Google account
- KV stores refresh token
- User gets `https://sheetsdb.USERNAME.workers.dev`
- Paste URL into Claude.ai → Settings → Connectors → done

**Zero infrastructure cost to the user.**

### Acceptance criteria
- [ ] Watch emits `created` event when a row is added to the sheet externally
- [ ] Watch emits `updated` event with correct field-level diff
- [ ] Watch emits `deleted` event when a row is removed externally
- [ ] `unsub()` stops polling
- [ ] Multiple watchers on same model share one poll interval
- [ ] MCP server exposes all 10 tools
- [ ] Cloudflare deploy completes in under 2 minutes
- [ ] Claude.ai can connect to deployed Worker as a connector
- [ ] Claude can query, create, update, delete rows via natural language

### e2e tests required
```
✓ watch: emits created when external row added
✓ watch: emits updated with field-level diff
✓ watch: emits deleted when external row removed
✓ watch: unsub stops polling
✓ watch: two watchers share one API poll
✓ watch: respects minimum interval of 2000ms
✓ mcp: sheets_find_many returns correct rows
✓ mcp: sheets_create inserts row and returns it
✓ mcp: sheets_update modifies correct rows
✓ mcp: sheets_delete removes correct rows
✓ mcp: sheets_search returns text matches
✓ mcp: sheets_list_models returns schema info
✓ cloudflare: worker deploys successfully
✓ cloudflare: OAuth flow completes
✓ cloudflare: connector URL works in Claude.ai
```

---

## v0.6 — It's reactive

**Goal:** Drive webhook integration for server-side deployments. Lower polling cost, faster change detection for Cloudflare Worker and server contexts.

### Spec

#### Drive webhook watch
```ts
// Server/Worker context only
const unsub = await Vendor.watchRemote({
  webhookUrl: 'https://your-worker.workers.dev/sheetsdb/hook',
  secret: process.env.WEBHOOK_SECRET,
}, (event) => {
  // Same event interface as polling watch
})
```

- Registers a Google Drive push notification channel
- When Google sends a change notification to `webhookUrl`, sheetsdb fetches and diffs
- Lower API cost than polling — one fetch per actual change, not per interval
- Channel expiration handled automatically (Drive channels expire after ~7 days, sheetsdb renews)
- Falls back to polling if webhook is unreachable

### Acceptance criteria
- [ ] Drive channel registered on `watchRemote` call
- [ ] Webhook receives notification and triggers fetch+diff
- [ ] Events emitted with same interface as polling watch
- [ ] Channel auto-renewed before expiry
- [ ] Falls back to polling if webhook endpoint returns non-200

### e2e tests required
```
✓ watchRemote: Drive channel created
✓ watchRemote: webhook triggers on external sheet change
✓ watchRemote: emits typed events
✓ watchRemote: channel renewed before 7-day expiry
✓ watchRemote: fallback to polling on webhook failure
```

---

## v1.0 — Production ready

**Goal:** OAuth support, full documentation site, comprehensive test coverage, npm package claimed, battle-tested.

### Spec

#### OAuth 2.0 auth
```ts
const client = createClient({
  spreadsheetId: 'YOUR_ID',
  auth: {
    type: 'oauth',
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  }
})
```

- Automatic token refresh (tokens expire after 1 hour)
- PKCE flow helper for browser/CLI contexts
- Token storage abstraction — plug in your own store

#### Production hardening
- Retry on transient network errors (5xx, timeouts) with configurable max attempts
- Request timeout per operation (default: 30s)
- Structured error types — `SheetsdbAuthError`, `SheetsdbNotFoundError`, `SheetsdbRateLimitError`, `SheetsdbValidationError`
- `onError` global handler

#### Documentation site
- Full API reference (auto-generated from TSDoc)
- Getting started guide
- Recipes: CRM, inventory tracker, CMS, form backend
- Migration guide from raw `google-spreadsheet`

#### npm package
- `sheetsdb` package name claimed
- Scoped packages: `@sheetsdb/core`, `@sheetsdb/mcp`, `@sheetsdb/cli`
- Semantic versioning enforced
- Changelog maintained

### Acceptance criteria
- [ ] OAuth flow completes and token refreshes automatically
- [ ] All 5 error types thrown in correct scenarios
- [ ] 100% e2e test pass rate across all prior milestones
- [ ] Documentation site deployed and publicly accessible
- [ ] npm package published and installable

### e2e tests required
```
✓ oauth: token refresh on expiry
✓ oauth: PKCE flow completes
✓ error: SheetsdbAuthError on invalid credentials
✓ error: SheetsdbNotFoundError on missing sheet
✓ error: SheetsdbRateLimitError queues and retries
✓ error: SheetsdbValidationError on schema violation
✓ retry: transient 503 retried up to max attempts
✓ timeout: operation exceeding 30s throws TimeoutError
✓ all v0.1 e2e tests pass
✓ all v0.2 e2e tests pass
✓ all v0.3 e2e tests pass
✓ all v0.4 e2e tests pass
✓ all v0.5 e2e tests pass
✓ all v0.6 e2e tests pass
```

---

## Summary

| Version | Headline | Key features |
|---------|----------|-------------|
| v0.1 | It works | CRUD, type system, basic filtering, auto ID |
| v0.2 | It's smart | Caching, batching, rate limits, query pushing, pagination |
| v0.3 | It's relational | hasMany, belongsTo, manyToMany, eager/lazy loading |
| v0.4 | It's ergonomic | CLI, introspection, full-text search, fuzzy, cursors |
| v0.5 | It's live | Polling watch, MCP server, Cloudflare one-click deploy |
| v0.6 | It's reactive | Drive webhooks, server-side push notifications |
| v1.0 | Production ready | OAuth, error types, docs site, npm published |

---

## Contributing

Want to help build sheetsdb? Start with v0.1 — pick any unchecked test from the e2e list, write the test first, then implement the feature. Open a PR and we'll review it.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions.
