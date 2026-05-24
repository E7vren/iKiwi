"use client";

import { ChevronRight, Loader2, MapPin, Navigation, Package } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getPusherClient } from "@/lib/pusherClient";
import { cn, formatPrice } from "@/lib/utils";
import { arriveAtStop } from "@/server/actions/delivery";
import { getMyRoutes, startRoute } from "@/server/actions/routes";
import { useDriverCtx } from "../DriverShell";

type RouteData = Awaited<ReturnType<typeof getMyRoutes>>[number];

function distKmLabel(km: number | null): string {
  if (km == null) return "";
  return `${Number(km).toFixed(1)} km`;
}

// ─── State A ─────────────────────────────────────────────────────────────────
function OfflineState({ onGoOnline }: { onGoOnline: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-6 text-center">
      <div className="text-7xl select-none">😴</div>
      <div>
        <h2 className="text-2xl font-bold">You&apos;re Offline</h2>
        <p className="text-muted-foreground mt-1.5 text-base">
          Toggle online to receive deliveries
        </p>
      </div>
      <button
        type="button"
        onClick={onGoOnline}
        className="h-14 px-10 rounded-full bg-primary text-white text-lg font-semibold shadow-md active:scale-95 transition-transform"
      >
        Go Online
      </button>
    </div>
  );
}

// ─── State B ─────────────────────────────────────────────────────────────────
function WaitingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-5 px-6 text-center">
      <Loader2 className="h-12 w-12 text-primary animate-spin" />
      <div>
        <h2 className="text-xl font-bold">Waiting for Route…</h2>
        <p className="text-muted-foreground mt-1.5">iKiwi will assign you a route shortly</p>
      </div>
    </div>
  );
}

