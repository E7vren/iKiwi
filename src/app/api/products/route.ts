import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

function todayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const categorySelect = {
  id: true, nameEn: true, nameUz: true, nameRu: true,
  slug: true, icon: true, sortOrder: true, isActive: true,
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  const all = req.nextUrl.searchParams.get("all") === "true";

  const where = all && session?.user?.role === "COMPANY_ADMIN" ? {} : { isAvailable: true };
  const today = todayUTC();

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    include: {
      category:    { select: categorySelect },
      dailyPrices: { where: { date: today }, orderBy: { createdAt: "desc" }, take: 1 },
      stockItem:   { select: { availableKg: true, availablePieces: true } },
    },
  });

  return NextResponse.json(
    products.map((p) => {
      const dp = p.dailyPrices[0];
      return {
        id: p.id,
        name: p.name,
        nameUz: p.nameUz,
        nameRu: p.nameRu,
        categoryId: p.categoryId,
        category: p.category,
        unitType: p.unitType,
        imageUrl: p.imageUrl,
        isAvailable: p.isAvailable,
        sortOrder: p.sortOrder,
        pricePerKg:          dp?.pricePerKg    != null ? Number(dp.pricePerKg)    : null,
        pricePerPiece:       dp?.pricePerPiece != null ? Number(dp.pricePerPiece) : null,
        stockAvailableKg:     p.stockItem?.availableKg     != null ? Number(p.stockItem.availableKg)     : null,
        stockAvailablePieces: p.stockItem?.availablePieces != null ? p.stockItem.availablePieces          : null,
      };
    })
  );
}
