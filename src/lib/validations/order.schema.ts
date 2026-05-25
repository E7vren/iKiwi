import { z } from "zod";

const ORDER_STATUSES = [
  "PENDING",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;

const orderItemSchema = z.discriminatedUnion("orderedAs", [
  z.object({
    productId: z.string().min(1),
    orderedAs: z.literal("KG"),
    requestedKg: z.number().positive("Quantity must be greater than 0").multipleOf(0.5),
  }),
  z.object({
    productId: z.string().min(1),
    orderedAs: z.literal("PIECE"),
    requestedPieces: z.number().int().positive("Quantity must be greater than 0"),
  }),
]);

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, "Order must have at least one item"),
  notes: z.string().max(500).optional(),
});

export const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(ORDER_STATUSES),
});

export const setActualCostSchema = z.object({
  orderId: z.string().min(1),
  saveDraft: z.boolean().optional(),
  items: z.array(
    z.object({
      orderItemId: z.string().min(1),
      actualKg: z.number().positive().optional(),
      actualPieces: z.number().int().positive().optional(),
      overridePrice: z.number().int().positive().max(100_000_000).optional(),
      adminNote: z.string().max(200).optional(),
    })
  ),
  finalCostNote: z.string().max(500).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type SetActualCostInput = z.infer<typeof setActualCostSchema>;
