import bcrypt from "bcryptjs";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const shops = await prisma.shop.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(
    shops.map((s) => ({
      ...s,
      latitude: Number(s.latitude),
      longitude: Number(s.longitude),
    }))
  );
}

// POST /api/shops — public registration endpoint (still needed for the register form)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const exists = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (exists) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const hash = await bcrypt.hash(parsed.data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      password: hash,
      role: "SHOP_OWNER",
      shops: {
        create: {
          name: parsed.data.shopName,
          ownerName: parsed.data.ownerName,
          phone: parsed.data.phone,
          address: parsed.data.address,
          latitude: parsed.data.latitude ?? 41.2995,
          longitude: parsed.data.longitude ?? 69.2401,
          isActive: false,
        },
      },
    },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json(user, { status: 201 });
}
