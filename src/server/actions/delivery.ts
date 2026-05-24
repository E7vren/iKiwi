"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { triggerEvent } from "@/lib/pusher";
import { consumeStockForOrder } from "@/lib/inventory/order-hooks";
import {
  arriveAtStopSchema,
  completeDeliverySchema,
  skipStopSchema,
} from "@/lib/validations/delivery.schema";
import type { ActionResult } from "@/types";

async function requireDeliveryStaff() {
  const session = await auth();
  if (session?.user.role !== "DELIVERY_STAFF") throw new Error("Unauthorized");
  return session;
}

export async function arriveAtStop(input: unknown): Promise<ActionResult<void>> {
  try {
    const session = await requireDeliveryStaff();
    const { stopId } = arriveAtStopSchema.parse(input);

    const stop = await prisma.routeStop.update({
      where: { id: stopId, route: { staff: { userId: session.user.id } } },
      data:  { status: "ARRIVED", arrivedAt: new Date() },
      include: {
        order: {
          include: {
            shop: { include: { user: { select: { id: true } } } },
          },
        },
        route: {
          select: { staff: { select: { fullName: true } } },
        },
      },
    });

    const shopUserId = stop.order.shop.user?.id;
    const driverName = stop.route?.staff?.fullName ?? "Your driver";

    if (shopUserId) {
      await prisma.notification.create({
        data: {
          userId:  shopUserId,
          type:    "DRIVER_ARRIVED",
          message: `${driverName} has arrived at your shop`,
        },
      });
    }

    await triggerEvent(`private-shop-${stop.order.shopId}`, "driver-arrived", {
      orderId: stop.orderId,
    });

    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to update stop" };
  }
}

