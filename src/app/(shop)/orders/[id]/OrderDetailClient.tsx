"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Clock, Download, Loader2, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { OrderTimeline } from "@/components/shop/OrderTimeline";
import { ContactModal } from "@/components/shop/ContactModal";
import { ShopSelector } from "@/components/shop/ShopSelector";
import { cn, formatPrice, getStatusColor, getStatusLabel } from "@/lib/utils";
import { getMyShops } from "@/server/actions/shops";
import { updateOrderShop } from "@/server/actions/orders";
import type { OrderStatus } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Driver = {
  fullName:     string;
  phone:        string;
  vehicleType:  string;
  vehiclePlate: string | null;
  currentLat:   number | null;
  currentLng:   number | null;
  lastSeenAt:   string | null;
};

type DetailOrder = {
  id: string;
  shopId: string;
  status: OrderStatus;
  estimatedTotal: number;
  actualTotal: number | null;
  deliveredTotal: number | null;
  deliveryNote: string | null;
  notes: string | null;
  finalCostNote: string | null;
  createdAt: string;
  updatedAt: string;
  shop: {
    name: string;
    ownerName: string;
    phone: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
  };
  items: Array<{
    id: string;
    orderedAs: "KG" | "PIECE";
    requestedKg: number | null;
    requestedPieces: number | null;
    actualKg: number | null;
    actualPieces: number | null;
    deliveredKg: number | null;
    deliveredPieces: number | null;
    returnedKg: number | null;
    returnedPieces: number | null;
    returnReason: string | null;
    returnNote: string | null;
    estimatedPrice: number;
    actualPrice: number | null;
    finalPrice: number | null;
    adminAdjusted: boolean;
    adminNote: string | null;
    product: { name: string };
  }>;
  routeStop: {
    id: string;
    route: {
      estimatedMinutes: number | null;
      startedAt: string | null;
      staff: Driver | null;
    } | null;
  } | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const VEHICLE_ICON: Record<string, string> = {
  MOTORCYCLE: "🏍️",
  CAR:        "🚗",
  VAN:        "🚐",
  TRUCK:      "🚚",
};

const VEHICLE_LABEL: Record<string, string> = {
  MOTORCYCLE: "Motorcycle",
  CAR:        "Car",
  VAN:        "Van",
  TRUCK:      "Truck",
};

const RETURN_REASON_LABEL: Record<string, string> = {
  BAD_QUALITY:      "Bad quality",
  WRONG_PRODUCT:    "Wrong product",
  DAMAGED:          "Damaged",
  EXPIRED:          "Expired",
  CUSTOMER_REFUSED: "Customer refused",
  OTHER:            "Other",
};

// ─── Mini Map ─────────────────────────────────────────────────────────────────

function DriverMiniMap({
  driverLat,
  driverLng,
  shopLat,
  shopLng,
}: {
  driverLat: number;
  driverLng: number;
  shopLat?: number | null;
  shopLng?: number | null;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!token || token.includes("your_mapbox") || !mapRef.current || mapInstanceRef.current) return;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (!mapRef.current || mapInstanceRef.current) return;
      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: mapRef.current,
        style:     "mapbox://styles/mapbox/streets-v12",
        center:    [driverLng, driverLat],
        zoom:      14,
        interactive: false,
      });

      map.on("load", () => {
        // Driver marker — green dot
        const dEl = document.createElement("div");
        dEl.innerHTML = `<div style="width:34px;height:34px;background:#16a34a;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.3)">
          <div style="width:10px;height:10px;background:white;border-radius:50%"></div>
        </div>`;
        new mapboxgl.Marker({ element: dEl }).setLngLat([driverLng, driverLat]).addTo(map);

        if (shopLat && shopLng) {
          // Shop marker
          const sEl = document.createElement("div");
          sEl.innerHTML = `<div style="background:white;border:2px solid #16a34a;border-radius:8px;padding:4px 5px;font-size:15px;box-shadow:0 2px 6px rgba(0,0,0,.2)">🏪</div>`;
          new mapboxgl.Marker({ element: sEl }).setLngLat([shopLng, shopLat]).addTo(map);

          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend([driverLng, driverLat]);
          bounds.extend([shopLng, shopLat]);
          map.fitBounds(bounds, { padding: 50, maxZoom: 15, animate: false });
        }
      });

      mapInstanceRef.current = map;
    });

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mapInstanceRef.current as any)?.remove?.();
      mapInstanceRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!token || token.includes("your_mapbox")) return null;

  return <div ref={mapRef} className="h-40 w-full rounded-xl overflow-hidden border border-border" />;
}

