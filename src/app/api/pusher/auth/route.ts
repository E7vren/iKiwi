import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pusherServer } from "@/lib/pusher";

export async function POST(req: NextRequest) {
  if (!pusherServer) {
    return NextResponse.json({ error: "Pusher not configured" }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.text();
  const params = new URLSearchParams(body);
  const socketId = params.get("socket_id");
  const channelName = params.get("channel_name");

  if (!socketId || !channelName) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const { role, staffId, warehouseStaffId } = session.user;

  let allowed = false;

  if (channelName === "private-admin" && role === "COMPANY_ADMIN") {
    allowed = true;
  } else if (channelName === `private-driver-${staffId}` && role === "DELIVERY_STAFF" && !!staffId) {
    allowed = true;
  } else if (channelName === `private-warehouse-${warehouseStaffId}` && role === "WAREHOUSE_STAFF" && !!warehouseStaffId) {
    allowed = true;
  } else if (channelName.startsWith("private-shop-") && role === "SHOP_OWNER") {
    // Multi-shop: verify the shop belongs to this user
    const shopId = channelName.replace("private-shop-", "");
    const shop = await prisma.shop.findFirst({
      where: { id: shopId, userId: session.user.id },
      select: { id: true },
    });
    allowed = !!shop;
  }

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const authData = pusherServer.authorizeChannel(socketId, channelName);
  return NextResponse.json(authData);
}
