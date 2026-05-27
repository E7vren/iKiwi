"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronRight, ChevronUp, MapPin, PackageSearch, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { ErrorState } from "@/components/shared/ErrorState";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPrice, getStatusColor, getStatusLabel } from "@/lib/utils";
import { useLocaleStore } from "@/store/localeStore";
import { useTranslations } from "@/lib/translations";
import type { Order, OrderItem } from "@/types";

async function fetchOrders(): Promise<{ orders: Order[] }> {
  const res = await fetch("/api/orders?limit=50");
  if (!res.ok) throw new Error(res.status >= 500 ? "server" : "network");
  return res.json();
}

function filterOrders(orders: Order[], tab: string): Order[] {
  if (tab === "ALL") return orders;
  if (tab === "ACTIVE")
    return orders.filter((o) => ["PREPARING", "READY", "OUT_FOR_DELIVERY"].includes(o.status));
  if (tab === "DELIVERED")
    return orders.filter((o) => ["DELIVERED", "CANCELLED", "PARTIALLY_DELIVERED"].includes(o.status));
  return orders.filter((o) => o.status === tab);
}

function formatQty(item: OrderItem): string {
  if (item.orderedAs === "KG") {
    return `${item.requestedKg ?? "?"} kg`;
  }
  return `${item.requestedPieces ?? "?"} pcs`;
}

function formatActualQty(item: OrderItem): string | null {
  if (item.orderedAs === "KG") {
    if (item.actualKg == null) return null;
    return `${item.actualKg} kg`;
  }
  if (item.actualPieces == null) return null;
  return `${item.actualPieces} pcs`;
}

function hasActualDiff(item: OrderItem): boolean {
  if (item.orderedAs === "KG") {
    return item.actualKg != null && item.actualKg !== item.requestedKg;
  }
  return item.actualPieces != null && item.actualPieces !== item.requestedPieces;
}

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="flex items-center">
        <button
          type="button"
          className="flex-1 flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors min-w-0"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-mono text-muted-foreground">
                #{order.id.slice(-6).toUpperCase()}
              </p>
              <Badge className={getStatusColor(order.status)}>{getStatusLabel(order.status)}</Badge>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <p className="font-bold text-primary">
                {formatPrice(order.actualTotal ?? order.estimatedTotal)}
              </p>
              {order.actualTotal != null && (
                <p className="text-xs text-muted-foreground line-through">
                  est. {formatPrice(order.estimatedTotal)}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {order.items.length} item{order.items.length !== 1 ? "s" : ""} ·{" "}
              {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
            </p>
            {order.shop?.name && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" /> {order.shop.name}
              </p>
            )}
          </div>
          <div className="shrink-0 text-muted-foreground">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>
        <Link
          href={`/orders/${order.id}`}
          className="h-full flex items-center px-3 py-3 hover:bg-accent transition-colors border-l border-border shrink-0"
          aria-label="View order details"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <Separator />
          <div className="space-y-2">
            {order.items.map((item) => {
              const actualQty = formatActualQty(item);
              const diff = hasActualDiff(item);
              return (
                <div key={item.id} className="text-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{item.product.name}</span>
                      <span className="text-muted-foreground ml-1">
                        {actualQty != null ? actualQty : formatQty(item)}
                      </span>
                      {diff && (
                        <span className="text-xs text-amber-600 ml-1">
                          (req: {formatQty(item)})
                        </span>
                      )}
                      {item.adminAdjusted && (
                        <Badge variant="outline" className="ml-1.5 text-[10px] h-4 px-1">
                          adjusted
                        </Badge>
                      )}
                      {item.adminNote && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">
                          {item.adminNote}
                        </p>
                      )}
                    </div>
                    <span className="font-medium shrink-0 ml-2">
                      {formatPrice(item.actualPrice ?? item.estimatedPrice)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {order.notes && (
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="text-xs text-muted-foreground italic">&ldquo;{order.notes}&rdquo;</p>
            </div>
          )}

          {order.finalCostNote && (
            <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2">
              <p className="text-xs font-medium text-primary mb-0.5">Staff note</p>
              <p className="text-xs text-muted-foreground">{order.finalCostNote}</p>
            </div>
          )}

          <div className="flex justify-between text-sm font-bold border-t pt-2">
            <span>{order.actualTotal != null ? "Final" : "Estimated"} total</span>
            <span className="text-primary">
              {formatPrice(order.actualTotal ?? order.estimatedTotal)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShopOrdersPage() {
  const locale = useLocaleStore((s) => s.locale);
  const T = useTranslations(locale);
  const [tab, setTab] = useState("ALL");

  const STATUS_TABS = [
    { value: "ALL",       label: T.tabAll },
    { value: "PENDING",   label: T.tabPending },
    { value: "ACTIVE",    label: T.tabActive },
    { value: "DELIVERED", label: T.tabDone },
  ];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["orders", "shop"],
    queryFn: fetchOrders,
    refetchInterval: 30_000,
  });

  const orders = data?.orders ?? [];
  const filtered = filterOrders(orders, tab);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">{T.myOrders}</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-4">
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error ? (
        <ErrorState
          type={error.message === "server" ? "server" : "network"}
          title={error.message === "server" ? "Something went wrong on our end" : "Couldn't load orders"}
          description={error.message === "server" ? "We're looking into it. Please try again." : "Check your connection and try again."}
          onRetry={() => refetch()}
          contactSupport={error.message === "server"}
        />
      ) : isLoading ? (
        <div className="space-y-3">
          {(["a", "b", "c"] as const).map((k) => (
            <div key={k} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        tab === "ALL" ? (
          <div className="py-16 flex flex-col items-center text-center gap-4">
            <div className="h-24 w-24 rounded-full bg-primary/8 flex items-center justify-center">
              <ShoppingBag className="h-12 w-12 text-primary/50" />
            </div>
            <div className="space-y-1.5">
              <p className="font-semibold text-[16px] text-foreground">{T.firstOrderTitle}</p>
              <p className="text-sm text-muted-foreground max-w-xs">{T.firstOrderDesc}</p>
            </div>
            <Link
              href="/shop"
              className="inline-flex items-center justify-center rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-[15px] font-medium px-6 h-11 mt-1"
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              {T.startShopping}
            </Link>
          </div>
        ) : (
          <div className="py-20 text-center space-y-3 text-muted-foreground">
            <PackageSearch className="h-12 w-12 mx-auto opacity-30" />
            <p className="font-medium text-foreground">{T.noFilteredOrders}</p>
            <p className="text-sm">{T.tryDifferentFilter}</p>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}
