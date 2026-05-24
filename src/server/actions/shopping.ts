"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { triggerEvent } from "@/lib/pusher";
import type { ActionResult } from "@/types";

export type ShoppingItem = {
  productId: string;
  productName: string;
  unitType: string;
  neededKg: number;
  neededPieces: number;
  availableKg: number;
  availablePieces: number;
  toBuyKg: number;
  toBuyPieces: number;
};

// ─── Generate shopping list ───────────────────────────────────────────────────

export async function generateShoppingList(): Promise<
  ActionResult<{ taskId: string | null; items: ShoppingItem[]; message?: string }>
> {
  try {
    const session = await auth();
    const allowed = ["COMPANY_ADMIN", "WAREHOUSE_STAFF"] as const;
    if (!session?.user || !allowed.includes(session.user.role as (typeof allowed)[number])) {
      return { success: false, error: "Unauthorized" };
    }

    // Cover today + tomorrow so day-before orders are included
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const windowEnd = new Date(todayStart);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 2);

    const orders = await prisma.order.findMany({
      where: {
        status: { notIn: ["CANCELLED"] },
        createdAt: { gte: todayStart, lt: windowEnd },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                unitType: true,
                stockItem: {
                  select: { availableKg: true, availablePieces: true },
                },
              },
            },
          },
        },
      },
    });

    // Aggregate needed quantities per product
    type Acc = {
      name: string;
      unitType: string;
      neededKg: number;
      neededPieces: number;
      availableKg: number;
      availablePieces: number;
    };
    const neededMap = new Map<string, Acc>();

    for (const order of orders) {
      for (const item of order.items) {
        const pid = item.productId;
        const prev = neededMap.get(pid) ?? {
          name: item.product.name,
          unitType: item.product.unitType,
          neededKg: 0,
          neededPieces: 0,
          availableKg: Number(item.product.stockItem?.availableKg ?? 0),
          availablePieces: item.product.stockItem?.availablePieces ?? 0,
        };

        if (item.orderedAs === "KG" && item.requestedKg != null) {
          prev.neededKg += Number(item.requestedKg);
        } else if (item.orderedAs === "PIECE" && item.requestedPieces != null) {
          prev.neededPieces += item.requestedPieces;
        }

        neededMap.set(pid, prev);
      }
    }

    // Compute deficits
    const deficits: ShoppingItem[] = [];
    for (const [productId, d] of neededMap) {
      const toBuyKg = Math.max(0, d.neededKg - d.availableKg);
      const toBuyPieces = Math.max(0, d.neededPieces - d.availablePieces);
      if (toBuyKg > 0 || toBuyPieces > 0) {
        deficits.push({
          productId,
          productName: d.name,
          unitType: d.unitType,
          neededKg: d.neededKg,
          neededPieces: d.neededPieces,
          availableKg: d.availableKg,
          availablePieces: d.availablePieces,
          toBuyKg,
          toBuyPieces,
        });
      }
    }

    if (deficits.length === 0) {
      return {
        success: true,
        data: { taskId: null, items: [], message: "Stock is sufficient for all orders!" },
      };
    }

    // Upsert today's SHOPPING_LIST restock task
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    let taskId = "";

    await prisma.$transaction(async (tx) => {
      const existingTask = await tx.restockTask.findFirst({
        where: {
          triggerType: "MANUAL",
          priority: "URGENT",
          adminNote: { startsWith: "[SHOPPING_LIST]" },
          createdAt: { gte: today, lt: tomorrow },
        },
        select: { id: true },
      });

      if (existingTask) {
        await tx.restockItem.deleteMany({ where: { restockTaskId: existingTask.id } });
        await tx.restockItem.createMany({
          data: deficits.map((d) => ({
            restockTaskId: existingTask.id,
            productId: d.productId,
            neededKg: d.toBuyKg > 0 ? d.toBuyKg : null,
            neededPieces: d.toBuyPieces > 0 ? d.toBuyPieces : null,
          })),
        });
        taskId = existingTask.id;
      } else {
        const task = await tx.restockTask.create({
          data: {
            status: "PENDING",
            priority: "URGENT",
            triggerType: "MANUAL",
            adminNote: `[SHOPPING_LIST] Generated ${new Date().toISOString()}`,
            items: {
              create: deficits.map((d) => ({
                productId: d.productId,
                neededKg: d.toBuyKg > 0 ? d.toBuyKg : null,
                neededPieces: d.toBuyPieces > 0 ? d.toBuyPieces : null,
              })),
            },
          },
        });
        taskId = task.id;

        // Notify everyone — only on first generation
        const [admins, warehouseStaff, deliveryStaff] = await Promise.all([
          tx.user.findMany({ where: { role: "COMPANY_ADMIN" }, select: { id: true } }),
          tx.warehouseStaff.findMany({
            where: { isActive: true },
            include: { user: { select: { id: true } } },
          }),
          tx.deliveryStaff.findMany({
            where: { isActive: true },
            include: { user: { select: { id: true } } },
          }),
        ]);

        const names = deficits
          .slice(0, 3)
          .map((d) => d.productName)
          .join(", ");
        const extra = deficits.length > 3 ? ` +${deficits.length - 3} more` : "";
        const msg = `Shopping list: ${deficits.length} product${deficits.length !== 1 ? "s" : ""} needed — ${names}${extra}`;

        await tx.notification.createMany({
          data: [
            ...admins.map((u) => ({
              userId: u.id,
              type: "ORDER_SHORTAGE_ALERT" as const,
              title: "Shopping list ready",
              message: msg,
            })),
            ...warehouseStaff.map((s) => ({
              userId: s.user.id,
              type: "ORDER_SHORTAGE_ALERT" as const,
              title: "Shopping list ready",
              message: msg,
            })),
            ...deliveryStaff.map((d) => ({
              userId: d.user.id,
              type: "ORDER_SHORTAGE_ALERT" as const,
              title: "Shopping list ready",
              message: msg,
            })),
          ],
          skipDuplicates: true,
        });
      }
    });

    // Pusher — outside transaction (non-fatal)
    const [activeWarehouse, activeDelivery] = await Promise.all([
      prisma.warehouseStaff.findMany({ where: { isActive: true }, select: { id: true } }),
      prisma.deliveryStaff.findMany({ where: { isActive: true }, select: { id: true } }),
    ]);

    const pusherPayload = { taskId, count: deficits.length };
    await Promise.allSettled([
      triggerEvent("private-admin", "shopping-list-ready", pusherPayload),
      ...activeWarehouse.map((s) =>
        triggerEvent(`private-warehouse-${s.id}`, "shopping-list-ready", pusherPayload)
      ),
      ...activeDelivery.map((d) =>
        triggerEvent(`private-driver-${d.id}`, "shopping-list-ready", pusherPayload)
      ),
    ]);

    revalidatePath("/admin/restock");
    revalidatePath("/warehouse/stock");
    revalidatePath("/driver/shopping");

    return { success: true, data: { taskId, items: deficits } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Failed to generate shopping list",
    };
  }
}

