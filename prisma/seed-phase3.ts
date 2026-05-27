/**
 * Phase 3 test seed — run AFTER the main seed.
 * Creates 5 READY orders (actual costs already set) across 5 shops.
 * Drop you right at the "Admin opens /admin/routes → Generate Routes" step.
 *
 * Usage:  npm run db:seed-phase3
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Two extra shops beyond what the main seed creates
const EXTRA_SHOPS = [
  {
    name: "Sergeli Savdo",
    ownerName: "Nodir Azimov",
    email: "sergeli@shop.uz",
    phone: "+998903334455",
    address: "Sergeli district, Tashkent",
    latitude: 41.231,
    longitude: 69.264,
  },
  {
    name: "Uchtepa Bozori",
    ownerName: "Malika Rashidova",
    email: "uchtepa@shop.uz",
    phone: "+998905556677",
    address: "Uchtepa district, Tashkent",
    latitude: 41.309,
    longitude: 69.187,
  },
] as const;

// Prices used for today's DailyPrice entries (UZS per kg)
const KG_PRICES = [12000, 8000, 15000, 5000, 9000, 11000];

// Item quantities per shop  [requestedKg, actualKg]
const SHOP_ORDERS: Array<{ shopIndex: number; items: [number, number, number][] }> = [
  // [productIndex, requestedKg, actualKg]
  { shopIndex: 0, items: [[0, 10, 9.5], [1, 5, 5],  [2, 8, 7.8]] },
  { shopIndex: 1, items: [[1, 15, 14],  [3, 20, 20]] },
  { shopIndex: 2, items: [[0, 6, 6],   [2, 12, 11], [4, 8, 8], [5, 3, 3]] },
  { shopIndex: 3, items: [[3, 25, 23],  [0, 5, 5]] },
  { shopIndex: 4, items: [[1, 10, 10],  [4, 7, 6.5], [2, 4, 4]] },
];

async function main() {
  console.log("🚚  Phase 3 test seed — building READY orders...\n");

  // ── Guard: require main seed to have run first ───────────────────────────
  const admin = await prisma.user.findFirst({ where: { role: "COMPANY_ADMIN" } });
  if (!admin) {
    console.error("❌  No admin found. Run `npm run db:seed` first.");
    process.exit(1);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // ── 1. Ensure extra shops exist ──────────────────────────────────────────
  const shopPw = await bcrypt.hash("Shop123!", 10);
  for (const s of EXTRA_SHOPS) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        name: s.ownerName,
        email: s.email,
        password: shopPw,
        role: "SHOP_OWNER",
        shops: {
          create: {
            name: s.name,
            ownerName: s.ownerName,
            phone: s.phone,
            address: s.address,
            latitude: s.latitude,
            longitude: s.longitude,
            isActive: true,
          },
        },
      },
    });
  }

  // ── 2. Fetch active shops (up to 5) ─────────────────────────────────────
  const shops = await prisma.shop.findMany({
    where: { isActive: true },
    include: { user: true },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  if (shops.length < 3) {
    console.error("❌  Need at least 3 active shops with coordinates. Run `npm run db:seed` first.");
    process.exit(1);
  }

  // ── 3. Fetch kg-orderable products ──────────────────────────────────────
  const kgProducts = await prisma.product.findMany({
    where: { isAvailable: true, unitType: { in: ["KG", "BOTH"] } },
    orderBy: { createdAt: "asc" },
    take: 6,
  });
  if (kgProducts.length < 3) {
    console.error("❌  Need at least 3 KG products. Run `npm run db:seed` first.");
    process.exit(1);
  }

  // ── 4. Ensure today's prices exist ──────────────────────────────────────
  for (let i = 0; i < kgProducts.length; i++) {
    const p = kgProducts[i];
    const pricePerKg = KG_PRICES[i] ?? 10000;
    const existing = await prisma.dailyPrice.findFirst({ where: { productId: p.id, date: today } });
    if (!existing) {
      await prisma.dailyPrice.create({
        data: {
          productId: p.id,
          pricePerKg,
          pricePerPiece: p.unitType === "BOTH" ? pricePerKg * 3 : null,
          date: today,
          adminId: admin.id,
        },
      });
    }
  }
  console.log(`✅  Today's prices set for ${kgProducts.length} products\n`);

  // ── 5. Create READY orders ───────────────────────────────────────────────
  let createdCount = 0;
  for (const recipe of SHOP_ORDERS) {
    const shop = shops[recipe.shopIndex];
    if (!shop) continue;

    // Skip if shop already has a READY/unrouted order today
    const alreadyReady = await prisma.order.findFirst({
      where: { shopId: shop.id, status: "READY", routeStop: null },
    });
    if (alreadyReady) {
      console.log(`  ⏭  ${shop.name} — already has a READY order, skipping`);
      continue;
    }

    let estimatedTotal = 0;
    let actualTotal = 0;

    const itemsPayload = recipe.items.flatMap(([pIdx, requestedKg, actualKg]) => {
      const product = kgProducts[pIdx];
      if (!product) return [];
      const pricePerKg = KG_PRICES[pIdx] ?? 10000;
      const estimated = Math.round(pricePerKg * requestedKg);
      const actual    = Math.round(pricePerKg * actualKg);
      estimatedTotal += estimated;
      actualTotal    += actual;
      return [{
        productId:       product.id,
        orderedAs:       "KG" as const,
        requestedKg,
        requestedPieces: null,
        estimatedPrice:  estimated,
        actualKg,
        actualPieces:    null,
        actualPrice:     actual,
        adminAdjusted:   false,
        adminNote:       null,
      }];
    });

    await prisma.order.create({
      data: {
        shopId: shop.id,
        status: "READY",
        estimatedTotal,
        actualTotal,
        items: { create: itemsPayload },
      },
    });

    const diff = actualTotal - estimatedTotal;
    const sign = diff >= 0 ? "+" : "";
    console.log(
      `  ✅  ${shop.name.padEnd(20)} ${recipe.items.length} items  ` +
      `est ${estimatedTotal.toLocaleString("ru-RU")} → actual ${actualTotal.toLocaleString("ru-RU")} UZS  (${sign}${diff.toLocaleString("ru-RU")})`
    );
    createdCount++;
  }

  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Phase 3 seed complete — ${createdCount} READY orders created      ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  ADMIN STEPS (http://localhost:3000):                    ║
║    1. Log in:  admin@ikiwi.uz / Admin123!               ║
║    2. Go to /admin/routes                                ║
║    3. Click "Generate Routes"                            ║
║    4. Select all ${shops.length} orders → pick 2 drivers → Generate  ║
║    5. Assign routes to Aziz and Bobur                    ║
║                                                          ║
║  DRIVER APP (open in another tab/browser):               ║
║    aziz@ikiwi.uz   / Driver123!  → /driver              ║
║    bobur@ikiwi.uz  / Driver123!  → /driver              ║
║                                                          ║
║  SHOP LOGINS (to watch real-time notifications):         ║
║    chorsu@shop.uz      / Shop123!                        ║
║    yunusobod@shop.uz   / Shop123!                        ║
║    chilonzor@shop.uz   / Shop123!                        ║
║    sergeli@shop.uz     / Shop123!                        ║
║    uchtepa@shop.uz     / Shop123!                        ║
╚══════════════════════════════════════════════════════════╝
`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
