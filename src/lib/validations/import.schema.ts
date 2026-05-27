import { z } from "zod";

export const importCategorySchema = z.object({
  key:     z.string().min(1),
  name_en: z.string().min(1),
  name_uz: z.string().min(1),
  name_ru: z.string().nullable().optional(),
  icon:    z.string().nullable().optional(),
});

export const importProductSchema = z.object({
  category: z.string().min(1),
  name_uz:  z.string().min(1),
  unitType: z.enum(["KG", "PIECE", "BOTH"]),
  price:    z.number().positive(),
});

export const importSchema = z.object({
  categories: z.array(importCategorySchema),
  products:   z.array(importProductSchema),
  mode:       z.enum(["skip", "update", "replace"]).default("skip"),
});

export type ImportInput    = z.infer<typeof importSchema>;
export type ImportCategory = z.infer<typeof importCategorySchema>;
export type ImportProduct  = z.infer<typeof importProductSchema>;
export type ImportMode     = "skip" | "update" | "replace";
