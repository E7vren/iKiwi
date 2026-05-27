import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `${Math.round(amount).toLocaleString("ru-RU")} UZS`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function todayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
    PREPARING: "bg-blue-100 text-blue-800 border-blue-200",
    READY: "bg-green-100 text-green-800 border-green-200",
    OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800 border-purple-200",
    DELIVERED: "bg-gray-100 text-gray-700 border-border",
    CANCELLED: "bg-red-100 text-red-800 border-red-200",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

export function getUnitLabel(unitType: "KG" | "PIECE" | "BOTH", orderedAs?: "KG" | "PIECE"): string {
  const resolved = orderedAs ?? (unitType === "BOTH" ? "KG" : unitType);
  return resolved === "KG" ? "kg" : "pcs";
}

export function getCategoryName(
  category: { nameEn: string; nameUz: string; nameRu?: string | null },
  locale: string
): string {
  if (locale === "uz") return category.nameUz;
  if (locale === "ru") return category.nameRu ?? category.nameEn;
  return category.nameEn;
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: "Pending",
    PREPARING: "Preparing",
    READY: "Ready",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
  };
  return map[status] ?? status;
}
