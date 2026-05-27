import { z } from "zod";

const productBaseSchema = z.object({
  name:                 z.string().min(2).max(100),
  nameUz:               z.string().max(100).optional(),
  nameRu:               z.string().max(100).optional(),
  categoryId:           z.string().min(1, "Category is required"),
  unitType:             z.enum(["KG", "PIECE", "BOTH"]),
  imageUrl:             z.preprocess((v) => (v === "" ? null : v), z.string().url("Must be a valid URL").optional().nullable()),
  isAvailable:          z.boolean().default(true),
  initialPricePerKg:    z.number().int().positive().optional(),
  initialPricePerPiece: z.number().int().positive().optional(),
});

export const createProductSchema = productBaseSchema.refine(
  (data) => {
    if (data.unitType === "KG")    return !!data.initialPricePerKg;
    if (data.unitType === "PIECE") return !!data.initialPricePerPiece;
    if (data.unitType === "BOTH")  return !!data.initialPricePerKg && !!data.initialPricePerPiece;
    return false;
  },
  { message: "Price is required and must match the unit type" }
);

export const updateProductSchema = productBaseSchema.partial().extend({
  id: z.string().min(1),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
