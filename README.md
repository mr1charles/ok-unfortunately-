# Pixel Estates

A virtual-world land marketplace prototype: create a character, explore a grid-based world made
of individually-owned plots, buy land, decorate it, list it for sale, auction it off, and bid on
other players' land — all backed by a server-authoritative real-money economy (currently running
on a mock payment system for development).

This is a working full-stack prototype, not a mockup: real auth, a real Postgres database, a real
ledger, and a real (mock-money) economy with double-spend protection.

## Concept

- Players buy land directly from the platform, then can resell it to other players via direct
  listings or auctions — a real player-driven marketplace, not a one-and-done "pixel for a
  dollar" wall.
- The platform takes a configurable cut (10% by default) of every **player-to-player** sale.
  Direct platform purchases (buying unowned land) are not subject to this fee and are tracked as
  a separate transaction type.
- Land prices are set entirely by players. The app does not claim or imply any guaranteed return
  — see the disclaimers baked into onboarding and Settings.

## Stack

| Layer      | Tech |
|------------|------|
| Frontend   | React + TypeScript + Vite + Tailwind CSS + React Router |
| Backend    | Node.js + TypeScript + Express + Zod validation |
| Database   | PostgreSQL via Prisma ORM |
| Auth       | JWT (bearer token), bcrypt password hashing |
| Payments   | Pluggable `PaymentProvider` interface; `MockPaymentProvider` in dev |

Monorepo layout (npm workspaces):

```
shared/   Framework-free TS shared between client & server: config constants
          (PLATFORM_FEE_PERCENT default, world size, etc.), enums, DTO types,
          the decoration catalog.
server/   Express API + Prisma schema/migrations/seed + background jobs.
client/   React SPA (Vite).
```

## Why it's structured this way

- **Server-authoritative economy.** The client never sends or trusts a balance. Every
  balance-changing operation goes through `server/src/services/walletService.ts`, which debits
  with a conditional `UPDATE ... WHERE balance >= amount` (atomic, race-safe — no double-spend)
  and writes an immutable `Transaction` row in the same DB transaction as the ownership change.
  See `applyLedgerEntry` and how `landService`, `marketplaceService`, and `auctionService` all
  compose it inside `prisma.$transaction`.
- **One fee configuration.** `shared/src/config.ts` defines `PLATFORM_FEE_PERCENT_DEFAULT` — the
  seed value only. The live value lives in the single-row `PlatformConfig` table and is read
  through `platformConfigService.getPlatformFeePercent()`. No other file hardcodes a percentage.
  Admins can change it at runtime from the admin dashboard; every subsequent sale uses the new
  rate immediately, and each `Transaction` row records the rate that was actually applied
  (`feePercentApplied`) for audit purposes.
- **Payment abstraction.** `server/src/lib/payments/PaymentProvider.ts` defines the interface;
  `MockPaymentProvider` is the only implementation today. All game logic (buying, selling,
  auctions) operates on the internal wallet ledger — real money only crosses the platform
  boundary at deposit/withdrawal, which is exactly where a `StripePaymentProvider` would plug in
  later without touching any other file.
- **Auctions settle out-of-band.** `server/src/jobs/auctionCloser.ts` polls every 5s for expired
  auctions and calls `auctionService.settleAuction`, which determines the winner, re-validates
  their balance, transfers funds (with fee) and ownership, and notifies both sides. A production
  deployment would replace the polling loop with a durable scheduler; the settlement logic itself
  is already decoupled from how it gets triggered.

## Getting started

### Prerequisites

- Node.js 20+
- A local PostgreSQL server

### 1. Install dependencies

```bash
npm install
```

This also builds the `shared` package (via a `postinstall` hook) so both `server` and `client`
can resolve `@pixel-estates/shared`.

### 2. Configure the database

Create a database and copy the server env file:

```bash
createdb landmarket   # or use an existing Postgres instance
cp server/.env.example server/.env
# edit server/.env if your DATABASE_URL differs
```

### 3. Run migrations and seed test data

```bash
npm run prisma:migrate   # applies the schema to your database
npm run seed              # creates the world grid + test accounts
```

The seed script creates:

- A 24×24 world (576 plots), priced higher near the center of the map.
- An admin account: `admin@pixelestates.dev` / `admin123`
- Three player accounts, each starting with **$100.00** in mock funds:
  `alice@example.com`, `bob@example.com`, `carol@example.com` (password: `password123`)
