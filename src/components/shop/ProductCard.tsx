"use client";

import { motion } from "framer-motion";
import { Heart, ShoppingCart } from "lucide-react";
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

// Stock status is intentionally NOT shown to customers — they can always order.
// When stock is low/zero, the system creates an URGENT restock task for the
// warehouse team to source the items from the market.

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
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl">
            {product.category.icon ?? "🛒"}
          </div>
        )}
        <Badge variant="secondary" className="absolute top-2 left-2 text-[10px]">
          {getCategoryName(product.category, locale)}
        </Badge>
        {inCart && (
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

          {hasPrice && (
            <Button
              size="sm"
              className="w-full h-8 text-xs bg-primary hover:bg-primary/90"
              onClick={onDetails}
            >
              <ShoppingCart className="h-3.5 w-3.5 mr-1" />
              {inCart ? T.viewEdit : T.addToCart}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
