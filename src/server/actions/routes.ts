"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { triggerEvent } from "@/lib/pusher";
import { optimizeRoutes } from "@/lib/route-optimizer";
import { assignRouteSchema, generateRoutesSchema } from "@/lib/validations/route.schema";
import type { ActionResult } from "@/types";

const IKIWI_WAREHOUSE = {
  lat: 41.3275,
  lng: 69.2348,
  name: "iKiwi Warehouse",
};

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "COMPANY_ADMIN") throw new Error("Unauthorized");
  return session;
}

async function requireDeliveryStaff() {
  const session = await auth();
  if (session?.user.role !== "DELIVERY_STAFF") throw new Error("Unauthorized");
  return session;
}

export async function generateRoutes(input: unknown): Promise<ActionResult<{ count: number }>> {
  try {
    await requireAdmin();
    const data = generateRoutesSchema.parse(input);

    const date = new Date(data.date);
    date.setUTCHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: {
        status: "READY",
        routeStop: null, // not already on a route
        ...(data.orderIds ? { id: { in: data.orderIds } } : {}),
      },
      include: { shop: true },
    });

    if (orders.length === 0) {
      return { success: false, error: "No READY orders available to route" };
    }

    const stops = orders.map((o) => ({
      orderId: o.id,
      lat: o.shop.latitude,
      lng: o.shop.longitude,
      shopName: o.shop.name,
    }));

    const routes = optimizeRoutes({
      warehouse: IKIWI_WAREHOUSE,
      stops,
      driverCount: data.driverCount,
      mode: data.optimizationMode,
    });

    await prisma.$transaction(
      routes.map((r) =>
        prisma.route.create({
          data: {
            date,
            status: "PLANNED",
            totalDistanceKm: r.totalDistanceKm,
            estimatedMinutes: r.estimatedMinutes,
            stops: {
              create: r.stops.map((s, i) => ({
                orderId: s.orderId,
                sequence: i + 1,
              })),
            },
          },
        })
      )
    );

    revalidatePath("/admin/routes");
    return { success: true, data: { count: routes.length } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to generate routes" };
  }
}

export async function getRoutesForDate(date: string) {
  await requireAdmin();
  return prisma.route.findMany({
    where: { date: new Date(date) },
    include: {
      staff: { include: { user: { select: { email: true } } } },
      stops: {
        include: { order: { include: { shop: true } } },
        orderBy: { sequence: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function assignRouteToDriver(input: unknown): Promise<ActionResult<void>> {
  try {
    await requireAdmin();
    const { routeId, staffId } = assignRouteSchema.parse(input);

    const route = await prisma.route.update({
      where: { id: routeId },
      data: { staffId },
      include: {
        staff: { include: { user: true } },
        stops: { select: { id: true } },
      },
    });

    if (route.staff) {
      await triggerEvent(`private-driver-${staffId}`, "route-assigned", {
        routeId: route.id,
        stopCount: route.stops.length,
        estimatedMinutes: route.estimatedMinutes,
      });

      await prisma.notification.create({
        data: {
          userId: route.staff.userId,
          type: "ROUTE_ASSIGNED",
          message: `New route assigned: ${route.stops.length} stops (~${route.estimatedMinutes ?? "?"} min)`,
        },
      });
    }

    revalidatePath("/admin/routes");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to assign route" };
  }
}

export async function getMyRoutes() {
  const session = await requireDeliveryStaff();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return prisma.route.findMany({
    where: {
      staff: { userId: session.user.id },
      date: { gte: today },
    },
    include: {
      stops: {
        include: {
          order: {
            include: {
              shop: true,
              items: {
                include: { product: { select: { name: true, nameUz: true, unitType: true } } },
              },
            },
          },
        },
        orderBy: { sequence: "asc" },
      },
    },
    orderBy: { date: "asc" },
  });
}

export async function getStopDetails(stopId: string) {
  const session = await requireDeliveryStaff();
  return prisma.routeStop.findFirst({
    where: { id: stopId, route: { staff: { userId: session.user.id } } },
    include: {
      route: {
        select: {
          id: true,
          status: true,
          startedAt: true,
          totalDistanceKm: true,
          estimatedMinutes: true,
          stops: {
            select: { id: true, sequence: true, status: true },
            orderBy: { sequence: "asc" },
          },
        },
      },
      order: {
        include: {
          shop: true,
          items: {
            include: {
              product: {
                select: { id: true, name: true, nameUz: true, imageUrl: true, unitType: true },
              },
            },
          },
        },
      },
    },
  });
}

export async function getCompletedRouteSummary(routeId: string) {
  const session = await requireDeliveryStaff();
  return prisma.route.findFirst({
    where: { id: routeId, staff: { userId: session.user.id } },
    include: {
      stops: {
        orderBy: { sequence: "asc" },
        include: {
          order: {
            select: {
              estimatedTotal: true,
              actualTotal: true,
              deliveredTotal: true,
              status: true,
              shop: { select: { name: true } },
            },
          },
        },
      },
    },
  });
}

export async function startRoute(routeId: string): Promise<ActionResult<void>> {
  try {
    const session = await requireDeliveryStaff();

    const route = await prisma.route.update({
      where: { id: routeId, staff: { userId: session.user.id } },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
      include: {
        stops: {
          include: {
            order: {
              include: {
                shop: { include: { user: { select: { id: true } } } },
              },
            },
          },
        },
        staff: { select: { fullName: true } },
      },
    });

    const driverName = route.staff?.fullName ?? "Your driver";

    await prisma.$transaction([
      ...route.stops.map((stop) =>
        prisma.order.update({
          where: { id: stop.orderId },
          data: { status: "OUT_FOR_DELIVERY" },
        })
      ),
      ...route.stops
        .filter((stop) => stop.order.shop.user?.id)
        .map((stop) =>
          prisma.notification.create({
            data: {
              userId: stop.order.shop.user!.id,
              type: "DRIVER_EN_ROUTE",
              message: `${driverName} is on the way to your shop`,
            },
          })
        ),
    ]);

    for (const stop of route.stops) {
      await triggerEvent(`private-shop-${stop.order.shopId}`, "driver-en-route", {
        orderId: stop.orderId,
        routeId: route.id,
      });
    }

    revalidatePath("/driver");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to start route" };
  }
}
