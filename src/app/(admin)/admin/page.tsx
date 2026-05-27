"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  ClipboardList,
  Clock,
  Loader2,
  Store,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, getStatusColor, getStatusLabel } from "@/lib/utils";
import { updateOrderStatus } from "@/server/actions/orders";

interface DashboardOrder {
  id: string;
  shopName: string;
  itemCount: number;
  estimatedTotal: number;
  status: string;
  createdAt: string;
}

async function fetchDashboard() {
  const res = await fetch("/api/dashboard");
  if (!res.ok) throw new Error("Failed");
  return res.json() as Promise<{
    todayOrders: number;
    yesterdayOrders: number;
    pendingOrders: number;
    activeShops: number;
    totalShops: number;
    revenue: number;
    cogs: number;
    profit: number;
    marginPct: number | null;
    cogsKnown: boolean;
    pricesSetToday: boolean;
    totalProducts: number;
    pendingOrdersList: DashboardOrder[];
    recentOrders: DashboardOrder[];
  }>;
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  trend?: number;
  color?: string; // kept in type for backward compat with callers, ignored
}) {
  const trendUp   = trend !== undefined && trend >= 0;
  const trendDown = trend !== undefined && trend < 0;

  return (
    <Card className="border-0">
      <CardContent className="flex items-start gap-4 pt-4">
        {/* Charcoal icon square — Design.md: "prominent icon in a charcoal-tinted square" */}
        <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/8 text-foreground">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-label-md text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
          <p className="text-data-display leading-none">{value}</p>
          {sub && (
            <p className="text-label-md text-muted-foreground mt-1 flex items-center gap-1">
              {trendUp   && <TrendingUp   className="h-3.5 w-3.5 text-primary shrink-0" />}
              {trendDown && <TrendingDown className="h-3.5 w-3.5 text-destructive shrink-0" />}
              {sub}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: 30_000,
  });

  async function startPreparing(orderId: string) {
    const result = await updateOrderStatus({ orderId, status: "PREPARING" });
    if (!result.success) toast.error(result.error);
    else {
      toast.success("Order is now being prepared");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["orders", "admin"] });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {(["a", "b", "c", "d"] as const).map((k) => (
            <Skeleton key={k} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const trend = data.todayOrders - data.yesterdayOrders;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button variant="outline" size="sm" onClick={() => router.push("/admin/orders")}>
          All Orders <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>

      {/* Prices alert */}
      {!data.pricesSetToday && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between w-full">
            <span className="text-amber-800 font-medium">
              Today&apos;s prices not set — shops cannot place orders.
            </span>
            <Button
              size="sm"
              className="ml-4 shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => router.push("/admin/prices")}
            >
              Set Prices
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          title="Today's Orders"
          value={data.todayOrders}
          trend={trend}
          sub={trend === 0 ? "vs yesterday" : `vs ${data.yesterdayOrders} yesterday`}
          icon={ClipboardList}
          color="blue"
        />
        <StatCard
          title="Pending"
          value={data.pendingOrders}
          sub="need attention"
          icon={Clock}
          color={data.pendingOrders > 0 ? "orange" : "green"}
        />
        <StatCard
          title="Active Shops"
          value={data.activeShops}
          sub={`of ${data.totalShops} total`}
          icon={Store}
          color="green"
        />
        <StatCard
          title="Revenue"
          value={formatPrice(data.revenue)}
          sub="collected from shops"
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Financial summary */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b py-3 px-5">
          <CardTitle className="text-base font-semibold">Financial Summary</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-3 divide-x">
          <div className="px-5 py-4">
            <p className="text-xs text-muted-foreground mb-1">Revenue</p>
            <p className="text-xl font-bold tabular-nums">{formatPrice(data.revenue)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">collected from shops</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-muted-foreground mb-1">Cost</p>
            <p className="text-xl font-bold tabular-nums text-red-600">
              {data.cogsKnown ? formatPrice(data.cogs) : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {data.cogsKnown ? "paid to suppliers" : "set supplier prices to track"}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-muted-foreground mb-1">Profit</p>
            <p className={`text-xl font-bold tabular-nums ${data.cogsKnown ? (data.profit >= 0 ? "text-green-600" : "text-red-600") : "text-muted-foreground"}`}>
              {data.cogsKnown ? formatPrice(data.profit) : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {data.cogsKnown && data.marginPct != null
                ? `${data.marginPct.toFixed(1)}% margin`
                : "revenue minus cost"}
            </p>
          </div>
        </div>
      </Card>

      {/* Pending orders quick list */}
      {data.pendingOrdersList.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b py-3 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                Pending Orders
                <Badge className="ml-2 bg-orange-100 text-orange-700 border-0">
                  {data.pendingOrdersList.length}
                </Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => router.push("/admin/orders")}>
                View all
              </Button>
            </div>
          </CardHeader>
          <div className="divide-y">
            {data.pendingOrdersList.map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{o.shopName}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.itemCount} items ·{" "}
                    {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <p className="text-sm font-bold text-primary shrink-0">
                  {formatPrice(o.estimatedTotal)}
                </p>
                <Button
                  size="sm"
                  className="shrink-0 h-7 text-xs bg-primary hover:bg-primary/90"
                  onClick={() => startPreparing(o.id)}
                >
                  Start
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent orders */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b py-3 px-5">
          <CardTitle className="text-base font-semibold">Recent Orders</CardTitle>
        </CardHeader>
        <div className="divide-y">
          {!data?.recentOrders?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No orders yet</p>
          ) : (
            data.recentOrders.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-muted/40"
              >
                <div>
                  <p className="text-sm font-medium">{o.shopName}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.itemCount} items ·{" "}
                    {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <div className="text-right">
                  <Badge className={getStatusColor(o.status)}>{getStatusLabel(o.status)}</Badge>
                  <p className="text-sm font-medium mt-1">{formatPrice(o.estimatedTotal)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
