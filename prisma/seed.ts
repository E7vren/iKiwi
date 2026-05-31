import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type UnitTypeKey = "KG" | "PIECE" | "BOTH";

interface SeedCategory {
  key: string;
  name_en: string;
  name_uz: string;
  name_ru: string | null;
  icon: string | null;
}

interface SeedProduct {
  category: string;
  name_uz: string;
  unitType: UnitTypeKey;
  price: number;
}

const WAREHOUSE_STAFF = [
  { name: "Rustam Saidov",   email: "rustam@ikiwi.uz",  phone: "+998902223344", fullName: "Rustam Saidov"   },
  { name: "Nodira Akramova", email: "nodira@ikiwi.uz",  phone: "+998905556677", fullName: "Nodira Akramova" },
] as const;

const DRIVERS = [
  { name: "Aziz Karimov",   email: "aziz@ikiwi.uz",   phone: "+998901112233", fullName: "Aziz Karimov",   vehicleType: "MOTORCYCLE" as const, vehiclePlate: "01 A 123 BC" },
  { name: "Bobur Tursunov", email: "bobur@ikiwi.uz",  phone: "+998904445566", fullName: "Bobur Tursunov", vehicleType: "CAR"        as const, vehiclePlate: "01 B 456 DE" },
  { name: "Sardor Yusupov", email: "sardor@ikiwi.uz", phone: "+998907778899", fullName: "Sardor Yusupov", vehicleType: "VAN"        as const, vehiclePlate: "01 C 789 FG" },
] as const;

const SHOPS = [
  { name: "Yunusobod Market",      ownerName: "Akbar Karimov",    email: "yunusobod@shop.uz",  phone: "+998901234567", address: "Yunusobod district, Tashkent",  latitude: 41.3400, longitude: 69.2850 },
  { name: "Chorsu Bazar",          ownerName: "Dilnoza Yusupova", email: "chorsu@shop.uz",     phone: "+998907654321", address: "Chorsu, Old City, Tashkent",    latitude: 41.2995, longitude: 69.2401 },
  { name: "Chilonzor Mini-Market", ownerName: "Sardor Toshmatov", email: "chilonzor@shop.uz",  phone: "+998909876543", address: "Chilonzor district, Tashkent", latitude: 41.2940, longitude: 69.2030 },
] as const;

