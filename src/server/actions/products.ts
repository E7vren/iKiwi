"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from "@/lib/validations";

function todayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN") throw new Error("Forbidden");
  return session;
}

const categorySelect = {
  id: true, nameEn: true, nameUz: true, nameRu: true,
  slug: true, icon: true, sortOrder: true, isActive: true,
} as const;

export async function createProduct(input: CreateProductInput) {
  const session = await requireAdmin();

  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success)
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation error" };

  const { initialPricePerKg, initialPricePerPiece, ...productData } = parsed.data;
  const today = todayUTC();

  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({ data: productData });
    await tx.dailyPrice.create({
      data: {
        productId: p.id,
        pricePerKg:    initialPricePerKg    ?? null,
        pricePerPiece: initialPricePerPiece ?? null,
        date:    today,
        adminId: session.user.id,
      },
    });
    return p;
  });

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return { success: true as const, data: { id: product.id } };
}

export async function updateProduct(input: UpdateProductInput) {
  await requireAdmin();

  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success)
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation error" };

  const { id, initialPricePerKg: _kg, initialPricePerPiece: _pcs, ...data } = parsed.data;

  await prisma.product.update({ where: { id }, data });

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return { success: true as const, data: { id } };
}

export async function deleteProduct(id: string) {
  await requireAdmin();

  const orderCount = await prisma.orderItem.count({ where: { productId: id } });
  if (orderCount > 0) {
    await prisma.product.update({ where: { id }, data: { isAvailable: false } });
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    return {
      success: true as const,
      softDeleted: true,
      info: "Product has order history — marked unavailable instead of deleted",
    };
  }

  await prisma.product.delete({ where: { id } });
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return { success: true as const, softDeleted: false };
}

export async function toggleProductAvailability(id: string) {
  await requireAdmin();

  const p = await prisma.product.findUniqueOrThrow({ where: { id } });
  await prisma.product.update({ where: { id }, data: { isAvailable: !p.isAvailable } });

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return { success: true as const };
}

export async function getAvailableProducts() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const today = todayUTC();

  const products = await prisma.product.findMany({
    where: { isAvailable: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    include: {
      category: { select: categorySelect },
      dailyPrices: { where: { date: today }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return products.map((p) => {
    const price = p.dailyPrices[0];
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
      pricePerKg:    price?.pricePerKg    != null ? Number(price.pricePerKg)    : null,
      pricePerPiece: price?.pricePerPiece != null ? Number(price.pricePerPiece) : null,
    };
  });
}

export async function getAllProducts() {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN") return [];

  const today = todayUTC();

  const products = await prisma.product.findMany({
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    include: {
      category: { select: categorySelect },
      dailyPrices: { where: { date: today }, orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { orderItems: true } },
    },
  });

  return products.map((p) => {
    const price = p.dailyPrices[0];
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
      orderCount: p._count.orderItems,
      pricePerKg:    price?.pricePerKg    != null ? Number(price.pricePerKg)    : null,
      pricePerPiece: price?.pricePerPiece != null ? Number(price.pricePerPiece) : null,
    };
  });
}