export async function completeDelivery(
  input: unknown
): Promise<ActionResult<{ deliveredTotal: number; totalReturned: number }>> {
  try {
    const session = await requireDeliveryStaff();
    const data = completeDeliverySchema.parse(input);

    const result = await prisma.$transaction(async (tx) => {
      const stop = await tx.routeStop.findUnique({
        where: { id: data.stopId, route: { staff: { userId: session.user.id } } },
        include: {
          order: {
            include: {
              items: { include: { product: { select: { name: true } } } },
              shop: { include: { user: { select: { id: true } } } },
            },
          },
        },
      });
      if (!stop) throw new Error("Stop not found");

      const order = stop.order;
      const baseTotal = Number(order.actualTotal ?? order.estimatedTotal);
      let totalReturned = 0;

      // Process returned items
      for (const ret of data.returns) {
        const item = order.items.find((i) => i.id === ret.orderItemId);
        if (!item) continue;

        const itemTotal = Number(item.actualPrice ?? item.estimatedPrice);
        const itemQty =
          item.orderedAs === "KG"
            ? Number(item.actualKg ?? item.requestedKg ?? 1)
            : (item.actualPieces ?? item.requestedPieces ?? 1);
        const unitPrice = itemQty > 0 ? itemTotal / itemQty : 0;

        const refund =
          ret.returnedKg != null
            ? unitPrice * ret.returnedKg
            : ret.returnedPieces != null
            ? unitPrice * ret.returnedPieces
            : 0;

        totalReturned += refund;

        const deliveredKg =
          item.actualKg != null ? Number(item.actualKg) - (ret.returnedKg ?? 0) : null;
        const deliveredPieces =
          item.actualPieces != null ? item.actualPieces - (ret.returnedPieces ?? 0) : null;
        const finalPrice = Math.round(itemTotal - refund);

        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            deliveredKg:     deliveredKg != null ? deliveredKg : undefined,
            deliveredPieces: deliveredPieces != null ? deliveredPieces : undefined,
            returnedKg:      ret.returnedKg ?? null,
            returnedPieces:  ret.returnedPieces ?? null,
            returnReason:    ret.reason,
            returnNote:      ret.note ?? null,
            finalPrice,
          },
        });
      }

      // Mark items with no return as fully delivered
      for (const item of order.items) {
        if (data.returns.some((r) => r.orderItemId === item.id)) continue;
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            deliveredKg:     item.actualKg,
            deliveredPieces: item.actualPieces,
            finalPrice:      item.actualPrice != null ? Number(item.actualPrice) : Number(item.estimatedPrice),
          },
        });
      }

      const hasReturns = data.returns.length > 0;
      const deliveredTotal = Math.max(0, Math.round(baseTotal - totalReturned));
      const isFullReturn = deliveredTotal <= 0 && hasReturns;

      const stopStatus = isFullReturn ? "FULL_RETURN" : hasReturns ? "PARTIAL_RETURN" : "COMPLETED";
      const orderStatus = hasReturns ? "PARTIALLY_DELIVERED" : "DELIVERED";

      await tx.order.update({
        where: { id: stop.orderId },
        data: {
          deliveredTotal,
          deliveryNote: data.deliveryNote ?? null,
          status: orderStatus,
        },
      });

      await tx.routeStop.update({
        where: { id: data.stopId },
        data: {
          status:      stopStatus,
          completedAt: new Date(),
          driverNote:  data.deliveryNote ?? null,
        },
      });

      // Consume / return stock based on delivery outcome
      await consumeStockForOrder(tx, stop.orderId, session.user.id, "DELIVERY_STAFF");

      // Close route if no pending stops remain
      const pendingCount = await tx.routeStop.count({
        where: {
          routeId: stop.routeId,
          status:  { in: ["PENDING", "ARRIVED", "VERIFYING"] },
        },
      });
      if (pendingCount === 0) {
        await tx.route.update({
          where: { id: stop.routeId },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
      }

      // In-app notification to shop owner
      const notificationType = hasReturns ? "RETURN_PROCESSED" : "DELIVERY_COMPLETED";

      const returnedNames = data.returns
        .map((r) => {
          const item = order.items.find((i) => i.id === r.orderItemId);
          return item ? item.product?.name ?? null : null;
        })
        .filter((n): n is string => n !== null)
        .slice(0, 3)
        .join(", ");

      const returnSuffix = data.returns.length > 3 ? ` +${data.returns.length - 3} more` : "";

      const notificationMsg = hasReturns
        ? `Returned: ${returnedNames}${returnSuffix}. Final: ${deliveredTotal.toLocaleString()} UZS`
        : `Order delivered. Total: ${deliveredTotal.toLocaleString()} UZS`;

      if (order.shop.user?.id) {
        await tx.notification.create({
          data: {
            userId:  order.shop.user.id,
            type:    notificationType,
            message: notificationMsg,
          },
        });
      }

      return { deliveredTotal, totalReturned: Math.round(totalReturned), hasReturns, order };
    });

    // Pusher events — non-fatal
    try {
      await triggerEvent(`private-shop-${result.order.shopId}`, "delivery-completed", {
        orderId:        result.order.id,
        deliveredTotal: result.deliveredTotal,
        totalReturned:  result.totalReturned,
        hasReturns:     result.hasReturns,
      });
      await triggerEvent("private-admin", "delivery-completed", {
        orderId:        result.order.id,
        shopName:       result.order.shop.name,
        hasReturns:     result.hasReturns,
        returnedAmount: result.totalReturned,
      });
    } catch (e) {
      console.error("[Pusher] delivery-completed event failed:", e);
    }

    revalidatePath("/driver");
    revalidatePath("/admin/orders");
    revalidatePath("/shop/orders");

    return {
      success: true,
      data: { deliveredTotal: result.deliveredTotal, totalReturned: result.totalReturned },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to complete delivery" };
  }
}

export async function skipStop(input: unknown): Promise<ActionResult<void>> {
  try {
    const session = await requireDeliveryStaff();
    const { stopId, reason } = skipStopSchema.parse(input);

    const stop = await prisma.routeStop.update({
      where: { id: stopId, route: { staff: { userId: session.user.id } } },
      data: {
        status:      "SKIPPED",
        completedAt: new Date(),
        driverNote:  reason,
      },
      select: { routeId: true, orderId: true, order: { select: { shopId: true } } },
    });

    // Notify admin
    await triggerEvent("private-admin", "stop-skipped", {
      orderId: stop.orderId,
    });

    // Auto-complete route if no pending stops remain
    const pendingCount = await prisma.routeStop.count({
      where: {
        routeId: stop.routeId,
        status:  { in: ["PENDING", "ARRIVED", "VERIFYING"] },
      },
    });
    if (pendingCount === 0) {
      await prisma.route.update({
        where: { id: stop.routeId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    }

    revalidatePath("/driver");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to skip stop" };
  }
}