- A couple of starter plots already owned, one active listing, and one live auction with a bid,
  so the app has something to look at immediately.

Re-running `npm run seed` is safe — it skips anything that already exists.

### 4. Run it

In two terminals:

```bash
npm run dev:server   # API on http://localhost:4000
npm run dev:client   # SPA on http://localhost:5173 (proxies /api to the server)
```

Open `http://localhost:5173` and log in with one of the seeded accounts (the login page has
one-click demo buttons), or register a new account — new accounts also start with $100.00 in
development mode.

### Useful scripts

| Command | What it does |
|---|---|
| `npm run typecheck` | Type-checks `shared`, `server`, and `client` |
| `npm run build` | Production build of all three packages |
| `npm run prisma:migrate` | Create/apply a Prisma migration (`server` workspace) |
| `npm run seed` | Re-run the seed script |

## Feature tour

- **Character creator** — skin tone, hair style/color, outfit style/color, one accessory, an
  accent color. Saved to the account and rendered both in the world and the sidebar.
- **World map** — a clickable grid of every plot, color-coded by status (🟩 available, 🟦 owned,
  🟨 listed, 🟧 auction, 🟥 admin-disabled). Your character walks around it with arrow keys/WASD;
  position is persisted (debounced) to your account.
- **Sidebar HUD** — always-visible balance, land count, active listings/bids, notifications, and
  navigation — styled as a game HUD panel, not a website navbar.
- **Marketplace** — browse every active listing and auction together, with type/price/sort
  filters (newest, price asc/desc, auction ending soon, owned by me).
- **Auctions** — starting price, optional reserve price, duration, live countdown, current
  bid/highest bidder. Bids are rejected client- and server-side if they exceed your balance.
  Winners are re-validated for sufficient funds at settlement time so a stale client balance
  can't manipulate the outcome.
- **My Land** — every plot you own, with quick actions to view, customize, list, auction, or
  cancel a listing/auction.
- **Land decoration** — each plot has a 6×6 buildable grid. A starter catalog (buildings, trees,
  paths, signs, furniture, lighting) is unlocked for every new account; placing/removing tiles is
  modeled as an `Inventory` + `LandDecoration` system so limited/purchasable items can be added
  later without a redesign.
- **Transactions** — full ledger of every purchase, sale, fee, deposit, and withdrawal.
- **Notifications** — land purchased/sold, auction won/lost, outbid, listing created/sold/removed,
  admin actions.
- **Settings** — mock wallet top-up/withdrawal, character re-customization, dark/light mode.
- **Admin dashboard** — platform stats (users, land sold, marketplace volume, fees collected,
  active listings/auctions, flagged transactions, open reports), the fee-percent control, user
  management (suspend/reinstate), transaction flagging, and report triage.

## Economy safety notes

- All purchases, sales, auction settlement, and balance changes are validated server-side; the
  client only ever displays what the server returns.
- Debits use a conditional atomic update guarded by `balanceCents >= amount`, so concurrent
  requests can never drive a balance negative.
- Buying your own listing, or bidding on your own auction, is explicitly rejected server-side.
- Every monetary movement writes an immutable `Transaction` row (gross, fee, net, and the fee
  rate that was actually applied), independent of the `LandOwnership` provenance ledger.

## What's intentionally out of scope for this prototype

- **Real payments.** `MockPaymentProvider` simulates instant success. Wiring up Stripe (or
  another processor) means implementing `PaymentProvider` for it and handling webhooks for
  deposit confirmation — no other file needs to change.
- **Real-time multiplayer.** The world map and marketplace poll on an interval rather than using
  websockets; other players' live positions aren't broadcast. Swapping in a socket layer wouldn't
  require changing the data model.
- **KYC/age verification/tax handling/refunds/chargebacks.** Required before any real-money
  launch; not implemented here. The `User` and `Transaction` models are deliberately structured
  so these can be layered on without a schema rewrite.
- **Decoration footprint collision.** Placement currently checks single-cell occupancy; the
  catalog already carries multi-cell `footprint` data for a future pass to use.

## Database schema

See `server/prisma/schema.prisma` for the full schema: `User`, `Character`, `Balance`,
`LandPlot`, `LandOwnership`, `Listing`, `Auction`, `Bid`, `Transaction`, `Notification`,
`InventoryItem`, `LandDecoration`, `PlatformConfig`, and `Report`.
