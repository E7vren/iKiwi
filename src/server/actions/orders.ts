"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendActualCostEmail, sendNewOrderEmail } from "@/lib/email";
import { releaseStockForOrder, reserveStockForOrder } from "@/lib/inventory/order-hooks";
import { triggerEvent } from "@/lib/pusher";
import {
  type CreateOrderInput,
  createOrderSchema,
  type SetActualCostInput,
  setActualCostSchema,
  type UpdateOrderStatusInput,
  updateOrderStatusSchema,
} from "@/lib/validations";

type OrderRow = Prisma.OrderGetPayload<{
  include: {
    shop: { select: { id: true; name: true; ownerName: true; phone: true } };
    items: { include: { product: { select: { id: true; name: true; unitType: true } } } };
  };
}>;

type Result<T> = { success: true; data: T } | { success: false; error: string };

function todayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function placeOrder(input: CreateOrderInput): Promise<Result<{ id: string }>> {
  const session = await auth();
  if (session?.user?.role !== "SHOP_OWNER") return { success: false, error: "Forbidden" };
  if (!session.user.shopId) return { success: false, error: "No shop linked to your account" };
  const shopId = session.user.shopId;

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { isActive: true },
  });
  if (!shop?.isActive) return { success: false, error: "Your shop is not yet approved" };

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" };

  const today = todayUTC();
  const productIds = parsed.data.items.map((i) => i.productId);

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isAvailable: true },
    include: {
      dailyPrices: { where: { date: today }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  let estimatedTotal = 0;
  const itemsData: Array<{
    productId: string;
    orderedAs: "KG" | "PIECE";
    requestedKg: number | null;
    requestedPieces: number | null;
    estimatedPrice: number;
  }> = [];

  for (const item of parsed.data.items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return { success: false, error: "Product not found or unavailable" };

    const dp = product.dailyPrices[0];
    if (!dp) return { success: false, error: `No price set today for "${product.name}"` };

    let lineTotal: number;

    if (item.orderedAs === "KG") {
      if (!dp.pricePerKg)
        return { success: false, error: `No kg price today for "${product.name}"` };
      lineTotal = Math.round(Number(dp.pricePerKg) * item.requestedKg);
      if (lineTotal <= 0) {
        return {
          success: false,
          error: `Price for "${product.name}" is zero — cannot place order`,
        };
      }
      itemsData.push({
        productId: item.productId,
        orderedAs: "KG",
        requestedKg: item.requestedKg,
        requestedPieces: null,
        estimatedPrice: lineTotal,
      });
    } else {
      if (!dp.pricePerPiece)
        return { success: false, error: `No piece price today for "${product.name}"` };
      lineTotal = Math.round(Number(dp.pricePerPiece) * item.requestedPieces);
      if (lineTotal <= 0) {
        return {
          success: false,
          error: `Price for "${product.name}" is zero — cannot place order`,
        };
      }
      itemsData.push({
        productId: item.productId,
        orderedAs: "PIECE",
        requestedKg: null,
        requestedPieces: item.requestedPieces,
        estimatedPrice: lineTotal,
      });
    }

    estimatedTotal += lineTotal;
  }

  const { order, admins } = await prisma.$transaction(
    async (
      tx
    ): Promise<{
      order: { id: string; shop: { name: string }; items: { id: string }[] };
      admins: { id: string; email: string | null }[];
    }> => {
      const order = await tx.order.create({
        data: {
          shopId,
          estimatedTotal,
          notes: parsed.data.notes ?? null,
          items: { create: itemsData },
        },
        include: {
          shop: { select: { name: true } },
          items: { select: { id: true } },
        },
      });

      const admins = await tx.user.findMany({
        where: { role: "COMPANY_ADMIN" },
        select: { id: true, email: true },
      });

      if (admins.length) {
        await tx.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            type: "ORDER_PLACED" as const,
            message: `New order from ${order.shop.name} — ${order.items.length} items, est. ${estimatedTotal.toLocaleString("ru-RU")} UZS`,
          })),
        });
      }

      // Stock shortage check (advisory — creates restock task but doesn't block order)
      const stockProductIds = itemsData.map((i) => i.productId);
      const stockItems = await tx.stockItem.findMany({
        where: { productId: { in: stockProductIds } },
        select: { productId: true, availableKg: true, availablePieces: true },
      });
      const stockMap = new Map(stockItems.map((s) => [s.productId, s]));

      type Shortage = { productId: string; orderedAs: "KG" | "PIECE"; shortBy: number };
      const shortages: Shortage[] = [];

      for (const item of itemsData) {
        const stock = stockMap.get(item.productId);
        if (!stock) continue;

        if (item.orderedAs === "KG" && item.requestedKg != null) {
          const available = Number(stock.availableKg ?? 0);
          const shortBy = item.requestedKg - available;
          if (shortBy > 0) shortages.push({ productId: item.productId, orderedAs: "KG", shortBy });
        } else if (item.orderedAs === "PIECE" && item.requestedPieces != null) {
          const available = stock.availablePieces ?? 0;
          const shortBy = item.requestedPieces - available;
          if (shortBy > 0)
            shortages.push({ productId: item.productId, orderedAs: "PIECE", shortBy });
        }
      }

      if (shortages.length > 0) {
        await tx.restockTask.create({
          data: {
            status: "PENDING",
            priority: "URGENT",
            triggerType: "ORDER_SHORTAGE",
            triggerOrderId: order.id,
            items: {
              create: shortages.map((s) => ({
                productId: s.productId,
                neededKg: s.orderedAs === "KG" ? s.shortBy : undefined,
                neededPieces: s.orderedAs === "PIECE" ? Math.ceil(s.shortBy) : undefined,
              })),
            },
          },
        });

        const shortId = order.id.slice(-6).toUpperCase();
        if (admins.length) {
          await tx.notification.createMany({
            data: admins.map((a) => ({
              userId: a.id,
              type: "ORDER_SHORTAGE_ALERT" as const,
              title: "Order needs restock",
              message: `Order #${shortId} has ${shortages.length} item${shortages.length !== 1 ? "s" : ""} below current stock. Urgent restock task created.`,
            })),
          });
        }
      }

      return { order, admins };
    }
  );

  // Pusher and email — outside transaction (non-fatal)
  if (admins.length) {
    try {
      await triggerEvent("private-admin", "new-order", {
        orderId: order.id,
        shopName: order.shop.name,
        itemCount: order.items.length,
        estimatedTotal,
      });
      if (admins[0].email) {
        await sendNewOrderEmail({
          adminEmail: admins[0].email,
          shopName: order.shop.name,
          orderId: order.id,
          itemCount: order.items.length,
          estimatedTotal,
        });
      }
    } catch (e) {
      console.error(
        "[placeOrder] Pusher/email notification failed:",
        e instanceof Error ? e.message : e
      );
    }
  }

  revalidatePath("/shop/orders");
  return { success: true, data: { id: order.id } };
}

