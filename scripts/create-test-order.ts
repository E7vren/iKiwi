/**
 * Creates a realistic mixed-unit test order (KG + PIECE items) for admin flow testing.
 * Run: npx tsx scripts/create-test-order.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const p = new PrismaClient({ adapter });

  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Get the first active shop
    const shop = await p.shop.findFirst({ where: { isActive: true } });
    if (!shop) throw new Error("No active shop found — run seed first");

    // Get products with today's prices
    const [tomato, watermelon, apple] = await Promise.all([
      p.product.findFirst({
        where: { name: "Tomato" },
        include: { dailyPrices: { where: { date: today }, take: 1 } },
      }),
      p.product.findFirst({
        where: { name: "Watermelon" },
        include: { dailyPrices: { where: { date: today }, take: 1 } },
      }),
      p.product.findFirst({
        where: { name: "Apple" },
        include: { dailyPrices: { where: { date: today }, take: 1 } },
      }),
    ]);

    if (!tomato?.dailyPrices[0] || !watermelon?.dailyPrices[0] || !apple?.dailyPrices[0]) {
      throw new Error("Products or today's prices not found — run seed first");
    }

    const tomatoPricePerKg = Number(tomato.dailyPrices[0].pricePerKg!); // 8500
    const watermelonPricePerPcs = Number(watermelon.dailyPrices[0].pricePerPiece!); // 25000
    const applePricePerKg = Number(apple.dailyPrices[0].pricePerKg!); // 9000

    // Order: 3 kg Tomato + 2 Watermelons + 2 kg Apple
    const tomatoEst = Math.round(3 * tomatoPricePerKg);    // 25,500
    const watermelonEst = Math.round(2 * watermelonPricePerPcs); // 50,000
    const appleEst = Math.round(2 * applePricePerKg);       // 18,000
    const estimatedTotal = tomatoEst + watermelonEst + appleEst; // 93,500

    const order = await p.order.create({
      data: {
        shopId: shop.id,
        estimatedTotal,
        notes: "Please deliver by noon",
        items: {
          create: [
            {
              productId: tomato.id,
              orderedAs: "KG",
              requestedKg: 3,
              requestedPieces: null,
              estimatedPrice: tomatoEst,
            },
            {
              productId: watermelon.id,
              orderedAs: "PIECE",
              requestedKg: null,
              requestedPieces: 2,
              estimatedPrice: watermelonEst,
            },
            {
              productId: apple.id,
              orderedAs: "KG",
              requestedKg: 2,
              requestedPieces: null,
              estimatedPrice: appleEst,
            },
          ],
        },
      },
      include: { items: { include: { product: { select: { name: true } } } }, shop: true },
    });

    console.log("\n=== TEST ORDER CREATED ===");
    console.log(`  ID:    ${order.id}`);
    console.log(`  Shop:  ${order.shop.name}`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Estimated Total: ${Number(order.estimatedTotal).toLocaleString("ru-RU")} UZS`);
    console.log("\n  Items:");
    for (const item of order.items) {
      const qty =
        item.orderedAs === "KG" ? `${Number(item.requestedKg)} kg` : `${item.requestedPieces} pcs`;
      console.log(
        `    [${item.orderedAs.padEnd(5)}] ${item.product.name.padEnd(20)} ${qty.padEnd(8)} est=${Number(item.estimatedPrice).toLocaleString("ru-RU")} UZS`
      );
    }
    console.log("\n  Expected admin modal auto-calc when no changes:");
    console.log(`    Tomato: 3 × 8,500 = ${(3 * 8500).toLocaleString("ru-RU")} UZS`);
    console.log(`    Watermelon: 2 × 25,000 = ${(2 * 25000).toLocaleString("ru-RU")} UZS`);
    console.log(`    Apple: 2 × 9,000 = ${(2 * 9000).toLocaleString("ru-RU")} UZS`);
    console.log(`    Total: ${estimatedTotal.toLocaleString("ru-RU")} UZS`);
    console.log("\n  Scenario to test override:");
    console.log("    Tomato actual: 2.85 kg → auto-calc = " + Math.round(2.85 * 8500).toLocaleString("ru-RU") + " UZS");
    console.log("    Apple override: 24,000 UZS (reason: 'Premium quality batch')");
    console.log(
      "    Expected final: " +
        (Math.round(2.85 * 8500) + 50000 + 24000).toLocaleString("ru-RU") +
        " UZS"
    );
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
