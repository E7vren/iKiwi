import { z } from "zod";

export const arriveAtStopSchema = z.object({
  stopId: z.string().min(1),
});

export const itemReturnSchema = z.object({
  orderItemId: z.string().min(1),
  returnedKg: z.number().nonnegative().optional(),
  returnedPieces: z.number().int().nonnegative().optional(),
  reason: z.enum([
    "BAD_QUALITY",
    "WRONG_PRODUCT",
    "DAMAGED",
    "EXPIRED",
    "CUSTOMER_REFUSED",
    "OTHER",
  ]),
  note: z.string().max(200).optional(),
});

export const completeDeliverySchema = z.object({
  stopId: z.string().min(1),
  returns: z.array(itemReturnSchema).default([]),
  deliveryNote: z.string().max(500).optional(),
});

export const skipStopSchema = z.object({
  stopId: z.string().min(1),
  reason: z.string().min(5, "Reason must be at least 5 characters").max(300),
});

export type ArriveAtStopInput = z.infer<typeof arriveAtStopSchema>;
export type ItemReturnInput = z.infer<typeof itemReturnSchema>;
export type CompleteDeliveryInput = z.infer<typeof completeDeliverySchema>;
export type SkipStopInput = z.infer<typeof skipStopSchema>;
