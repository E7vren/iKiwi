"use client";

import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  Download,
  Filter,
  Search,
  X,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllStock, getStockMovements } from "@/server/actions/inventory";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Movement = Awaited<ReturnType<typeof getStockMovements>>[number];

// ─── Helpers ────────────────────────────────────────────────────────────────────

const MOVEMENT_LABELS: Record<string, string> = {
  INITIAL_STOCK:   "Initial Stock",
  RESTOCK:         "Restock",
  ADJUSTMENT:      "Adjustment",
  WASTE:           "Waste",
  THEFT:           "Theft",
  COUNT_CORRECTION:"Count Correction",
  RESERVED:        "Reserved",
  RELEASED:        "Released",
  CONSUMED:        "Consumed",
  RETURN:          "Return",
};

const MOVEMENT_COLORS: Record<string, string> = {
  INITIAL_STOCK:   "bg-blue-100 text-blue-700",
  RESTOCK:         "bg-green-100 text-green-700",
  ADJUSTMENT:      "bg-gray-100 text-gray-700",
  WASTE:           "bg-red-100 text-red-700",
  THEFT:           "bg-red-100 text-red-700",
  COUNT_CORRECTION:"bg-purple-100 text-purple-700",
  RESERVED:        "bg-amber-100 text-amber-700",
  RELEASED:        "bg-sky-100 text-sky-700",
  CONSUMED:        "bg-orange-100 text-orange-700",
  RETURN:          "bg-teal-100 text-teal-700",
};

const POSITIVE_TYPES = new Set(["INITIAL_STOCK", "RESTOCK", "ADJUSTMENT", "COUNT_CORRECTION", "RELEASED", "RETURN"]);

function fmtDelta(type: string, kg: number | null, pieces: number | null) {
  const parts: string[] = [];
  if (kg !== null && kg !== 0) parts.push(`${kg > 0 ? "+" : ""}${kg.toFixed(1)} kg`);
  if (pieces !== null && pieces !== 0) parts.push(`${pieces > 0 ? "+" : ""}${pieces} pcs`);
  return parts.join(" / ") || "—";
}

function deltaColor(type: string, kg: number | null, pieces: number | null) {
  const anyPositive =
    (kg != null && kg > 0) || (pieces != null && pieces > 0);
  const anyNegative =
    (kg != null && kg < 0) || (pieces != null && pieces < 0);

  if (["RESERVED"].includes(type)) return "text-amber-600";
  if (["CONSUMED", "WASTE", "THEFT"].includes(type)) return "text-red-600";
  if (anyPositive) return "text-green-700";
  if (anyNegative) return "text-red-600";
  return "text-muted-foreground";
}

// ─── CSV Export ──────────────────────────────────────────────────────────────────