// ─── Get today's shopping list ────────────────────────────────────────────────

type ShoppingListTask = Prisma.RestockTaskGetPayload<{
  include: {
    items: {
      include: {
        product: {
          select: {
            id: true;
            name: true;
            unitType: true;
            stockItem: { select: { availableKg: true; availablePieces: true } };
          };
        };
      };
    };
  };
}>;

export async function getShoppingList(): Promise<ActionResult<ShoppingListTask | null>> {
  try {
    const session = await auth();
    const allowed = ["COMPANY_ADMIN", "WAREHOUSE_STAFF", "DELIVERY_STAFF"] as const;
    if (!session?.user || !allowed.includes(session.user.role as (typeof allowed)[number])) {
      return { success: false, error: "Unauthorized" };
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const task = await prisma.restockTask.findFirst({
      where: {
        triggerType: "MANUAL",
        priority: "URGENT",
        adminNote: { startsWith: "[SHOPPING_LIST]" },
        createdAt: { gte: today, lt: tomorrow },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                unitType: true,
                stockItem: { select: { availableKg: true, availablePieces: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: task };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Failed to fetch shopping list",
    };
  }
}

// ─── Claim shopping list ──────────────────────────────────────────────────────

export async function claimShoppingList(taskId: string): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (session?.user?.role !== "DELIVERY_STAFF") {
      return { success: false, error: "Unauthorized" };
    }

    await prisma.restockTask.update({
      where: { id: taskId },
      data: {
        adminNote: `[SHOPPING_LIST] Claimed by driver ${session.user.id} at ${new Date().toISOString()}`,
      },
    });

    revalidatePath("/driver/shopping");
    revalidatePath("/admin/restock");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to claim task" };
  }
}
