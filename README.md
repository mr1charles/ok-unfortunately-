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

## Social sign-in (Google / Apple / Microsoft) and mobile

Both clients support "Continue with Google / Apple / Microsoft" through one shared endpoint,
`POST /api/auth/oauth/:provider`, which is exactly the pattern a native iOS/Android app uses: the
platform SDK (Google Sign-In, Sign in with Apple, MSAL) produces a signed ID token on-device, and
the backend's only job is to verify it and map it to an account. That verification
(`server/src/lib/oauth/jwksProvider.ts`) is real - it fetches each provider's public keys (JWKS)
and checks the token's signature, issuer, and audience with the `jose` library - so it works as-is
the moment real client IDs are configured:

```bash
# server/.env
GOOGLE_CLIENT_ID="..."
APPLE_CLIENT_ID="..."       # your Services ID
MICROSOFT_CLIENT_ID="..."
```

```bash
# client/.env (Vite)
VITE_GOOGLE_CLIENT_ID="..."
VITE_APPLE_CLIENT_ID="..."
VITE_MICROSOFT_CLIENT_ID="..."
```

**Without those set** (the default in this prototype - there's no real Google/Apple/Microsoft
developer account behind this build), every provider automatically falls back to a **mock
verifier** (`server/src/lib/oauth/mockProvider.ts`), and both clients show a small "dev sign-in"
dialog instead of the real provider UI, clearly labeled `DEV`. This lets the entire flow - new
account creation, linking a provider to an existing account by verified email, repeat sign-in
finding the same account - be exercised and tested end-to-end without any external credentials,
the same way `MockPaymentProvider` lets checkout be tested without a real payment processor. `GET
/api/auth/oauth/providers` reports which providers are "live" vs. mock so each client knows which
UI to show.

Account linking rules (`server/src/services/oauthService.ts`): signing in with a provider
already linked to a local account logs into that account; signing in with a *verified* email that
matches an existing password-based account links the new provider to it (so a player can use
Google on web and Apple on iOS for the same account); otherwise a brand-new account is provisioned
with the same onboarding (character, starter decorations, starting balance) as a normal
registration - just with no password set (`User.passwordHash` is nullable for these accounts, and
email/password login for them returns a clear "use social sign-in" error rather than a generic
invalid-credentials message).

### Mobile (iOS/Android)

`game-client/export_presets.cfg` has real Android and iOS export presets (bundle IDs, Android
`INTERNET`/`ACCESS_NETWORK_STATE` permissions, iOS minimum version, etc.) - Godot recognizes them
out of the box (verified in this environment: `godot4 --export-debug "Android" ...` and `"iOS"`
both correctly parse the presets and fail only on the two things this environment doesn't have:
Godot's export templates and a platform SDK/Xcode). To produce an actual `.apk`/`.ipa`:

- **Android**: install the Android SDK, download Godot's Android export templates (Editor >
  Manage Export Templates), point Editor Settings at your SDK path, then either use the Godot
  editor's Export dialog or `godot4 --export-release "Android" builds/android/pixel-estates.apk`.
- **iOS**: open the project in Godot on macOS with Xcode installed, download the iOS export
  templates, fill in your Apple Developer Team ID/provisioning profile in the iOS preset, and
  export (Godot generates an Xcode project you archive/sign from Xcode).

The web app (`client/`) is also mobile-responsive - the sidebar becomes a slide-out drawer with a
hamburger toggle below the `md` breakpoint (verified at 390px width).

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
  log all showing real data from the backend tests above), the new Terms/Privacy pages, the social
  sign-in dev dialog completing a real new-account sign-in end to end, and the mobile drawer
  sidebar at a 390px viewport width.
- **Social sign-in, via both `curl` and the Godot client's own `PIXEL_ESTATES_TEST_OAUTH` hook**:
  a new mock-Google identity correctly provisioned a new account with a derived username and
  starting balance; signing in again with the same identity correctly logged into the same account
  instead of duplicating it; signing in with a *different* provider (mock Microsoft) using an
  existing player's email correctly **linked** to her existing account (same land count, same
  history) rather than creating a duplicate; malformed tokens and unknown providers were both
  cleanly rejected with 400s. The Godot-side base64url token encoding was confirmed
  byte-for-byte interoperable with the server's decoder this way.
- `game-client/export_presets.cfg`'s Android and iOS presets were confirmed valid by running
  `godot4 --export-debug` against both: the engine recognized and parsed each preset correctly,
  failing only on the two things unavailable in this environment (Godot's export templates and a
  platform SDK/Xcode) - not on anything in the preset configuration itself.
- Both `server` and `client` TypeScript projects `tsc --noEmit` clean and `vite build` clean.

## Database schema

`server/prisma/schema.prisma` has two subsystems:

- **Original grid** (kept as-is, still fully working): `LandPlot`, `LandOwnership`, `Listing`,
  `Auction`, `Bid`.
- **Pixel-world system** (new): `World`, `PixelOwnership`, `Property`, `PropertyDecoration`,
  `CreditBalance`, `CreditTransaction`, `Defense`, `AttackConfig`, `Attack`,
  `DailyAttackAllowance`, `Event`, `EventItem`, `PlayerEventItem`, `PropertyListing`,
  `PropertyAuction`, `PropertyBid`, `AdminActionLog`.
- **Shared across both**: `User` (nullable `passwordHash` for social-only accounts),
  `OAuthAccount` (linked Google/Apple/Microsoft identities), `Character`, `Balance`, `Transaction`
  (extended with nullable `propertyId`/`propertyListingId`/`propertyAuctionId` alongside the
  original `plotId`/`listingId`/`auctionId`, so one ledger covers both systems), `Notification`,
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
- [x] Sign in with Google/Apple/Microsoft, real JWKS-verified ID tokens, on both the web app and
      the Godot client, with account linking by verified email and a dev/mock fallback when no
      real credentials are configured.
- [x] iOS and Android export configuration for the Godot client (bundle IDs, permissions);
      web app is mobile-responsive with a slide-out sidebar below the `md` breakpoint.

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
- **Native Google/Apple/Microsoft SDK plugins for Godot's mobile export.** The Godot login screen's
  social buttons use the dev/mock flow described above (calling the same real backend endpoint a
  native SDK would). Wiring up the actual native SDKs on an exported iOS/Android build is a
  follow-up requiring platform-specific Godot plugin binaries built with Xcode/Android Studio,
  which this environment can't produce - the backend verification they'd call is already real and
  ready.
- **Actual `.apk`/`.ipa` binaries.** `export_presets.cfg` is configured and was confirmed valid
  against the Godot export system, but producing real installable builds needs Godot's export
  templates (large downloads), an Android SDK or Xcode, and (for iOS) an Apple Developer Program
  membership - none of which are available in this environment.
