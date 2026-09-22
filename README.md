# Pixel Estates

A persistent, player-built virtual world: walk around a real 3D island, buy individual pixels of
land (up to 100,000,000 of them), watch them become yours, connect them into properties, build
and decorate, defend your land with shields, attack other players for gameplay credits, and trade
land on a player-driven marketplace with auctions - all backed by a server-authoritative
real-money economy.

The project has three parts:

| Part | Tech | What it's for |
|---|---|---|
| **`game-client/`** | **Godot 4.3** | The actual 3D game: character, movement, camera, the pixel world, mining, building, shields, attacks. This is the primary interactive experience. |
| **`client/`** | React + TypeScript + Vite + Tailwind | Web app for account creation, the 2D marketplace/auctions, wallet, player profile, admin dashboard, Terms & Privacy. |
| **`server/`** | Node.js + TypeScript + Express + Prisma | One API both of the above talk to. PostgreSQL-backed, server-authoritative for every balance, ownership, and probability roll. |

This is a working prototype, not a mockup - see "What's been verified" below for exactly how each
part was tested in this environment.

## Why a Godot client

The original build of this project was a 2D web map (a `24x24` demo grid you can still see under
`LandPlot`/`Listing`/`Auction` in the schema, exposed at `/world`, `/marketplace`, `/my-land` in the
React app). Scaling that concept up to "walk around a real 3D island with 100,000,000 purchasable
pixels" is not something a DOM-based 2D map can do well - so the interactive world moved to a real
game engine, and the web app's job narrowed to what browsers are actually good at: accounts,
payments, the marketplace, and admin tooling. The two share one backend and one economy; a
purchase made by walking up to land in Godot and a purchase made by clicking a card in the web
marketplace both go through the exact same server-side services and the exact same `Transaction`
ledger.

## Quick start

### Prerequisites

- Node.js 20+
- A local PostgreSQL server
- [Godot 4.3](https://godotengine.org/download) to run the 3D client (the game itself; not needed
  to run the web app or server)

### 1. Backend + web app

```bash
npm install                 # also builds the shared package (postinstall hook)
cp server/.env.example server/.env   # edit DATABASE_URL if needed
npm run prisma:migrate      # applies both the original grid schema and the pixel-world schema
npm run seed                # creates City Island (100,000,000 pixels), test accounts, sample data
npm run dev:server          # API on http://localhost:4000
npm run dev:client          # web app on http://localhost:5173 (in a second terminal)
```

Log in at `http://localhost:5173` with a seeded account (the login page has one-click demo
buttons), or register a new one - new accounts start with $100.00 in mock funds and 100 credits in
development mode.

### 2. The 3D game client

```bash
godot4 --path game-client                 # opens the project in the editor; press Play
# or, once you have a Godot editor installed with a GUI:
#   File > Open Project... -> select the game-client/ folder
```

With the server running, the game shows a login screen (same accounts as the web app - the two
share one user database). Demo buttons are on the login screen; controls are listed in the sidebar
HUD in-game:

| Action | Control |
|---|---|
| Move / look | WASD + mouse |
| Jump / sprint | Space / Shift |
| Select pixels (hold, look around, release) | Hold Left Mouse Button |
| Interact / mine / place building / confirm | E |
| Open build menu | B |
| Open shield/defense menu | G |
| Attack today's random target | F |
| Toggle HUD | Tab |
| Release mouse cursor | Esc |

Walk up to any gray tile, hold left-click while looking around to grow a selection rectangle,
release to see the price, and confirm to buy it with your real (mock, in dev) balance. Buy a tile
touching land you already own and watch the connection effect play.

#### Headless/dev testing convenience

The Godot client supports two environment variables useful for automated testing (never used
otherwise):

- `PIXEL_ESTATES_AUTOLOGIN="email:password"` - skips the login screen.
- `PIXEL_ESTATES_TEST_ACTIONS=1` - after entering the world, automatically exercises purchase,
  mining, attack, building, and shield-purchase once, printing `[TEST]` results to the console.
  This is what was used to validate the full gameplay loop headlessly in this environment (see
  below) since no GUI/display is available here.

