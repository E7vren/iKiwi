"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { type UpdateShopInput, updateShopSchema } from "@/lib/validations";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireShopOwner() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SHOP_OWNER") return null;
  return session.user;
}

// ─── Shop owner: get all own shops ───────────────────────────────────────────

export async function getMyShops() {
  const user = await requireShopOwner();
  if (!user) return [];

  const shops = await prisma.shop.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return shops.map((s) => ({
    id: s.id,
    name: s.name,
    ownerName: s.ownerName,
    phone: s.phone,
    address: s.address,
    latitude: Number(s.latitude),
    longitude: Number(s.longitude),
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
  }));
}

export type MyShop = Awaited<ReturnType<typeof getMyShops>>[number];

// ─── Shop owner: add a new shop ───────────────────────────────────────────────

const addShopSchema = z.object({
  name:      z.string().min(2, "Shop name required"),
  ownerName: z.string().min(2, "Owner name required"),
  phone:     z.string().min(7, "Phone required"),
  address:   z.string().min(3, "Address required"),
  latitude:  z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type AddShopInput = z.infer<typeof addShopSchema>;

export async function addShop(input: AddShopInput): Promise<Result<{ id: string }>> {
  const user = await requireShopOwner();
  if (!user) return { success: false, error: "Forbidden" };

  const parsed = addShopSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { name, ownerName, phone, address, latitude, longitude } = parsed.data;

  const shop = await prisma.$transaction(async (tx) => {
    const shop = await tx.shop.create({
      data: { userId: user.id, name, ownerName, phone, address, latitude, longitude, isActive: true },
    });

    // Notify all admins
    const admins = await tx.user.findMany({
      where: { role: "COMPANY_ADMIN" },
      select: { id: true },
    });

    if (admins.length > 0) {
      await tx.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: "ORDER_PLACED" as const, // reuse existing type for admin notification
          title: "New shop added",
          message: `New shop "${name}" at ${address} was added by a customer. Review in Admin → Shops.`,
        })),
      });
    }

    return shop;
  });

  revalidatePath("/shop/profile");
  revalidatePath("/admin/shops");
  return { success: true, data: { id: shop.id } };
}

// ─── Shop owner: update own shop ─────────────────────────────────────────────

const updateMyShopSchema = z.object({
  shopId:    z.string().min(1),
  name:      z.string().min(2, "Shop name required"),
  ownerName: z.string().min(2, "Owner name required"),
  phone:     z.string().min(7, "Phone required"),
  address:   z.string().min(3, "Address required"),
  latitude:  z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type UpdateMyShopInput = z.infer<typeof updateMyShopSchema>;

export async function updateMyShop(input: UpdateMyShopInput): Promise<Result<void>> {
  const user = await requireShopOwner();
  if (!user) return { success: false, error: "Forbidden" };

  const parsed = updateMyShopSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { shopId, name, ownerName, phone, address, latitude, longitude } = parsed.data;

  // Verify ownership
  const existing = await prisma.shop.findFirst({ where: { id: shopId, userId: user.id } });
  if (!existing) return { success: false, error: "Shop not found" };

  await prisma.shop.update({
    where: { id: shopId },
    data: { name, ownerName, phone, address, latitude, longitude },
  });

  revalidatePath("/shop/profile");
  return { success: true, data: undefined };
}

// ─── Shop owner: delete a shop ────────────────────────────────────────────────

export async function deleteMyShop(shopId: string): Promise<Result<void>> {
  const user = await requireShopOwner();
  if (!user) return { success: false, error: "Forbidden" };

  const shop = await prisma.shop.findFirst({
    where: { id: shopId, userId: user.id },
    include: {
      _count: {
        select: {
          orders: { where: { status: { notIn: ["DELIVERED", "CANCELLED"] } } },
        },
      },
    },
  });

  if (!shop) return { success: false, error: "Shop not found" };
  if (shop._count.orders > 0)
    return { success: false, error: "Cannot delete a shop with active orders" };

  await prisma.shop.delete({ where: { id: shopId } });
  revalidatePath("/shop/profile");
  return { success: true, data: undefined };
}

// ─── Shop owner: get this-month stats across all shops ───────────────────────

export async function getMyStats() {
  const user = await requireShopOwner();
  if (!user) return { count: 0, totalSpent: 0, avgOrder: 0 };

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: { shop: { userId: user.id }, createdAt: { gte: start } },
    select: { estimatedTotal: true, actualTotal: true },
  });

  const count = orders.length;
  const totalSpent = orders.reduce(
    (acc, o) => acc + Number(o.actualTotal ?? o.estimatedTotal),
    0
  );
  const avgOrder = count > 0 ? Math.round(totalSpent / count) : 0;
  return { count, totalSpent, avgOrder };
}

// ─── Admin: get all shops ─────────────────────────────────────────────────────

export async function getAllShops() {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN") return [];

  const shops = await prisma.shop.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return shops.map((s) => ({
    ...s,
    latitude: Number(s.latitude),
    longitude: Number(s.longitude),
  }));
}

// ─── Admin: toggle shop active / edit shop ────────────────────────────────────

export async function updateShop(input: UpdateShopInput): Promise<Result<{ isActive: boolean }>> {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN") return { success: false, error: "Forbidden" };

  const parsed = updateShopSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" };

  const shop = await prisma.shop.update({
    where: { id: parsed.data.shopId },
    data: { isActive: parsed.data.isActive },
  });

  revalidatePath("/admin/shops");
  return { success: true, data: { isActive: shop.isActive } };
}

// ─── Admin: update any shop's details (to help customer) ─────────────────────

const adminUpdateShopSchema = z.object({
  shopId:    z.string().min(1),
  name:      z.string().min(2).optional(),
  ownerName: z.string().min(2).optional(),
  phone:     z.string().min(7).optional(),
  address:   z.string().min(3).optional(),
  latitude:  z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isActive:  z.boolean().optional(),
});

export type AdminUpdateShopInput = z.infer<typeof adminUpdateShopSchema>;

export async function adminUpdateShop(input: AdminUpdateShopInput): Promise<Result<void>> {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN") return { success: false, error: "Forbidden" };

  const parsed = adminUpdateShopSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" };

  const { shopId, ...data } = parsed.data;
  await prisma.shop.update({ where: { id: shopId }, data });

  revalidatePath("/admin/shops");
  return { success: true, data: undefined };
}

// ─── Admin: get shop detail with orders ──────────────────────────────────────

export async function getShopWithOrders(shopId: string) {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN") return null;

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      user: { select: { email: true, name: true } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true, status: true, estimatedTotal: true, actualTotal: true, createdAt: true,
        },
      },
    },
  });

  if (!shop) return null;

  return {
    ...shop,
    latitude: Number(shop.latitude),
    longitude: Number(shop.longitude),
    orders: shop.orders.map((o) => ({
      ...o,
      estimatedTotal: Number(o.estimatedTotal),
      actualTotal: o.actualTotal != null ? Number(o.actualTotal) : null,
    })),
  };
}
