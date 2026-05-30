import { Prisma } from "@prisma/client";

/**
 * Recursively converts all Prisma Decimal instances to plain numbers so
 * objects can cross the Server→Client boundary without serialization errors.
 */
export function serializeDecimals<T>(data: T): T {
  if (data instanceof Prisma.Decimal) return Number(data) as unknown as T;
  if (data === null || data === undefined) return data;
  if (data instanceof Date) return data;
  if (Array.isArray(data)) return data.map(serializeDecimals) as unknown as T;
  if (typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      out[k] = serializeDecimals(v);
    }
    return out as T;
  }
  return data;
}
