"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Save, TrendingDown, TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/utils";
import { getCategoryName } from "@/lib/utils";
import { useLocaleStore } from "@/store/localeStore";
import { setDailyPrices } from "@/server/actions/prices";
import type { Product } from "@/types";

interface PriceRecord {
  productId: string;
  pricePerKg: number | null;
  pricePerPiece: number | null;
  date: string;
}

interface ProductWithYesterday extends Product {
  yesterdayPriceKg: number | null;
  yesterdayPricePcs: number | null;
}

async function fetchProductsWithPrices(): Promise<ProductWithYesterday[]> {
  const [productsRes, pricesRes] = await Promise.all([
    fetch("/api/products?all=true"),
    fetch("/api/prices?days=2"),
  ]);
  const products: Product[] = await productsRes.json();
  const prices: PriceRecord[] = await pricesRes.json();

  const yesterday = new Date();
  yesterday.setUTCHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  return products.map((p) => {
    const yPrice = prices.find((pr) => pr.productId === p.id && pr.date === yesterdayStr);
    return {
      ...p,
      yesterdayPriceKg: yPrice?.pricePerKg ?? null,
      yesterdayPricePcs: yPrice?.pricePerPiece ?? null,
    };
  });
}

const schema = z.object({
  prices: z.array(
    z.object({
      productId: z.string(),
      unitType: z.string(),
      priceKg: z.string(),
      pricePcs: z.string(),
    })
  ),
});
type FormValues = z.infer<typeof schema>;

function Trend({ today, yesterday }: { today: number | null; yesterday: number | null }) {
  if (!today || !yesterday) return <span className="text-muted-foreground text-xs">—</span>;
  const diff = today - yesterday;
  const pct = Math.round((diff / yesterday) * 100);
  if (diff === 0)
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-0.5 whitespace-nowrap">
        <Minus className="h-3 w-3" /> 0%
      </span>
    );
  return (
    <span
      className={`text-xs flex items-center gap-0.5 font-medium whitespace-nowrap ${diff > 0 ? "text-red-500" : "text-green-600"}`}
    >
      {diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {diff > 0 ? "+" : ""}
      {pct}%
    </span>
  );
}

export function PriceGrid() {
  const qc = useQueryClient();
  const locale = useLocaleStore((s) => s.locale);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products-with-prices"],
    queryFn: fetchProductsWithPrices,
  });

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    values: {
      prices: products.map((p) => ({
        productId: p.id,
        unitType: p.unitType,
        priceKg: p.pricePerKg != null ? String(p.pricePerKg) : "",
        pricePcs: p.pricePerPiece != null ? String(p.pricePerPiece) : "",
      })),
    },
  });

  async function onSubmit(data: FormValues) {
    const payload = data.prices
      .map((p) => {
        const pricePerKg =
          p.unitType !== "PIECE" && p.priceKg !== "" && Number(p.priceKg) > 0
            ? Math.round(Number(p.priceKg))
            : undefined;
        const pricePerPiece =
          p.unitType !== "KG" && p.pricePcs !== "" && Number(p.pricePcs) > 0
            ? Math.round(Number(p.pricePcs))
            : undefined;
        return { productId: p.productId, pricePerKg, pricePerPiece };
      })
      .filter((p) => p.pricePerKg != null || p.pricePerPiece != null);

    if (payload.length === 0) {
      toast.error("Enter at least one price");
      return;
    }

    const result = await setDailyPrices({ prices: payload });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`${payload.length} prices saved — shops notified!`);
    qc.invalidateQueries({ queryKey: ["products-with-prices"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  // Group products by category, preserving global index for react-hook-form
  const grouped = products.reduce<
    Array<{ category: Product["category"]; items: Array<{ product: ProductWithYesterday; idx: number }> }>
  >((acc, product, idx) => {
    const existing = acc.find((g) => g.category.id === product.category.id);
    if (existing) {
      existing.items.push({ product, idx });
    } else {
      acc.push({ category: product.category, items: [{ product, idx }] });
    }
    return acc;
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Set today&apos;s prices. Shop owners are notified immediately.
        </p>
        <Button
          onClick={handleSubmit(onSubmit)}
          disabled={isSubmitting || isLoading}
          className="bg-primary hover:bg-primary/90"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save All Prices
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-7 w-48 rounded-lg" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {grouped.map(({ category, items }) => (
            <div key={category.id} className="space-y-2">
              {/* Category header */}
              <div className="flex items-center gap-2">
                <span className="text-xl">{category.icon}</span>
                <h2 className="font-semibold text-base">{getCategoryName(category, locale)}</h2>
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  {items.length}
                </span>
              </div>

              {/* Products table */}
              <div className="rounded-xl border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Product</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-44">Price / kg</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-44">Price / pcs</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-24">vs yesterday</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map(({ product, idx }) => (
                      <tr key={product.id} className="hover:bg-muted/40/50">
                        <td className="px-4 py-2.5">
                          <input type="hidden" {...register(`prices.${idx}.productId`)} />
                          <input type="hidden" {...register(`prices.${idx}.unitType`)} />
                          <p className="font-medium">{product.nameUz || product.name}</p>
                          {product.nameRu && (
                            <p className="text-xs text-muted-foreground">{product.nameRu}</p>
                          )}
                        </td>

                        {/* KG price */}
                        <td className="px-3 py-2.5">
                          {product.unitType !== "PIECE" ? (
                            <div className="space-y-0.5">
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                placeholder="—"
                                {...register(`prices.${idx}.priceKg`)}
                                className="h-8 text-sm w-36"
                              />
                              {product.yesterdayPriceKg != null && (
                                <p className="text-[10px] text-muted-foreground pl-0.5">
                                  yest: {formatPrice(product.yesterdayPriceKg)} UZS
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* PCS price */}
                        <td className="px-3 py-2.5">
                          {product.unitType !== "KG" ? (
                            <div className="space-y-0.5">
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                placeholder="—"
                                {...register(`prices.${idx}.pricePcs`)}
                                className="h-8 text-sm w-36"
                              />
                              {product.yesterdayPricePcs != null && (
                                <p className="text-[10px] text-muted-foreground pl-0.5">
                                  yest: {formatPrice(product.yesterdayPricePcs)} UZS
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Trend */}
                        <td className="px-3 py-2.5">
                          <Trend
                            today={product.unitType !== "PIECE" ? product.pricePerKg : product.pricePerPiece}
                            yesterday={product.unitType !== "PIECE" ? product.yesterdayPriceKg : product.yesterdayPricePcs}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </form>
      )}
    </div>
  );
}
