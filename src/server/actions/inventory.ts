"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeError } from "@/lib/errors";
import { checkReorderPoint } from "@/lib/inventory/alerts";
import { applyStockChange } from "@/lib/inventory/stock-engine";
import { triggerEvent } from "@/lib/pusher";
import {
  adjustStockSchema,
  setReorderPointSchema,
  warehouseIncomingSchema,
  warehouseStockCountSchema,
} from "@/lib/validations/inventory.schema";
import type { ActionResult } from "@/types";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "COMPANY_ADMIN") throw new Error("Unauthorized");
  return session;
}

async function requireWarehouseStaff() {
  const session = await auth();
  if (session?.user.role !== "WAREHOUSE_STAFF") throw new Error("Unauthorized");
  return session;
}

// ─── Stock reading ────────────────────────────────────────────────────────────

export async function getAllStockForStaff() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "COMPANY_ADMIN" && session.user.role !== "WAREHOUSE_STAFF")
  ) {
    throw new Error("Unauthorized");
  }
  return prisma.stockItem.findMany({
    include: {
      product: { include: { category: true } },
    },
    orderBy: { product: { name: "asc" } },
  });
}

export async function getAllStock() {
  await requireAdmin();
  return prisma.stockItem.findMany({
    include: {
      product: { include: { category: true } },
    },
    orderBy: { product: { name: "asc" } },
  });
}

export async function getStockByProduct(productId: string) {
  await requireAdmin();
  return prisma.stockItem.findUnique({
    where: { productId },
    include: {
      product: true,
      movements: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });
}

export async function getLowStockProducts() {
  await requireAdmin();
  const all = await prisma.stockItem.findMany({
    include: { product: { include: { category: true } } },
  });
  return all.filter((s) => {
    const kgLow =
      s.minStockKg != null && s.availableKg != null && Number(s.availableKg) < Number(s.minStockKg);
    const piecesLow =
      s.minStockPieces != null && s.availablePieces != null && s.availablePieces < s.minStockPieces;
    return kgLow || piecesLow;
  });
}

// ─── Manual adjustment ────────────────────────────────────────────────────────

export async function adjustStock(input: unknown): Promise<ActionResult<void>> {
  try {
    const session = await requireAdmin();
    const data = adjustStockSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      await applyStockChange(tx, {
        productId: data.productId,
        deltaKg: data.deltaKg,
        deltaPieces: data.deltaPieces,
        type: data.type,
        performedBy: session.user.id,
        performedByRole: "COMPANY_ADMIN",
        reason: data.reason,
        note: data.note,
      });
      await checkReorderPoint(tx, data.productId);
    });

    await triggerEvent("private-admin", "stock-adjusted", { productId: data.productId });
    revalidatePath("/admin/warehouse");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: normalizeError(e) };
  }
}

// ─── Stock movement history ───────────────────────────────────────────────────

export async function getStockMovements(opts?: {
  productId?: string;
  type?: string;
  limit?: number;
  offset?: number;
}) {
  await requireAdmin();
  const where: Record<string, unknown> = {};
  if (opts?.productId) where.stockItem = { productId: opts.productId };
  if (opts?.type) where.type = opts.type;

  return prisma.stockMovement.findMany({
    where,
    include: {
      stockItem: { include: { product: { include: { category: true } } } },
      warehouseStaff: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 100,
    skip: opts?.offset ?? 0,
  });
}

// ─── Reorder point / supplier settings ───────────────────────────────────────

export async function setReorderPoint(input: unknown): Promise<ActionResult<void>> {
  try {
    await requireAdmin();
    const data = setReorderPointSchema.parse(input);

    await prisma.stockItem.update({
      where: { productId: data.productId },
      data: {
        minStockKg: data.minStockKg,
        minStockPieces: data.minStockPieces,
        targetStockKg: data.targetStockKg,
        targetStockPieces: data.targetStockPieces,
        supplierName: data.supplierName,
        supplierPrice: data.supplierPrice,
      },
    });

    revalidatePath("/admin/warehouse");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: normalizeError(e) };
  }
}

// ─── Warehouse staff: set current stock count ─────────────────────────────────

export async function warehouseUpdateStockCount(input: unknown): Promise<ActionResult<void>> {
  try {
    const session = await requireWarehouseStaff();
    const data = warehouseStockCountSchema.parse(input);

    const staff = await prisma.warehouseStaff.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!staff) return { success: false, error: "Staff profile not found" };

    const stockItem = await prisma.stockItem.findUnique({
      where: { productId: data.productId },
      select: { availableKg: true, availablePieces: true },
    });
    if (!stockItem) return { success: false, error: "Product not tracked in inventory" };

    const deltaKg =
      data.currentKg !== undefined
        ? data.currentKg - Number(stockItem.availableKg ?? 0)
        : undefined;
    const deltaPieces =
      data.currentPieces !== undefined
        ? data.currentPieces - (stockItem.availablePieces ?? 0)
        : undefined;

    // Nothing changed — skip writing a movement
    if (
      (deltaKg === undefined || deltaKg === 0) &&
      (deltaPieces === undefined || deltaPieces === 0)
    ) {
      return { success: true, data: undefined };
    }

    await prisma.$transaction(async (tx) => {
      await applyStockChange(tx, {
        productId: data.productId,
        deltaKg: deltaKg !== undefined && deltaKg !== 0 ? deltaKg : undefined,
        deltaPieces: deltaPieces !== undefined && deltaPieces !== 0 ? deltaPieces : undefined,
        type: "COUNT_CORRECTION",
        performedBy: session.user.id,
        performedByRole: "WAREHOUSE_STAFF",
        warehouseStaffId: staff.id,
        note: data.note,
      });
    });

    revalidatePath("/warehouse/stock");
    revalidatePath("/admin/warehouse");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: normalizeError(e) };
  }
}

// ─── Warehouse staff: log incoming stock ──────────────────────────────────────

export async function warehouseLogIncoming(input: unknown): Promise<ActionResult<void>> {
  try {
    const session = await requireWarehouseStaff();
    const data = warehouseIncomingSchema.parse(input);

    const staff = await prisma.warehouseStaff.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!staff) return { success: false, error: "Staff profile not found" };

    await prisma.$transaction(async (tx) => {
      await applyStockChange(tx, {
        productId: data.productId,
        deltaKg: data.receivedKg,
        deltaPieces: data.receivedPieces,
        type: "RESTOCK",
        performedBy: session.user.id,
        performedByRole: "WAREHOUSE_STAFF",
        warehouseStaffId: staff.id,
        note: data.note,
      });

      const update: Record<string, unknown> = { lastRestockedAt: new Date() };
      if (data.costPerKg !== undefined) update.supplierPrice = data.costPerKg;
      else if (data.costPerPiece !== undefined) update.supplierPrice = data.costPerPiece;

      await tx.stockItem.update({
        where: { productId: data.productId },
        data: update,
      });
    });

    revalidatePath("/warehouse/stock");
    revalidatePath("/admin/warehouse");
    return { success: true, data: undefined };
  } catch (e) {
    console.error("[warehouseLogIncoming] failed", {
      productId: (input as { productId?: string })?.productId,
      error:     e instanceof Error ? e.message : String(e),
    });
    return { success: false, error: normalizeError(e) };
  }
}
