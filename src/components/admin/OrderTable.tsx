"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Loader2,
  MoreHorizontal,
  PackageCheck,
  RefreshCw,
  Save,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getPusherClient } from "@/lib/pusherClient";
import { formatPrice, getStatusColor, getStatusLabel } from "@/lib/utils";
import { getAllOrders, setActualCost, updateOrderStatus } from "@/server/actions/orders";
import type { Order } from "@/types";

const STATUS_TABS = [
  "ALL",
  "PENDING",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
];

const NEXT_STATUSES: Record<string, string[]> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

// ─── Local form schema ────────────────────────────────────────────────────────

const itemSchema = z.object({
  orderItemId: z.string(),
  productName: z.string(),
  orderedAs: z.enum(["KG", "PIECE"]),
  requestedKg: z.number().nullable(),
  requestedPieces: z.number().nullable(),
  estimatedPrice: z.number(),
  pricePerUnit: z.number(),
  actualKg: z.number().min(0),
  actualPieces: z.number().int().min(0),
  overrideEnabled: z.boolean(),
  overridePrice: z.number().min(0),
  overrideReason: z.string().max(200),
});

const actualCostSchema = z.object({
  finalCostNote: z.string().max(500),
  deliveryFee: z.number().min(0),
  items: z.array(itemSchema).superRefine((items, ctx) => {
    items.forEach((item, idx) => {
      if (item.overrideEnabled && !item.overrideReason.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Reason is required when overriding price",
          path: [idx, "overrideReason"],
        });
      }
    });
  }),
});

type ActualCostForm = z.infer<typeof actualCostSchema>;

// ─── SetActualCostDialog ─────────────────────────────────────────────────────

function SetActualCostDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isDraftRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const {
    control,
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<ActualCostForm, unknown, ActualCostForm>({
    resolver: zodResolver(actualCostSchema),
    values: order
      ? {
          finalCostNote: order.finalCostNote ?? "",
          deliveryFee: order.deliveryFee ??
            Math.round(order.estimatedTotal * (order.estimatedTotal >= 1_000_000 ? 0.05 : 0.10)),
          items: order.items.map((item) => {
            const requestedQty =
              item.orderedAs === "KG" ? (item.requestedKg ?? 1) : (item.requestedPieces ?? 1);
            const pricePerUnit =
              requestedQty > 0 ? Math.round(item.estimatedPrice / requestedQty) : 0;
            return {
              orderItemId: item.id,
              productName: item.product.name,
              orderedAs: item.orderedAs as "KG" | "PIECE",
              requestedKg: item.requestedKg,
              requestedPieces: item.requestedPieces,
              estimatedPrice: item.estimatedPrice,
              pricePerUnit,
              actualKg: item.actualKg ?? item.requestedKg ?? 0,
              actualPieces: item.actualPieces ?? item.requestedPieces ?? 0,
              overrideEnabled: item.adminAdjusted,
              overridePrice: item.actualPrice ?? item.estimatedPrice,
              overrideReason: item.adminNote ?? "",
            };
          }),
        }
      : { finalCostNote: "", deliveryFee: 0, items: [] },
  });

  const { fields } = useFieldArray({ control, name: "items" });
  const watched = watch("items");
  const watchedFee = watch("deliveryFee");

  // ── computed totals ──────────────────────────────────────────────────────
  function autoCalc(i: ActualCostForm["items"][number]): number {
    if (i.orderedAs === "KG") return Math.round((i.actualKg || 0) * i.pricePerUnit);
    return Math.round((i.actualPieces || 0) * i.pricePerUnit);
  }

  function lineTotal(idx: number): number {
    const i = watched[idx];
    if (!i) return 0;
    return i.overrideEnabled ? i.overridePrice || 0 : autoCalc(i);
  }

  const calculatedTotal = watched.reduce((s, i) => s + autoCalc(i), 0);
  const adjustments = watched.reduce((s, i, idx) => {
    if (!i.overrideEnabled) return s;
    return s + ((i.overridePrice || 0) - autoCalc(i));
  }, 0);
  const subtotal = calculatedTotal + adjustments;
  const fee = watchedFee || 0;
  const finalTotal = subtotal + fee;
  const estimatedTotal = order?.estimatedTotal ?? 0;
  const estimatedFee = order?.deliveryFee ??
    Math.round(estimatedTotal * (estimatedTotal >= 1_000_000 ? 0.05 : 0.10));
  const finalDiff = finalTotal - (estimatedTotal + estimatedFee);

  // ── submit ───────────────────────────────────────────────────────────────
  async function onSubmit(data: ActualCostForm) {
    if (!order) return;
    const draft = isDraftRef.current;
    draft ? setSaving(true) : setConfirming(true);

    const result = await setActualCost({
      orderId: order.id,
      saveDraft: draft,
      deliveryFee: data.deliveryFee,
      finalCostNote: data.finalCostNote || undefined,
      items: data.items.map((i) => ({
        orderItemId: i.orderItemId,
        actualKg: i.orderedAs === "KG" && !i.overrideEnabled ? i.actualKg || undefined : undefined,
        actualPieces:
          i.orderedAs === "PIECE" && !i.overrideEnabled ? i.actualPieces || undefined : undefined,
        overridePrice: i.overrideEnabled ? i.overridePrice || undefined : undefined,
        adminNote: i.overrideEnabled ? i.overrideReason || undefined : undefined,
      })),
    });

    draft ? setSaving(false) : setConfirming(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    if (draft) {
      toast.success("Draft saved — shop not yet notified.");
      qc.invalidateQueries({ queryKey: ["orders", "admin"] });
    } else {
      toast.success("Order finalised — shop notified!");
      qc.invalidateQueries({ queryKey: ["orders", "admin"] });
      onClose();
    }
  }

  const shortId = order?.id.slice(-6).toUpperCase();

  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="text-lg">Adjust Final Cost — Order #{shortId}</DialogTitle>
          {order && (
            <p className="text-sm text-muted-foreground">
              {order.shop?.name} ·{" "}
              {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          {/* ── Items table ── */}
          <div className="flex-1 overflow-y-auto px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Product</TableHead>
                  <TableHead className="w-[90px]">Requested</TableHead>
                  <TableHead className="w-[130px]">Actual</TableHead>
                  <TableHead className="w-[120px]">Unit Price</TableHead>
                  <TableHead className="w-[110px] text-right">Line Total</TableHead>
                  <TableHead className="w-[80px] text-center">Override</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, idx) => {
                  const isKg = field.orderedAs === "KG";
                  const overrideOn = !!watched[idx]?.overrideEnabled;
                  const total = lineTotal(idx);
                  const autoTotal = autoCalc(watched[idx] ?? field);
                  const hasDiff = overrideOn && total !== autoTotal;

                  return (
                    <>
                      {/* Main row */}
                      <TableRow key={field.id}>
                        {/* Product */}
                        <TableCell>
                          <span className="font-medium text-sm">{field.productName}</span>
                        </TableCell>

                        {/* Requested */}
                        <TableCell className="text-sm text-muted-foreground">
                          {isKg
                            ? `${field.requestedKg ?? "?"} kg`
                            : `${field.requestedPieces ?? "?"} pcs`}
                        </TableCell>

                        {/* Actual input */}
                        <TableCell>
                          {overrideOn ? (
                            <span className="text-xs text-muted-foreground italic">
                              manual override
                            </span>
                          ) : isKg ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...register(`items.${idx}.actualKg`, { valueAsNumber: true })}
                                className="h-7 text-sm w-20"
                              />
                              <span className="text-xs text-muted-foreground">kg</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                {...register(`items.${idx}.actualPieces`, {
                                  valueAsNumber: true,
                                })}
                                className="h-7 text-sm w-20"
                              />
                              <span className="text-xs text-muted-foreground">pcs</span>
                            </div>
                          )}
                        </TableCell>

                        {/* Unit Price */}
                        <TableCell className="text-sm text-muted-foreground">
                          {field.pricePerUnit > 0
                            ? `${formatPrice(field.pricePerUnit)} / ${isKg ? "kg" : "pcs"}`
                            : "—"}
                        </TableCell>

                        {/* Line Total */}
                        <TableCell className="text-right">
                          <span
                            className={`text-sm font-semibold ${hasDiff ? "text-amber-600" : "text-foreground"}`}
                          >
                            {formatPrice(total)}
                          </span>
                          {hasDiff && (
                            <p className="text-[10px] text-muted-foreground line-through text-right">
                              {formatPrice(autoTotal)}
                            </p>
                          )}
                        </TableCell>

                        {/* Override toggle */}
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={overrideOn}
                            onChange={(e) =>
                              setValue(`items.${idx}.overrideEnabled`, e.target.checked, {
                                shouldDirty: true,
                              })
                            }
                            className="h-4 w-4 accent-primary cursor-pointer"
                            title="Override price manually"
                          />
                        </TableCell>
                      </TableRow>

                      {/* Override sub-row */}
                      {overrideOn && (
                        <TableRow key={`${field.id}-override`} className="bg-amber-50/50">
                          <TableCell colSpan={6} className="py-2 px-4">
                            <div className="flex gap-3 items-end">
                              <div className="space-y-1">
                                <Label className="text-xs text-amber-700">Manual price (UZS)</Label>
                                <Input
                                  type="number"
                                  step="100"
                                  min="0"
                                  {...register(`items.${idx}.overridePrice`, {
                                    valueAsNumber: true,
                                  })}
                                  className="h-7 text-sm w-36 border-amber-300 focus-visible:ring-amber-400"
                                />
                              </div>
                              <div className="flex-1 space-y-1">
                                <Label className="text-xs text-amber-700">
                                  Reason for adjustment
                                </Label>
                                <Input
                                  placeholder='e.g. "Premium quality batch"'
                                  {...register(`items.${idx}.overrideReason`)}
                                  className="h-7 text-sm border-amber-300 focus-visible:ring-amber-400"
                                />
                                {errors.items?.[idx]?.overrideReason && (
                                  <p className="text-[10px] text-destructive mt-0.5">
                                    {errors.items[idx].overrideReason.message}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* ── Summary + note + actions (sticky bottom) ── */}
          <div className="shrink-0 border-t bg-card px-6 pt-4 pb-6 space-y-4">
            {/* Summary block */}
            <div className="rounded-xl border bg-gray-50 p-4 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {adjustments !== 0 && (
                <div
                  className={`flex justify-between font-medium ${adjustments > 0 ? "text-red-600" : "text-green-600"}`}
                >
                  <span>Adjustments</span>
                  <span>
                    {adjustments > 0 ? "+" : ""}
                    {formatPrice(adjustments)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-muted-foreground">
                <span>
                  Delivery Fee
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    ({fee >= (estimatedTotal * 0.07) ? "5%" : "10%"})
                  </span>
                </span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="1000"
                    min="0"
                    {...register("deliveryFee", { valueAsNumber: true })}
                    className="h-7 w-32 text-right text-sm"
                  />
                  <span className="text-xs shrink-0">UZS</span>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-base">Grand Total</span>
                <span className="font-bold text-xl text-primary">{formatPrice(finalTotal)}</span>
              </div>
              {finalDiff !== 0 && (
                <div
                  className={`flex justify-between text-xs font-medium ${finalDiff > 0 ? "text-red-600" : "text-green-600"}`}
                >
                  <span>Difference vs estimate</span>
                  <span>
                    {finalDiff > 0 ? "+" : ""}
                    {formatPrice(finalDiff)}
                  </span>
                </div>
              )}
            </div>

            {/* Order-wide note */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Note for shop (optional — visible in their order view)
              </Label>
              <Textarea
                placeholder="e.g. Today's tomatoes were extra fresh — minor weight difference"
                rows={2}
                {...register("finalCostNote")}
                className="text-sm resize-none"
              />
            </div>

            {/* Action buttons */}
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="mr-auto">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="outline"
                disabled={saving || confirming}
                onClick={() => {
                  isDraftRef.current = true;
                }}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Draft
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90"
                disabled={saving || confirming}
                onClick={() => {
                  isDraftRef.current = false;
                }}
              >
                {confirming ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <PackageCheck className="h-4 w-4 mr-2" />
                )}
                Confirm & Notify Shop
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Order row with expandable items ─────────────────────────────────────────

function OrderRowExpanded({ order, onFinalize }: { order: Order; onFinalize: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();
  const nextStatuses = NEXT_STATUSES[order.status] ?? [];
  const canFinalize = ["PENDING", "PREPARING"].includes(order.status);

  async function handleStatusChange(status: string) {
    const result = await updateOrderStatus({
      orderId: order.id,
      status: status as
        | "PENDING"
        | "PREPARING"
        | "READY"
        | "OUT_FOR_DELIVERY"
        | "DELIVERED"
        | "CANCELLED",
    });
    if (!result.success) toast.error(result.error);
    else {
      toast.success(`Status updated to ${getStatusLabel(status)}`);
      qc.invalidateQueries({ queryKey: ["orders", "admin"] });
    }
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground">
        #{order.id.slice(-6).toUpperCase()}
      </TableCell>
      <TableCell>
        <button type="button" className="text-left w-full" onClick={() => setExpanded((v) => !v)}>
          <p className="font-medium text-sm">{order.shop?.name}</p>
          {order.notes && (
            <p className="text-xs text-muted-foreground italic truncate max-w-[160px]">
              {order.notes}
            </p>
          )}
          {expanded && (
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {order.items.map((item) => (
                <p key={item.id}>
                  · {item.product.name}{" "}
                  {item.orderedAs === "KG"
                    ? `${item.requestedKg} kg`
                    : `${item.requestedPieces} pcs`}
                </p>
              ))}
            </div>
          )}
        </button>
      </TableCell>
      <TableCell className="hidden sm:table-cell text-sm">{order.items.length}</TableCell>
      <TableCell>
        <p className="text-sm font-bold">
          {formatPrice((order.actualTotal ?? order.estimatedTotal) + (order.deliveryFee ?? 0))}
        </p>
        {order.deliveryFee != null && order.deliveryFee > 0 && (
          <p className="text-[10px] text-muted-foreground">
            +{formatPrice(order.deliveryFee)} delivery
          </p>
        )}
      </TableCell>
      <TableCell>
        <Badge className={`${getStatusColor(order.status)} text-xs`}>
          {getStatusLabel(order.status)}
        </Badge>
      </TableCell>
      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
        {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {canFinalize && (
            <Button
              size="sm"
              className="h-7 text-xs bg-primary hover:bg-primary/90"
              onClick={onFinalize}
            >
              <PackageCheck className="h-3.5 w-3.5" />
            </Button>
          )}
          {nextStatuses.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs">Change Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {nextStatuses.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className="text-xs"
                  >
                    {getStatusLabel(s)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent transition-colors ml-auto"
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Main OrderTable ──────────────────────────────────────────────────────────

export function OrderTable() {
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [shopSearch, setShopSearch] = useState(() => searchParams.get("search") ?? "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [finalizing, setFinalizing] = useState<Order | null>(null);
  const [newCount, setNewCount] = useState(0);
  const prevTotal = useRef<number | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["orders", "admin", statusFilter, shopSearch, dateFrom, dateTo],
    queryFn: () =>
      getAllOrders({
        status: statusFilter,
        shopName: shopSearch || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    const ch = pusher.subscribe("private-admin");
    ch.bind("new-order", (payload: { shopName?: string }) => {
      setNewCount((n) => n + 1);
      toast.info(`New order from ${payload.shopName ?? "a shop"}!`, {
        action: {
          label: "View",
          onClick: () => {
            setStatusFilter("PENDING");
            qc.invalidateQueries({ queryKey: ["orders", "admin"] });
          },
        },
      });
      qc.invalidateQueries({ queryKey: ["orders", "admin"] });
    });

    return () => {
      ch.unbind_all();
      pusher.unsubscribe("private-admin");
    };
  }, [qc]);

  useEffect(() => {
    if (data?.total == null) return;
    if (prevTotal.current !== null && data.total > prevTotal.current) {
      setNewCount((n) => n + (data.total - prevTotal.current!));
    }
    prevTotal.current = data.total;
  }, [data?.total]);

  const orders = data?.orders ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Tabs
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setNewCount(0);
          }}
        >
          <TabsList className="flex-wrap h-auto gap-1">
            {STATUS_TABS.map((s) => (
              <TabsTrigger key={s} value={s} className="text-xs">
                {s === "ALL" ? "All" : getStatusLabel(s)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Input
          placeholder="Search shop…"
          value={shopSearch}
          onChange={(e) => setShopSearch(e.target.value)}
          className="w-40"
        />
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-36"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-36"
        />

        {newCount > 0 && (
          <Badge className="bg-red-500 text-white border-0 flex items-center gap-1">
            <Bell className="h-3 w-3" /> {newCount} new
          </Badge>
        )}

        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-7 text-xs"
          onClick={() => {
            refetch();
            setNewCount(0);
          }}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
      </div>

      <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {(["a", "b", "c", "d"] as const).map((k) => (
              <Skeleton key={k} className="h-12 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <p>No orders found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Order</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead className="hidden sm:table-cell">Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Time</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <OrderRowExpanded
                  key={order.id}
                  order={order}
                  onFinalize={() => setFinalizing(order)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <SetActualCostDialog order={finalizing} onClose={() => setFinalizing(null)} />
    </div>
  );
}
