"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronRight, Loader2, MapPin, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ShopSelector } from "@/components/shop/ShopSelector";
import { formatPrice } from "@/lib/utils";
import { getMyShops, type MyShop } from "@/server/actions/shops";
import { placeOrder } from "@/server/actions/orders";
import { useCartStore } from "@/store/cartStore";
import type { CartItem } from "@/types";

function SwipeableCartItem({
  item, onRemove, onIncrease, onDecrease,
}: {
  item: CartItem;
  onRemove: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const unitLabel = item.orderedAs === "KG" ? "kg" : "pcs";

  return (
    <AnimatePresence>
      <motion.div
        layout
        className="relative overflow-hidden rounded-xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
      >
        <div className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 bg-red-50 rounded-xl w-full">
          <Trash2 className="h-5 w-5 text-destructive" />
          <span className="text-xs text-destructive ml-1.5 font-medium">Remove</span>
        </div>
        <motion.div
          drag="x"
          dragConstraints={{ left: -100, right: 0 }}
          dragElastic={0.1}
          onDragEnd={(_, info) => { if (info.offset.x < -80) onRemove(); }}
          className="relative flex items-center gap-3 rounded-xl bg-card border border-border shadow-sm p-3 cursor-grab active:cursor-grabbing"
          whileTap={{ scale: 0.99 }}
        >
          <div className="h-12 w-12 rounded-lg bg-primary/5 flex items-center justify-center text-2xl shrink-0">
            {item.orderedAs === "KG" ? "⚖️" : "📦"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatPrice(item.pricePerUnit)} / {unitLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={onDecrease}>
              {item.qty <= (item.orderedAs === "KG" ? 0.5 : 1)
                ? <Trash2 className="h-3 w-3 text-destructive" />
                : <Minus className="h-3 w-3" />}
            </Button>
            <span className="w-12 text-center text-sm font-semibold">
              {item.qty} {unitLabel}
            </span>
            <Button size="icon" className="h-7 w-7 bg-primary hover:bg-primary/90" onClick={onIncrease}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-sm font-bold text-right w-20 shrink-0">
            {formatPrice(item.pricePerUnit * item.qty)}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function CartPage() {
  const router = useRouter();
  const { items, addItem, updateQty, removeItem, clearCart } = useCartStore();
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [shops, setShops] = useState<MyShop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const total = items.reduce((acc, i) => acc + i.pricePerUnit * i.qty, 0);
  const selectedShop = shops.find((s) => s.id === selectedShopId) ?? null;

  useEffect(() => {
    getMyShops().then((data) => {
      setShops(data);
      // Auto-select if only one active shop
      const active = data.filter((s) => s.isActive);
      if (active.length === 1) setSelectedShopId(active[0].id);
    });
  }, []);

  async function handlePlaceOrder() {
    if (items.length === 0) return;
    if (!selectedShopId) {
      setSelectorOpen(true);
      return;
    }
    setLoading(true);

    const orderItems = items.map((i) =>
      i.orderedAs === "KG"
        ? { productId: i.productId, orderedAs: "KG" as const, requestedKg: i.qty }
        : { productId: i.productId, orderedAs: "PIECE" as const, requestedPieces: i.qty }
    );

    const result = await placeOrder({
      shopId: selectedShopId,
      items: orderItems,
      notes: notes.trim() || undefined,
    });

    setLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    clearCart();
    router.push(`/orders/${result.data.id}/confirmation`);
  }

  if (items.length === 0) {
    return (
      <div className="py-24 text-center space-y-4">
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground/30" />
        <div>
          <p className="font-semibold text-lg">Your cart is empty</p>
          <p className="text-sm text-muted-foreground mt-1">Add products from the catalog</p>
        </div>
        <Button onClick={() => router.push("/shop")} className="bg-primary hover:bg-primary/90">
          Browse Catalog
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Your Cart</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} product{items.length !== 1 ? "s" : ""}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">← Swipe left to remove an item</p>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const step = item.orderedAs === "KG" ? 0.5 : 1;
            return (
              <SwipeableCartItem
                key={`${item.productId}::${item.orderedAs}`}
                item={item}
                onRemove={() => removeItem(item.productId, item.orderedAs)}
                onIncrease={() =>
                  addItem({ productId: item.productId, name: item.name, unitType: item.unitType, orderedAs: item.orderedAs, pricePerUnit: item.pricePerUnit }, step)
                }
                onDecrease={() => {
                  const newQty = Math.round((item.qty - step) * 10) / 10;
                  if (newQty <= 0) removeItem(item.productId, item.orderedAs);
                  else updateQty(item.productId, item.orderedAs, newQty);
                }}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {/* Deliver to — shop selector */}
      <div>
        <Label className="text-sm mb-2 block">Deliver to</Label>
        {shops.filter((s) => s.isActive).length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            You have no active shops.{" "}
            <Link href="/shop/profile" className="underline font-medium">
              Add one in your profile.
            </Link>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSelectorOpen(true)}
            className="w-full rounded-xl border border-border bg-card p-4 text-left flex items-center gap-3 hover:border-primary/40 transition-colors"
          >
            <MapPin className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              {selectedShop ? (
                <>
                  <p className="font-semibold text-sm">{selectedShop.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedShop.address}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Tap to select delivery shop</p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        )}
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          Quantities shown are estimates. Staff will confirm exact weights/counts and notify you of the final cost.
        </p>
      </div>

      {/* Order summary */}
      <div className="rounded-xl bg-card border border-border shadow-sm p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Products</span>
          <span>{items.length}</span>
        </div>
        <Separator />
        <div className="flex justify-between font-bold pt-1">
          <span>Estimated Total</span>
          <span className="text-primary text-lg">{formatPrice(total)}</span>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Order notes (optional)</Label>
        <Textarea
          id="notes"
          placeholder="Special requests, delivery time, etc…"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          className="shrink-0 text-destructive border-destructive/30 hover:bg-destructive/5"
          onClick={clearCart}
        >
          <Trash2 className="h-4 w-4 mr-1.5" /> Clear
        </Button>
        <Button
          onClick={handlePlaceOrder}
          disabled={loading || shops.filter((s) => s.isActive).length === 0}
          className="flex-1 bg-primary hover:bg-primary/90"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {selectedShopId ? `Place Order · ${formatPrice(total)}` : "Select shop to order"}
        </Button>
      </div>

      <ShopSelector
        shops={shops}
        value={selectedShopId}
        onChange={setSelectedShopId}
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
      />
    </div>
  );
}
