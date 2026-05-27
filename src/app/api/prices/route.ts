import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function dayUTC(offset = 0) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "1");
  const since = dayUTC(-(days - 1));

  const prices = await prisma.dailyPrice.findMany({
    where: { date: { gte: since } },
    include: {
      product: {
        select: {
          id: true, name: true, unitType: true, categoryId: true,
          category: { select: { id: true, nameEn: true, icon: true, slug: true } },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(
    prices.map((p) => ({
      id: p.id,
      productId: p.productId,
      pricePerKg:    p.pricePerKg    != null ? Number(p.pricePerKg)    : null,
      pricePerPiece: p.pricePerPiece != null ? Number(p.pricePerPiece) : null,
      date: p.date.toISOString().slice(0, 10),
      product: p.product,
    }))
  );
}
