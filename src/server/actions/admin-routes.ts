"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/types";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "COMPANY_ADMIN") throw new Error("Unauthorized");
  return session;
}

export async function getRoutePlanningData(date: string) {
  await requireAdmin();

  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);

  const [readyOrders, allStaff, routes] = await Promise.all([
    prisma.order.findMany({
      where: { status: "READY", routeStop: null },
      include: {
        shop: { select: { name: true, address: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.deliveryStaff.findMany({
      where: { isActive: true },
      include: {
        user: { select: { email: true } },
        routes: {
          where: { date: d },
          select: { id: true, status: true },
        },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.route.findMany({
      where: { date: d },
      include: {
        staff: { select: { id: true, fullName: true, vehicleType: true, currentLat: true, currentLng: true, lastSeenAt: true } },
        stops: {
          include: { order: { include: { shop: true } } },
          orderBy: { sequence: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return { readyOrders, allStaff, routes };
}

export async function cancelRoute(routeId: string): Promise<ActionResult<void>> {
  try {
    await requireAdmin();

    const route = await prisma.route.findUnique({
      where: { id: routeId },
      select: { status: true },
    });

    if (!route) return { success: false, error: "Route not found" };
    if (route.status !== "PLANNED") return { success: false, error: "Only PLANNED routes can be cancelled" };

    await prisma.$transaction([
      // Delete stops so orders become available for future route generation
      prisma.routeStop.deleteMany({ where: { routeId } }),
      prisma.route.update({ where: { id: routeId }, data: { status: "CANCELLED" } }),
    ]);

    revalidatePath("/admin/routes");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to cancel route" };
  }
}