async function main() {
  console.log("🌱 Seeding iKiwi database...\n");

  // 1. Admin user
  const adminHash = await bcrypt.hash("Admin123!", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@ikiwi.com" },
    update: {},
    create: { name: "iKiWi Admin", email: "admin@ikiwi.com", password: adminHash, role: "COMPANY_ADMIN" },
  });
  console.log(`✅ Admin: ${admin.email}`);

  // 2. Load product data
  const dataPath = path.join(process.cwd(), "prisma", "seed-data", "ikiwi-products.json");
  const { categories, products } = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as {
    categories: SeedCategory[];
    products: SeedProduct[];
  };

  // 3. Upsert categories
  const categoryMap = new Map<string, string>(); // key → id
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    const slug = c.name_en.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const cat = await prisma.category.upsert({
      where: { slug },
      update: { nameEn: c.name_en, nameUz: c.name_uz, nameRu: c.name_ru, icon: c.icon, sortOrder: i },
      create: { nameEn: c.name_en, nameUz: c.name_uz, nameRu: c.name_ru, slug, icon: c.icon, sortOrder: i },
    });
    categoryMap.set(c.key, cat.id);
    console.log(`  ${c.icon ?? "📦"} ${c.name_en}`);
  }
  console.log(`✅ ${categories.length} categories seeded\n`);

  // 4. Products with today's prices (skip duplicates)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Deduplicate by name_uz
  const seen = new Set<string>();
  const uniqueProducts = products.filter((p) => {
    if (seen.has(p.name_uz)) return false;
    seen.add(p.name_uz);
    return true;
  });

  let productCount = 0;
  let skipped = 0;

  for (const p of uniqueProducts) {
    const categoryId = categoryMap.get(p.category);
    if (!categoryId) {
      console.warn(`  ⚠️  Unknown category "${p.category}" — skipping "${p.name_uz}"`);
      continue;
    }

    // Skip if already exists
    const existing = await prisma.product.findFirst({ where: { nameUz: p.name_uz, categoryId } });
    if (existing) {
      skipped++;
      continue;
    }

    const unitType = p.unitType as UnitTypeKey;
    const pricePerKg    = unitType === "KG"    || unitType === "BOTH" ? p.price : null;
    const pricePerPiece = unitType === "PIECE"  || unitType === "BOTH" ? p.price : null;

    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: p.name_uz,
          nameUz: p.name_uz,
          categoryId,
          unitType,
          pricePerKg,
          pricePerPiece,
          isAvailable: true,
        },
      });
      await tx.dailyPrice.create({
        data: { productId: product.id, pricePerKg, pricePerPiece, date: today, adminId: admin.id },
      });
    });

    productCount++;
  }

  console.log(`✅ ${productCount} products created, ${skipped} skipped (already existed)\n`);

  // 5. Sample shop owners
  const shopPw = await bcrypt.hash("Shop123!", 10);
  for (const s of SHOPS) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        name: s.ownerName, email: s.email, password: shopPw, role: "SHOP_OWNER",
        shops: {
          create: {
            name: s.name, ownerName: s.ownerName, phone: s.phone,
            address: s.address, latitude: s.latitude, longitude: s.longitude,
            isActive: true,
          },
        },
      },
    });
    console.log(`  Shop: ${s.email}`);
  }

  // 6. Delivery staff
  const driverPw = await bcrypt.hash("Driver123!", 10);
  for (const d of DRIVERS) {
    const driverUser = await prisma.user.upsert({
      where: { email: d.email },
      update: {},
      create: { name: d.name, email: d.email, password: driverPw, role: "DELIVERY_STAFF" },
    });
    await prisma.deliveryStaff.upsert({
      where: { userId: driverUser.id },
      update: {},
      create: {
        userId: driverUser.id,
        fullName: d.fullName,
        phone: d.phone,
        vehicleType: d.vehicleType,
        vehiclePlate: d.vehiclePlate,
        isActive: true,
        isAvailable: false,
      },
    });
    console.log(`  Driver: ${d.email}`);
  }

  // 7. Warehouse staff
  const warehousePw = await bcrypt.hash("Warehouse123!", 10);
  for (const w of WAREHOUSE_STAFF) {
    const wUser = await prisma.user.upsert({
      where: { email: w.email },
      update: {},
      create: { name: w.name, email: w.email, password: warehousePw, role: "WAREHOUSE_STAFF" },
    });
    await prisma.warehouseStaff.upsert({
      where: { userId: wUser.id },
      update: {},
      create: { userId: wUser.id, fullName: w.fullName, phone: w.phone, isActive: true },
    });
    console.log(`  Warehouse: ${w.email}`);
  }

  // 8. Stock items + INITIAL_STOCK movements for every product
  const allProducts = await prisma.product.findMany({
    select: { id: true, unitType: true, pricePerKg: true, pricePerPiece: true },
  });

  let stockCreated = 0;
  let stockSkipped = 0;

  for (const product of allProducts) {
    const existing = await prisma.stockItem.findUnique({ where: { productId: product.id } });
    if (existing) { stockSkipped++; continue; }

    const isKg = product.unitType === "KG" || product.unitType === "BOTH";

    // Random stock: KG 20–100, Pieces 10–50
    const availableKg     = isKg ? Math.round((Math.random() * 80 + 20) * 10) / 10 : null;
    const availablePieces = !isKg ? Math.floor(Math.random() * 41 + 10) : null;

    const retailPrice = Number(product.pricePerKg ?? product.pricePerPiece ?? 0);
    const supplierPrice = retailPrice > 0 ? Math.round(retailPrice * 0.7) : null;

    const stockItem = await prisma.stockItem.create({
      data: {
        productId:         product.id,
        availableKg,
        availablePieces,
        reservedKg:        isKg  ? 0 : null,
        reservedPieces:    !isKg ? 0 : null,
        minStockKg:        isKg  ? 10  : null,
        minStockPieces:    !isKg ? 5   : null,
        targetStockKg:     isKg  ? 80  : null,
        targetStockPieces: !isKg ? 40  : null,
        supplierName:      "Tashkent Wholesale Market",
        supplierPrice,
        lastRestockedAt:   new Date(),
      },
    });

    // INITIAL_STOCK movement
    await prisma.stockMovement.create({
      data: {
        stockItemId:      stockItem.id,
        type:             "INITIAL_STOCK",
        deltaKg:          availableKg,
        deltaPieces:      availablePieces,
        newBalanceKg:     availableKg,
        newBalancePieces: availablePieces,
        performedBy:      admin.id,
        performedByRole:  "COMPANY_ADMIN",
        note:             "Initial stock load",
      },
    });

    stockCreated++;
  }

  console.log(`✅ ${stockCreated} stock items created, ${stockSkipped} skipped\n`);

  console.log(`
✨ Seeding complete!
   Admin:      admin@ikiwi.uz  / Admin123!
   Shops:      *@shop.uz       / Shop123!
   Drivers:    *@ikiwi.uz      / Driver123!
   Warehouse:  rustam@ikiwi.uz, nodira@ikiwi.uz / Warehouse123!`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
