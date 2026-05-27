import { z } from "zod";

export const createStaffSchema = z.object({
  fullName:     z.string().min(2).max(80),
  email:        z.string().email(),
  phone:        z.string().regex(/^\+?998\d{9}$/, "Valid Uzbek phone required"),
  password:     z.string().min(8),
  vehicleType:  z.enum(["MOTORCYCLE", "CAR", "VAN", "TRUCK"]),
  vehiclePlate: z.string().max(20).optional(),
});

export const updateStaffSchema = createStaffSchema
  .partial()
  .omit({ password: true })
  .extend({ id: z.string().min(1) });

export const toggleAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

export const updateLocationSchema = z.object({
  latitude:  z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type ToggleAvailabilityInput = z.infer<typeof toggleAvailabilitySchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
