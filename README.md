# sheetsdb

**Turning Google Sheets into a database.**

A lightweight, type-safe TypeScript ORM for Google Sheets. Define schemas, query rows, manage relations — all against a spreadsheet your team already uses and understands.

---

## Why sheetsdb?

Google Sheets is everywhere. Product teams track inventory in it. Sales teams run their CRM from it. Founders manage operations in it. It has auth, history, sharing, a GUI — everything a small database needs except one thing: a proper developer interface.

The raw Google Sheets API returns untyped arrays. You get `row[0]`, `row[1]`, `row[2]`. No types. No queries. No relations. No caching. Every developer who's tried to build on top of Sheets has ended up writing the same boilerplate — fetch all rows, filter in memory, pray nothing breaks when columns shift.

sheetsdb fixes that. Define your schema once, and get a typed, queryable, relation-aware database backed by a spreadsheet.

---

## What already exists — and why we built this anyway

We did the research before building. Here's what we found:

### `sheetsdb` (npm, 2015)
The original package with the same name. Callback-based, built against the deprecated Sheets API v3, last published in 2015. No TypeScript, no queries beyond basic insert/select, no maintenance. A ghost.

### `google-spreadsheet` (npm, actively maintained)
The best low-level wrapper for the Sheets API — ~50,000 downloads/week, actively maintained, solid TypeScript support. sheetsdb is built **on top of** this package. It gives you clean access to the API but is explicitly not an ORM: no schema definition, no query builder, no type enforcement, no caching, no relations. You still get raw rows.

### `@it-econonomia/google-spreadsheet-orm` (GitHub, abandoned)
The closest prior art to what we're building. Uses TypeScript decorators (`@worksheet`, `@column`) to map classes to sheets — the right idea architecturally. But it uses the raw `googleapis` package directly, references sheets by index number (fragile), has no filtering beyond basic equality checks, no caching, no relationships, and requires `experimentalDecorators`. Last commit: years ago. 11 stars, 5 forks, 0 issues.

### `google-sheets-orm` (npm, abandoned)
Last published 4 years ago. No TypeScript. No dependents. Nothing to learn from here.

### `tarang-db` (npm, November 2025)
The most recent attempt, and the most ambitious design — Prisma-like syntax, `findMany`, `hasMany`/`belongsTo` relations, auto UUID, soft deletes, smart caching. The API design is genuinely good. But it launched once on DEV Community with zero marketing, zero community, and 1 download per week. The author has no following and the project appears abandoned 6 months after launch.

### SheetDB, Sheety, Sheet.best (hosted services)
These are paid proxy services that turn your sheet into a REST endpoint. They work but add a billing layer on top of a free API, don't solve typing, can't do relations, and require your data to go through someone else's servers. They're also limited to simple GET/POST operations — no schema, no query builder, no aggregation.

### Stein (open source, abandoned)
The only open-source Sheets-to-API proxy. MIT license, Node.js, 830 stars — but unmaintained since January 2023. No TypeScript. No types. No relations.

---

**The gap is clear.** Every project that tried to build an ORM layer on top of Google Sheets has been a solo side project that shipped once and died. Nobody has done it with proper TypeScript-first design, good documentation, a real community, and active maintenance.

sheetsdb is the attempt to get it right.

---

## Quick start

```bash
npm install sheetsdb
```

```ts
import { createClient, defineModel, t } from 'sheetsdb'

// 1. Connect
const client = createClient({
  spreadsheetId: 'YOUR_SPREADSHEET_ID',
  auth: {
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL!,
    privateKey: process.env.GOOGLE_PRIVATE_KEY!,
  }
})

// 2. Define a model
const Vendor = defineModel(client, 'Vendors', {
  name:        t.string(),
  category:    t.string(),
  status:      t.enum(['Active', 'Contacted', 'Negotiating']),
  lastContact: t.date().optional(),
  notes:       t.string().optional(),
})

// 3. Query
const activeVendors = await Vendor.findMany({ status: 'Active' })
const axt = await Vendor.findOne({ name: 'AXT' })

// 4. Write
await Vendor.create({ name: 'Coherent', category: 'InP Supplier', status: 'Active' })
await Vendor.update({ name: 'AXT' }, { status: 'Negotiating' })
await Vendor.delete({ name: 'AXT' })
```

That's it. Your Google Sheet is now a typed database.

---

## Core concepts

### Sheets as tables
Each sheet tab in your spreadsheet maps to a model. The first row is always the header — sheetsdb reads it to understand your columns. You can keep editing the sheet manually; sheetsdb won't break if you add or reorder columns.

### Auto-managed IDs
sheetsdb automatically manages a `_id` column (UUID) in each sheet. This gives every row a stable identity that survives row insertions, deletions, and reordering. You never reference rows by index.

