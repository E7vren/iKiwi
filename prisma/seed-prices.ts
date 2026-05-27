/**
 * Updates all products' prices from ikiwi-products.json using raw pg.
 * Run: npx tsx prisma/seed-prices.ts
 */
import { Client } from "pg";
import fs from "fs";
import path from "path";
import "dotenv/config";

interface SeedProduct {
  category: string;
  name_uz: string;
  unitType: "KG" | "PIECE" | "BOTH";
  price: number;
}

async function main() {
  console.log("💰 Setting prices from seed data...\n");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const adminRes = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'COMPANY_ADMIN' LIMIT 1`
    );
    if (!adminRes.rows.length) throw new Error("No admin user found. Run db:seed first.");
    const adminId = adminRes.rows[0].id;

    const dataPath = path.resolve(__dirname, "seed-data", "ikiwi-products.json");
    const { products: seedProducts } = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as {
      products: SeedProduct[];
    };

    // Deduplicate seed list by nameUz (only need one price entry per unique name)
    const seen = new Set<string>();
    const unique = seedProducts.filter((p) => {
      const key = p.name_uz.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const dbRes = await client.query<{ id: string; nameUz: string }>(
      `SELECT id, "nameUz" FROM products`
    );
    // Map nameUz -> array of all matching product IDs (handles duplicates)
    const dbMap = new Map<string, string[]>();
    for (const p of dbRes.rows) {
      const key = p.nameUz?.toLowerCase().trim() ?? "";
      const existing = dbMap.get(key) ?? [];
      existing.push(p.id);
      dbMap.set(key, existing);
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let updated = 0;
    let notFound = 0;

    await client.query("BEGIN");

    for (const sp of unique) {
      const key = sp.name_uz.toLowerCase().trim();
      const productIds = dbMap.get(key);

      if (!productIds?.length) {
        console.warn(`  ⚠️  Not found: "${sp.name_uz}"`);
        notFound++;
        continue;
      }

      const pricePerKg    = sp.unitType !== "PIECE" ? sp.price : null;
      const pricePerPiece = sp.unitType !== "KG"    ? sp.price : null;

      for (const productId of productIds) {
        await client.query(
          `UPDATE products SET "pricePerKg" = $1, "pricePerPiece" = $2 WHERE id = $3`,
          [pricePerKg, pricePerPiece, productId]
        );

        await client.query(
          `INSERT INTO daily_prices (id, "productId", "pricePerKg", "pricePerPiece", date, "adminId", "createdAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
           ON CONFLICT ("productId", date) DO UPDATE
           SET "pricePerKg" = $2, "pricePerPiece" = $3, "adminId" = $5`,
          [productId, pricePerKg, pricePerPiece, today, adminId]
        );
      }

      updated++;
    }

    await client.query("COMMIT");
    console.log(`✅ ${updated} products updated`);
    if (notFound > 0) console.log(`⚠️  ${notFound} not found (check spelling)`);
    console.log("\nDone! Refresh the admin Prices tab.");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