```bash
PIXEL_ESTATES_AUTOLOGIN="alice@example.com:password123" PIXEL_ESTATES_TEST_ACTIONS=1 \
  godot4 --headless --path game-client --quit-after 500
```

## Architecture

```
shared/       Framework-free TS shared between the server and the React app: the central
              PLATFORM_FEE_PERCENT default, world/pixel-price defaults, development-stage
              thresholds, decoration/defense catalogs, DTO types. The Godot client is GDScript,
              so it talks to the same values through the API (GET /worlds/:key,
              GET /admin/worlds/attack-config) rather than importing this package directly.
server/       Express API + Prisma schema/migrations/seed + background jobs (auction
              settlement for both the original grid and the new Property auctions).
client/       React SPA: marketplace, wallet, profile, admin dashboard, Terms & Privacy.
game-client/  Godot 4 project: the 3D world.
```

### The pixel-world data model (100,000,000 pixels, without 100,000,000 rows)

`PixelOwnership` is **sparse**: a row only exists once a pixel is actually purchased. An unowned
pixel is represented by the *absence* of a row, so a freshly-seeded 100,000,000-pixel island costs
nothing in storage - `World.ownedPixelCount` (a denormalized counter, incremented atomically on
every purchase) is what "0.0002% developed" is computed from, never a `COUNT(*)` over the sparse
table.

When you buy pixels, `pixelService.purchasePixels` (server/src/services/pixelService.ts):

1. Validates bounds, dedupes, and caps the request to a sane bounding box.
2. Prefetches the *padded* bounding box of the selection in one query - this both detects
   conflicts (already-owned pixels) and gives neighbor-ownership data for the next step.
3. Runs a union-find over the newly-selected pixels **and** any adjacent existing properties you
   already own, so a purchase can create a new property, grow an existing one, or bridge two
   previously-separate properties into one - all in the same request. This is the server-side
   implementation of "connected land."
4. Debits your balance and writes an immutable `Transaction` row (via the same `walletService`
   the original grid system uses) in the same DB transaction as the ownership change.

The Godot client never sees or trusts pixel data beyond what `GET /worlds/:id/chunks` returns for
the chunks near the player - see "Performance" below.

### Performance: chunking, not 100,000,000 nodes

- **Server**: chunk queries (`GET /worlds/:id/chunks?cx=&cy=&radius=`) return only *owned* pixels
  within the requested area - a chunk with nothing purchased in it costs one small JSON response,
  not 4,096 rows.
- **Client (`game-client/scripts/world/ChunkManager.gd`)**: streams a radius of chunks around the
  player, tearing down chunks that fall out of range. Each `Chunk` (`Chunk.gd`) is exactly two
  draw calls regardless of how many pixels are owned in it: one ground quad for the whole chunk
  (representing every still-unowned pixel at zero cost) and one GPU-instanced `MultiMeshInstance3D`
  for every owned pixel, colored per-instance. A fully-owned 64x64 chunk (4,096 pixels) is still
  one draw call.
- **Pixel targeting** uses ray/plane math against the conceptual y=0 ground, not per-pixel physics
  colliders - with up to 100,000,000 pixels, per-pixel collision shapes would be prohibitive.

### Server-authoritative economy (unchanged principle, now also covering credits/attacks)

The client - web or Godot - never sends or trusts a balance, credit total, or attack outcome.
Every purchase, sale, auction settlement, credit grant, mining reward, and attack roll happens in
`server/src/services/*`, most inside a single `prisma.$transaction` alongside the ownership/state
change it causes, so money and world-state can never diverge. Balance and credit debits use a
conditional `UPDATE ... WHERE balance >= amount` (see `walletService.debitBalance` /
`creditService.spendCredits`) so concurrent requests can never drive either below zero.

Two currencies, two ledgers, on purpose:

- **`Balance` / `Transaction`** - real money (mock in dev). Used for pixel purchases, marketplace
  sales, and auctions. Every row records the platform fee rate that actually applied
  (`feePercentApplied`), so changing the fee later never rewrites history.
