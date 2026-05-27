"use client";

import { AlertTriangle, Minus, Plus, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatPrice, getCategoryName } from "@/lib/utils";
import { useTranslations } from "@/lib/translations";
import { useLocaleStore } from "@/store/localeStore";
import { useCartStore } from "@/store/cartStore";
import type { Product } from "@/types";

interface Props {
  product: Product | null;
  onClose: () => void;
}

export function ProductSheet({ product, onClose }: Props) {
  const { items, addItem, updateQty, removeItem } = useCartStore();
  const locale = useLocaleStore((s) => s.locale);
  const T = useTranslations(locale);
  const [orderedAs, setOrderedAs] = useState<"KG" | "PIECE">("KG");

  useEffect(() => {
    if (!product) return;
    setOrderedAs(product.unitType === "PIECE" ? "PIECE" : "KG");
  }, [product?.id, product?.unitType]);

  const resolvedUnit: "KG" | "PIECE" =
    product?.unitType === "PIECE" ? "PIECE" : product?.unitType === "KG" ? "KG" : orderedAs;

  const cartItem = product
    ? items.find((i) => i.productId === product.id && i.orderedAs === resolvedUnit)
    : null;
  const qty = cartItem?.qty ?? 0;
  const step = resolvedUnit === "KG" ? 0.5 : 1;

  const pricePerUnit = resolvedUnit === "KG" ? product?.pricePerKg : product?.pricePerPiece;
  const hasPrice = pricePerUnit != null;

  const displayName = product
    ? locale === "ru" && product.nameRu
      ? product.nameRu
      : product.nameUz || product.name
    : "";

  function handleAdd() {
    if (!product || !hasPrice) return;
    addItem(
      {
        productId: product.id,
        name: product.name,
        unitType: product.unitType,
        orderedAs: resolvedUnit,
        pricePerUnit: pricePerUnit,
      },
      step
    );
  }

  function handleIncrease() {
    if (!product || !hasPrice) return;
    if (qty === 0) handleAdd();
    else updateQty(product.id, resolvedUnit, Math.round((qty + step) * 10) / 10);
  }

  function handleDecrease() {
    if (!product) return;
    const newQty = Math.round((qty - step) * 10) / 10;
    if (newQty <= 0) removeItem(product.id, resolvedUnit);
    else updateQty(product.id, resolvedUnit, newQty);
  }

  const unitLabel = resolvedUnit === "KG" ? T.perKg : T.perPcs;

  return (
    <Sheet open={!!product} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-10 max-w-2xl mx-auto">
        {product && (
          <>
            {product.imageUrl && (
              <div className="h-48 overflow-hidden rounded-xl mb-2">
                <img
                  src={product.imageUrl}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <SheetHeader className="text-left mb-5">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="text-xl">{displayName}</SheetTitle>
                <Badge variant="secondary" className="text-xs">
                  {product.category.icon} {getCategoryName(product.category, locale)}
                </Badge>
              </div>
            </SheetHeader>

            <div className="space-y-5">
              {/* Unit toggle — only for BOTH products */}
              {product.unitType === "BOTH" && (
                <div className="flex rounded-lg border p-1 gap-1 w-fit">
                  <button
                    type="button"
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      orderedAs === "KG"
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setOrderedAs("KG")}
                  >
                    {T.byKg}
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      orderedAs === "PIECE"
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setOrderedAs("PIECE")}
                  >
                    {T.byPcs}
                  </button>
                </div>
              )}

              {hasPrice ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold text-primary">{formatPrice(pricePerUnit)}</p>
                      <p className="text-sm text-muted-foreground">{unitLabel}</p>
                    </div>

                    {qty === 0 ? (
                      <Button
                        size="lg"
                        className="bg-primary hover:bg-primary/90"
                        onClick={handleAdd}
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        {T.addToCart}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-10 w-10"
                          onClick={handleDecrease}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-20 text-center font-bold text-xl">
                          {qty} {resolvedUnit === "KG" ? "kg" : "pcs"}
                        </span>
                        <Button
                          size="icon"
                          className="h-10 w-10 bg-primary hover:bg-primary/90"
                          onClick={handleIncrease}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {qty > 0 && (
                    <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        {qty} {resolvedUnit === "KG" ? "kg" : "pcs"} {T.inCart}
                      </span>
                      <span className="font-bold text-primary">
                        {formatPrice(qty * pricePerUnit)}
                      </span>
                    </div>
                  )}

                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">{T.qtyNote}</p>
                  </div>
                </>
              ) : (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
                  <p className="text-sm text-amber-800">{T.noPriceBody}</p>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
