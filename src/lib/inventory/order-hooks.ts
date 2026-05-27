import type { $Enums, Prisma } from "@prisma/client";

type Role = $Enums.Role;
import { applyStockChange } from "./stock-engine";
import { checkReorderPoint } from "./alerts";

/**
 * Reserve stock for every item in an order (PENDING → PREPARING transition).
 * Items with insufficient stock are collected as shortages and an URGENT
 * ORDER_SHORTAGE restock task is created automatically.
 */
export async function reserveStockForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  adminUserId: string
): Promise<{ shortages: Array<{ productName: string; needed: number; available: number; productId: string }> }> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, stockItem: true },
          },
        },
      },
    },
  });

  const shortages: Array<{
    productName: string;
    needed: number;
    available: number;
    productId: string;
    orderedAs: "KG" | "PIECE";
  }> = [];

  for (const item of order.items) {
    const stock = item.product.stockItem;
    if (!stock) continue; // Product not tracked in inventory

    if (item.orderedAs === "KG" && item.requestedKg != null) {
      const needed    = Number(item.requestedKg);
      const available = Number(stock.availableKg ?? 0);
      if (available < needed) {
        shortages.push({ productName: item.product.name, needed, available, productId: item.productId, orderedAs: "KG" });
        continue;
      }
      await applyStockChange(tx, {
        productId: item.productId,
        deltaKg:   needed,
        type:      "RESERVED",
        performedBy:     adminUserId,
        performedByRole: "COMPANY_ADMIN",
        orderId,
      });
    } else if (item.orderedAs === "PIECE" && item.requestedPieces != null) {
      const needed    = item.requestedPieces;
      const available = stock.availablePieces ?? 0;
      if (available < needed) {
        shortages.push({ productName: item.product.name, needed, available, productId: item.productId, orderedAs: "PIECE" });
        continue;
      }
      await applyStockChange(tx, {
        productId:   item.productId,
        deltaPieces: needed,
        type:        "RESERVED",
        performedBy:     adminUserId,
        performedByRole: "COMPANY_ADMIN",
        orderId,
      });
    }
  }

  if (shortages.length > 0) {
    // Deduplicate: only create if no open shortage task already exists for this order
    const existingTask = await tx.restockTask.findFirst({
      where: { triggerOrderId: orderId, status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] } },
      select: { id: true },
    });

    if (!existingTask) {
      await tx.restockTask.create({
        data: {
          status:        "PENDING",
          priority:      "URGENT",
          triggerType:   "ORDER_SHORTAGE",
          triggerOrderId: orderId,
          items: {
            create: shortages.map((s) => ({
              productId:    s.productId,
              neededKg:     s.orderedAs === "KG"    ? s.needed : undefined,
              neededPieces: s.orderedAs === "PIECE" ? s.needed : undefined,
            })),
          },
        },
      });

      const admins = await tx.user.findMany({
        where:  { role: "COMPANY_ADMIN" },
        select: { id: true },
      });
      const names = shortages.map((s) => s.productName).join(", ");
      const shortId = orderId.slice(-6).toUpperCase();
      await tx.notification.createMany({
        data: admins.map((a) => ({
          userId:  a.id,
          type:    "ORDER_SHORTAGE_ALERT" as const,
          message: `Order #${shortId}: insufficient stock for ${names}. Urgent restock task created.`,
        })),
      });
    }
  }

  return { shortages };
}

/**
 * Release all reserved stock back to available (order CANCELLED).
 * Only has effect if the order was in PREPARING state and stock was reserved.
 */
export async function releaseStockForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  adminUserId: string
) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: {
        include: { product: { select: { id: true, stockItem: { select: { id: true } } } } },
      },
    },
  });

  // Only release items that were actually reserved (have a RESERVED movement for this order)
  const reservedMovements = await tx.stockMovement.findMany({
    where:  { orderId, type: "RESERVED" },
    select: { stockItem: { select: { productId: true } }, deltaKg: true, deltaPieces: true },
  });
  const reservedSet = new Map(
    reservedMovements.map((m) => [m.stockItem.productId, m])
  );

  for (const item of order.items) {
    if (!item.product.stockItem) continue;
    if (!reservedSet.has(item.productId)) continue; // was never reserved (shortage)

    if (item.orderedAs === "KG" && item.requestedKg != null) {
      await applyStockChange(tx, {
        productId: item.productId,
        deltaKg:   Number(item.requestedKg),
        type:      "RELEASED",
        performedBy:     adminUserId,
        performedByRole: "COMPANY_ADMIN",
        orderId,
      });
    } else if (item.orderedAs === "PIECE" && item.requestedPieces != null) {
      await applyStockChange(tx, {
        productId:   item.productId,
        deltaPieces: item.requestedPieces,
        type:        "RELEASED",
        performedBy:     adminUserId,
        performedByRole: "COMPANY_ADMIN",
        orderId,
      });
    }
  }
}

/**
 * Consume reserved stock on delivery completion.
 * Delivered amounts → CONSUMED (permanently removes from reserved).
 * Returned amounts → RETURN (adds back to available).
 * Triggers reorder-point check after each CONSUMED movement.
 */
export async function consumeStockForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  performedBy: string,
  performedByRole: Role
) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: {
        include: { product: { select: { id: true, stockItem: { select: { id: true } } } } },
      },
    },
  });

  for (const item of order.items) {
    if (!item.product.stockItem) continue;

    if (item.orderedAs === "KG") {
      // Delivered amount (prefer explicit deliveredKg, fall back to actualKg)
      const deliveredKg = item.deliveredKg != null
        ? Number(item.deliveredKg)
        : item.actualKg != null ? Number(item.actualKg) : null;

      if (deliveredKg != null && deliveredKg > 0) {
        await applyStockChange(tx, {
          productId: item.productId,
          deltaKg:   deliveredKg,
          type:      "CONSUMED",
          performedBy,
          performedByRole,
          orderId,
        });
        await checkReorderPoint(tx, item.productId);
      }

      const returnedKg = item.returnedKg != null ? Number(item.returnedKg) : null;
      if (returnedKg != null && returnedKg > 0) {
        await applyStockChange(tx, {
          productId: item.productId,
          deltaKg:   returnedKg,
          type:      "RETURN",
          performedBy,
          performedByRole,
          orderId,
          reason: item.returnReason ?? undefined,
          note:   item.returnNote ?? undefined,
        });
      }
    } else if (item.orderedAs === "PIECE") {
      const deliveredPieces = item.deliveredPieces ?? item.actualPieces ?? null;

      if (deliveredPieces != null && deliveredPieces > 0) {
        await applyStockChange(tx, {
          productId:   item.productId,
          deltaPieces: deliveredPieces,
          type:        "CONSUMED",
          performedBy,
          performedByRole,
          orderId,
        });
        await checkReorderPoint(tx, item.productId);
      }

      const returnedPieces = item.returnedPieces ?? null;
      if (returnedPieces != null && returnedPieces > 0) {
        await applyStockChange(tx, {
          productId:   item.productId,
          deltaPieces: returnedPieces,
          type:        "RETURN",
          performedBy,
          performedByRole,
          orderId,
        });
      }
    }
  }
}