export async function updateOrderStatus(
  input: UpdateOrderStatusInput
): Promise<Result<{ status: string }>> {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN") return { success: false, error: "Forbidden" };

  const parsed = updateOrderStatusSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" };

  const order = await prisma.$transaction(async (tx) => {
    const currentOrder = await tx.order.findUniqueOrThrow({
      where: { id: parsed.data.orderId },
      select: { status: true },
    });

    const updated = await tx.order.update({
      where: { id: parsed.data.orderId },
      data: { status: parsed.data.status },
      include: { shop: { include: { user: true } } },
    });

    if (parsed.data.status === "PREPARING") {
      await reserveStockForOrder(tx, parsed.data.orderId, session.user.id);
    } else if (
      parsed.data.status === "CANCELLED" &&
      ["PREPARING", "READY", "OUT_FOR_DELIVERY"].includes(currentOrder.status)
    ) {
      await releaseStockForOrder(tx, parsed.data.orderId, session.user.id);
    }

    return updated;
  });

  const statusLabel: Record<string, string> = {
    PREPARING: "being prepared",
    READY: "ready for pickup",
    OUT_FOR_DELIVERY: "out for delivery",
    DELIVERED: "delivered",
    CANCELLED: "cancelled",
  };

  if (order.shop.user) {
    await prisma.notification.create({
      data: {
        userId: order.shop.user.id,
        type: "STATUS_CHANGED",
        message: `Order #${order.id.slice(-6).toUpperCase()} is now ${statusLabel[parsed.data.status] ?? parsed.data.status}`,
      },
    });

    await triggerEvent(`private-shop-${order.shopId}`, "status-changed", {
      orderId: order.id,
      status: order.status,
    });
  }

  revalidatePath("/admin/orders");
  revalidatePath("/shop/orders");
  return { success: true, data: { status: order.status } };
}