// ─── Driver Info Card ─────────────────────────────────────────────────────────

function DriverInfoCard({
  driver,
  startedAt,
  estimatedMinutes,
  shopLat,
  shopLng,
}: {
  driver: Driver;
  startedAt: string | null;
  estimatedMinutes: number | null;
  shopLat?: number | null;
  shopLng?: number | null;
}) {
  const etaMin = (() => {
    if (!estimatedMinutes || !startedAt) return null;
    const elapsed = Math.round((Date.now() - new Date(startedAt).getTime()) / 60_000);
    return Math.max(0, estimatedMinutes - elapsed);
  })();

  const firstName = driver.fullName.split(" ")[0];

  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-primary/5 border-b border-border flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
        <p className="text-sm font-semibold text-foreground">
          {firstName} is on the way
        </p>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Vehicle + plate */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-base">{VEHICLE_ICON[driver.vehicleType] ?? "🚗"}</span>
            <span className="text-muted-foreground">
              {VEHICLE_LABEL[driver.vehicleType] ?? driver.vehicleType}
              {driver.vehiclePlate && (
                <span className="ml-1.5 font-mono text-xs">{driver.vehiclePlate}</span>
              )}
            </span>
          </div>
          {etaMin !== null && etaMin > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>~{etaMin} min</span>
            </div>
          )}
        </div>

        {/* Call button */}
        <a
          href={`tel:${driver.phone}`}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors active:scale-95"
        >
          <Phone className="h-4 w-4 text-primary" />
          Call {firstName}
        </a>

        {/* Mini map */}
        {driver.currentLat && driver.currentLng && (
          <DriverMiniMap
            driverLat={driver.currentLat}
            driverLng={driver.currentLng}
            shopLat={shopLat}
            shopLng={shopLng}
          />
        )}
      </div>
    </div>
  );
}

// ─── Returns Section ──────────────────────────────────────────────────────────

