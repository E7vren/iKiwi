import type { $Enums, Prisma } from "@prisma/client";

type MovementType = $Enums.MovementType;
type Role = $Enums.Role;

export type StockChangeInput = {
  productId:         string;
  deltaKg?:          number;
  deltaPieces?:      number;
  type:              MovementType;
  performedBy:       string;
  performedByRole:   Role;
  orderId?:          string;
  restockTaskId?:    string;
  warehouseStaffId?: string;
  reason?:           string;
  note?:             string;
};

export async function applyStockChange(
  tx: Prisma.TransactionClient,
  input: StockChangeInput
) {
  const stockItem = await tx.stockItem.findUnique({
    where:  { productId: input.productId },
    select: { id: true },
  });
  if (!stockItem) {
    throw new Error(`No stock record for product ${input.productId}`);
  }

  const dKg     = input.deltaKg     ?? 0;
  const dPieces = input.deltaPieces ?? 0;

  const updateData: Prisma.StockItemUpdateInput = {};

  switch (input.type) {
    case "RESTOCK":
    case "INITIAL_STOCK":
    case "RETURN":
    case "ADJUSTMENT":
    case "WASTE":
    case "THEFT":
    case "COUNT_CORRECTION":
      if (dKg     !== 0) updateData.availableKg     = { increment: dKg };
      if (dPieces !== 0) updateData.availablePieces = { increment: dPieces };
      break;

    case "RELEASED":
      if (dKg !== 0) {
        updateData.availableKg = { increment: dKg };
        updateData.reservedKg  = { decrement: dKg };
      }
      if (dPieces !== 0) {
        updateData.availablePieces = { increment: dPieces };
        updateData.reservedPieces  = { decrement: dPieces };
      }
      break;

    case "RESERVED":
      if (dKg !== 0) {
        updateData.availableKg = { decrement: dKg };
        updateData.reservedKg  = { increment: dKg };
      }
      if (dPieces !== 0) {
        updateData.availablePieces = { decrement: dPieces };
        updateData.reservedPieces  = { increment: dPieces };
      }
      break;

    case "CONSUMED":
      if (dKg     !== 0) updateData.reservedKg     = { decrement: dKg };
      if (dPieces !== 0) updateData.reservedPieces = { decrement: dPieces };
      break;
  }

  if (input.type === "RESTOCK") {
    updateData.lastRestockedAt = new Date();
  }

  const updated = await tx.stockItem.update({
    where:  { id: stockItem.id },
    data:   updateData,
    select: { availableKg: true, availablePieces: true },
  });

  if (updated.availableKg !== null && Number(updated.availableKg) < 0) {
    console.warn(`[Stock] Negative available for product ${input.productId}: ${Number(updated.availableKg)} kg`);
  }

  return tx.stockMovement.create({
    data: {
      stockItemId:      stockItem.id,
      type:             input.type,
      deltaKg:          dKg     !== 0 ? dKg     : null,
      deltaPieces:      dPieces !== 0 ? dPieces : null,
      newBalanceKg:     updated.availableKg    != null ? Number(updated.availableKg)    : null,
      newBalancePieces: updated.availablePieces ?? null,
      orderId:          input.orderId,
      restockTaskId:    input.restockTaskId,
      performedBy:      input.performedBy,
      performedByRole:  input.performedByRole,
      reason:           input.reason,
      note:             input.note,
      warehouseStaffId: input.warehouseStaffId,
    },
  });
}