export async function setActualCost(
  input: SetActualCostInput
): Promise<Result<{ actualTotal: number }>> {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN") return { success: false, error: "Forbidden" };

  const parsed = setActualCostSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" };

  const { saveDraft = false } = parsed.data;

  const existingItems = await prisma.orderItem.findMany({
    where: {
      id: { in: parsed.data.items.map((i) => i.orderItemId) },
      orderId: parsed.data.orderId,
    },
  });

  let actualTotal = 0;

  await prisma.$transaction(async (tx) => {
    for (const { orderItemId, actualKg, actualPieces, overridePrice, adminNote } of parsed.data
      .items) {
      const existing = existingItems.find((i) => i.id === orderItemId);
      if (!existing) continue;

      let lineTotal: number;
      let adminAdjusted = false;

      if (overridePrice != null) {
        lineTotal = overridePrice;
        adminAdjusted = true;
      } else if (actualKg != null && existing.requestedKg != null) {
        const pricePerKg = Number(existing.estimatedPrice) / Number(existing.requestedKg);
        lineTotal = Math.round(actualKg * pricePerKg);
      } else if (actualPieces != null && existing.requestedPieces != null) {
        const pricePerPiece = Number(existing.estimatedPrice) / existing.requestedPieces;
        lineTotal = Math.round(actualPieces * pricePerPiece);
      } else {
        lineTotal = Number(existing.estimatedPrice);
      }

      actualTotal += lineTotal;

      await tx.orderItem.update({
        where: { id: orderItemId },
        data: {
          actualKg: actualKg ?? null,
          actualPieces: actualPieces ?? null,
          actualPrice: lineTotal,
          adminAdjusted,
          adminNote: adminNote ?? null,
        },
      });
    }

    await tx.order.update({
      where: { id: parsed.data.orderId },
      data: {
        ...(saveDraft ? {} : { status: "READY" }),
        actualTotal,
        finalCostNote: parsed.data.finalCostNote ?? null,
      },
    });
  });

  if (!saveDraft) {
    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      include: {
        shop: { include: { user: true } },
        items: { include: { product: { select: { name: true, unitType: true } } } },
      },
    });

    if (order?.shop?.user) {
      const estimatedFmt = Number(order.estimatedTotal).toLocaleString("ru-RU");
      const actualFmt = actualTotal.toLocaleString("ru-RU");
      const diff = actualTotal - Number(order.estimatedTotal);
      const diffFmt = `${diff >= 0 ? "+" : ""}${diff.toLocaleString("ru-RU")}`;

      const shortId = order.id.slice(-6).toUpperCase();
      const notifMessage =
        `Order #${shortId} ready for pickup\n` +
        `Estimated: ${estimatedFmt} UZS\n` +
        `Final: ${actualFmt} UZS (${diffFmt})\n` +
        `Tap to view order details`;

      await prisma.notification.create({
        data: {
          userId: order.shop.user.id,
          type: "ACTUAL_COST_SET",
          message: notifMessage,
        },
      });

      await triggerEvent(`private-shop-${order.shopId}`, "actual-cost-set", {
        orderId: order.id,
        estimatedTotal: Number(order.estimatedTotal),
        actualTotal,
        diff,
      });

      if (order.shop.user.email) {
        await sendActualCostEmail({
          shopOwnerEmail: order.shop.user.email,
          shopName: order.shop.name,
          orderId: order.id,
          actualTotal,
          items: order.items.map((item) => ({
            name: item.product.name,
            unit: item.orderedAs === "KG" ? "kg" : "pcs",
            actualQty:
              item.orderedAs === "KG"
                ? Number(item.actualKg ?? item.requestedKg)
                : Number(item.actualPieces ?? item.requestedPieces),
            lineTotal: Number(item.actualPrice),
            note: item.adminNote ?? null,
          })),
        });
      }
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath("/shop/orders");
  return { success: true, data: { actualTotal } };
}

