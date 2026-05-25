"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendStaffCredentialsEmail } from "@/lib/email";
import {
  createStaffSchema,
  updateStaffSchema,
  toggleAvailabilitySchema,
  updateLocationSchema,
} from "@/lib/validations/delivery-staff.schema";
import type { ActionResult } from "@/types";

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

export async function createDeliveryStaff(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();
    const data = createStaffSchema.parse(input);
    const passwordHash = await bcrypt.hash(data.password, 10);

    const staff = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email:    data.email,
          name:     data.fullName,
          password: passwordHash,
          role:     "DELIVERY_STAFF",
        },
      });
      return tx.deliveryStaff.create({
        data: {
          userId:       user.id,
          fullName:     data.fullName,
          phone:        data.phone,
          vehicleType:  data.vehicleType,
          vehiclePlate: data.vehiclePlate ?? null,
        },
      });
    });

    // Send credentials email non-fatally
    sendStaffCredentialsEmail({ staffEmail: data.email, staffName: data.fullName, password: data.password });

    revalidatePath("/admin/staff");
    return { success: true, data: { id: staff.id } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to create staff" };
  }
}

export async function updateDeliveryStaff(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();
    const { id, ...data } = updateStaffSchema.parse(input);

    const staff = await prisma.deliveryStaff.update({
      where: { id },
      data: {
        fullName:     data.fullName,
        phone:        data.phone,
        vehicleType:  data.vehicleType,
        vehiclePlate: data.vehiclePlate ?? null,
      },
    });

    revalidatePath("/admin/staff");
    return { success: true, data: { id: staff.id } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to update staff" };
  }
}

export async function getAllStaff() {
  await requireAdmin();
  return prisma.deliveryStaff.findMany({
    include: { user: { select: { email: true } } },
    orderBy: { fullName: "asc" },
  });
}

export async function getAvailableStaffForDate(date: string) {
  await requireAdmin();
  return prisma.deliveryStaff.findMany({
    where: { isActive: true },
    include: {
      user: { select: { email: true } },
      routes: {
        where: { date: new Date(date) },
        select: { id: true, status: true, _count: { select: { stops: true } } },
      },
    },
    orderBy: { fullName: "asc" },
  });
}

export async function toggleStaffAvailability(
  input: unknown
): Promise<ActionResult<{ isAvailable: boolean }>> {
  try {
    const session = await requireDeliveryStaff();
    const { isAvailable } = toggleAvailabilitySchema.parse(input);

    const staff = await prisma.deliveryStaff.update({
      where: { userId: session.user.id },
      data: { isAvailable },
    });

    revalidatePath("/driver");
    revalidatePath("/admin/routes");
    return { success: true, data: { isAvailable: staff.isAvailable } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to update availability" };
  }
}

export async function adminToggleStaffActive(staffId: string): Promise<ActionResult<{ isActive: boolean }>> {
  try {
    await requireAdmin();
    const current = await prisma.deliveryStaff.findUniqueOrThrow({
      where: { id: staffId },
      select: { isActive: true },
    });
    const staff = await prisma.deliveryStaff.update({
      where: { id: staffId },
      data: { isActive: !current.isActive },
    });
    revalidatePath("/admin/staff");
    return { success: true, data: { isActive: staff.isActive } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to update staff" };
  }
}

export async function getAllStaffWithStats() {
  await requireAdmin();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return prisma.deliveryStaff.findMany({
    include: {
      user: { select: { email: true } },
      routes: {
        where: { date: today },
        select: {
          id: true,
          status: true,
          _count: { select: { stops: true } },
        },
      },
    },
    orderBy: { fullName: "asc" },
  });
}

export async function getStaffDetails(staffId: string) {
  await requireAdmin();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setUTCHours(0, 0, 0, 0);

  const [staff, recentRoutes, allStops, completedRouteCount] = await Promise.all([
    prisma.deliveryStaff.findUniqueOrThrow({
      where: { id: staffId },
      include: { user: { select: { email: true } } },
    }),
    prisma.route.findMany({
      where: { staffId, date: { gte: weekAgo } },
      select: {
        id: true,
        date: true,
        status: true,
        totalDistanceKm: true,
        estimatedMinutes: true,
        _count: { select: { stops: true } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.routeStop.findMany({
      where: { route: { staffId } },
      select: { status: true },
    }),
    prisma.route.count({ where: { staffId, status: "COMPLETED" } }),
  ]);

  const delivered = allStops.filter(
    (s) => s.status === "COMPLETED" || s.status === "PARTIAL_RETURN"
  ).length;
  const returned = allStops.filter(
    (s) => s.status === "FULL_RETURN" || s.status === "SKIPPED"
  ).length;
  const total = allStops.length;

  return {
    staff,
    recentRoutes,
    stats: {
      routesThisWeek: recentRoutes.length,
      totalDeliveries: delivered,
      onTimeRate: total > 0 ? Math.round((delivered / total) * 100) : 100,
      returnRate: total > 0 ? parseFloat(((returned / total) * 100).toFixed(1)) : 0,
      avgDeliveries: completedRouteCount > 0 ? Math.round(delivered / completedRouteCount) : 0,
    },
  };
}

export async function adminResetPassword(input: {
  staffId: string;
  newPassword: string;
}): Promise<ActionResult<void>> {
  try {
    await requireAdmin();
    const { staffId, newPassword } = input;
    if (newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters" };
    }
    if (newPassword.length > 72) {
      return { success: false, error: "Password must be at most 72 characters" };
    }
    const staffRecord = await prisma.deliveryStaff.findUniqueOrThrow({
      where: { id: staffId },
      select: { userId: true },
    });
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: staffRecord.userId }, data: { password: hash } });
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to reset password" };
  }
}

export async function updateMyLocation(input: unknown): Promise<ActionResult<void>> {
  try {
    const session = await requireDeliveryStaff();
    const { latitude, longitude } = updateLocationSchema.parse(input);

    await prisma.deliveryStaff.update({
      where: { userId: session.user.id },
      data: { currentLat: latitude, currentLng: longitude, lastSeenAt: new Date() },
    });

    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to update location" };
  }
}
