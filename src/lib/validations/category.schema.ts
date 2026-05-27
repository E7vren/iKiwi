import { z } from "zod";

export const createCategorySchema = z.object({
  nameEn:    z.string().min(2).max(50),
  nameUz:    z.string().min(2).max(50),
  nameRu:    z.string().max(50).optional(),
  slug:      z.string().regex(/^[a-z0-9-]+$/, "lowercase, numbers, hyphens only"),
  icon:      z.string().max(10).optional(),
  sortOrder: z.number().int().min(0),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  id: z.string(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
