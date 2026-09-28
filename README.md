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

All demo accounts use `password123`.

| Role | Email |
| --- | --- |
| Admin | `admin@pharmalink.com` |
| Manufacturer | `mfr@apex.com` |
| Stockist | `stockist@city.com` |

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
npm run dev       # start the Next.js app
npm run build     # production compile and type-check
npm run lint      # ESLint
npx tsc --noEmit  # TypeScript check
```

The local SQLite database is `prisma/dev.db`. To reseed it manually, run `npx prisma db seed` after resetting or removing the local database.

Drug-license verification in this prototype is simulated and does not replace regulatory compliance or professional review.
