"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowUpDown,
  Box,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adjustStock, getAllStock, setReorderPoint } from "@/server/actions/inventory";

// ─── Types ─────────────────────────────────────────────────────────────────────

type StockRow = Awaited<ReturnType<typeof getAllStock>>[number];

type SortKey = "name" | "kg" | "pieces" | "status";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function stockStatus(row: StockRow) {
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

function StatusBadge({ status }: { status: string }) {
  if (status === "low")
    return (
      <Badge className="bg-amber-100 text-amber-800 border-0 gap-1">
        <AlertTriangle className="h-3 w-3" /> Low
      </Badge>
    );
  if (status === "empty")
    return <Badge className="bg-red-100 text-red-700 border-0">Empty</Badge>;
  return <Badge className="bg-green-100 text-green-700 border-0">OK</Badge>;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

// ─── Stat Cards ─────────────────────────────────────────────────────────────────

function StatsRow({ data }: { data: StockRow[] }) {
  const total = data.length;
  const low = data.filter((r) => stockStatus(r) === "low").length;
  const empty = data.filter((r) => stockStatus(r) === "empty").length;
  const ok = total - low - empty;

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {[
        { label: "Total Products", value: total, color: "bg-blue-50 text-blue-600" },
        { label: "OK", value: ok, color: "bg-green-50 text-green-600" },
        { label: "Low Stock", value: low, color: "bg-amber-50 text-amber-600" },
        { label: "Empty", value: empty, color: "bg-red-50 text-red-600" },
      ].map(({ label, value, color }) => (
        <Card key={label} className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${color}`}>
              <Box className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-data-display">{value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Set Stock Dialog (direct absolute value entry) ──────────────────────────

function SetStockDialog({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const qc = useQueryClient();
  const isKg    = row.product.unitType === "KG"    || row.product.unitType === "BOTH";
  const isPiece = row.product.unitType === "PIECE" || row.product.unitType === "BOTH";

  const currentKg     = Number(row.availableKg ?? 0);
  const currentPieces = row.availablePieces ?? 0;

  const [newKgStr,     setNewKgStr]     = useState(isKg    ? String(currentKg)     : "");
  const [newPiecesStr, setNewPiecesStr] = useState(isPiece ? String(currentPieces) : "");
  const [busy, setBusy] = useState(false);

  const newKg     = Number(newKgStr     || 0);
  const newPieces = Number(newPiecesStr || 0);
  const deltaKg     = isKg    ? newKg     - currentKg     : 0;
  const deltaPieces = isPiece ? newPieces - currentPieces : 0;

  async function handleSave() {
    if (isKg    && newKgStr     === "") { toast.error("Enter kg amount");     return; }
    if (isPiece && newPiecesStr === "") { toast.error("Enter pieces amount"); return; }
    setBusy(true);
    const res = await adjustStock({
      productId:   row.productId,
      deltaKg:     isKg    ? deltaKg     : undefined,
      deltaPieces: isPiece ? deltaPieces : undefined,
      type:        "COUNT_CORRECTION",
      reason:      "Manual count correction by admin",
    });
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Stock updated");
    qc.invalidateQueries({ queryKey: ["admin-stock"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Set Stock — {row.product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {isKg && (
            <div className="space-y-1.5">
              <Label>Amount in warehouse (kg)</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0"
                  onClick={() => setNewKgStr((v) => String(Math.max(0, Number(v || 0) - 1)))}>
                  <Minus className="h-3 w-3" />
                </Button>
                <Input type="number" step="0.5" min="0" value={newKgStr}
                  onChange={(e) => setNewKgStr(e.target.value)} className="text-center text-lg font-semibold" />
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0"
                  onClick={() => setNewKgStr((v) => String(Number(v || 0) + 1))}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Was: {fmt(currentKg)} kg
                {deltaKg !== 0 && (
                  <span className={deltaKg > 0 ? "text-green-600 ml-1 font-medium" : "text-red-600 ml-1 font-medium"}>
                    ({deltaKg > 0 ? "+" : ""}{fmt(deltaKg)} kg)
                  </span>
                )}
              </p>
            </div>
          )}
          {isPiece && (
            <div className="space-y-1.5">
              <Label>Amount in warehouse (pcs)</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0"
                  onClick={() => setNewPiecesStr((v) => String(Math.max(0, Number(v || 0) - 1)))}>
                  <Minus className="h-3 w-3" />
                </Button>
                <Input type="number" step="1" min="0" value={newPiecesStr}
                  onChange={(e) => setNewPiecesStr(e.target.value)} className="text-center text-lg font-semibold" />
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0"
                  onClick={() => setNewPiecesStr((v) => String(Number(v || 0) + 1))}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Was: {currentPieces} pcs
                {deltaPieces !== 0 && (
                  <span className={deltaPieces > 0 ? "text-green-600 ml-1 font-medium" : "text-red-600 ml-1 font-medium"}>
                    ({deltaPieces > 0 ? "+" : ""}{deltaPieces} pcs)
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Adjust Stock Dialog (delta / waste / theft) ──────────────────────────────

type AdjustType = "ADJUSTMENT" | "WASTE" | "THEFT";

const adjustTypeLabels: Record<AdjustType, string> = {
  ADJUSTMENT: "Manual Adjustment",
  WASTE:      "Waste / Spoilage",
  THEFT:      "Theft / Loss",
};

function AdjustDialog({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType]             = useState<AdjustType>("ADJUSTMENT");
  const [deltaKg, setDeltaKg]       = useState("");
  const [deltaPieces, setDeltaPieces] = useState("");
  const [reason, setReason]         = useState("");
  const [busy, setBusy]             = useState(false);

  const isKg    = row.product.unitType === "KG"    || row.product.unitType === "BOTH";
  const isPiece = row.product.unitType === "PIECE" || row.product.unitType === "BOTH";
  const currentKg     = Number(row.availableKg ?? 0);
  const currentPieces = row.availablePieces ?? 0;
  const previewKg     = isKg    && deltaKg     !== "" ? currentKg     + Number(deltaKg)     : currentKg;
  const previewPieces = isPiece && deltaPieces !== "" ? currentPieces + Number(deltaPieces) : currentPieces;

  async function handleSubmit() {
    if (!reason.trim())        { toast.error("Reason is required");              return; }
    if (!deltaKg && !deltaPieces) { toast.error("Enter a delta for kg or pieces"); return; }
    setBusy(true);
    const res = await adjustStock({
      productId:   row.productId,
      deltaKg:     deltaKg     !== "" ? Number(deltaKg)     : undefined,
      deltaPieces: deltaPieces !== "" ? Number(deltaPieces) : undefined,
      type,
      reason: reason.trim(),
    });
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Stock updated");
    qc.invalidateQueries({ queryKey: ["admin-stock"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Adjustment — {row.product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Reason type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(adjustTypeLabels) as AdjustType[]).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium text-left transition-colors ${
                    type === t ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-gray-300"
                  }`}>
                  {adjustTypeLabels[t]}
                </button>
              ))}
            </div>
          </div>

          {isKg && (
            <div className="space-y-1.5">
              <Label>Delta kg — current: {fmt(currentKg)} kg</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0"
                  onClick={() => setDeltaKg((v) => String(Number(v || 0) - 1))}>
                  <Minus className="h-3 w-3" />
                </Button>
                <Input type="number" step="0.1" value={deltaKg}
                  onChange={(e) => setDeltaKg(e.target.value)} placeholder="0" className="text-center" />
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0"
                  onClick={() => setDeltaKg((v) => String(Number(v || 0) + 1))}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {deltaKg !== "" && (
                <p className="text-xs text-muted-foreground">
                  New: <span className={previewKg < 0 ? "text-red-600 font-medium" : "text-green-700 font-medium"}>{fmt(previewKg)} kg</span>
                </p>
              )}
            </div>
          )}

          {isPiece && (
            <div className="space-y-1.5">
              <Label>Delta pcs — current: {currentPieces} pcs</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0"
                  onClick={() => setDeltaPieces((v) => String(Number(v || 0) - 1))}>
                  <Minus className="h-3 w-3" />
                </Button>
                <Input type="number" step="1" value={deltaPieces}
                  onChange={(e) => setDeltaPieces(e.target.value)} placeholder="0" className="text-center" />
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0"
                  onClick={() => setDeltaPieces((v) => String(Number(v || 0) + 1))}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {deltaPieces !== "" && (
                <p className="text-xs text-muted-foreground">
                  New: <span className={previewPieces < 0 ? "text-red-600 font-medium" : "text-green-700 font-medium"}>{previewPieces} pcs</span>
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Reason *</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Spoilage found during inspection..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reorder Point Dialog ─────────────────────────────────────────────────────────

function ReorderDialog({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    minStockKg:        row.minStockKg        != null ? String(Number(row.minStockKg))        : "",
    minStockPieces:    String(row.minStockPieces    ?? ""),
    targetStockKg:     row.targetStockKg     != null ? String(Number(row.targetStockKg))     : "",
    targetStockPieces: String(row.targetStockPieces ?? ""),
    supplierName:      row.supplierName      ?? "",
    supplierPrice:     row.supplierPrice     != null ? String(Number(row.supplierPrice))     : "",
  });

  const isKg = row.product.unitType === "KG" || row.product.unitType === "BOTH";
  const isPiece = row.product.unitType === "PIECE" || row.product.unitType === "BOTH";

  function field(k: keyof typeof form) {
    return {
      value: form[k],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [k]: e.target.value })),
    };
  }

  async function handleSave() {
    setBusy(true);
    const res = await setReorderPoint({
      productId:         row.productId,
      minStockKg:        form.minStockKg     ? Number(form.minStockKg)        : null,
      minStockPieces:    form.minStockPieces ? Number(form.minStockPieces)    : null,
      targetStockKg:     form.targetStockKg  ? Number(form.targetStockKg)     : null,
      targetStockPieces: form.targetStockPieces ? Number(form.targetStockPieces) : null,
      supplierName:      form.supplierName   || null,
      supplierPrice:     form.supplierPrice  ? Number(form.supplierPrice)     : null,
    });
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Reorder settings saved");
    qc.invalidateQueries({ queryKey: ["admin-stock"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reorder Settings — {row.product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {isKg && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Min Stock (kg)</Label>
                <Input type="number" step="0.1" placeholder="0" {...field("minStockKg")} />
              </div>
              <div className="space-y-1.5">
                <Label>Target Stock (kg)</Label>
                <Input type="number" step="0.1" placeholder="0" {...field("targetStockKg")} />
              </div>
            </div>
          )}
          {isPiece && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Min Stock (pcs)</Label>
                <Input type="number" step="1" placeholder="0" {...field("minStockPieces")} />
              </div>
              <div className="space-y-1.5">
                <Label>Target Stock (pcs)</Label>
                <Input type="number" step="1" placeholder="0" {...field("targetStockPieces")} />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Supplier Name</Label>
            <Input placeholder="e.g. Toshkent Bozor" {...field("supplierName")} />
          </div>
          <div className="space-y-1.5">
            <Label>Supplier Price (UZS / unit)</Label>
            <Input type="number" step="100" placeholder="0" {...field("supplierPrice")} />
            {form.supplierPrice && row.product.pricePerKg != null && (
              <p className="text-xs text-muted-foreground">
                Margin vs kg price:{" "}
                <span className="font-medium text-green-700">
                  {(((Number(row.product.pricePerKg) - Number(form.supplierPrice)) / Number(row.product.pricePerKg)) * 100).toFixed(1)}%
                </span>{" "}
                (retail {Number(row.product.pricePerKg).toLocaleString()} UZS/kg)
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Product Stock Detail Sheet ──────────────────────────────────────────────────

function StockDetailSheet({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const kgPct =
    row.minStockKg && Number(row.minStockKg) > 0
      ? Math.min(100, (Number(row.availableKg) / Number(row.minStockKg)) * 100)
      : null;
  const piecePct =
    row.minStockPieces && row.minStockPieces > 0
      ? Math.min(100, ((row.availablePieces ?? 0) / row.minStockPieces) * 100)
      : null;

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{row.product.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Stock overview */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Current Stock
            </h3>
            {(row.product.unitType === "KG" || row.product.unitType === "BOTH") && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{fmt(Number(row.availableKg ?? 0))} kg available</span>
                  {row.reservedKg && Number(row.reservedKg) > 0 && (
                    <span className="text-amber-600">{fmt(Number(row.reservedKg))} reserved</span>
                  )}
                </div>
                {kgPct !== null && (
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${kgPct < 100 ? "bg-amber-400" : "bg-green-500"}`}
                      style={{ width: `${kgPct}%` }}
                    />
                  </div>
                )}
                {row.minStockKg && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Min: {fmt(Number(row.minStockKg))} kg
                    {row.targetStockKg ? ` · Target: ${fmt(Number(row.targetStockKg))} kg` : ""}
                  </p>
                )}
              </div>
            )}
            {(row.product.unitType === "PIECE" || row.product.unitType === "BOTH") && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{row.availablePieces ?? 0} pcs available</span>
                  {(row.reservedPieces ?? 0) > 0 && (
                    <span className="text-amber-600">{row.reservedPieces} reserved</span>
                  )}
                </div>
                {piecePct !== null && (
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${piecePct < 100 ? "bg-amber-400" : "bg-green-500"}`}
                      style={{ width: `${piecePct}%` }}
                    />
                  </div>
                )}
                {row.minStockPieces && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Min: {row.minStockPieces} pcs
                    {row.targetStockPieces ? ` · Target: ${row.targetStockPieces} pcs` : ""}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Supplier */}
          {(row.supplierName || row.supplierPrice) && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Supplier
              </h3>
              {row.supplierName && (
                <p className="text-sm">{row.supplierName}</p>
              )}
              {row.supplierPrice && (
                <p className="text-sm text-muted-foreground">
                  {Number(row.supplierPrice).toLocaleString()} UZS / unit
                </p>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="space-y-1 text-xs text-muted-foreground border-t pt-3">
            <p>Category: {row.product.category?.nameEn ?? "—"}</p>
            <p>Last updated: {formatDistanceToNow(new Date(row.updatedAt), { addSuffix: true })}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────────

export default function WarehousePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stock"],
    queryFn:  () => getAllStock(),
    refetchInterval: 60_000,
  });

  const [filter, setFilter] = useState<"all" | "low" | "empty">("all");
  const [catFilter, setCatFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [adjustRow, setAdjustRow] = useState<StockRow | null>(null);
  const [setStockRow, setSetStockRow] = useState<StockRow | null>(null);
  const [reorderRow, setReorderRow] = useState<StockRow | null>(null);
  const [detailRow, setDetailRow] = useState<StockRow | null>(null);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(true); }
  }

  const categories = Array.from(
    new Map(
      (data ?? [])
        .filter((r) => r.product.category)
        .map((r) => [r.product.category!.id, r.product.category!])
    ).values()
  ).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const rows = (data ?? [])
    .filter((r) => {
      if (filter === "low") return stockStatus(r) === "low";
      if (filter === "empty") return stockStatus(r) === "empty";
      return true;
    })
    .filter((r) => catFilter === "ALL" || r.product.category?.id === catFilter)
    .filter((r) =>
      !search ||
      r.product.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.product.category?.nameEn ?? "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.product.name.localeCompare(b.product.name);
      else if (sortKey === "kg") cmp = Number(a.availableKg ?? 0) - Number(b.availableKg ?? 0);
      else if (sortKey === "pieces") cmp = (a.availablePieces ?? 0) - (b.availablePieces ?? 0);
      else if (sortKey === "status") {
        const order = { ok: 0, low: 1, empty: 2 };
        cmp = order[stockStatus(a)] - order[stockStatus(b)];
      }
      return sortAsc ? cmp : -cmp;
    });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-headline-lg">Stock Overview</h1>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[1, 2, 3, 4].map((k) => <Skeleton key={k} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const lowCount = (data ?? []).filter((r) => stockStatus(r) === "low").length;
  const emptyCount = (data ?? []).filter((r) => stockStatus(r) === "empty").length;

  return (
    <div className="space-y-6">
      <h1 className="text-headline-lg">Stock Overview</h1>

      {data && <StatsRow data={data} />}

      <Card className="border-0 shadow-sm">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-5 py-3 border-b">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-3">All</TabsTrigger>
              <TabsTrigger value="low" className="text-xs px-3">
                Low {lowCount > 0 && <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] px-1">{lowCount}</span>}
              </TabsTrigger>
              <TabsTrigger value="empty" className="text-xs px-3">
                Empty {emptyCount > 0 && <span className="ml-1 rounded-full bg-red-500 text-white text-[10px] px-1">{emptyCount}</span>}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 min-w-0 max-w-xs">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product or category..."
              className="pl-8 h-8 text-sm"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-2">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-2 border-b overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setCatFilter("ALL")}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                catFilter === "ALL"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-gray-400"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCatFilter(cat.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  catFilter === cat.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-gray-400"
                }`}
              >
                {cat.nameEn}
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/50 text-xs text-muted-foreground">
                <th className="text-left px-5 py-2.5 font-medium">
                  <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("name")}>
                    Product <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left px-3 py-2.5 font-medium">Category</th>
                <th className="text-right px-3 py-2.5 font-medium">
                  <button type="button" className="flex items-center gap-1 ml-auto" onClick={() => toggleSort("kg")}>
                    Available (kg) <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-right px-3 py-2.5 font-medium">
                  <button type="button" className="flex items-center gap-1 ml-auto" onClick={() => toggleSort("pieces")}>
                    Available (pcs) <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-right px-3 py-2.5 font-medium">Reserved (kg)</th>
                <th className="text-right px-3 py-2.5 font-medium">Cost (UZS)</th>
                <th className="px-3 py-2.5 font-medium">
                  <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("status")}>
                    Status <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                    No products found
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40/50 transition-colors">
                  <td className="px-5 py-3 font-medium">{row.product.name}</td>
                  <td className="px-3 py-3 text-muted-foreground text-xs">
                    {row.product.category?.nameEn ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {row.availableKg != null ? `${fmt(Number(row.availableKg))} kg` : "—"}
                    {row.minStockKg != null && (
                      <p className="text-[10px] text-muted-foreground">min {fmt(Number(row.minStockKg))}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {row.availablePieces != null ? `${row.availablePieces} pcs` : "—"}
                    {row.minStockPieces != null && (
                      <p className="text-[10px] text-muted-foreground">min {row.minStockPieces}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-amber-700">
                    {row.reservedKg && Number(row.reservedKg) > 0
                      ? `${fmt(Number(row.reservedKg))} kg`
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground text-xs">
                    {row.supplierPrice != null
                      ? Number(row.supplierPrice).toLocaleString()
                      : "—"}
                    {row.supplierName && (
                      <p className="text-[10px] truncate max-w-[80px] ml-auto">{row.supplierName}</p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={stockStatus(row)} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSetStockRow(row)}
                      >
                        Set
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setAdjustRow(row)}
                      >
                        Adjust
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setReorderRow(row)}
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDetailRow(row)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {setStockRow && <SetStockDialog row={setStockRow} onClose={() => setSetStockRow(null)} />}
      {adjustRow   && <AdjustDialog  row={adjustRow}  onClose={() => setAdjustRow(null)}  />}
      {reorderRow  && <ReorderDialog row={reorderRow} onClose={() => setReorderRow(null)} />}
      {detailRow   && <StockDetailSheet row={detailRow} onClose={() => setDetailRow(null)} />}
    </div>
  );
}
