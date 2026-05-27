import { z } from "zod";

export const createShopSchema = z.object({
  name: z.string().min(2, "Shop name must be at least 2 characters"),
  ownerName: z.string().min(2, "Owner name must be at least 2 characters"),
  phone: z
    .string()
    .min(7, "Phone number is too short")
    .regex(/^\+?[0-9\s\-()]+$/, "Invalid phone number format"),
  address: z.string().min(5, "Address is too short"),
  latitude: z
    .number()
    .min(37, "Latitude out of range for Uzbekistan")
    .max(46, "Latitude out of range for Uzbekistan"),
  longitude: z
    .number()
    .min(56, "Longitude out of range for Uzbekistan")
    .max(74, "Longitude out of range for Uzbekistan"),
});

export const updateShopSchema = z.object({
  shopId: z.string().min(1),
  isActive: z.boolean(),
});

export type CreateShopInput = z.infer<typeof createShopSchema>;
export type UpdateShopInput = z.infer<typeof updateShopSchema>;
