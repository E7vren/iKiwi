"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Heart, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice, getCategoryName } from "@/lib/utils";
import { animations } from "@/lib/animations";
import { useTranslations } from "@/lib/translations";
import { useLocaleStore } from "@/store/localeStore";
import { useCartStore } from "@/store/cartStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

// Thresholds below which we show "Limited stock"
const LOW_KG_THRESHOLD    = 5;
const LOW_PIECE_THRESHOLD = 3;

function getStockStatus(product: Product): "out" | "low" | "ok" {
  const { unitType, stockAvailableKg, stockAvailablePieces } = product;

  // Not tracked in inventory → always ok (no restriction)
  if (stockAvailableKg === null && stockAvailablePieces === null) return "ok";

  const kgOut    = unitType !== "PIECE" && stockAvailableKg    != null && stockAvailableKg    <= 0;
  const pieceOut = unitType !== "KG"    && stockAvailablePieces != null && stockAvailablePieces <= 0;
  const kgLow    = unitType !== "PIECE" && stockAvailableKg    != null && stockAvailableKg    > 0 && stockAvailableKg    < LOW_KG_THRESHOLD;
  const pieceLow = unitType !== "KG"    && stockAvailablePieces != null && stockAvailablePieces > 0 && stockAvailablePieces < LOW_PIECE_THRESHOLD;

  // Out of stock: all tracked dimensions are exhausted
  if (unitType === "BOTH") {
    if (kgOut && pieceOut) return "out";
  } else if (unitType === "KG"    && kgOut)    return "out";
  else if (unitType === "PIECE"  && pieceOut)  return "out";

  if (kgLow || pieceLow) return "low";
  return "ok";
}

function haptic(ms = 20) {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
}

interface Props {
  product: Product;
  onDetails?: () => void;
}

export function ProductCard({ product, onDetails }: Props) {
  const { items } = useCartStore();
  const locale = useLocaleStore((s) => s.locale);
  const T = useTranslations(locale);
  const toggle = useFavoritesStore((s) => s.toggle);
  const isFav = useFavoritesStore((s) => s.isFavorite(product.id));
  const inCart = items.some((i) => i.productId === product.id);

  const hasPrice =
    (product.unitType !== "PIECE" && product.pricePerKg != null) ||
    (product.unitType !== "KG" && product.pricePerPiece != null);

  const displayName =
    locale === "ru" && product.nameRu ? product.nameRu : product.nameUz || product.name;

  const stockStatus = getStockStatus(product);
  const isOutOfStock = stockStatus === "out";

  return (
    /* relative so the heart button (absolute) is positioned against the card */
    <motion.div
      whileTap={animations.tap}
      className="relative rounded-xl bg-card shadow-sm border border-border overflow-hidden flex flex-col"
    >
      {/* Heart / favourite — absolutely on the card, not inside any button */}
      <motion.button
        type="button"
        aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
        whileTap={{ scale: 1.35 }}
        transition={{ duration: 0.15 }}
        onClick={() => { toggle(product.id); haptic(20); }}
        className="absolute top-2 right-2 z-10 h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-sm border border-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <Heart
          className={cn(
            "h-3.5 w-3.5 transition-colors duration-150",
            isFav ? "text-red-500 fill-red-500" : "text-muted-foreground"
          )}
        />
      </motion.button>

      {/* Image / icon area — standalone button, no nested buttons inside */}
      <button
        type="button"
        className="relative h-36 bg-muted w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
        onClick={onDetails}
        aria-label={`View details for ${displayName}`}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={displayName}
            className={cn("h-full w-full object-cover", isOutOfStock && "opacity-40 grayscale")}
          />
        ) : (
          <div className={cn("flex h-full items-center justify-center text-5xl", isOutOfStock && "opacity-40 grayscale")}>
            {product.category.icon ?? "🛒"}
          </div>
        )}
        <Badge variant="secondary" className="absolute top-2 left-2 text-[10px]">
          {getCategoryName(product.category, locale)}
        </Badge>
        {/* Stock status overlays */}
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-gray-800/75 px-2.5 py-1 text-[11px] font-semibold text-white">
              Out of stock
            </span>
          </div>
        )}
        {stockStatus === "low" && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-orange-500/90 px-2 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5 text-white" />
            <span className="text-[10px] font-semibold text-white">Limited</span>
          </div>
        )}
        {inCart && !isOutOfStock && (
          <span className="absolute bottom-2 right-2 h-2 w-2 rounded-full bg-primary border-2 border-card" />
        )}
      </button>

      {/* Text + action */}
      <div className="p-3 flex flex-col flex-1">
        <button type="button" className="text-left focus:outline-none" onClick={onDetails}>
          <p className="font-semibold text-sm leading-tight line-clamp-2">{displayName}</p>
        </button>

        <div className="mt-auto pt-3 space-y-2">
          {!hasPrice ? (
            <p className="text-xs text-muted-foreground">{T.noPrice}</p>
          ) : product.unitType === "BOTH" ? (
            <div className="space-y-0.5">
              {product.pricePerKg != null && (
                <p className="text-xs font-bold text-primary">
                  {formatPrice(product.pricePerKg)} / {T.perKg}
                </p>
              )}
              {product.pricePerPiece != null && (
                <p className="text-xs font-bold text-primary">
                  {formatPrice(product.pricePerPiece)} / {T.perPcs}
                </p>
              )}
            </div>
          ) : product.unitType === "KG" ? (
            <p className="text-sm font-bold text-primary">
              {product.pricePerKg != null
                ? `${formatPrice(product.pricePerKg)} / ${T.perKg}`
                : T.noPrice}
            </p>
          ) : (
            <p className="text-sm font-bold text-primary">
              {product.pricePerPiece != null
                ? `${formatPrice(product.pricePerPiece)} / ${T.perPcs}`
                : T.noPrice}
            </p>
          )}

          {hasPrice && !isOutOfStock && (
            <Button
              size="sm"
              className="w-full h-8 text-xs bg-primary hover:bg-primary/90"
              onClick={onDetails}
            >
              <ShoppingCart className="h-3.5 w-3.5 mr-1" />
              {inCart ? T.viewEdit : T.addToCart}
            </Button>
          )}
          {isOutOfStock && (
            <p className="text-center text-[11px] text-muted-foreground py-1">
              Currently unavailable
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
