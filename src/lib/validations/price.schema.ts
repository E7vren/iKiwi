import { z } from "zod";

export const setDailyPricesSchema = z.object({
  prices: z
    .array(
      z.object({
        productId: z.string().min(1),
        pricePerKg: z.number().int().positive().optional(),
        pricePerPiece: z.number().int().positive().optional(),
      }).refine(
        (p) => p.pricePerKg != null || p.pricePerPiece != null,
        { message: "At least one price (kg or piece) must be set" }
      )
    )
    .min(1, "At least one price must be set"),
});

export type SetDailyPricesInput = z.infer<typeof setDailyPricesSchema>;