function exportCsv(movements: Movement[]) {
  const header = ["Date", "Product", "Category", "Type", "Delta (kg)", "Delta (pcs)", "Balance (kg)", "Balance (pcs)", "By", "Role", "Reason", "Note"];
  const rows = movements.map((m) => [
    format(new Date(m.createdAt), "yyyy-MM-dd HH:mm"),
    m.stockItem.product.name,
    m.stockItem.product.category?.nameEn ?? "",
    m.type,
    m.deltaKg    != null ? Number(m.deltaKg).toFixed(2)    : "",
    m.deltaPieces != null ? String(m.deltaPieces)           : "",
    m.newBalanceKg    != null ? Number(m.newBalanceKg).toFixed(2) : "",
    m.newBalancePieces != null ? String(m.newBalancePieces)        : "",
    m.warehouseStaff?.fullName ?? m.performedByRole,
    m.performedByRole,
    m.reason ?? "",
    m.note    ?? "",
  ]);

  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${v}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `stock-history-${format(new Date(), "yyyyMMdd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Page ───────────────────────────────────────────────────────────────────

const MOVEMENT_TYPES = Object.keys(MOVEMENT_LABELS);

export default function StockHistoryPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  function handleTypeChange(v: string | null)    { setTypeFilter(v ?? "all"); }
  function handleProductChange(v: string | null) { setProductFilter(v ?? "all"); }

  const { data: movements, isLoading } = useQuery({
    queryKey: ["stock-movements"],
    queryFn:  () => getStockMovements({ limit: 500 }),
    refetchInterval: 60_000,
  });

  const { data: stock } = useQuery({
    queryKey: ["admin-stock"],
    queryFn:  () => getAllStock(),
  });

  const products = stock ?? [];

  const filtered = (movements ?? []).filter((m) => {
    if (typeFilter    !== "all" && m.type !== typeFilter)                        return false;
    if (productFilter !== "all" && m.stockItem.productId !== productFilter)      return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !m.stockItem.product.name.toLowerCase().includes(q) &&
        !(m.reason ?? "").toLowerCase().includes(q) &&
        !(m.note ?? "").toLowerCase().includes(q) &&
        !(m.warehouseStaff?.fullName ?? "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Stock History</h1>
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stock History</h1>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => filtered.length > 0 && exportCsv(filtered)}
          disabled={filtered.length === 0}
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product, reason, staff..."
            className="pl-8 h-9 text-sm"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-2.5">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        <Select value={typeFilter} onValueChange={handleTypeChange}>
          <SelectTrigger className="h-9 w-auto min-w-[160px] text-sm">
            <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {MOVEMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{MOVEMENT_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={productFilter} onValueChange={handleProductChange}>
          <SelectTrigger className="h-9 w-auto min-w-[180px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.productId} value={p.productId}>{p.product.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(search || typeFilter !== "all" || productFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground"
            onClick={() => { setSearch(""); setTypeFilter("all"); setProductFilter("all"); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/50 text-xs text-muted-foreground">
                <th className="text-left px-5 py-2.5 font-medium">Time</th>
                <th className="text-left px-3 py-2.5 font-medium">Product</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="text-right px-3 py-2.5 font-medium">Delta</th>
                <th className="text-right px-3 py-2.5 font-medium">New Balance</th>
                <th className="text-left px-3 py-2.5 font-medium">By</th>
                <th className="text-left px-3 py-2.5 font-medium">Reason / Note</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    No movements found
                  </td>
                </tr>
              )}
              {filtered.map((m) => {
                const kg     = m.deltaKg     != null ? Number(m.deltaKg)     : null;
                const pieces = m.deltaPieces != null ? m.deltaPieces         : null;
                const color  = deltaColor(m.type, kg, pieces);

                return (
                  <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap">
                      <p className="font-medium tabular-nums">
                        {format(new Date(m.createdAt), "dd MMM HH:mm")}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium">{m.stockItem.product.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {m.stockItem.product.category?.nameEn ?? ""}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        className={`${MOVEMENT_COLORS[m.type] ?? "bg-gray-100 text-gray-700"} border-0 text-xs`}
                      >
                        {MOVEMENT_LABELS[m.type] ?? m.type}
                      </Badge>
                    </td>
                    <td className={`px-3 py-3 text-right tabular-nums font-medium ${color}`}>
                      {fmtDelta(m.type, kg, pieces)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {m.newBalanceKg     != null ? `${Number(m.newBalanceKg).toFixed(1)} kg`  : ""}
                      {m.newBalanceKg != null && m.newBalancePieces != null ? " / " : ""}
                      {m.newBalancePieces != null ? `${m.newBalancePieces} pcs` : ""}
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-xs">
                        {m.warehouseStaff?.fullName ?? m.performedByRole.replace(/_/g, " ").toLowerCase()}
                      </p>
                    </td>
                    <td className="px-3 py-3 max-w-[220px]">
                      {m.reason && <p className="text-xs truncate">{m.reason}</p>}
                      {m.note   && <p className="text-xs text-muted-foreground truncate">{m.note}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="border-t px-5 py-2.5 text-xs text-muted-foreground">
            Showing {filtered.length} movement{filtered.length !== 1 ? "s" : ""}
          </div>
        )}
      </Card>
    </div>
  );
}
