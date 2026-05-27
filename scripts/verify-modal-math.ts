/**
 * Simulates the SetActualCostDialog math for the test order.
 * Run: npx tsx scripts/verify-modal-math.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const p = new PrismaClient({ adapter });

  try {
    const order = await p.order.findFirst({
      orderBy: { createdAt: "desc" },
      include: {
        items: { include: { product: { select: { name: true } } } },
        shop: { select: { name: true } },
      },
    });

    if (!order) {
      console.log("No orders found");
      return;
    }

    console.log(`\n=== MODAL MATH SIMULATION — Order for ${order.shop.name} ===`);
    console.log(`Order ID: ${order.id}`);
    console.log(`Estimated Total: ${Number(order.estimatedTotal).toLocaleString("ru-RU")} UZS\n`);

    // Simulate form initialization (matches SetActualCostDialog values)
    const formItems = order.items.map((item) => {
      const requestedQty =
        item.orderedAs === "KG" ? Number(item.requestedKg ?? 1) : (item.requestedPieces ?? 1);
      const pricePerUnit = requestedQty > 0 ? Math.round(Number(item.estimatedPrice) / requestedQty) : 0;
      return {
        name: item.product.name,
        orderedAs: item.orderedAs,
        requestedKg: item.requestedKg ? Number(item.requestedKg) : null,
        requestedPieces: item.requestedPieces,
        estimatedPrice: Number(item.estimatedPrice),
        pricePerUnit,
        actualKg: item.requestedKg ? Number(item.requestedKg) : 0, // prefilled with requested
        actualPieces: item.requestedPieces ?? 0,
        overrideEnabled: false,
        overridePrice: 0,
      };
    });

    console.log("--- Scenario A: No changes (actuals = requested) ---");
    let calcTotal = 0;
    for (const i of formItems) {
      const lineTotal =
        i.orderedAs === "KG"
          ? Math.round(i.actualKg * i.pricePerUnit)
          : Math.round(i.actualPieces * i.pricePerUnit);
      calcTotal += lineTotal;
      console.log(
        `  ${i.name.padEnd(15)} [${i.orderedAs}] ` +
          `${i.orderedAs === "KG" ? i.actualKg + " kg" : i.actualPieces + " pcs"} × ` +
          `${i.pricePerUnit.toLocaleString("ru-RU")} UZS = ` +
          `${lineTotal.toLocaleString("ru-RU")} UZS`
      );
    }
    console.log(`  Calculated Total:  ${calcTotal.toLocaleString("ru-RU")} UZS`);
    console.log(`  Adjustments:       0`);
    console.log(`  Final Total:       ${calcTotal.toLocaleString("ru-RU")} UZS`);
    console.log(
      `  Diff vs estimate:  ${(calcTotal - Number(order.estimatedTotal)) >= 0 ? "+" : ""}${(calcTotal - Number(order.estimatedTotal)).toLocaleString("ru-RU")} UZS`
    );

    console.log("\n--- Scenario B: Tomato 2.85 kg, Apple overridden at 24,000 ---");
    const scenarioB = formItems.map((i) => {
      if (i.name === "Tomato") return { ...i, actualKg: 2.85 };
      if (i.name === "Apple") return { ...i, overrideEnabled: true, overridePrice: 24000 };
      return i;
    });

    function autoCalc(i: typeof scenarioB[0]) {
      return i.orderedAs === "KG"
        ? Math.round(i.actualKg * i.pricePerUnit)
        : Math.round(i.actualPieces * i.pricePerUnit);
    }

    const calcTotalB = scenarioB.reduce((s, i) => s + autoCalc(i), 0);
    const adjustmentsB = scenarioB.reduce((s, i) => {
      if (!i.overrideEnabled) return s;
      return s + (i.overridePrice - autoCalc(i));
    }, 0);
    const finalTotalB = calcTotalB + adjustmentsB;

    for (const i of scenarioB) {
      const auto = autoCalc(i);
      const line = i.overrideEnabled ? i.overridePrice : auto;
      const override = i.overrideEnabled ? ` [OVERRIDE from ${auto.toLocaleString("ru-RU")}]` : "";
      console.log(
        `  ${i.name.padEnd(15)} [${i.orderedAs}] ` +
          `${i.orderedAs === "KG" ? i.actualKg + " kg" : i.actualPieces + " pcs"} = ` +
          `${line.toLocaleString("ru-RU")} UZS${override}`
      );
    }
    console.log(`  Calculated Total:  ${calcTotalB.toLocaleString("ru-RU")} UZS`);
    console.log(
      `  Adjustments:       ${adjustmentsB >= 0 ? "+" : ""}${adjustmentsB.toLocaleString("ru-RU")} UZS`
    );
    console.log(`  ─────────────────────────────────`);
    console.log(`  FINAL TOTAL:       ${finalTotalB.toLocaleString("ru-RU")} UZS`);
    console.log(
      `  Diff vs estimate:  ${(finalTotalB - Number(order.estimatedTotal)) >= 0 ? "+" : ""}${(finalTotalB - Number(order.estimatedTotal)).toLocaleString("ru-RU")} UZS`
    );

    console.log("\n=== NOTIFICATION MESSAGE PREVIEW ===");
    const shortId = order.id.slice(-6).toUpperCase();
    const estimatedFmt = Number(order.estimatedTotal).toLocaleString("ru-RU");
    const actualFmt = finalTotalB.toLocaleString("ru-RU");
    const diff = finalTotalB - Number(order.estimatedTotal);
    const diffFmt = `${diff >= 0 ? "+" : ""}${diff.toLocaleString("ru-RU")}`;
    console.log(`"Order #${shortId} ready for pickup`);
    console.log(`Estimated: ${estimatedFmt} UZS`);
    console.log(`Final: ${actualFmt} UZS (${diffFmt})`);
    console.log(`Tap to view order details"`);
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