// ─── State C ─────────────────────────────────────────────────────────────────
function RouteReadyState({
  route,
  onStart,
  starting,
}: {
  route: RouteData;
  onStart: () => void;
  starting: boolean;
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Summary card */}
      <div className="bg-white rounded-2xl shadow-sm border p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-bold text-lg">Today&apos;s Route</p>
            <p className="text-muted-foreground text-sm">
              {route.stops.length} stops
              {route.estimatedMinutes ? ` · ~${route.estimatedMinutes} min` : ""}
              {route.totalDistanceKm ? ` · ${distKmLabel(Number(route.totalDistanceKm))}` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          className="w-full h-14 rounded-xl bg-primary text-white text-lg font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : "▶  Start Route"}
        </button>
      </div>

      {/* Stop preview list */}
      <div className="bg-white rounded-2xl shadow-sm border divide-y">
        {route.stops.map((stop, i) => (
          <div key={stop.id} className="flex items-center px-4 py-3.5 gap-3">
            <span className="h-7 w-7 rounded-full bg-gray-100 text-gray-500 text-sm font-bold flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <p className="flex-1 font-medium text-sm truncate">{stop.order.shop.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── State D ─────────────────────────────────────────────────────────────────
function RouteInProgressState({
  route,
  onArrive,
  arriving,
}: {
  route: RouteData;
  onArrive: (stopId: string) => void;
  arriving: boolean;
}) {
  const completedCount = route.stops.filter((s) =>
    ["COMPLETED", "PARTIAL_RETURN", "FULL_RETURN", "SKIPPED"].includes(s.status)
  ).length;
  const totalCount = route.stops.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const currentStop = route.stops.find((s) =>
    ["PENDING", "ARRIVED", "VERIFYING"].includes(s.status)
  );
  const remainingStops = route.stops.filter(
    (s) => s !== currentStop && ["PENDING"].includes(s.status)
  );

  const shop = currentStop?.order.shop;
  const mapsUrl = shop
    ? `https://maps.google.com/maps?daddr=${shop.latitude},${shop.longitude}`
    : null;

  if (!currentStop) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <div className="text-6xl">🎉</div>
        <h2 className="text-xl font-bold">All stops done!</h2>
        <a
          href={`/driver/done?routeId=${route.id}`}
          className="h-14 px-8 rounded-full bg-primary text-white font-bold text-lg flex items-center justify-center"
        >
          View Summary
        </a>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm font-medium">
          <span className="text-muted-foreground">
            Stop {completedCount + 1} of {totalCount}
          </span>
          <span className="text-primary">{Math.round(progress)}% done</span>
        </div>
        <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current stop card */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="bg-primary/5 border-b px-4 py-2.5 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-primary">Current Stop</span>
        </div>
        <div className="p-4 space-y-3">
          <h2 className="text-xl font-bold">{shop?.name}</h2>
          <p className="text-muted-foreground text-sm">{shop?.address}</p>

          <a
            href={`tel:${shop?.phone}`}
            className="flex items-center gap-2 text-primary font-semibold text-base"
          >
            📞 {shop?.phone}
          </a>

          <div className="flex gap-2 text-sm text-muted-foreground">
            <span>🛒 {currentStop.order.items.length} items</span>
            <span>·</span>
            <span className="font-mono">
              💰{" "}
              {formatPrice(
                Number(currentStop.order.actualTotal ?? currentStop.order.estimatedTotal)
              )}
            </span>
          </div>

          <div className="flex gap-3 pt-1">
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 h-12 rounded-xl border-2 border-primary text-primary font-semibold text-base flex items-center justify-center gap-2 active:bg-primary/5"
              >
                <Navigation className="h-5 w-5" />
                Navigate
              </a>
            )}
            <button
              type="button"
              onClick={() => onArrive(currentStop.id)}
              disabled={arriving}
              className={cn(
                "flex-1 h-12 rounded-xl bg-primary text-white font-bold text-base flex items-center justify-center gap-2",
                "active:scale-[0.98] transition-transform disabled:opacity-60",
                mapsUrl ? "" : "w-full"
              )}
            >
              {arriving ? <Loader2 className="h-5 w-5 animate-spin" /> : "📍  I've Arrived"}
            </button>
          </div>
        </div>
      </div>

      {/* Remaining stops */}
      {remainingStops.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border divide-y">
          <p className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Next stops
          </p>
          {remainingStops.map((stop) => (
            <div key={stop.id} className="flex items-center px-4 py-3.5 gap-3">
              <span className="h-7 w-7 rounded-full bg-gray-100 text-gray-500 text-sm font-bold flex items-center justify-center shrink-0">
                {stop.sequence}
              </span>
              <p className="flex-1 font-medium text-sm truncate">{stop.order.shop.name}</p>
              <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function DriverPage() {
  const { isOnline, setOnline } = useDriverCtx();
  const { data: session } = useSession();
  const router = useRouter();
  const [route, setRoute] = useState<RouteData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [starting, setStarting] = useState(false);
  const [arriving, setArriving] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRoute = useCallback(async () => {
    setFetching(true);
    const routes = await getMyRoutes();
    const active = routes.find((r) => r.status === "PLANNED" || r.status === "IN_PROGRESS") ?? null;
    setRoute(active);
    setFetching(false);
    return active;
  }, []);

  // Fetch on mount and whenever online status changes
  useEffect(() => {
    if (!isOnline) {
      setRoute(null);
      return;
    }
    fetchRoute();

    // Poll every 30 s while waiting for a route assignment (state B)
    pollRef.current = setInterval(async () => {
      const r = await fetchRoute();
      if (r) clearInterval(pollRef.current ?? undefined);
    }, 30_000);

    return () => clearInterval(pollRef.current ?? undefined);
  }, [isOnline, fetchRoute]);

  // Pusher: instant route-assigned notification
  useEffect(() => {
    const staffId = session?.user?.staffId;
    if (!staffId || !isOnline) return;
    const pc = getPusherClient();
    if (!pc) return;
    const ch = pc.subscribe(`private-driver-${staffId}`);
    ch.bind("route-assigned", (data: { stopCount: number }) => {
      toast(`🗺️ New route assigned: ${data.stopCount} stops`);
      fetchRoute();
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    });
    return () => {
      ch.unbind_all();
      pc.unsubscribe(`private-driver-${staffId}`);
    };
  }, [session?.user?.staffId, isOnline, fetchRoute]);

  async function handleStart() {
    if (!route) return;
    setStarting(true);
    const result = await startRoute(route.id);
    if (result.success) {
      if ("vibrate" in navigator) navigator.vibrate(50);
      await fetchRoute();
    } else {
      toast.error(result.error ?? "Failed to start route");
    }
    setStarting(false);
  }

  async function handleArrive(stopId: string) {
    setArriving(true);
    const result = await arriveAtStop({ stopId });
    if (result.success) {
      if ("vibrate" in navigator) navigator.vibrate([50, 50, 50]);
      router.push(`/driver/stop/${stopId}`);
    } else {
      toast.error(result.error ?? "Failed to update stop");
      setArriving(false);
    }
  }

  if (!isOnline) return <OfflineState onGoOnline={() => setOnline(true)} />;
  if (fetching && !route) return <WaitingState />;
  if (!route) return <WaitingState />;
  if (route.status === "PLANNED") {
    return <RouteReadyState route={route} onStart={handleStart} starting={starting} />;
  }
  if (route.status === "IN_PROGRESS") {
    return <RouteInProgressState route={route} onArrive={handleArrive} arriving={arriving} />;
  }
  if (route.status === "COMPLETED") {
    router.replace(`/driver/done?routeId=${route.id}`);
    return null;
  }
  return <WaitingState />;
}