- **`CreditBalance` / `CreditTransaction`** - gameplay currency, earned via mining and successful
  attacks, spent on shields/defenses. Never converts to or from real money; `creditService.ts` is
  the only file allowed to touch it, exactly as `walletService.ts` is the only file allowed to
  touch `Balance`.

### Attacks & defenses

- `DailyAttackAllowance` tracks each player's attacks used today (`AttackConfig.maxAttacksPerDay`,
  default 3), reset by date string rather than a rolling timer.
- Attacking picks a random `Property` in the world not owned by you
  (`attackService.pickRandomTarget`). If the target has an active `Defense` (shield), the attack
  is `BLOCKED` and a charge is consumed - no roll happens, no purchased land is ever at risk.
  Otherwise the outcome (`SUCCESS` / `FAILED` / `CRITICAL`) is rolled against
  `AttackConfig.successRatePct` / `criticalRatePct` / `failRatePct` (admin-configurable, must sum
  to 100), moving small amounts of **credits only** - never pixels, never cash.
- Shields (`Defense`) are bought with credits from a small catalog (`shared/src/types.ts
  DEFENSE_CATALOG`) and have a limited number of charges; each blocked attack consumes one.

### Admin test worlds & sandbox

`worldService.cloneAsTestWorld` creates a `World` row flagged `isTestCopy: true` /
`kind: TEST_COPY`, with the same dimensions/price/config as the source but zero pixels owned -
clearly labeled (`"City Island — TEST #01"`, a `⚠ TEST ENVIRONMENT` banner in both the admin
dashboard and the Godot HUD). Every sandbox action in `adminWorldService.ts` (grant unlimited test
cash/credits, instant-buy, force a shield, force-trigger an attack ignoring the daily limit,
force-settle an auction, bulk-spawn decorations) refuses to run against a non-test world **unless**
the caller explicitly passes `allowProduction: true` - and every single sandbox action, in either
mode, writes an `AdminActionLog` row (admin, action, target, reason, timestamp, metadata) before
returning. There is no code path that mutates a production user's balance without that audit row.

## What's been verified in this environment

This session has no display/GPU, so the Godot client couldn't be visually playtested the way the
web app was (screenshotted with Playwright). Instead, everything below was verified for real
against the running Postgres-backed server:

- **Backend, end-to-end via `curl`**: registration/login, world listing showing all 100,000,000
  pixels with a live `ownedPixelCount`, chunk streaming returning only owned pixels, a pixel
  purchase that correctly **merged** into an existing property (pixel count 100 → 101, bounding
  box updated), mining granting credits, an attack correctly **blocked** by an active shield three
  times in a row until the shield's charges hit exactly 0, the daily attack limit correctly
  rejecting a 4th attempt, admin test-world cloning, sandbox actions correctly **refused** against
  the production world and correctly **allowed** against a test-copy world, and every one of those
  admin actions appearing in the action log.
- **Godot client, headless (`godot4 --headless --path game-client`)**: the full project loads and
  runs with zero script/parse errors. Using the `PIXEL_ESTATES_AUTOLOGIN` +
  `PIXEL_ESTATES_TEST_ACTIONS` hooks described above, the complete interactive loop - login, world
  load, player spawn, chunk load, **pixel purchase, mining, attack, decoration placement, and
  shield purchase** - was exercised against the live server and completed with no errors for four
  different accounts (including one with zero owned land, to check that edge case doesn't crash
  mining/shield code).
  - One cosmetic, headless-only artifact was found and root-caused by isolating it into nine
    minimal reproduction scenes: Godot's dummy/headless rendering driver logs a harmless
    `Parameter "m" is null` warning when a `CollisionShape3D` exists anywhere in a scene that also
    contains a `MeshInstance3D` (a debug-gizmo code path, not present when running with a real GPU
    driver). It doesn't affect logic or crash anything; it's filtered out of the validation runs.
