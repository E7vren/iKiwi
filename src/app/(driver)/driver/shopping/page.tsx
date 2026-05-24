"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, ShoppingCart } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { claimShoppingList, getShoppingList } from "@/server/actions/shopping";

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export default function DriverShoppingPage() {
  const [isPending, startTransition] = useTransition();

  const { data: result, isLoading } = useQuery({
    queryKey: ["driver-shopping-list"],
    queryFn: () => getShoppingList(),
    refetchInterval: 60_000,
  });
  const task = result?.success ? result.data : null;

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((k) => (
          <Skeleton key={k} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!task || task.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
        <p className="font-semibold text-lg">All good!</p>
        <p className="text-sm text-muted-foreground mt-1">
          No shopping needed right now. Stock is sufficient for today's orders.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold text-base">Shopping List</p>
            <p className="text-xs text-muted-foreground">
              {task.items.length} product{task.items.length !== 1 ? "s" : ""} needed
              {" · "}generated {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
      </div>

      {/* Claim button */}
      {task && (
        <div className="px-4 pt-3">
          <Button
            className="w-full"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await claimShoppingList(task.id);
                if (!result.success) toast.error(result.error);
                else toast.success("Marked as 'on it' — team notified");
              })
            }
          >
            {isPending ? "Updating…" : "I'm on it"}
          </Button>
        </div>
      )}

      {/* Items */}
      <div className="p-4 space-y-3">
        {task.items.map((item) => {
          const isKg = item.product.unitType === "KG" || item.product.unitType === "BOTH";
          const isPiece = item.product.unitType === "PIECE" || item.product.unitType === "BOTH";
          const availKg = Number(item.product.stockItem?.availableKg ?? 0);
          const availPieces = item.product.stockItem?.availablePieces ?? 0;
          const neededKg = Number(item.neededKg ?? 0);
          const neededPieces = item.neededPieces ?? 0;
          const toBuyKg = Math.max(0, neededKg - availKg);
          const toBuyPieces = Math.max(0, neededPieces - availPieces);

          return (
            <div key={item.id} className="rounded-xl border bg-white overflow-hidden shadow-sm">
              {/* Product name */}
              <div className="px-4 py-3 border-b bg-gray-50">
                <p className="font-semibold">{item.product.name}</p>
              </div>

              {/* Buy / available / ordered grid */}
              <div className="grid grid-cols-3 divide-x px-0">
                {/* To buy */}
                <div className="px-4 py-3 text-center">
                  <p className="text-lg font-bold text-primary">
                    {isKg && toBuyKg > 0 ? `${fmt(toBuyKg)} kg` : ""}
                    {isKg && toBuyKg > 0 && isPiece && toBuyPieces > 0 ? " / " : ""}
                    {isPiece && toBuyPieces > 0 ? `${toBuyPieces} pcs` : ""}
                    {toBuyKg === 0 && toBuyPieces === 0 ? "—" : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">TO BUY</p>
                </div>

                {/* In stock */}
                <div className="px-4 py-3 text-center">
                  <p className="text-base font-semibold text-gray-700">
                    {isKg ? `${fmt(availKg)} kg` : ""}
                    {isKg && isPiece ? " / " : ""}
                    {isPiece ? `${availPieces} pcs` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">IN STOCK</p>
                </div>

                {/* Ordered */}
                <div className="px-4 py-3 text-center">
                  <p className="text-base font-semibold text-gray-700">
                    {isKg && neededKg > 0 ? `${fmt(neededKg)} kg` : ""}
                    {isKg && neededKg > 0 && isPiece && neededPieces > 0 ? " / " : ""}
                    {isPiece && neededPieces > 0 ? `${neededPieces} pcs` : ""}
                    {neededKg === 0 && neededPieces === 0 ? "—" : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">ORDERED</p>
                </div>
              </div>
            </div>
          );
        })}

        <p className="text-xs text-center text-muted-foreground pt-2">
          After buying, warehouse staff logs the incoming stock to update quantities.
        </p>
      </div>
    </div>
  );
}
