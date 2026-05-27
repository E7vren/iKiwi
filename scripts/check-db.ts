import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const p = new PrismaClient({ adapter });

  try {
    const products = await p.product.findMany({
      include: { dailyPrices: { orderBy: { date: "desc" }, take: 1 } },
      orderBy: { name: "asc" },
    });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    console.log("\n=== PRODUCTS + TODAY'S PRICES ===");
    let missingPrice = 0;
    for (const prod of products) {
      const dp = prod.dailyPrices[0];
      const isToday = dp?.date.getTime() === today.getTime();
      const kgStr =
        isToday && dp.pricePerKg != null
          ? `${Number(dp.pricePerKg).toLocaleString("ru-RU")}/kg`
          : "—";
      const pcsStr =
        isToday && dp.pricePerPiece != null
          ? `${Number(dp.pricePerPiece).toLocaleString("ru-RU")}/pcs`
          : "—";
      const needsKg = prod.unitType !== "PIECE";
      const needsPcs = prod.unitType !== "KG";
      const hasPriceToday =
        (!needsKg || (isToday && dp?.pricePerKg != null)) &&
        (!needsPcs || (isToday && dp?.pricePerPiece != null));
      if (!hasPriceToday) missingPrice++;
      const flag = hasPriceToday ? "" : " ⚠ MISSING";
      const avail = prod.isAvailable ? "✓" : "✗";
      console.log(
        `${avail} [${prod.unitType.padEnd(6)}] ${prod.name.padEnd(20)} kg=${kgStr.padEnd(14)}  pcs=${pcsStr}${flag}`
      );
    }
    console.log(`\nMissing today's price: ${missingPrice} product(s)`);

    // Most recent order
    const recentOrder = await p.order.findFirst({
      include: {
        items: { include: { product: { select: { name: true } } } },
        shop: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentOrder) {
      console.log(`\n=== MOST RECENT ORDER — ${recentOrder.shop.name} ===`);
      console.log(`  Status: ${recentOrder.status}`);
      console.log(
        `  estimatedTotal: ${Number(recentOrder.estimatedTotal).toLocaleString("ru-RU")} UZS`
      );
      console.log(
        `  actualTotal: ${recentOrder.actualTotal != null ? Number(recentOrder.actualTotal).toLocaleString("ru-RU") + " UZS" : "not set"}`
      );
      console.log(`  finalCostNote: ${recentOrder.finalCostNote ?? "(none)"}`);
      for (const item of recentOrder.items) {
        const reqQty =
          item.orderedAs === "KG"
            ? `${Number(item.requestedKg)} kg`
            : `${item.requestedPieces} pcs`;
        const actQty =
          item.orderedAs === "KG" && item.actualKg != null
            ? `actual ${Number(item.actualKg)} kg`
            : item.orderedAs === "PIECE" && item.actualPieces != null
              ? `actual ${item.actualPieces} pcs`
              : "no actual yet";
        const override = item.adminAdjusted ? " [ADMIN ADJUSTED]" : "";
        const note = item.adminNote ? ` note="${item.adminNote}"` : "";
        console.log(
          `  [${item.orderedAs.padEnd(5)}] ${item.product.name.padEnd(20)} req=${reqQty.padEnd(8)} ` +
            `${actQty.padEnd(18)} est=${Number(item.estimatedPrice).toLocaleString("ru-RU")}  ` +
            `actual=${item.actualPrice != null ? Number(item.actualPrice).toLocaleString("ru-RU") + " UZS" : "—"}${override}${note}`
        );
      }
    } else {
      console.log("\n=== No orders in database yet ===");
    }

    // Shops
    const shops = await p.shop.findMany({ select: { name: true, isActive: true } });
    console.log(`\n=== SHOPS ===`);
    for (const s of shops) {
      console.log(`  ${s.isActive ? "✓ active" : "✗ inactive"} — ${s.name}`);
    }
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
