"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Map as MapIcon,
  MapPin,
  Minus,
  Navigation,
  Package,
  Plus,
  RefreshCw,
  Truck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { RouteMap, type RouteMapData } from "@/components/admin/RouteMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cancelRoute, getRoutePlanningData } from "@/server/actions/admin-routes";
import { assignRouteToDriver, generateRoutes } from "@/server/actions/routes";

type PlanningData = Awaited<ReturnType<typeof getRoutePlanningData>>;
type RouteRow = PlanningData["routes"][number];

const ROUTE_COLORS = [
  "#2e7d32", "#1565c0", "#e65100", "#6a1b9a",
  "#c62828", "#00695c", "#f57f17", "#283593",
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PLANNED:     { label: "Planned",     cls: "bg-blue-100 text-blue-700" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-emerald-100 text-emerald-700" },
  COMPLETED:   { label: "Completed",   cls: "bg-gray-100 text-gray-600" },
  CANCELLED:   { label: "Cancelled",   cls: "bg-red-100 text-red-600" },
};

const VEHICLE_ICON: Record<string, string> = {
  MOTORCYCLE: "🏍️",
  CAR:        "🚗",
  VAN:        "🚐",
  TRUCK:      "🚚",
};

const DONE_STATUSES = new Set(["COMPLETED", "PARTIAL_RETURN", "FULL_RETURN", "SKIPPED"]);

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  const clr: Record<string, string> = {
    green:  "bg-green-50 text-green-600",
    blue:   "bg-blue-50 text-blue-600",
    orange: "bg-orange-50 text-orange-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${clr[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function RouteCard({
  route,
  index,
  allStaff,
  onAssign,
  onCancel,
  assigningId,
  cancellingId,
  isSelected,
  onSelect,
}: {
  route: RouteRow;
  index: number;
  allStaff: PlanningData["allStaff"];
  onAssign: (routeId: string, staffId: string) => void;
  onCancel: (routeId: string) => void;
  assigningId: string | null;
  cancellingId: string | null;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
}) {
  const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
  const badge = STATUS_BADGE[route.status] ?? { label: route.status, cls: "bg-gray-100 text-gray-600" };

  const dist = route.totalDistanceKm != null
    ? `${Number(route.totalDistanceKm).toFixed(1)} km`
    : null;
  const eta = route.estimatedMinutes != null
    ? route.estimatedMinutes >= 60
      ? `~${Math.floor(route.estimatedMinutes / 60)}h ${route.estimatedMinutes % 60}min`
      : `~${route.estimatedMinutes}min`
    : null;

  return (
    <div
      className={`rounded-xl bg-white shadow-sm overflow-hidden transition-all ${
        isSelected ? "ring-2 ring-offset-1" : "border border-gray-100"
      }`}
      style={isSelected ? { outlineColor: color } : {}}
    >
      <div className="h-1.5 w-full" style={{ background: color }} />
      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm">Route {index + 1}</span>
              <Badge className={`text-xs border-0 ${badge.cls}`}>{badge.label}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{route.stops.length} stops</span>
              {dist && <span>{dist}</span>}
              {eta && (
                <span className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  {eta}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2"
              onClick={() => onSelect(isSelected ? null : route.id)}
            >
              <MapIcon className="h-3 w-3 mr-1" />
              {isSelected ? "Deselect" : "Map"}
            </Button>
            {route.status === "PLANNED" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0 text-destructive border-destructive/30 hover:bg-destructive/5"
                disabled={cancellingId === route.id}
                onClick={() => onCancel(route.id)}
              >
                {cancellingId === route.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Driver assignment */}
        {route.status === "PLANNED" && (
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Select
              value={route.staff?.id ?? ""}
              onValueChange={(val) => val && onAssign(route.id, val)}
              disabled={assigningId === route.id}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                {assigningId === route.id ? (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Assigning…</span>
                  </div>
                ) : (
                  <SelectValue placeholder="Assign driver…" />
                )}
              </SelectTrigger>
              <SelectContent>
                {allStaff.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    <span className="mr-1">{VEHICLE_ICON[s.vehicleType]}</span>
                    {s.fullName}
                    {s.routes.length > 0 && (
                      <span className="ml-1 text-orange-500 text-[10px]">(has route)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {route.status === "IN_PROGRESS" && route.staff && (
          <div className="flex items-center gap-2 text-sm">
            <Navigation className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span className="font-medium">
              {VEHICLE_ICON[route.staff.vehicleType]} {route.staff.fullName}
            </span>
            <span className="text-xs text-emerald-600 font-medium">live</span>
          </div>
        )}

        {(route.status === "COMPLETED" || route.status === "CANCELLED") && route.staff && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />
            {VEHICLE_ICON[route.staff.vehicleType]} {route.staff.fullName}
          </p>
        )}

        {/* Stops preview */}
        <div className="space-y-1">
          {route.stops.slice(0, 4).map((stop) => {
            const done = DONE_STATUSES.has(stop.status);
            return (
              <div key={stop.id} className="flex items-center gap-2 text-xs">
                <span
                  className="h-5 w-5 rounded-full flex items-center justify-center font-bold text-white text-[10px] shrink-0"
                  style={{ background: done ? "#9ca3af" : color }}
                >
                  {stop.sequence}
                </span>
                <span className={`truncate ${done ? "line-through text-muted-foreground" : ""}`}>
                  {stop.order.shop.name}
                </span>
                {stop.status !== "PENDING" && (
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {stop.status.toLowerCase().replace(/_/g, " ")}
                  </span>
                )}
              </div>
            );
          })}
          {route.stops.length > 4 && (
            <p className="text-xs text-muted-foreground pl-7">
              +{route.stops.length - 4} more stops
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminRoutesPage() {
  const [date, setDate] = useState(() => toDateStr(new Date()));
  const [data, setData] = useState<PlanningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Generate dialog
  const [genOpen, setGenOpen] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [allSelected, setAllSelected] = useState(true);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [driverCount, setDriverCount] = useState(2);
  const [optMode, setOptMode] = useState<"DISTANCE" | "TIME" | "BALANCED">("BALANCED");

  // Map
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [showDrivers, setShowDrivers] = useState(true);

  // Per-route loading states
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      try {
        const d = await getRoutePlanningData(date);
        setData(d);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [date]
  );

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(true), 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  // Pusher subscription for live route events
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import("@/lib/pusherClient").then(({ getPusherClient }) => {
      const pc = getPusherClient();
      if (!pc) return;
      const ch = pc.subscribe("admin-routes");
      ch.bind("route-update", () => load(true));
      cleanup = () => {
        ch.unbind_all();
        pc.unsubscribe("admin-routes");
      };
    });
    return () => cleanup?.();
  }, [load]);

  function openGenDialog() {
    if (!data) return;
    setAllSelected(true);
    setSelectedOrderIds(new Set(data.readyOrders.map((o) => o.id)));
    setDriverCount(
      Math.max(1, Math.min(data.allStaff.length || 1, Math.ceil(data.readyOrders.length / 6)))
    );
    setOptMode("BALANCED");
    setGenOpen(true);
  }

  async function handleGenerate() {
    setGenLoading(true);
    const orderIds = allSelected ? undefined : [...selectedOrderIds];
    if (!allSelected && selectedOrderIds.size === 0) {
      toast.error("Select at least one order");
      setGenLoading(false);
      return;
    }
    const result = await generateRoutes({ date, driverCount, optimizationMode: optMode, orderIds });
    setGenLoading(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success(`${result.data!.count} route${result.data!.count > 1 ? "s" : ""} generated`);
    setGenOpen(false);
    load(true);
  }

  async function handleAssign(routeId: string, staffId: string) {
    setAssigningId(routeId);
    const result = await assignRouteToDriver({ routeId, staffId });
    setAssigningId(null);
    if (!result.success) toast.error(result.error);
    else { toast.success("Driver assigned and notified"); load(true); }
  }

  async function handleCancel(routeId: string) {
    setCancellingId(routeId);
    const result = await cancelRoute(routeId);
    setCancellingId(null);
    if (!result.success) toast.error(result.error);
    else { toast.success("Route cancelled"); load(true); }
  }

  function toggleOrder(id: string) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Derived stats
  const readyCount = data?.readyOrders.length ?? 0;
  const activeRoutes = data?.routes.filter((r) => r.status !== "CANCELLED") ?? [];
  const availableDrivers = data?.allStaff.filter((s) => s.routes.length === 0).length ?? 0;
  const totalDrivers = data?.allStaff.length ?? 0;
  const avgStops = activeRoutes.length
    ? Math.round(activeRoutes.reduce((sum, r) => sum + r.stops.length, 0) / activeRoutes.length)
    : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRoutes = (data?.routes ?? []) as any as RouteMapData[];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Delivery Routes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Plan and monitor daily deliveries</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs"
            onClick={() => setDate(toDateStr(new Date()))}
          >
            Today
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 w-9 p-0"
            onClick={() => load(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="sm"
            className="h-9 bg-primary hover:bg-primary/90"
            onClick={openGenDialog}
            disabled={loading || readyCount === 0}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Generate Routes
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Ready Orders"
          value={loading ? "…" : readyCount}
          icon={Package}
          color="orange"
        />
        <StatCard
          title="Available Drivers"
          value={loading ? "…" : `${availableDrivers}/${totalDrivers}`}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Routes Today"
          value={loading ? "…" : activeRoutes.length}
          icon={Truck}
          color="green"
        />
        <StatCard
          title="Avg Stops"
          value={loading ? "…" : avgStops || "—"}
          icon={MapPin}
          color="purple"
        />
      </div>

      {/* Map toggle */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          onClick={() => setMapOpen((o) => !o)}
        >
          <div className="flex items-center gap-2">
            <MapIcon className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Route Map</span>
            {activeRoutes.length > 0 && (
              <Badge className="bg-primary/10 text-primary border-0 text-xs">
                {activeRoutes.length} active
              </Badge>
            )}
            {selectedRouteId && (
              <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">filtered</Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            {mapOpen && (
              <>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDrivers((v) => !v);
                  }}
                >
                  {showDrivers ? "Hide drivers" : "Show drivers"}
                </button>
                {selectedRouteId && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRouteId(null);
                    }}
                  >
                    Show all routes
                  </button>
                )}
              </>
            )}
            {mapOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
        {mapOpen && (
          <div className="h-96 border-t">
            <RouteMap
              routes={mapRoutes}
              selectedRouteId={selectedRouteId}
              showDrivers={showDrivers}
            />
          </div>
        )}
      </div>

      {/* Routes list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !data?.routes.length ? (
        <div className="rounded-xl border border-dashed bg-white py-16 text-center">
          <Truck className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium text-gray-700">No routes for this date</p>
          <p className="text-sm text-muted-foreground mt-1">
            {readyCount > 0
              ? `${readyCount} ready orders waiting — click Generate Routes`
              : "No ready orders to route yet"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.routes.map((route, i) => (
            <RouteCard
              key={route.id}
              route={route}
              index={i}
              allStaff={data.allStaff}
              onAssign={handleAssign}
              onCancel={handleCancel}
              assigningId={assigningId}
              cancellingId={cancellingId}
              isSelected={selectedRouteId === route.id}
              onSelect={(id) => setSelectedRouteId(id)}
            />
          ))}
        </div>
      )}

      {/* Generate dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Routes</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Driver count */}
            <div className="space-y-2">
              <Label>Number of drivers</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  disabled={driverCount <= 1}
                  onClick={() => setDriverCount((n) => Math.max(1, n - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center text-lg font-bold">{driverCount}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  disabled={driverCount >= 20}
                  onClick={() => setDriverCount((n) => Math.min(20, n + 1))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                {data && data.readyOrders.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ≈{Math.ceil((allSelected ? data.readyOrders.length : selectedOrderIds.size) / driverCount)} stops/driver
                  </span>
                )}
              </div>
            </div>

            {/* Optimization mode */}
            <div className="space-y-2">
              <Label>Optimization mode</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["DISTANCE", "TIME", "BALANCED"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setOptMode(mode)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      optMode === mode
                        ? "bg-primary text-white border-primary"
                        : "bg-white border-gray-200 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {mode === "DISTANCE" ? "🛣️ Distance" : mode === "TIME" ? "⏱️ Time" : "⚖️ Balanced"}
                  </button>
                ))}
              </div>
            </div>

            {/* Order selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Orders to include</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    setAllSelected(true);
                    setSelectedOrderIds(new Set(data?.readyOrders.map((o) => o.id) ?? []));
                  }}
                >
                  Select all ({data?.readyOrders.length ?? 0})
                </button>
              </div>
              <div className="max-h-44 overflow-y-auto rounded-lg border divide-y">
                {data?.readyOrders.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">No ready orders</p>
                )}
                {data?.readyOrders.map((order) => {
                  const checked = allSelected || selectedOrderIds.has(order.id);
                  return (
                    <label
                      key={order.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          if (allSelected) {
                            const newSet = new Set(data.readyOrders.map((o) => o.id));
                            newSet.delete(order.id);
                            setSelectedOrderIds(newSet);
                            setAllSelected(false);
                          } else {
                            toggleOrder(order.id);
                          }
                        }}
                        className="rounded accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{order.shop.name}</p>
                        <p className="text-[10px] text-muted-foreground">{order._count.items} items</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)} disabled={genLoading}>
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={handleGenerate}
              disabled={genLoading}
            >
              {genLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Generate {driverCount} Route{driverCount > 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
