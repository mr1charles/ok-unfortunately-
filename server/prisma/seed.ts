import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DECORATION_CATALOG,
  DEFAULT_CHARACTER_APPEARANCE,
  DEV_STARTING_BALANCE_CENTS,
  MIN_LAND_PRICE_CENTS,
  PLATFORM_FEE_PERCENT_DEFAULT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@pixel-estates/shared";
import { ensureCityIsland } from "../src/services/worldService.js";
import { purchasePixels, expandRect } from "../src/services/pixelService.js";
import { ensureCreditBalance, creditUser } from "../src/services/creditService.js";
import { getOrCreateAttackConfig } from "../src/services/attackService.js";
import { purchaseDefense } from "../src/services/defenseService.js";
import { createEvent } from "../src/services/eventService.js";

const prisma = new PrismaClient();

// Simple deterministic pseudo-random so re-running the seed against a fresh
// DB always produces the same, reviewable world.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  console.log("Seeding Pixel Estates...");

  const rand = mulberry32(20260101);

  // --- Platform config -----------------------------------------------
  const existingConfig = await prisma.platformConfig.findFirst();
  if (!existingConfig) {
    await prisma.platformConfig.create({ data: { platformFeePercent: PLATFORM_FEE_PERCENT_DEFAULT } });
    console.log(`Created PlatformConfig with ${PLATFORM_FEE_PERCENT_DEFAULT}% fee`);
  }

  // --- World grid -------------------------------------------------------
  const existingPlotCount = await prisma.landPlot.count();
  if (existingPlotCount === 0) {
    const centerX = WORLD_WIDTH / 2;
    const centerY = WORLD_HEIGHT / 2;
    const plotsData = [];
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < WORLD_WIDTH; x++) {
        const distFromCenter = Math.hypot(x - centerX, y - centerY);
        const maxDist = Math.hypot(centerX, centerY);
        // Land closer to the center of the world is pricier (like a downtown core).
        const proximityMultiplier = 1 + (1 - distFromCenter / maxDist) * 8;
        const noise = 0.75 + rand() * 0.5;
        const priceCents = Math.max(
          MIN_LAND_PRICE_CENTS,
          Math.round(MIN_LAND_PRICE_CENTS * proximityMultiplier * noise)
        );
        plotsData.push({
          x,
          y,
          platformPriceCents: priceCents,
          biomeSeed: Math.floor(rand() * 5),
        });
      }
    }
    await prisma.landPlot.createMany({ data: plotsData });
    console.log(`Created ${plotsData.length} land plots (${WORLD_WIDTH}x${WORLD_HEIGHT} world)`);
  } else {
    console.log(`World already has ${existingPlotCount} plots, skipping grid seed`);
  }

  // --- Users --------------------------------------------------------
  async function upsertUser(params: {
    email: string;
    username: string;
    password: string;
    role: "PLAYER" | "ADMIN";
    balanceCents: number;
    appearance?: typeof DEFAULT_CHARACTER_APPEARANCE;
    positionX?: number;
    positionY?: number;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: params.email } });
    if (existing) {
      console.log(`User ${params.email} already exists, skipping`);
      return existing;
    }
    const passwordHash = await bcrypt.hash(params.password, 10);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: params.email,
          username: params.username,
          passwordHash,
          role: params.role,
          hasOnboarded: true,
        },
      });
      await tx.character.create({
        data: {
          userId: created.id,
          appearance: params.appearance ?? DEFAULT_CHARACTER_APPEARANCE,
          positionX: params.positionX ?? Math.floor(WORLD_WIDTH / 2),
          positionY: params.positionY ?? Math.floor(WORLD_HEIGHT / 2),
        },
      });
      await tx.inventoryItem.createMany({
        data: DECORATION_CATALOG.map((item) => ({ userId: created.id, objectType: item.key, quantity: -1 })),
      });
      await tx.balance.create({ data: { userId: created.id, balanceCents: params.balanceCents } });
      if (params.balanceCents > 0) {
        await tx.transaction.create({
          data: {
            type: "DEPOSIT",
            grossCents: params.balanceCents,
            feeCents: 0,
            netCents: params.balanceCents,
            toUserId: created.id,
            description: "Initial seed balance (development mode test funds)",
          },
        });
      }
      return created;
    });
    console.log(`Created user ${params.username} <${params.email}> ($${(params.balanceCents / 100).toFixed(2)})`);
    return user;
  }

  const admin = await upsertUser({
    email: "admin@pixelestates.dev",
    username: "admin",
    password: "admin123",
    role: "ADMIN",
    balanceCents: 0,
    appearance: { ...DEFAULT_CHARACTER_APPEARANCE, outfitColor: "#1f2937", accessory: "cape" },
  });

  const alice = await upsertUser({
    email: "alice@example.com",
    username: "alice",
    password: "password123",
    role: "PLAYER",
    balanceCents: DEV_STARTING_BALANCE_CENTS,
    appearance: { ...DEFAULT_CHARACTER_APPEARANCE, hairStyle: "long", outfitColor: "#e0559b" },
    positionX: 10,
    positionY: 10,
  });

  const bob = await upsertUser({
    email: "bob@example.com",
    username: "bob",
    password: "password123",
    role: "PLAYER",
    balanceCents: DEV_STARTING_BALANCE_CENTS,
    appearance: { ...DEFAULT_CHARACTER_APPEARANCE, hairStyle: "mohawk", outfitColor: "#22c55e", accessory: "glasses" },
    positionX: 14,
    positionY: 10,
  });

  await upsertUser({
    email: "carol@example.com",
    username: "carol",
    password: "password123",
    role: "PLAYER",
    balanceCents: DEV_STARTING_BALANCE_CENTS,
    appearance: { ...DEFAULT_CHARACTER_APPEARANCE, hairStyle: "curly", outfitColor: "#f59e0b", accessory: "hat" },
    positionX: 12,
    positionY: 14,
  });

  // --- Give alice & bob a few starter plots, a listing, and a live auction ---
  const aliceOwnsAny = await prisma.landPlot.findFirst({ where: { ownerId: alice.id } });
  if (!aliceOwnsAny) {
    const centerPlots = await prisma.landPlot.findMany({
      where: { status: "AVAILABLE" },
      orderBy: [{ y: "asc" }, { x: "asc" }],
      take: 6,
      skip: Math.floor(WORLD_WIDTH * WORLD_HEIGHT / 2) - 3,
    });

    if (centerPlots.length >= 4) {
      const [p1, p2, p3, p4] = centerPlots;

      // Alice owns p1 (plain) and p2 (listed for sale)
      await prisma.$transaction(async (tx) => {
        for (const plot of [p1, p2]) {
          await tx.landOwnership.create({
            data: { plotId: plot.id, userId: alice.id, acquiredPriceCents: plot.platformPriceCents, acquiredVia: "PLATFORM_PURCHASE" },
          });
          await tx.landPlot.update({ where: { id: plot.id }, data: { ownerId: alice.id, status: "OWNED", lastSalePriceCents: plot.platformPriceCents } });
          await tx.transaction.create({
            data: {
              type: "PLATFORM_PURCHASE",
              grossCents: plot.platformPriceCents,
              feeCents: 0,
              netCents: plot.platformPriceCents,
              fromUserId: alice.id,
              plotId: plot.id,
              description: `Purchased plot (${plot.x}, ${plot.y}) directly from the platform`,
            },
          });
        }
        await tx.balance.update({
          where: { userId: alice.id },
          data: { balanceCents: { decrement: p1.platformPriceCents + p2.platformPriceCents } },
        });

        await tx.landPlot.update({ where: { id: p2.id }, data: { status: "LISTED" } });
        await tx.listing.create({
          data: {
            plotId: p2.id,
            sellerId: alice.id,
            priceCents: Math.round(p2.platformPriceCents * 3.5),
            description: "Prime real estate near the center of the world map!",
          },
        });

        // Bob owns p3, and auctions off p4 with a live bid from carol/nobody yet
        await tx.landOwnership.create({
          data: { plotId: p3.id, userId: bob.id, acquiredPriceCents: p3.platformPriceCents, acquiredVia: "PLATFORM_PURCHASE" },
        });
        await tx.landPlot.update({ where: { id: p3.id }, data: { ownerId: bob.id, status: "OWNED", lastSalePriceCents: p3.platformPriceCents } });

        await tx.landOwnership.create({
          data: { plotId: p4.id, userId: bob.id, acquiredPriceCents: p4.platformPriceCents, acquiredVia: "PLATFORM_PURCHASE" },
        });
        await tx.landPlot.update({ where: { id: p4.id }, data: { ownerId: bob.id, status: "AUCTION", lastSalePriceCents: p4.platformPriceCents } });
        await tx.transaction.create({
          data: {
            type: "PLATFORM_PURCHASE",
            grossCents: p3.platformPriceCents + p4.platformPriceCents,
            feeCents: 0,
            netCents: p3.platformPriceCents + p4.platformPriceCents,
            fromUserId: bob.id,
            description: "Purchased starter plots directly from the platform",
          },
        });
        await tx.balance.update({
          where: { userId: bob.id },
          data: { balanceCents: { decrement: p3.platformPriceCents + p4.platformPriceCents } },
        });

        const auction = await tx.auction.create({
          data: {
            plotId: p4.id,
            sellerId: bob.id,
            startingPriceCents: Math.round(p4.platformPriceCents * 2),
            description: "Corner lot, great for a starter build. No reserve!",
            endAt: new Date(Date.now() + 1000 * 60 * 60 * 6), // 6 hours from now
          },
        });

        const bidAmount = Math.round(p4.platformPriceCents * 2.4);
        await tx.bid.create({ data: { auctionId: auction.id, bidderId: alice.id, amountCents: bidAmount } });
        await tx.auction.update({ where: { id: auction.id }, data: { currentBidCents: bidAmount, currentBidderId: alice.id } });
      });

      console.log("Seeded starter ownership: alice owns 2 plots (1 listed), bob owns 2 plots (1 in a live auction)");
    }
  }

  // --- Pixel-world system: City Island (100,000,000 pixels), credits, ------
  // --- attack config, a starter property for alice/bob, and one event -----
  const cityIsland = await ensureCityIsland();
  console.log(`City Island ready: ${cityIsland.pixelWidth}x${cityIsland.pixelHeight} = ${(cityIsland.pixelWidth * cityIsland.pixelHeight).toLocaleString()} pixels @ $${(cityIsland.pixelPriceCents / 100).toFixed(2)}/pixel`);

  await getOrCreateAttackConfig();

  for (const user of [admin, alice, bob]) {
    await ensureCreditBalance(user.id);
  }

  const alicePropertyCount = await prisma.property.count({ where: { worldId: cityIsland.id, ownerId: alice.id } });
  if (alicePropertyCount === 0) {
    // Alice buys a 10x10 block near the center of City Island - her first
    // connected property, big enough to place a building and a shield.
    const cx = Math.floor(cityIsland.pixelWidth / 2);
    const cy = Math.floor(cityIsland.pixelHeight / 2);
    const alicePlot = await purchasePixels(alice.id, cityIsland.id, {
      coords: expandRect(cx, cy, cx + 9, cy + 9),
      colorHex: "#e0559b",
    });
    const aliceProperty = alicePlot.propertyIds[0];
    await prisma.propertyDecoration.create({
      data: { propertyId: aliceProperty, objectType: "house_small", x: cx, y: cy, placedByUserId: alice.id },
    });
    await creditUser(prisma, alice.id, 150, "Seed starting credits top-up", "ADMIN_GRANT");
    await purchaseDefense(alice.id, aliceProperty, "SHIELD");

    // Bob buys an adjacent block so players can see two different owners'
    // colors sitting right next to each other on the same island.
    const bobPlot = await purchasePixels(bob.id, cityIsland.id, {
      coords: expandRect(cx + 10, cy, cx + 15, cy + 9),
      colorHex: "#22c55e",
    });
    await creditUser(prisma, bob.id, 80, "Seed starting credits top-up", "ADMIN_GRANT");

    console.log(
      `Seeded City Island starter properties: alice owns a 10x10 plot near (${cx}, ${cy}) with a shield, bob owns an adjacent 6x10 plot (${bobPlot.purchasedCount} pixels)`
    );
  }

  const halloweenExists = await prisma.event.findUnique({ where: { key: "halloween-2026" } });
  if (!halloweenExists) {
    const inTwoWeeks = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
    await createEvent(admin.id, {
      key: "halloween-2026",
      name: "Halloween on City Island",
      description: "Limited-time spooky decorations for your property.",
      emoji: "🎃",
      worldId: cityIsland.id,
      startAt: new Date(),
      endAt: inTwoWeeks,
      items: [
        { objectType: "jack_o_lantern", name: "Jack-o'-Lantern", emoji: "🎃" },
        { objectType: "spooky_tombstone", name: "Spooky Tombstone", emoji: "🪦" },
      ],
    });
    console.log("Seeded Halloween on City Island event (2 limited-time items)");
  }

  console.log("\nSeed complete. Test accounts (development only):");
  console.log("  Admin: admin@pixelestates.dev / admin123");
  console.log("  Player: alice@example.com / password123 ($100.00 starting balance)");
  console.log("  Player: bob@example.com / password123 ($100.00 starting balance)");
  console.log("  Player: carol@example.com / password123 ($100.00 starting balance)");
  void admin;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
