"use client";

import { MapPin, Navigation } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { MyShop } from "@/server/actions/shops";

interface Props {
  shops: MyShop[];
  value: string | null;           // selected shopId
  onChange: (shopId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function ShopSelector({ shops, value, onChange, open, onOpenChange }: Props) {
  const [gpsLoading, setGpsLoading] = useState(false);

  function handleGps() {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const { latitude, longitude } = pos.coords;
        let nearest = shops[0];
        let minDist = Infinity;
        for (const s of shops) {
          const d = distanceKm(latitude, longitude, s.latitude, s.longitude);
          if (d < minDist) { minDist = d; nearest = s; }
        }
        if (nearest) onChange(nearest.id);
      },
      () => setGpsLoading(false)
    );
  }

  const activeShops = shops.filter((s) => s.isActive);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Deliver to which shop?</SheetTitle>
        </SheetHeader>

        <Button
          variant="outline"
          className="w-full mb-4 gap-2"
          disabled={gpsLoading}
          onClick={handleGps}
        >
          <Navigation className="h-4 w-4 text-primary" />
          {gpsLoading ? "Detecting location…" : "Use my location (nearest shop)"}
        </Button>

        <div className="space-y-2">
          {activeShops.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No active shops. Add one in your profile.
            </p>
          )}
          {activeShops.map((shop) => (
            <button
              key={shop.id}
              type="button"
              onClick={() => { onChange(shop.id); onOpenChange(false); }}
              className={cn(
                "w-full text-left rounded-xl border p-4 transition-colors",
                value === shop.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              )}
            >
              <p className="font-semibold text-sm">{shop.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" /> {shop.address}
              </p>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
