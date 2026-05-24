"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, PackagePlus, Search, ShoppingCart, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getAllStockForStaff,
  warehouseLogIncoming,
  warehouseUpdateStockCount,
} from "@/server/actions/inventory";
import { generateShoppingList } from "@/server/actions/shopping";

// ─── Types ─────────────────────────────────────────────────────────────────────

type StockRow = Awaited<ReturnType<typeof getAllStockForStaff>>[number];

// ─── Helpers ────────────────────────────────────────────────────────────────────

function stockStatus(row: StockRow): "ok" | "low" | "empty" {
  const kgLow =
    row.minStockKg != null &&
    row.availableKg != null &&
    Number(row.availableKg) < Number(row.minStockKg);
  const piecesLow =
    row.minStockPieces != null &&
    row.availablePieces != null &&
    row.availablePieces < row.minStockPieces;
  const hasStock =
    (row.availableKg != null && Number(row.availableKg) > 0) ||
    (row.availablePieces != null && row.availablePieces > 0);

  if (kgLow || piecesLow) return "low";
  if (!hasStock) return "empty";
  return "ok";
}

const STATUS_DOT: Record<string, string> = {
  ok: "bg-green-500",
  low: "bg-amber-400",
  empty: "bg-red-500",
};

const STATUS_LABEL: Record<string, string> = {
  ok: "OK",
  low: "Low",
  empty: "Empty",
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

// ─── Count Dialog ────────────────────────────────────────────────────────────

function CountDialog({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const qc = useQueryClient();
  const isKg = row.product.unitType === "KG" || row.product.unitType === "BOTH";
  const isPiece = row.product.unitType === "PIECE" || row.product.unitType === "BOTH";

  const [kg, setKg] = useState(isKg ? String(fmt(Number(row.availableKg ?? 0))) : "");
  const [pieces, setPieces] = useState(isPiece ? String(row.availablePieces ?? 0) : "");
  const [note, setNote] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      warehouseUpdateStockCount({
        productId: row.productId,
        currentKg: isKg && kg !== "" ? Number(kg) : undefined,
        currentPieces: isPiece && pieces !== "" ? Number(pieces) : undefined,
        note: note || undefined,
      }),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Stock count updated");
      qc.invalidateQueries({ queryKey: ["warehouse-stock"] });
      onClose();
    },
    onError: () => toast.error("Failed to update count"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Set Count — {row.product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Enter the actual quantity currently in the warehouse.
          </p>
          {isKg && (
            <div className="space-y-1.5">
              <Label htmlFor="count-kg">Current kg</Label>
              <Input
                id="count-kg"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={kg}
                onChange={(e) => setKg(e.target.value)}
                placeholder="e.g. 15.5"
              />
            </div>
          )}
          {isPiece && (
            <div className="space-y-1.5">
              <Label htmlFor="count-pcs">Current pieces</Label>
              <Input
                id="count-pcs"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={pieces}
                onChange={(e) => setPieces(e.target.value)}
                placeholder="e.g. 20"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="count-note">Note (optional)</Label>
            <Textarea
              id="count-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. counted after morning delivery"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutate()} disabled={isPending}>
            {isPending ? "Saving…" : "Save Count"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Incoming Dialog ─────────────────────────────────────────────────────────

function IncomingDialog({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const qc = useQueryClient();
  const isKg = row.product.unitType === "KG" || row.product.unitType === "BOTH";
  const isPiece = row.product.unitType === "PIECE" || row.product.unitType === "BOTH";

  const [kg, setKg] = useState("");
  const [pieces, setPieces] = useState("");
  const [costPerKg, setCostPerKg] = useState("");
  const [costPerPcs, setCostPerPcs] = useState("");
  const [note, setNote] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      warehouseLogIncoming({
        productId: row.productId,
        receivedKg: isKg && kg !== "" ? Number(kg) : undefined,
        receivedPieces: isPiece && pieces !== "" ? Number(pieces) : undefined,
        costPerKg: isKg && costPerKg !== "" ? Number(costPerKg) : undefined,
        costPerPiece: isPiece && costPerPcs !== "" ? Number(costPerPcs) : undefined,
        note: note || undefined,
      }),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Incoming stock logged");
      qc.invalidateQueries({ queryKey: ["warehouse-stock"] });
      qc.invalidateQueries({ queryKey: ["driver-shopping-list"] });
      onClose();
    },
    onError: () => toast.error("Failed to log incoming"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Incoming — {row.product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Record stock received from supplier or market run.
          </p>
          {isKg && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="in-kg">Received kg</Label>
                <Input
                  id="in-kg"
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  step="0.1"
                  value={kg}
                  onChange={(e) => setKg(e.target.value)}
                  placeholder="e.g. 20"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="in-cost-kg">Cost per kg (UZS)</Label>
                <Input
                  id="in-cost-kg"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={costPerKg}
                  onChange={(e) => setCostPerKg(e.target.value)}
                  placeholder="e.g. 3000"
                />
              </div>
            </div>
          )}
          {isPiece && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="in-pcs">Received pcs</Label>
                <Input
                  id="in-pcs"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={pieces}
                  onChange={(e) => setPieces(e.target.value)}
                  placeholder="e.g. 50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="in-cost-pcs">Cost per piece (UZS)</Label>
                <Input
                  id="in-cost-pcs"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={costPerPcs}
                  onChange={(e) => setCostPerPcs(e.target.value)}
                  placeholder="e.g. 500"
                />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="in-note">Note (optional)</Label>
            <Textarea
              id="in-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. bought from central market"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutate()} disabled={isPending}>
            {isPending ? "Saving…" : "Log Incoming"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stock item row ───────────────────────────────────────────────────────────

function StockItem({
  row,
  onCount,
  onIncoming,
}: {
  row: StockRow;
  onCount: (row: StockRow) => void;
  onIncoming: (row: StockRow) => void;
}) {
  const status = stockStatus(row);
  const isKg = row.product.unitType === "KG" || row.product.unitType === "BOTH";
  const isPiece = row.product.unitType === "PIECE" || row.product.unitType === "BOTH";

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
      <div className={`h-3 w-3 shrink-0 rounded-full ${STATUS_DOT[status]}`} />

      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold truncate">{row.product.name}</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isKg && (
            <span>
              {fmt(Number(row.availableKg ?? 0))} kg
              {row.reservedKg && Number(row.reservedKg) > 0 && (
                <span className="text-amber-600"> · {fmt(Number(row.reservedKg))} reserved</span>
              )}
            </span>
          )}
          {isKg && isPiece && <span className="mx-1">·</span>}
          {isPiece && <span>{row.availablePieces ?? 0} pcs</span>}
        </p>
        {row.minStockKg != null && (
          <p className="text-xs text-muted-foreground/70">
            Min: {fmt(Number(row.minStockKg))} kg
            {row.targetStockKg ? ` · Target: ${fmt(Number(row.targetStockKg))} kg` : ""}
          </p>
        )}
      </div>

      <span
        className={`shrink-0 text-sm font-semibold mr-1 ${
          status === "ok" ? "text-green-600" : status === "low" ? "text-amber-600" : "text-red-600"
        }`}
      >
        {STATUS_LABEL[status]}
      </span>

      <div className="flex gap-1 shrink-0">
        <button
          type="button"
          title="Set count"
          onClick={() => onCount(row)}
          className="h-9 w-9 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors"
        >
          <ClipboardCheck className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Log incoming"
          onClick={() => onIncoming(row)}
          className="h-9 w-9 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors"
        >
          <PackagePlus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function WarehouseStockPage() {
  const [search, setSearch] = useState("");
  const [countRow, setCountRow] = useState<StockRow | null>(null);
  const [incomingRow, setIncomingRow] = useState<StockRow | null>(null);
  const [askPending, startAsk] = useTransition();

  const { data: stock, isLoading } = useQuery({
    queryKey: ["warehouse-stock"],
    queryFn: () => getAllStockForStaff(),
    refetchInterval: 60_000,
  });

  const filtered = (stock ?? []).filter(
    (r) =>
      !search ||
      r.product.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.product.category?.nameEn ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, StockRow[]>>((acc, row) => {
    const cat = row.product.category?.nameEn ?? "Uncategorised";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(row);
    return acc;
  }, {});

  const lowCount = (stock ?? []).filter((r) => stockStatus(r) === "low").length;
  const emptyCount = (stock ?? []).filter((r) => stockStatus(r) === "empty").length;

  function handleAsk() {
    startAsk(async () => {
      const result = await generateShoppingList();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.data.items.length === 0) {
        toast.success(result.data.message ?? "Stock is sufficient for all orders!");
      } else {
        toast.success(
          `Shopping list sent! ${result.data.items.length} product${result.data.items.length !== 1 ? "s" : ""} needed.`,
          { duration: 5000 }
        );
      }
    });
  }

  return (
    <div className="space-y-0">
      {/* Search bar + controls */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            inputMode="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="h-11 w-full rounded-xl border-2 border-gray-200 bg-gray-50 pl-10 pr-10 text-base focus:border-primary focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-3"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Quick stats */}
        {(lowCount > 0 || emptyCount > 0) && !search && (
          <div className="flex gap-3 mt-2">
            {lowCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-amber-700">
                <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                {lowCount} low stock
              </div>
            )}
            {emptyCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-red-600">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                {emptyCount} empty
              </div>
            )}
          </div>
        )}

        {/* Ask for shopping list */}
        <Button
          size="sm"
          variant="outline"
          className="mt-3 w-full gap-2 border-primary/40 text-primary hover:bg-primary/5"
          onClick={handleAsk}
          disabled={askPending}
        >
          <ShoppingCart className="h-4 w-4" />
          {askPending ? "Generating…" : "Ask for Shopping List"}
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="px-4 pt-4 space-y-3">
          {[1, 2, 3, 4, 5].map((k) => (
            <Skeleton key={k} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">No products found</div>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([cat, rows]) => (
            <div key={cat}>
              <div className="bg-gray-100 px-4 py-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {cat}
                </p>
              </div>
              <div className="bg-white">
                {rows.map((row) => (
                  <StockItem
                    key={row.id}
                    row={row}
                    onCount={setCountRow}
                    onIncoming={setIncomingRow}
                  />
                ))}
              </div>
            </div>
          ))
      )}

      {countRow && <CountDialog row={countRow} onClose={() => setCountRow(null)} />}
      {incomingRow && <IncomingDialog row={incomingRow} onClose={() => setIncomingRow(null)} />}
    </div>
  );
}
