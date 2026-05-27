import type { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ORDER_INCLUDE = {
  shop: { select: { id: true, name: true, ownerName: true, phone: true, address: true } },
  items: {
    include: { product: { select: { id: true, name: true, unitType: true, imageUrl: true } } },
  },
} as const;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "30"));
  const status = searchParams.get("status");
  const shopId = searchParams.get("shopId");

  const where: Prisma.OrderWhereInput =
    session.user.role === "SHOP_OWNER"
      ? { shop: { userId: session.user.id } }
      : {};

  if (status && status !== "ALL") where.status = status as Prisma.EnumOrderStatusFilter;
  if (shopId && session.user.role === "COMPANY_ADMIN") where.shopId = shopId;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({
    orders: orders.map(formatOrder),
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  });
}
