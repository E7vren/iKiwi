import { PrismaClient } from "../node_modules/.prisma/client/index.js";

const p = new PrismaClient();

const products = await p.product.findMany({
  include: { dailyPrices: { orderBy: { date: "desc" }, take: 1 } },
  orderBy: { name: "asc" },
});

console.log("\n=== PRODUCTS + TODAY'S PRICES ===");
for (const prod of products) {
  const dp = prod.dailyPrices[0];
  const kgStr = dp?.pricePerKg != null ? Number(dp.pricePerKg).toLocaleString() : "—";
  const pcsStr = dp?.pricePerPiece != null ? Number(dp.pricePerPiece).toLocaleString() : "—";
  const avail = prod.isAvailable ? "✓" : "✗";
  console.log(
    `${avail} [${prod.unitType.padEnd(6)}] ${prod.name.padEnd(20)} kg=${kgStr.padStart(8)} UZS  pcs=${pcsStr.padStart(8)} UZS`
  );
}

// Count products missing today's price
const today = new Date();
today.setUTCHours(0, 0, 0, 0);
const pricesCount = await p.dailyPrice.count({ where: { date: today } });
console.log(`\n=== Daily price records for today: ${pricesCount} ===`);

// Check order items schema by looking at a recent order
const recentOrder = await p.order.findFirst({
  include: { items: true, shop: true },
  orderBy: { createdAt: "desc" },
});
if (recentOrder) {
  console.log(`\n=== MOST RECENT ORDER (${recentOrder.shop.name}) ===`);
  console.log(`  Status: ${recentOrder.status}`);
  console.log(`  estimatedTotal: ${Number(recentOrder.estimatedTotal).toLocaleString()} UZS`);
  console.log(`  actualTotal: ${recentOrder.actualTotal != null ? Number(recentOrder.actualTotal).toLocaleString() + " UZS" : "not set"}`);
  for (const item of recentOrder.items) {
    const qty =
      item.orderedAs === "KG"
        ? `${Number(item.requestedKg)} kg`
        : `${item.requestedPieces} pcs`;
    const actual =
      item.orderedAs === "KG" && item.actualKg != null
        ? ` → actual ${Number(item.actualKg)} kg`
        : item.orderedAs === "PIECE" && item.actualPieces != null
          ? ` → actual ${item.actualPieces} pcs`
          : "";
    console.log(
      `  [${item.orderedAs.padEnd(5)}] ${qty.padEnd(12)} est=${Number(item.estimatedPrice).toLocaleString().padStart(8)} UZS${actual}`
    );
  }
} else {
  console.log("\n=== No orders in database yet ===");
}

// Check shops
const shops = await p.shop.findMany({ select: { name: true, isActive: true, userId: true } });
console.log(`\n=== SHOPS (${shops.length}) ===`);
for (const s of shops) {
  console.log(`  ${s.isActive ? "✓ active" : "✗ inactive"} — ${s.name}`);
}

await p.$disconnect();
