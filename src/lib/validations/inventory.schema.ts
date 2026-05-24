import { z } from "zod";

export const adjustStockSchema = z
  .object({
    productId: z.string().min(1),
    deltaKg: z.number().optional(),
    deltaPieces: z.number().int().optional(),
    type: z.enum(["ADJUSTMENT", "WASTE", "THEFT", "COUNT_CORRECTION"]),
    reason: z.string().min(2).max(200),
    note: z.string().max(500).optional(),
  })
  .refine((d) => d.deltaKg !== undefined || d.deltaPieces !== undefined, {
    message: "Must specify deltaKg or deltaPieces",
  });

export const setReorderPointSchema = z.object({
  productId: z.string().min(1),
  minStockKg: z.number().nonnegative().optional(),
  minStockPieces: z.number().int().nonnegative().optional(),
  targetStockKg: z.number().nonnegative().optional(),
  targetStockPieces: z.number().int().nonnegative().optional(),
  supplierName: z.string().max(80).optional(),
  supplierPrice: z.number().int().nonnegative().optional(),
});

export const restockReceivedSchema = z.object({
  restockTaskId: z.string().min(1),
  items: z.array(
    z.object({
      restockItemId: z.string().min(1),
      receivedKg: z.number().nonnegative().optional(),
      receivedPieces: z.number().int().nonnegative().optional(),
      pricePaidPerKg: z.number().int().nonnegative().optional(),
      pricePaidPerPiece: z.number().int().nonnegative().optional(),
    })
  ),
  staffNote: z.string().max(500).optional(),
});

export const createManualRestockSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        neededKg: z.number().positive().optional(),
        neededPieces: z.number().int().positive().optional(),
      })
    )
    .min(1),
  assignedToId: z.string().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  adminNote: z.string().max(500).optional(),
});

export const warehouseStockCountSchema = z
  .object({
    productId: z.string().min(1),
    currentKg: z.number().nonnegative().optional(),
    currentPieces: z.number().int().nonnegative().optional(),
    note: z.string().max(200).optional(),
  })
  .refine((d) => d.currentKg !== undefined || d.currentPieces !== undefined, {
    message: "Must specify currentKg or currentPieces",
  });

export const warehouseIncomingSchema = z
  .object({
    productId: z.string().min(1),
    receivedKg: z.number().positive().optional(),
    receivedPieces: z.number().int().positive().optional(),
    costPerKg: z.number().int().nonnegative().optional(),
    costPerPiece: z.number().int().nonnegative().optional(),
    note: z.string().max(200).optional(),
  })
  .refine((d) => d.receivedKg !== undefined || d.receivedPieces !== undefined, {
    message: "Must specify receivedKg or receivedPieces",
  })
  .refine((d) => !(d.costPerKg !== undefined && d.costPerPiece !== undefined), {
    message: "Provide costPerKg or costPerPiece, not both",
  });

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type SetReorderPointInput = z.infer<typeof setReorderPointSchema>;
export type RestockReceivedInput = z.infer<typeof restockReceivedSchema>;
export type CreateManualRestockInput = z.infer<typeof createManualRestockSchema>;
export type WarehouseStockCountInput = z.infer<typeof warehouseStockCountSchema>;
export type WarehouseIncomingInput = z.infer<typeof warehouseIncomingSchema>;