export async function getOrderById(orderId: string) {
  const session = await auth();
  if (!session?.user) return null;

  const row = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          ownerName: true,
          phone: true,
          address: true,
          latitude: true,
          longitude: true,
        },
      },
      items: {
        include: { product: { select: { id: true, name: true, unitType: true, imageUrl: true } } },
      },
      routeStop: {
        include: {
          route: {
            select: {
              estimatedMinutes: true,
              startedAt: true,
              staff: {
                select: {
                  fullName: true,
                  phone: true,
                  vehicleType: true,
                  vehiclePlate: true,
                  currentLat: true,
                  currentLng: true,
                  lastSeenAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!row) return null;
  if (session.user.role === "SHOP_OWNER" && row.shopId !== session.user.shopId) return null;

  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    estimatedTotal: Number(row.estimatedTotal),
    actualTotal: row.actualTotal != null ? Number(row.actualTotal) : null,
    deliveredTotal: row.deliveredTotal != null ? Number(row.deliveredTotal) : null,
    deliveryNote: row.deliveryNote,
    shop: {
      id: row.shop.id,
      name: row.shop.name,
      ownerName: row.shop.ownerName,
      phone: row.shop.phone,
      address: row.shop.address,
      latitude: row.shop.latitude != null ? Number(row.shop.latitude) : null,
      longitude: row.shop.longitude != null ? Number(row.shop.longitude) : null,
    },
    routeStop: row.routeStop
      ? {
          id: row.routeStop.id,
          route: row.routeStop.route
            ? {
                estimatedMinutes: row.routeStop.route.estimatedMinutes,
                startedAt: row.routeStop.route.startedAt?.toISOString() ?? null,
                staff: row.routeStop.route.staff
                  ? {
                      fullName: row.routeStop.route.staff.fullName,
                      phone: row.routeStop.route.staff.phone,
                      vehicleType: row.routeStop.route.staff.vehicleType as string,
                      vehiclePlate: row.routeStop.route.staff.vehiclePlate,
                      currentLat: row.routeStop.route.staff.currentLat,
                      currentLng: row.routeStop.route.staff.currentLng,
                      lastSeenAt: row.routeStop.route.staff.lastSeenAt?.toISOString() ?? null,
                    }
                  : null,
              }
            : null,
        }
      : null,
    items: row.items.map((i) => ({
      ...i,
      orderedAs: i.orderedAs as "KG" | "PIECE",
      requestedKg: i.requestedKg != null ? Number(i.requestedKg) : null,
      requestedPieces: i.requestedPieces ?? null,
      actualKg: i.actualKg != null ? Number(i.actualKg) : null,
      actualPieces: i.actualPieces ?? null,
      deliveredKg: i.deliveredKg != null ? Number(i.deliveredKg) : null,
      deliveredPieces: i.deliveredPieces ?? null,
      returnedKg: i.returnedKg != null ? Number(i.returnedKg) : null,
      returnedPieces: i.returnedPieces ?? null,
      returnReason: i.returnReason as string | null,
      returnNote: i.returnNote,
      estimatedPrice: Number(i.estimatedPrice),
      actualPrice: i.actualPrice != null ? Number(i.actualPrice) : null,
      finalPrice: i.finalPrice != null ? Number(i.finalPrice) : null,
    })),
  };
}

export async function getMyOrders(page = 1, limit = 30) {
  const session = await auth();
  if (session?.user?.role !== "SHOP_OWNER") return { orders: [], total: 0 };

  const where = { shopId: session.user.shopId ?? "" };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        shop: { select: { id: true, name: true, ownerName: true, phone: true } },
        items: {
          include: { product: { select: { id: true, name: true, unitType: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: orders.map(formatOrder),
    total,
    pages: Math.ceil(total / limit) || 1,
  };
}

export async function getAllOrders(
  filters: { status?: string; shopId?: string; page?: number; limit?: number } = {}
) {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN") return { orders: [], total: 0 };

  const { status, shopId, page = 1, limit = 50 } = filters;
  const where: Prisma.OrderWhereInput = {};
  if (status && status !== "ALL") where.status = status as Prisma.EnumOrderStatusFilter;
  if (shopId) where.shopId = shopId;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        shop: { select: { id: true, name: true, ownerName: true, phone: true } },
        items: {
          include: { product: { select: { id: true, name: true, unitType: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: orders.map(formatOrder),
    total,
    pages: Math.ceil(total / limit) || 1,
  };
}

function formatOrder(order: OrderRow) {
  return {
    ...order,
    estimatedTotal: Number(order.estimatedTotal),
    actualTotal: order.actualTotal != null ? Number(order.actualTotal) : null,
    items: order.items.map((i) => ({
      ...i,
      requestedKg: i.requestedKg != null ? Number(i.requestedKg) : null,
      requestedPieces: i.requestedPieces ?? null,
      actualKg: i.actualKg != null ? Number(i.actualKg) : null,
      actualPieces: i.actualPieces ?? null,
      estimatedPrice: Number(i.estimatedPrice),
      actualPrice: i.actualPrice != null ? Number(i.actualPrice) : null,
    })),
  };
}
