import type { Prisma } from "@prisma/client";

/**
 * After a stock-reducing change, check if available stock crossed the
 * reorder threshold. Creates an AUTO_LOW_STOCK restock task and notifies
 * all admins if needed. Idempotent — skips if an open task already exists.
 */
export async function checkReorderPoint(
  tx: Prisma.TransactionClient,
  productId: string
) {
  const stock = await tx.stockItem.findUnique({
    where: { productId },
    include: { product: { select: { name: true } } },
  });
  if (!stock) return;

  const kgLow =
    stock.minStockKg != null &&
    stock.availableKg != null &&
    Number(stock.availableKg) < Number(stock.minStockKg);

  const piecesLow =
    stock.minStockPieces != null &&
    stock.availablePieces != null &&
    stock.availablePieces < stock.minStockPieces;

  if (!kgLow && !piecesLow) return;

  // Skip if an open restock task already covers this product
  const existing = await tx.restockItem.findFirst({
    where: {
      productId,
      restockTask: { status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] } },
    },
  });
  if (existing) return;

  const neededKg =
    kgLow && stock.targetStockKg != null
      ? Math.max(0, Number(stock.targetStockKg) - Number(stock.availableKg ?? 0))
      : undefined;

  const neededPieces =
    piecesLow && stock.targetStockPieces != null
      ? Math.max(0, stock.targetStockPieces - (stock.availablePieces ?? 0))
      : undefined;

  await tx.restockTask.create({
    data: {
      status:      "PENDING",
      priority:    "NORMAL",
      triggerType: "AUTO_LOW_STOCK",
      items: {
        create: [{ productId, neededKg, neededPieces }],
      },
    },
  });

  const admins = await tx.user.findMany({
    where: { role: "COMPANY_ADMIN" },
    select: { id: true },
  });

  const msg = `Low stock: ${stock.product.name} is below reorder point. A restock task has been created automatically.`;
  for (const admin of admins) {
    await tx.notification.create({
      data: { userId: admin.id, type: "LOW_STOCK_ALERT", message: msg },
    });
  }
}
