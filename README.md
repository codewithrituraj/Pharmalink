# PharmaLink

PharmaLink is a B2B pharmaceutical procurement workspace for verified manufacturers and stockists. It includes role-based authentication, manufacturer discovery and access requests, filtered catalogues, favourites, server-calculated purchase orders, FEFO stock reservation, order tracking, PDF documents, admin verification, and live operational dashboards.

## Run locally

Prerequisites: Node.js 20+ and npm.

```bash
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
```

Open http://localhost:3000. The development script uses Webpack because it is more reliable with the current Tailwind/PostCSS setup than the Turbopack CSS worker in this environment.

## Demo accounts

All demo accounts use `password@123`.

| Role | Email |
| --- | --- |
| Admin | `admin@pharmalink.com` |
| Manufacturer | `mfr@apex.com` |
| Stockist | `stockist@city.com` |

Passwords are stored as scrypt hashes, so `password@123` in the table above is the
value you type, not what sits in the database. New accounts must choose at least
8 characters and at most 128. Sign-in sets no minimum, so an account created
under the old 6 character rule is not locked out by the change. The demo
password is deliberately weak and public: replace it before this is exposed to
anyone.

## Where to edit what

- `src/app/login/page.tsx`: login and demo quick-fill panel.
- `src/app/*/page.tsx`: role dashboards and workflow screens.
- `src/app/api/**`: authenticated server routes.
- `src/components/ui/`: shared controls.
- `src/app/globals.css`: design tokens and global visual language.
- `prisma/schema.prisma`: database models.
- `prisma/seed.ts`: fictional demo organizations, products, batches, and access grants.

## Main workflows

- Admin: review pending business verifications at `/admin/verifications`.
- Manufacturer: review stockist access requests at `/manufacturer/access-requests` and manage products at `/manufacturer/catalogue`.
- Stockist: discover manufacturers and request access at `/stockist/manufacturers`.
- Stockist: search authorized catalogues, filter by dosage/strength/price/availability/prescription status, inspect product details, favourite products, save drafts, and place one-manufacturer purchase orders at `/stockist/catalogue`.
- Stockist: search/filter/export orders at `/stockist/orders`; inspect timelines, audit history, cancel valid orders, reorder, and download PO/invoice PDFs at `/stockist/orders/[id]`.
- Order placement uses a Prisma transaction and allocates inventory by earliest expiry date first. MOQ, scheme discount, GST, notes, and totals are calculated on the server.

Phase 2 adds the local `pdfkit` dependency for real purchase-order and invoice PDF generation.

## Useful commands

```bash
npm run dev              # start the Next.js app
npm run build            # production compile and type-check
npm run lint             # ESLint
npm run typecheck        # TypeScript check
npm test                 # unit tests, no server needed
npm run test:integration # order lifecycle and access control, needs a build
npm run verify           # typecheck + lint + unit tests
```

## Tests

`npm test` covers the business rules as pure functions: the FEFO allocator, the
price and discount arithmetic, the order status machine, and the analytics
forecasts. It needs nothing but the repository.

`npm run test:integration` runs three suites against a real server. The order
lifecycle suite checks that the routes call those rules correctly, that one
organization cannot read another's orders, and that cancelling puts stock back
where it came from. The authorization suite probes all 27 API routes with the
wrong caller: anonymous, a manufacturer against a stockist route, an admin
against a stockist route, and a stockist against a manufacturer or admin route.
A refusal is 401, 403, 404 or 400; a 2xx means the route answered someone it
should have refused. The page suite loads all 18 pages as the role that owns
each one, checks that the other two roles are turned away, checks that a visitor
with no session is sent to the login page, and checks that an address matching no
route answers 404 with the app's own page rather than Next's default. It needs a
seeded database and a production build:

```bash
npx prisma db seed
npm run build
npm run test:integration
```

The suite starts its own server on a free port and restores `prisma/dev.db`
afterwards, including when a run fails, so your working copy is left as it was
found. The dataset itself is not byte-for-byte reproducible between seeds, so
compare a dump rather than a checksum if you need to check the restore.

Because each suite owns that database outright, `test:integration` passes
`--test-concurrency=1`. Node's test runner runs separate files in parallel by
default, and two servers writing to one SQLite file at the same time produces
failures that look like application bugs. Keep it that way unless the suites are
given databases of their own.

The local SQLite database is `prisma/dev.db`. To reseed it manually, run `npx prisma db seed` after resetting or removing the local database.

## When a page goes wrong

Three files cover the failures a page can have, and they sit at different levels
on purpose:

- `src/app/not-found.tsx` answers any URL that matches no route. It renders
  outside the layouts, so it cannot know who is signed in and shows the same page
  to everyone. The stockist order page is not part of this: a mistyped or
  cancelled order id renders an explanation and a 200, because that order is part
  of the stockist's history and the order page is the right place to be.
- `src/app/error.tsx` catches a page that threw while rendering, inside the
  layouts and the app's own styling. In production the message a server
  component threw is withheld on purpose, so the screen shows the `digest` that
  matches the server log and offers a retry.
- `src/app/global-error.tsx` is the one before it, for a failure in the root
  layout itself, which a boundary does not catch. It replaces the root layout and
  therefore renders its own document with inline styles, since the app's
  stylesheet is not loaded at that level.

Drug-license verification in this prototype is simulated and does not replace regulatory compliance or professional review.
