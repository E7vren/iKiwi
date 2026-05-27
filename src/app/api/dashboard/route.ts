import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

function dayUTC(offset = 0) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const today = dayUTC(0);
  const yesterday = dayUTC(-1);
  const tomorrow = dayUTC(1);

  // Build per-day revenue for last 30 days
  async function getDailyRevenue(daysBack: number) {
    const results: { day: string; revenue: number }[] = [];
    for (let i = daysBack - 1; i >= 0; i--) {
      const from = dayUTC(-i);
      const to   = dayUTC(-i + 1);
      const agg  = await prisma.order.aggregate({
        where: { status: { in: ["DELIVERED", "READY"] }, createdAt: { gte: from, lt: to } },
        _sum: { actualTotal: true, estimatedTotal: true },
      });
      const dayRevenue = Number(agg._sum.actualTotal ?? agg._sum.estimatedTotal ?? 0);
      const label = from.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
      results.push({ day: label, revenue: dayRevenue });
    }
    return results;
  }

  const [
    totalShops,
    activeShops,
    totalOrders,
    todayOrders,
    yesterdayOrders,
    pendingOrders,
    revenueAgg,
    deliveredItems,
    recentOrders,
    pendingOrdersList,
    pricesSetToday,
    totalProducts,
  ] = await Promise.all([
    prisma.shop.count(),
    prisma.shop.count({ where: { isActive: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
    prisma.order.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.aggregate({
      where: { status: { in: ["DELIVERED", "READY"] } },
      _sum: { actualTotal: true, estimatedTotal: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { status: { in: ["DELIVERED", "READY"] } } },
      select: {
        orderedAs: true,
        deliveredKg: true,
        actualKg: true,
        deliveredPieces: true,
        actualPieces: true,
        product: { select: { stockItem: { select: { supplierPrice: true } } } },
      },
    }),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        shop: { select: { name: true } },
        items: { select: { id: true } },
      },
    }),
    prisma.order.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 10,
      include: {
        shop: { select: { name: true } },
        items: { select: { id: true } },
      },
    }),
    prisma.dailyPrice.count({ where: { date: today } }),
    prisma.product.count({ where: { isAvailable: true } }),
  ]);

  const revenue = Number(revenueAgg._sum.actualTotal ?? revenueAgg._sum.estimatedTotal ?? 0);

  let cogs = 0;
  for (const item of deliveredItems) {
    const supplierPrice = item.product.stockItem?.supplierPrice;
    if (!supplierPrice) continue;
    const price = Number(supplierPrice);
    if (item.orderedAs === "KG") {
      const qty = Number(item.deliveredKg ?? item.actualKg ?? 0);
      cogs += qty * price;
    } else {
      const qty = item.deliveredPieces ?? item.actualPieces ?? 0;
      cogs += qty * price;
    }
  }

  const profit = revenue - cogs;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : null;
  const cogsKnown = deliveredItems.some((i) => i.product.stockItem?.supplierPrice != null);

  const [weekRevenue, monthRevenue] = await Promise.all([
    getDailyRevenue(7),
    getDailyRevenue(30),
  ]);

  return NextResponse.json({
    totalShops,
    activeShops,
    totalOrders,
    todayOrders,
    yesterdayOrders,
    pendingOrders,
    revenue,
    cogs,
    profit,
    marginPct,
    cogsKnown,
    pricesSetToday: pricesSetToday > 0,
    totalProducts,
    weekRevenue,
    monthRevenue,
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      shopName: o.shop.name,
      itemCount: o.items.length,
      status: o.status,
      estimatedTotal: Number(o.estimatedTotal),
      createdAt: o.createdAt,
    })),
    pendingOrdersList: pendingOrdersList.map((o) => ({
      id: o.id,
      shopName: o.shop.name,
      itemCount: o.items.length,
      estimatedTotal: Number(o.estimatedTotal),
      createdAt: o.createdAt,
    })),
  });
}
