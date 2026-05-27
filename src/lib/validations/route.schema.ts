import { z } from "zod";

export const generateRoutesSchema = z.object({
  date:             z.string().date(),
  driverCount:      z.number().int().min(1).max(20),
  optimizationMode: z.enum(["DISTANCE", "TIME", "BALANCED"]).default("BALANCED"),
  orderIds:         z.array(z.string()).optional(),
});

export const assignRouteSchema = z.object({
  routeId: z.string().min(1),
  staffId: z.string().min(1),
});

export const startRouteSchema = z.object({
  routeId: z.string().min(1),
});

export type GenerateRoutesInput = z.infer<typeof generateRoutesSchema>;
export type AssignRouteInput = z.infer<typeof assignRouteSchema>;
export type StartRouteInput = z.infer<typeof startRouteSchema>;
