"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { importSchema } from "@/lib/validations/import.schema";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN") throw new Error("Forbidden");
  return session;
}

export async function bulkImport(rawInput: unknown) {
  const session = await requireAdmin();

  const parsed = importSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid import data",
    };
  }

  const { categories, products, mode } = parsed.data;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let categoriesCreated = 0;
  let categoriesUpdated = 0;
  let productsCreated   = 0;
  let productsUpdated   = 0;
  let productsSkipped   = 0;
  const errors: string[] = [];

  // ── 1. Upsert categories ────────────────────────────────────────────────────
  const categoryMap = new Map<string, string>(); // key → id

  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    const slug = c.name_en.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    try {
      const existing = await prisma.category.findUnique({ where: { slug } });
      if (existing) {
        await prisma.category.update({
          where: { slug },
          data: {
            nameEn:    c.name_en,
            nameUz:    c.name_uz,
            nameRu:    c.name_ru ?? null,
            icon:      c.icon ?? null,
            sortOrder: i,
          },
        });
        categoryMap.set(c.key, existing.id);
        categoriesUpdated++;
      } else {
        const cat = await prisma.category.create({
          data: {
            nameEn:    c.name_en,
            nameUz:    c.name_uz,
            nameRu:    c.name_ru ?? null,
            slug,
            icon:      c.icon ?? null,
            sortOrder: i,
          },
        });
        categoryMap.set(c.key, cat.id);
        categoriesCreated++;
      }
    } catch (e) {
      errors.push(`Category "${c.name_en}": ${(e as Error).message}`);
    }
  }

  // ── 2. Replace mode: hide all current products ──────────────────────────────
  if (mode === "replace") {
    await prisma.product.updateMany({ data: { isAvailable: false } });
  }

  // ── 3. Pre-fetch existing products (avoid N+1 findFirst calls) ──────────────
  const allExisting = await prisma.product.findMany({
    select: { id: true, nameUz: true, categoryId: true },
  });
  const existingMap = new Map(
    allExisting.map((p) => [`${p.nameUz}|||${p.categoryId}`, p.id])
  );

  // ── 4. Deduplicate input by nameUz ──────────────────────────────────────────
  const seen = new Set<string>();
  const uniqueProducts = products.filter((p) => {
    if (seen.has(p.name_uz)) return false;
    seen.add(p.name_uz);
    return true;
  });

  // ── 5. Process products ─────────────────────────────────────────────────────
  for (const p of uniqueProducts) {
    const categoryId = categoryMap.get(p.category);
    if (!categoryId) {
      errors.push(`Unknown category key "${p.category}" for "${p.name_uz}"`);
      continue;
    }

    const pricePerKg    = p.unitType === "KG"    || p.unitType === "BOTH" ? p.price : null;
    const pricePerPiece = p.unitType === "PIECE"  || p.unitType === "BOTH" ? p.price : null;

    const existingId = existingMap.get(`${p.name_uz}|||${categoryId}`);

    try {
      if (existingId) {
        if (mode === "skip") {
          productsSkipped++;
          continue;
        }

        // update or replace: re-enable + update price
        await prisma.product.update({
          where: { id: existingId },
          data: { unitType: p.unitType, pricePerKg, pricePerPiece, isAvailable: true },
        });
        await prisma.dailyPrice.upsert({
          where: { productId_date: { productId: existingId, date: today } },
          update: { pricePerKg, pricePerPiece, adminId: session.user.id },
          create: {
            productId: existingId,
            pricePerKg,
            pricePerPiece,
            date:    today,
            adminId: session.user.id,
          },
        });
        productsUpdated++;
      } else {
        const product = await prisma.product.create({
          data: {
            name:         p.name_uz,
            nameUz:       p.name_uz,
            categoryId,
            unitType:     p.unitType,
            pricePerKg,
            pricePerPiece,
            isAvailable:  true,
          },
        });
        await prisma.dailyPrice.create({
          data: {
            productId:    product.id,
            pricePerKg,
            pricePerPiece,
            date:         today,
            adminId:      session.user.id,
          },
        });
        productsCreated++;
      }
    } catch (e) {
      errors.push(`"${p.name_uz}": ${(e as Error).message}`);
    }
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/categories");
  revalidatePath("/shop");

  return {
    success: true as const,
    summary: {
      categoriesCreated,
      categoriesUpdated,
      productsCreated,
      productsUpdated,
      productsSkipped,
      errors,
    },
  };
}
