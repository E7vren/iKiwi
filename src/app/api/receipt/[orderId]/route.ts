import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ReceiptDocument } from "@/components/pdf/ReceiptDocument";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      shop: { select: { name: true, ownerName: true, phone: true, address: true, userId: true } },
      items: {
        include: { product: { select: { name: true, unitType: true } } },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.user.role === "SHOP_OWNER" && order.shop?.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = {
    ...order,
    createdAt: order.createdAt.toISOString(),
    estimatedTotal: Number(order.estimatedTotal),
    actualTotal: order.actualTotal != null ? Number(order.actualTotal) : null,
    items: order.items.map((i) => ({
      ...i,
      orderedAs: i.orderedAs as "KG" | "PIECE",
      requestedKg: i.requestedKg != null ? Number(i.requestedKg) : null,
      requestedPieces: i.requestedPieces ?? null,
      actualKg: i.actualKg != null ? Number(i.actualKg) : null,
      actualPieces: i.actualPieces ?? null,
      estimatedPrice: Number(i.estimatedPrice),
      actualPrice: i.actualPrice != null ? Number(i.actualPrice) : null,
    })),
  };

  const element = createElement(ReceiptDocument, { order: doc }) as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  const shortId = order.id.slice(-6).toUpperCase();

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="iKiwi-Order-${shortId}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