### Type system
Every column has a declared type. sheetsdb casts values on read and validates on write. No more `"true"` strings that should be booleans or `"2024-01-15"` strings that should be dates.

| Type | Sheet value | JS value |
|------|-------------|----------|
| `t.string()` | `"AXT"` | `"AXT"` |
| `t.number()` | `"42"` | `42` |
| `t.boolean()` | `"TRUE"` | `true` |
| `t.date()` | `"2024-01-15"` | `Date` object |
| `t.enum([...])` | `"Active"` | `"Active"` |

### Caching
sheetsdb caches sheet data in memory after the first read. Subsequent reads are instant. Cache invalidates automatically on any write. TTL is configurable (default: 60 seconds).

### Relations
Link models together using foreign key columns. sheetsdb resolves relations across sheets with a single query call.

```ts
const Contact = defineModel(client, 'Contacts', {
  name:     t.string(),
  email:    t.string(),
  vendorId: t.string(), // foreign key
})

Vendor.hasMany(Contact, { foreignKey: 'vendorId' })
Contact.belongsTo(Vendor, { foreignKey: 'vendorId' })

// Eager loading
const vendors = await Vendor.findMany(
  { status: 'Active' },
  { include: { contacts: true } }
)
// vendors[0].contacts → Contact[]
```

---

## API reference

### `createClient(config)`
Creates a client connected to a spreadsheet.

```ts
const client = createClient({
  spreadsheetId: string,       // The ID from your sheet's URL
  auth: {
    clientEmail: string,       // Service account email
    privateKey: string,        // Service account private key
  },
  cacheTTL?: number,           // Cache TTL in ms (default: 60000)
})
```

### `defineModel(client, sheetName, schema)`
Defines a model backed by a sheet tab.

```ts
const Model = defineModel(client, 'SheetName', {
  columnName: t.type(),
  ...
})
```

### Model methods

| Method | Description |
|--------|-------------|
| `Model.findMany(filter?, options?)` | Find all rows matching filter |
| `Model.findOne(filter)` | Find first matching row |
| `Model.create(data)` | Insert a new row |
| `Model.update(filter, data)` | Update matching rows |
| `Model.delete(filter)` | Delete matching rows |
| `Model.count(filter?)` | Count matching rows |
| `Model.sync()` | Force cache refresh |

### Filter operators

```ts
// Equality
{ status: 'Active' }

// Comparison
{ age: { gte: 18 } }
{ age: { lte: 65 } }
{ age: { gt: 0, lt: 100 } }

// Text
{ name: { contains: 'Corp' } }
{ name: { startsWith: 'A' } }

// Null checks
{ notes: { isNull: true } }
```

---

## Authentication

sheetsdb uses a Google service account for authentication. This is the simplest and most reliable method for server-side use.

**Setup:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project and enable the **Google Sheets API**
3. Create a **Service Account** and download the JSON key
4. Share your spreadsheet with the service account email (Editor access)
5. Set `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` in your environment

---

## Limitations

sheetsdb is a great fit for small-to-medium datasets (up to ~50,000 rows per sheet). It is not a replacement for a production relational database. Some things to know:

- **No server-side filtering** — the Sheets API returns all rows; filtering happens in memory
- **Rate limits** — Google allows 60 reads and 60 writes per minute per user; sheetsdb batches operations automatically
- **No transactions** — concurrent writes can conflict; last write wins
- **10 million cell limit** — Google's hard limit per spreadsheet

For most internal tools, CMS backends, and small-team applications, these constraints are not a problem.

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full plan.

**v0.1 — Core ORM**
- [ ] `createClient` with service account auth
- [ ] `defineModel` with schema and type system
- [ ] `findMany`, `findOne`, `create`, `update`, `delete`, `count`
- [ ] Auto-managed `_id` column
- [ ] In-memory caching with TTL
- [ ] Filter operators (eq, gt, lt, contains, startsWith, isNull)

**v0.2 — Relations**
- [ ] `hasMany`, `belongsTo`, `manyToMany`
- [ ] Eager loading via `include`
- [ ] Cross-sheet foreign key validation

**v0.3 — Developer Experience**
- [ ] CLI: `sheetsdb init` — scaffold a sheet from a schema
- [ ] CLI: `sheetsdb migrate` — sync schema changes to an existing sheet
- [ ] Schema introspection: generate a schema from an existing sheet

**v1.0 — Production Ready**
- [ ] OAuth 2.0 auth (in addition to service accounts)
- [ ] Batch write queue with automatic flush
- [ ] Change detection via polling with typed events
- [ ] Full test coverage
- [ ] Comprehensive documentation site

---

## Contributing

sheetsdb is open source and MIT licensed. Contributions are welcome.

```bash
git clone https://github.com/pA1nD/sheetsdb
cd test2
npm install
npm test
```

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a PR.

---

## License

MIT © Björn Schmidtke
