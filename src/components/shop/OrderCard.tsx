import { Badge } from "@/components/ui/badge";
import { formatDate, formatPrice, getStatusColor, getStatusLabel } from "@/lib/utils";
import type { Order, OrderItem } from "@/types";

function itemQtyLabel(item: OrderItem): string {
  if (item.orderedAs === "KG") {
    return `${item.requestedKg ?? "?"} kg`;
  }
  return `${item.requestedPieces ?? "?"} pcs`;
}

export function OrderCard({ order }: { order: Order }) {
  return (
    <div className="rounded-xl bg-card border border-border shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Order #{order.id.slice(-6).toUpperCase()}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{formatDate(order.createdAt)}</p>
        </div>
        <Badge className={getStatusColor(order.status)}>{getStatusLabel(order.status)}</Badge>
      </div>

      <div className="divide-y divide-border">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between py-1.5 text-sm">
            <span className="text-muted-foreground">
              {item.product.name} × {itemQtyLabel(item)}
            </span>
            <span className="font-medium">{formatPrice(item.estimatedPrice)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border">
        <span className="text-sm text-muted-foreground">
          {order.actualTotal != null ? "Final" : "Estimated"}
        </span>
        <span className="font-bold text-primary">
          {formatPrice(order.actualTotal ?? order.estimatedTotal)}
        </span>
      </div>

      {order.notes && <p className="text-xs text-muted-foreground italic">Note: {order.notes}</p>}
    </div>
  );
}