function ReturnsSection({
  items,
  totalRefund,
}: {
  items: DetailOrder["items"];
  totalRefund: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="px-4 pb-3">
      <button
        type="button"
        className="w-full flex items-center justify-between py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2 font-medium text-orange-600">
          <span>↩️</span>
          Returns{" "}
          <span className="text-xs font-normal">
            (−{formatPrice(totalRefund)})
          </span>
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="mt-2 space-y-2 pb-1">
          {items.map((item) => {
            const hasKgReturn     = item.returnedKg    != null && item.returnedKg    > 0;
            const hasPieceReturn  = item.returnedPieces != null && item.returnedPieces > 0;
            const qtyLabel = hasKgReturn
              ? `${item.returnedKg} kg`
              : hasPieceReturn
              ? `${item.returnedPieces} pcs`
              : null;

            return (
              <div key={item.id} className="rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 px-3 py-2.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">
                      {item.product.name}
                      {qtyLabel && (
                        <span className="ml-1 font-normal text-muted-foreground text-xs">
                          returned {qtyLabel}
                        </span>
                      )}
                    </p>
                    {item.returnReason && (
                      <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                        {RETURN_REASON_LABEL[item.returnReason] ?? item.returnReason}
                      </p>
                    )}
                    {item.returnNote && (
                      <p className="text-xs text-muted-foreground italic mt-0.5">
                        &ldquo;{item.returnNote}&rdquo;
                      </p>
                    )}
                  </div>
                  {item.finalPrice != null && item.actualPrice != null && item.finalPrice < item.actualPrice && (
                    <span className="text-xs font-medium text-orange-600 shrink-0">
                      −{formatPrice(item.actualPrice - item.finalPrice)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Cost Breakdown ───────────────────────────────────────────────────────────

function CostBreakdown({ order }: { order: DetailOrder }) {
  const hasActual    = order.actualTotal    != null;
  const hasDelivered = order.deliveredTotal != null;

  return (
    <div className="px-4 py-3 space-y-1.5">
      {/* Estimated */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Estimated</span>
        <span className={cn("text-muted-foreground", (hasActual || hasDelivered) && "line-through")}>
          {formatPrice(order.estimatedTotal)}
        </span>
      </div>

      {/* Actual */}
      {hasActual && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Actual</span>
          <span className={cn("text-muted-foreground", hasDelivered && "line-through")}>
            {formatPrice(order.actualTotal!)}
          </span>
        </div>
      )}

      <Separator className="my-1" />

      {/* Delivered total (final) */}
      {hasDelivered ? (
        <div className="flex justify-between items-center">
          <span className="font-bold text-foreground flex items-center gap-1.5">
            <span className="text-green-600">✓</span>
            Delivered
          </span>
          <span className="text-xl font-bold text-green-600">
            {formatPrice(order.deliveredTotal!)}
          </span>
        </div>
      ) : (
        <div className="flex justify-between">
          <span className="font-bold text-foreground">
            {hasActual ? "Final total" : "Estimated total"}
          </span>
          <span className="text-xl font-bold text-primary">
            {formatPrice(order.actualTotal ?? order.estimatedTotal)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function itemQtyLabel(item: DetailOrder["items"][0]): string {
  if (item.orderedAs === "KG") {
    const v = item.actualKg ?? item.requestedKg;
    return v != null ? `${v} kg` : "—";
  }
  const v = item.actualPieces ?? item.requestedPieces;
  return v != null ? `${v} pcs` : "—";
}

export function OrderDetailClient({ order }: { order: DetailOrder }) {
  const shortId        = order.id.slice(-6).toUpperCase();
  const [downloading, setDownloading] = useState(false);
  const [contactOpen,  setContactOpen]  = useState(false);
  const [shopSelectorOpen, setShopSelectorOpen] = useState(false);
  const [changingShop, setChangingShop] = useState(false);

  const { data: myShops = [] } = useQuery({
    queryKey: ["my-shops"],
    queryFn: () => getMyShops(),
    enabled: order.status === "PENDING",
  });

  async function handleChangeShop(shopId: string) {
    setChangingShop(true);
    const result = await updateOrderShop(order.id, shopId);
    setChangingShop(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Delivery shop updated");
    setShopSelectorOpen(false);
    window.location.reload();
  }

  const isOutForDelivery = order.status === "OUT_FOR_DELIVERY";
  const isDelivered      = order.status === "DELIVERED" || order.status === "PARTIALLY_DELIVERED";
  const driver           = order.routeStop?.route?.staff ?? null;

  // Returns: items that had something returned
  const returnedItems = order.items.filter(
    (i) => (i.returnedKg != null && i.returnedKg > 0) || (i.returnedPieces != null && i.returnedPieces > 0)
  );
  const totalRefund =
    order.actualTotal != null && order.deliveredTotal != null
      ? order.actualTotal - order.deliveredTotal
      : 0;

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/receipt/${order.id}`);
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `iKiwi-Order-${shortId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't generate receipt. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Back header */}
      <div className="flex items-center gap-3">
        <Link
          href="/shop/orders"
          className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-accent transition-colors shrink-0"
          aria-label="Back to orders"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-bold text-foreground">Order #{shortId}</h1>
          <p className="text-xs text-muted-foreground">
            {new Date(order.createdAt).toLocaleDateString("en-GB", {
              day: "numeric", month: "long", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>
        <Badge className={getStatusColor(order.status)}>
          {getStatusLabel(order.status)}
        </Badge>
      </div>

      {/* Timeline */}
      <div className="rounded-2xl bg-card border border-border shadow-sm p-4">
        <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Tracking
        </h2>
        <OrderTimeline
          status={order.status}
          createdAt={order.createdAt}
          updatedAt={order.updatedAt}
        />
      </div>

      {/* Driver info card — only when OUT_FOR_DELIVERY with driver assigned */}
      {isOutForDelivery && driver && (
        <DriverInfoCard
          driver={driver}
          startedAt={order.routeStop?.route?.startedAt ?? null}
          estimatedMinutes={order.routeStop?.route?.estimatedMinutes ?? null}
          shopLat={order.shop.latitude}
          shopLng={order.shop.longitude}
        />
      )}

      {/* Items */}
      <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-[13px] font-semibold text-foreground">
            Items · {order.items.length}
          </h2>
        </div>
        <div className="divide-y divide-border">
          {order.items.map((item) => {
            const price  = item.finalPrice ?? item.actualPrice ?? item.estimatedPrice;
            const reqQty = item.orderedAs === "KG"
              ? `${item.requestedKg ?? "?"} kg`
              : `${item.requestedPieces ?? "?"} pcs`;
            const actQty = itemQtyLabel(item);
            const diffQty = actQty !== reqQty && (item.actualKg != null || item.actualPieces != null);
            const hasReturn = (item.returnedKg != null && item.returnedKg > 0) ||
                              (item.returnedPieces != null && item.returnedPieces > 0);

            return (
              <div key={item.id} className="px-4 py-3 flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium text-foreground", hasReturn && "line-through text-muted-foreground")}>
                    {item.product.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {actQty}
                    {diffQty && (
                      <span className="ml-1.5 text-amber-600 dark:text-amber-400">
                        (requested {reqQty})
                      </span>
                    )}
                  </p>
                  {hasReturn && (
                    <p className="text-xs text-orange-600 mt-0.5">
                      ↩ Returned {item.returnReason ? `— ${RETURN_REASON_LABEL[item.returnReason] ?? item.returnReason}` : ""}
                    </p>
                  )}
                  {item.adminNote && (
                    <p className="text-xs text-muted-foreground italic mt-0.5">{item.adminNote}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn("text-sm font-semibold text-foreground", hasReturn && "line-through text-muted-foreground")}>
                    {formatPrice(price)}
                  </p>
                  {item.adminAdjusted && (
                    <span className="text-[9px] text-muted-foreground">adjusted</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Three-line cost breakdown */}
        <CostBreakdown order={order} />

        {/* Expandable returns section */}
        {returnedItems.length > 0 && isDelivered && (
          <ReturnsSection items={returnedItems} totalRefund={totalRefund} />
        )}

        {/* Notes */}
        {order.finalCostNote && (
          <div className="px-4 pb-3">
            <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2">
              <p className="text-xs font-medium text-primary mb-0.5">Staff note</p>
              <p className="text-xs text-muted-foreground">{order.finalCostNote}</p>
            </div>
          </div>
        )}
        {order.deliveryNote && (
          <div className="px-4 pb-3">
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Driver note</p>
              <p className="text-xs text-muted-foreground italic">&ldquo;{order.deliveryNote}&rdquo;</p>
            </div>
          </div>
        )}
        {order.notes && (
          <div className="px-4 pb-3">
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="text-xs text-muted-foreground italic">&ldquo;{order.notes}&rdquo;</p>
            </div>
          </div>
        )}
      </div>

      {/* Shop info */}
      <div className="rounded-2xl bg-card border border-border shadow-sm px-4 py-3 space-y-1">
        <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Shop</p>
        <p className="text-sm font-medium text-foreground">{order.shop.name}</p>
        <p className="text-xs text-muted-foreground">{order.shop.ownerName} · {order.shop.phone}</p>
        <p className="text-xs text-muted-foreground">{order.shop.address}</p>
        {order.status === "PENDING" && (
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-7 text-xs"
            disabled={changingShop}
            onClick={() => setShopSelectorOpen(true)}
          >
            {changingShop ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Change delivery shop
          </Button>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button variant="outline" className="w-full" onClick={handleDownload} disabled={downloading}>
          {downloading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Download Receipt PDF
        </Button>
        <Button variant="outline" className="w-full" onClick={() => setContactOpen(true)}>
          <MessageCircle className="h-4 w-4 mr-2" />
          Contact iKiwi about this order
        </Button>
      </div>

      <ContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        orderRef={shortId}
      />

      <ShopSelector
        shops={myShops}
        value={order.shopId}
        onChange={handleChangeShop}
        open={shopSelectorOpen}
        onOpenChange={setShopSelectorOpen}
      />
    </div>
  );
}