- **Web app, in a real headless browser (Playwright)**: every screen was screenshotted and
  clicked through, including the new admin **Islands** tab (world list with live development %,
  test-world clone/delete, the attack-probability editor, event creation, and the admin action
  log all showing real data from the backend tests above) and the new Terms/Privacy pages.
- Both `server` and `client` TypeScript projects `tsc --noEmit` clean and `vite build` clean.

## Database schema

`server/prisma/schema.prisma` has two subsystems:

- **Original grid** (kept as-is, still fully working): `LandPlot`, `LandOwnership`, `Listing`,
  `Auction`, `Bid`.
- **Pixel-world system** (new): `World`, `PixelOwnership`, `Property`, `PropertyDecoration`,
  `CreditBalance`, `CreditTransaction`, `Defense`, `AttackConfig`, `Attack`,
  `DailyAttackAllowance`, `Event`, `EventItem`, `PlayerEventItem`, `PropertyListing`,
  `PropertyAuction`, `PropertyBid`, `AdminActionLog`.
- **Shared across both**: `User`, `Character`, `Balance`, `Transaction` (extended with nullable
  `propertyId`/`propertyListingId`/`propertyAuctionId` alongside the original
  `plotId`/`listingId`/`auctionId`, so one ledger covers both systems), `Notification`,
  `InventoryItem`, `Report`, `PlatformConfig`.

## Feature checklist against the brief

- [x] Multiple islands/worlds, City Island first, admin-creatable, database-ready for more.
- [x] 100,000,000 purchasable pixels at $0.01 each, sparse storage, no pre-seeded rows.
- [x] Select by point, rectangle, or explicit list; price shown before purchase.
- [x] Connected land auto-detected via server-side union-find; electric/energy connection VFX.
- [x] Customizable pixel color, independent of ownership data.
- [x] Tile-based building/decoration on owned land.
- [x] Credits, separate from cash, earned via mining and attacks, spent on shields/decorations.
- [x] Daily attack system (configurable count/probabilities), shields that block attacks,
      full attack history.
- [x] City development stages driven by `ownedPixelCount / totalPixels`, thresholds configurable
      per world.
- [x] Marketplace: buy/sell/auction/bid for both the original grid and the new Property system,
      server-authoritative fee split identical in both.
- [x] Admin dashboard: world creation, test-world cloning, sandbox actions (cash/credits/instant
      buy/forced attack/forced shield/forced auction end/bulk decorations), attack-probability
      editor, event creation, user suspension, transaction flagging, full audit log.
- [x] Terms & Conditions and Privacy Policy pages, plain English, all required sections.
- [x] Real 3D game client (Godot) with third-person movement/camera, not a 2D map with 3D styling.
- [x] Chunked/instanced rendering; never one node per pixel.
- [x] Server-authoritative for every balance, ownership, and probability roll, in both clients.

## What's intentionally out of scope for this prototype

- **Real payments.** `MockPaymentProvider` simulates instant success; swapping in Stripe or
  another processor means implementing the existing `PaymentProvider` interface - no other file
  changes.
- **Full character customization in Godot.** The 3D character currently reads
  skin/outfit color from the account's existing appearance data (set via the web app's character
  creator) rather than duplicating a full creator UI in-engine; the vertical slice's `Player.gd`
  is structured so a fuller in-engine creator can read/write the same `Character.appearance` JSON.
- **Multiplayer visibility of other players' avatars.** Each client currently renders only its own
  character; the chunk-streaming architecture doesn't preclude adding this, but no realtime
  position broadcast (websocket) exists yet.
- **Day/night cycle, weather, and boat/portal travel between islands.** The environment currently
  renders a static sky/sun/fog; these are natural next additions once the vertical slice is
  extended to the remaining islands (Tropical/Future/Nature/Event).
- **Full multi-cell decoration footprint collision.** Placement checks single-cell occupancy;
  each catalog entry already carries `footprint` data for a future pass to use.
- **KYC/age verification enforcement, tax handling, refund automation, chargebacks.** The Terms
  page describes the intended policy; none of it is wired into checkout logic yet.
