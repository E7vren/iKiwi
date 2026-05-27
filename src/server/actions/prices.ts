"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { triggerEvent } from "@/lib/pusher";
import { type SetDailyPricesInput, setDailyPricesSchema } from "@/lib/validations";

type Result<T> = { success: true; data: T } | { success: false; error: string };

function todayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function setDailyPrices(
  input: SetDailyPricesInput
): Promise<Result<{ count: number }>> {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN") return { success: false, error: "Forbidden" };

  const parsed = setDailyPricesSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" };

  const today = todayUTC();

  // Resolve admin from DB in case the JWT session has a stale user ID
  const adminUser = await prisma.user.findFirst({
    where: {
      OR: [
        { id: session.user.id },
        { email: session.user.email ?? "" },
      ],
      role: "COMPANY_ADMIN",
    },
    select: { id: true },
  });
  if (!adminUser) return { success: false, error: "Admin user not found in database. Please sign out and sign back in." };
  const adminId = adminUser.id;

  await prisma.$transaction(async (tx) => {
    for (const { productId, pricePerKg, pricePerPiece } of parsed.data.prices) {
      await tx.dailyPrice.upsert({
        where: { productId_date: { productId, date: today } },
        update: { pricePerKg: pricePerKg ?? null, pricePerPiece: pricePerPiece ?? null, adminId },
        create: { productId, pricePerKg: pricePerKg ?? null, pricePerPiece: pricePerPiece ?? null, date: today, adminId },
      });
      await tx.product.update({
        where: { id: productId },
        data: { pricePerKg: pricePerKg ?? null, pricePerPiece: pricePerPiece ?? null },
      });
    }
  });

  const activeShops = await prisma.shop.findMany({
    where: { isActive: true },
    select: { id: true, userId: true },
  });

  if (activeShops.length) {
    await prisma.notification.createMany({
      data: activeShops.map((s) => ({
        userId: s.userId,
        type: "PRICE_UPDATED" as const,
        message: "Today's prices have been updated. Browse the catalog!",
      })),
    });

    await Promise.all(
      activeShops.map((s) =>
        triggerEvent(`private-shop-${s.id}`, "prices-updated", {
          date: today.toISOString(),
          count: parsed.data.prices.length,
        })
      )
    );
  }

  revalidatePath("/shop");
  revalidatePath("/admin/prices");
  return { success: true, data: { count: parsed.data.prices.length } };
}

export async function getTodaysPrices() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const today = todayUTC();
  const prices = await prisma.dailyPrice.findMany({
    where: { date: today },
    include: {
      product: { select: { id: true, name: true, unitType: true, categoryId: true, category: { select: { id: true, nameEn: true, icon: true, slug: true } } } },
    },
  });
  return prices.map((p) => ({
    ...p,
    pricePerKg: p.pricePerKg != null ? Number(p.pricePerKg) : null,
    pricePerPiece: p.pricePerPiece != null ? Number(p.pricePerPiece) : null,
  }));
}

export async function getPriceHistory(productId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

  const prices = await prisma.dailyPrice.findMany({
    where: { productId, date: { gte: thirtyDaysAgo } },
    orderBy: { date: "asc" },
  });

  return prices.map((p) => ({
    date: p.date.toISOString().slice(0, 10),
    pricePerKg: p.pricePerKg != null ? Number(p.pricePerKg) : null,
    pricePerPiece: p.pricePerPiece != null ? Number(p.pricePerPiece) : null,
  }));
}
