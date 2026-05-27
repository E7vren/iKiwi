"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@/lib/validations/category.schema";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "COMPANY_ADMIN") throw new Error("Unauthorized");
  return session;
}

export async function getAllCategories() {
  return prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

export async function createCategory(input: CreateCategoryInput) {
  await requireAdmin();
  const data = createCategorySchema.parse(input);
  const category = await prisma.category.create({ data });
  revalidatePath("/admin/categories");
  revalidatePath("/shop");
  return { success: true as const, data: category };
}

export async function updateCategory(input: UpdateCategoryInput) {
  await requireAdmin();
  const { id, ...data } = updateCategorySchema.parse(input);
  const category = await prisma.category.update({ where: { id }, data });
  revalidatePath("/admin/categories");
  revalidatePath("/shop");
  return { success: true as const, data: category };
}

export async function deleteCategory(id: string) {
  await requireAdmin();
  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0) {
    return {
      success: false as const,
      error: `Cannot delete: ${count} product${count === 1 ? "" : "s"} use this category. Reassign or delete them first.`,
    };
  }
  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/categories");
  revalidatePath("/shop");
  return { success: true as const };
}

export async function toggleCategoryActive(id: string) {
  await requireAdmin();
  const cat = await prisma.category.findUniqueOrThrow({ where: { id } });
  await prisma.category.update({ where: { id }, data: { isActive: !cat.isActive } });
  revalidatePath("/admin/categories");
  revalidatePath("/shop");
  return { success: true as const };
}
