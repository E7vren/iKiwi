"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getTomorrowOrders } from "@/server/actions/orders";

type Order = Awaited<ReturnType<typeof getTomorrowOrders>>[number];

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export default function TomorrowOrdersPage() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["tomorrow-orders"],
    queryFn: () => getTomorrowOrders(),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((k) => (
          <Skeleton key={k} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <CalendarDays className="h-12 w-12 text-gray-300 mb-4" />
        <p className="font-semibold text-lg">No orders yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Today's orders will appear here as shops place them.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <p className="text-sm text-muted-foreground">
        {orders.length} order{orders.length !== 1 ? "s" : ""} placed today for tomorrow's delivery
      </p>

      {orders.map((order: Order) => (
        <div key={order.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">{order.shop.name}</p>
              {order.shop.address && (
                <p className="text-xs text-muted-foreground">{order.shop.address}</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
            </p>
          </div>

          <div className="px-4 py-3 space-y-1">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-foreground">{item.product.name}</span>
                <span className="font-medium">
                  {item.orderedAs === "KG"
                    ? `${fmt(item.requestedKg ?? 0)} kg`
                    : `${item.requestedPieces ?? 0} pcs`}
                </span>
              </div>
            ))}
          </div>

          <div className="px-4 py-2 border-t bg-muted/40 flex justify-end">
            <span className="text-sm font-semibold">
              Est. {order.estimatedTotal.toLocaleString("ru-RU")} UZS
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
