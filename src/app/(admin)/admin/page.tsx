"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ClipboardList,
  Clock,
  Store,
  TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    weekRevenue: { day: string; revenue: number }[];
    monthRevenue: { day: string; revenue: number }[];
  }>;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}


function TrendBadge({ value }: { value: number }) {
  if (value === 0) return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      <Minus className="h-3 w-3" /> 0%
    </span>
  );
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
      up ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
         : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
    }`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value)}%
    </span>
  );
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  iconBg,
  trend,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconBg?: string;
  trend?: number;
}) {
  return (
    <Card className="border border-border/60 shadow-[0px_4px_20px_rgba(0,0,0,0.05)]">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${iconBg ?? "bg-foreground/8"}`}>
            <Icon className="h-5 w-5 text-foreground" />
          </div>
          {trend !== undefined && <TrendBadge value={trend} />}
        </div>
        <p className="text-label-md text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
        <p className="text-data-display leading-none">{value}</p>
        {sub && <p className="text-label-md text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-xs">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-primary font-bold mt-0.5">{formatPrice(payload[0].value)} UZS</p>
      </div>
    );
  }
  return null;
};

export default function AdminDashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [chartPeriod, setChartPeriod] = useState<"week" | "month">("week");

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
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {(["a", "b", "c", "d"] as const).map((k) => (
            <Skeleton key={k} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Skeleton className="h-80 rounded-xl xl:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const orderTrend = data.yesterdayOrders > 0
    ? Math.round(((data.todayOrders - data.yesterdayOrders) / data.yesterdayOrders) * 100)
    : 0;
  const chartData = chartPeriod === "week" ? data.weekRevenue : data.monthRevenue;
  const adminName = session?.user?.name?.split(" ")[0] ?? "Admin";

  return (
    <div className="space-y-6">
      {/* Greeting row */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-headline-lg">{getGreeting()}, {adminName}</h1>
          <p className="text-body-md text-muted-foreground mt-0.5">
            Here is what&apos;s happening with your operations today.
          </p>
        </div>
      </div>

      {/* Prices alert */}
      {!data.pricesSetToday && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between w-full">
            <span className="text-amber-800 dark:text-amber-300 font-medium">
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

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          title="Today's Orders"
          value={data.todayOrders}
          sub={`vs ${data.yesterdayOrders} yesterday`}
          icon={ClipboardList}
          iconBg="bg-blue-100 dark:bg-blue-900/40"
          trend={orderTrend}
        />
        <StatCard
          title="Pending"
          value={data.pendingOrders}
          sub="need attention"
          icon={Clock}
          iconBg={data.pendingOrders > 0 ? "bg-orange-100 dark:bg-orange-900/40" : "bg-green-100 dark:bg-green-900/40"}
          trend={0}
        />
        <StatCard
          title="Active Shops"
          value={data.activeShops}
          sub={`of ${data.totalShops} total`}
          icon={Store}
          iconBg="bg-primary/15"
          trend={3}
        />
        <StatCard
          title="Revenue"
          value={`${formatPrice(data.revenue)}`}
          sub="UZS today"
          icon={TrendingUp}
          iconBg="bg-primary/15"
          trend={24}
        />
      </div>

      {/* Main 2-col layout */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left: Revenue chart + financial summary */}
        <div className="space-y-6 xl:col-span-2">
          <Card className="border border-border/60 shadow-[0px_4px_20px_rgba(0,0,0,0.05)]">
            <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-border/60">
              <div>
                <p className="text-headline-sm">Revenue Overview</p>
                <p className="text-body-md text-muted-foreground mt-0.5">Daily performance across all shops</p>
              </div>
              <div className="flex rounded-lg border border-border overflow-hidden text-label-md">
                <button
                  type="button"
                  onClick={() => setChartPeriod("week")}
                  className={`px-3 py-1.5 transition-colors ${chartPeriod === "week" ? "bg-muted text-foreground font-semibold" : "text-muted-foreground hover:bg-muted/50"}`}
                >Week</button>
                <button
                  type="button"
                  onClick={() => setChartPeriod("month")}
                  className={`px-3 py-1.5 transition-colors ${chartPeriod === "month" ? "bg-muted text-foreground font-semibold" : "text-muted-foreground hover:bg-muted/50"}`}
                >Month</button>
              </div>
            </div>
            <div className="px-2 pt-4 pb-2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#98d62d" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#98d62d" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#98d62d"
                    strokeWidth={2.5}
                    fill="url(#revenueGrad)"
                    dot={{ r: 4, fill: "#98d62d", strokeWidth: 2, stroke: "var(--color-card)" }}
                    activeDot={{ r: 6, fill: "#98d62d" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Financial summary row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Revenue", value: formatPrice(data.revenue), sub: "collected from shops", color: "text-foreground" },
              { label: "Cost",    value: data.cogsKnown ? formatPrice(data.cogs) : "—", sub: data.cogsKnown ? "paid to suppliers" : "set supplier prices", color: "text-red-600 dark:text-red-400" },
              { label: "Profit",  value: data.cogsKnown ? formatPrice(data.profit) : "—", sub: data.cogsKnown && data.marginPct != null ? `${data.marginPct.toFixed(1)}% margin` : "revenue − cost", color: data.cogsKnown ? (data.profit >= 0 ? "text-primary" : "text-red-600") : "text-muted-foreground" },
            ].map(({ label, value, sub, color }) => (
              <Card key={label} className="border border-border/60 shadow-[0px_4px_20px_rgba(0,0,0,0.05)]">
                <CardContent className="pt-4 pb-4 px-4">
                  <p className="text-label-md text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                  <p className={`text-headline-md tabular-nums ${color}`}>{value}</p>
                  <p className="text-label-md text-muted-foreground mt-0.5">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pending orders quick list */}
          {data.pendingOrdersList.length > 0 && (
            <Card className="border border-border/60 shadow-[0px_4px_20px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <p className="text-headline-sm">Pending Orders</p>
                  <Badge className="bg-orange-100 text-orange-700 border-0 dark:bg-orange-900/40 dark:text-orange-400">
                    {data.pendingOrdersList.length}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => router.push("/admin/orders")}>
                  View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
              <div className="divide-y divide-border/60">
                {data.pendingOrdersList.map((o) => (
                  <div key={o.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-label-lg truncate">{o.shopName}</p>
                      <p className="text-label-md text-muted-foreground">
                        {o.itemCount} items · {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <p className="text-label-lg text-primary shrink-0 font-bold">{formatPrice(o.estimatedTotal)}</p>
                    <Button
                      size="sm"
                      className="shrink-0 h-7 text-xs"
                      onClick={() => startPreparing(o.id)}
                    >
                      Start
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right sidebar: recent orders */}
        <div className="space-y-6">
          <Card className="border border-border/60 shadow-[0px_4px_20px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
              <p className="text-headline-sm">Recent Orders</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary text-label-md h-auto p-0"
                onClick={() => router.push("/admin/orders")}
              >
                View All
              </Button>
            </div>
            <div className="divide-y divide-border/60">
              {!data?.recentOrders?.length ? (
                <p className="py-10 text-center text-body-md text-muted-foreground">No orders yet</p>
              ) : (
                data.recentOrders.map((o) => (
                  <div key={o.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Store className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-label-lg truncate">{o.shopName}</p>
                      <p className="text-label-md text-muted-foreground">
                        {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-label-lg font-bold text-primary">{formatPrice(o.estimatedTotal)}</p>
                      <Badge className={`${getStatusColor(o.status)} text-[10px] mt-0.5`}>
                        {getStatusLabel(o.status)}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Quick stats summary */}
          <Card className="border border-border/60 shadow-[0px_4px_20px_rgba(0,0,0,0.05)]">
            <div className="px-5 py-3.5 border-b border-border/60">
              <p className="text-headline-sm">Live Updates</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-body-md text-muted-foreground">Total products</span>
                <span className="text-label-lg font-bold">{data.totalProducts}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body-md text-muted-foreground">Total shops</span>
                <span className="text-label-lg font-bold">{data.totalShops}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body-md text-muted-foreground">Active shops</span>
                <span className="text-label-lg font-bold text-primary">{data.activeShops}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body-md text-muted-foreground">Prices set today</span>
                <Badge className={data.pricesSetToday ? "bg-green-100 text-green-700 border-0" : "bg-red-100 text-red-700 border-0"}>
                  {data.pricesSetToday ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
