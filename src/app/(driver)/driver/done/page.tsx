"use client";

import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { cn, formatPrice } from "@/lib/utils";
import { getCompletedRouteSummary } from "@/server/actions/routes";

type RouteSummary = NonNullable<Awaited<ReturnType<typeof getCompletedRouteSummary>>>;

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function SummaryContent() {
  const params = useSearchParams();
  const routeId = params.get("routeId");

  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [loading, setLoading] = useState(!!routeId);

  useEffect(() => {
    if (!routeId) return;
    getCompletedRouteSummary(routeId).then((r) => {
      setRoute(r ?? null);
      setLoading(false);
    });
  }, [routeId]);

  // Compute stats
  const totalCollected = route
    ? route.stops.reduce(
        (sum, s) =>
          sum + Number(s.order.deliveredTotal ?? s.order.actualTotal ?? s.order.estimatedTotal),
        0
      )
    : 0;
  const partialReturns = route
    ? route.stops.filter((s) => s.order.status === "PARTIALLY_DELIVERED").length
    : 0;
  const fullReturns = route ? route.stops.filter((s) => s.status === "FULL_RETURN").length : 0;
  const deliveredCount = route ? route.stops.filter((s) => s.status !== "SKIPPED").length : 0;

  const durationMin =
    route?.startedAt && route?.completedAt
      ? Math.round(
          (new Date(route.completedAt).getTime() - new Date(route.startedAt).getTime()) / 60_000
        )
      : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 px-5 py-8 text-center">
      {/* Animated checkmark */}
      <div className="relative flex items-center justify-center">
        <div className="h-28 w-28 rounded-full bg-green-100 flex items-center justify-center animate-[scale-in_0.4s_ease-out]">
          <span className="text-6xl">✅</span>
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold">Route Complete!</h1>
        <p className="text-muted-foreground mt-1 text-base">Great work today 🎉</p>
      </div>

      {loading ? (
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      ) : route ? (
        <div className="w-full max-w-sm bg-card rounded-2xl shadow-sm border divide-y text-left">
          <StatRow label="Deliveries" value={`${deliveredCount} stops`} />
          <StatRow
            label="Partial returns"
            value={
              partialReturns > 0
                ? `${partialReturns} order${partialReturns > 1 ? "s" : ""}`
                : "None"
            }
            valueClass={partialReturns > 0 ? "text-orange-600" : "text-green-600"}
          />
          {fullReturns > 0 && (
            <StatRow label="Full returns" value={`${fullReturns}`} valueClass="text-red-600" />
          )}
          <StatRow
            label="Total collected"
            value={formatPrice(totalCollected)}
            valueClass="text-primary font-mono text-xl font-bold"
          />
          {durationMin != null && <StatRow label="Time" value={formatDuration(durationMin)} />}
          {route.totalDistanceKm != null && (
            <StatRow label="Distance" value={`${Number(route.totalDistanceKm).toFixed(1)} km`} />
          )}
        </div>
      ) : null}

      {/* Stop-by-stop summary */}
      {route && route.stops.length > 0 && (
        <div className="w-full max-w-sm space-y-2 max-h-60 overflow-y-auto text-left">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Stop Summary
          </p>
          {route.stops.map((stop) => {
            const shopName = stop.order.shop?.name ?? "Shop";
            const statusLabel =
              stop.status === "COMPLETED"
                ? "Delivered"
                : stop.status === "PARTIAL_RETURN"
                  ? "Partial return"
                  : stop.status === "FULL_RETURN"
                    ? "Full return"
                    : stop.status === "SKIPPED"
                      ? "Skipped"
                      : stop.status;
            return (
              <div
                key={stop.id}
                className="flex justify-between items-center text-sm border rounded-lg px-3 py-2 bg-card"
              >
                <span className="font-medium truncate mr-3">{shopName}</span>
                <span
                  className={cn(
                    "font-semibold shrink-0",
                    stop.status === "COMPLETED" && "text-green-600",
                    stop.status === "PARTIAL_RETURN" && "text-amber-600",
                    stop.status === "FULL_RETURN" && "text-red-500",
                    stop.status === "SKIPPED" && "text-gray-400"
                  )}
                >
                  {statusLabel}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <a
        href="/driver"
        className="h-14 px-10 rounded-full bg-primary text-primary-foreground text-lg font-semibold flex items-center justify-center shadow-md active:scale-95 transition-transform"
      >
        Back to Home
      </a>
    </div>
  );
}

function StatRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className={`font-semibold text-base ${valueClass ?? ""}`}>{value}</span>
    </div>
  );
}

export default function DonePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      }
    >
      <SummaryContent />
    </Suspense>
  );
}
