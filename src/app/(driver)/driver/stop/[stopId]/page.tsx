"use client";

import { ArrowLeft, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { cn, formatPrice } from "@/lib/utils";
import { completeDelivery, skipStop } from "@/server/actions/delivery";
import { getStopDetails } from "@/server/actions/routes";

type StopDetail = NonNullable<Awaited<ReturnType<typeof getStopDetails>>>;
type OrderItem = StopDetail["order"]["items"][number];

const RETURN_REASONS = [
  { value: "BAD_QUALITY", label: "Bad quality", emoji: "🥬" },
  { value: "DAMAGED", label: "Damaged", emoji: "📦" },
  { value: "WRONG_PRODUCT", label: "Wrong product", emoji: "❌" },
  { value: "EXPIRED", label: "Expired", emoji: "⏳" },
  { value: "CUSTOMER_REFUSED", label: "Customer refused", emoji: "🚫" },
  { value: "OTHER", label: "Other", emoji: "❓" },
] as const;

type ReturnReason = (typeof RETURN_REASONS)[number]["value"];

interface ReturnEntry {
  returnedKg?: number;
  returnedPieces?: number;
  reason: ReturnReason;
  note?: string;
}

function getItemTotal(item: OrderItem): number {
  return Number(item.actualPrice ?? item.estimatedPrice);
}

function getItemQty(item: OrderItem): number {
  return item.orderedAs === "KG"
    ? Number(item.actualKg ?? item.requestedKg ?? 1)
    : Number(item.actualPieces ?? item.requestedPieces ?? 1);
}

function getRefund(item: OrderItem, ret: ReturnEntry): number {
  const unitPrice = getItemQty(item) > 0 ? getItemTotal(item) / getItemQty(item) : 0;
  const qty = item.orderedAs === "KG" ? (ret.returnedKg ?? 0) : (ret.returnedPieces ?? 0);
  return Math.round(unitPrice * qty);
}

// ─── Return Sheet ─────────────────────────────────────────────────────────────
function ReturnSheet({
  item,
  existing,
  onConfirm,
  onCancel,
}: {
  item: OrderItem;
  existing?: ReturnEntry;
  onConfirm: (entry: ReturnEntry) => void;
  onCancel: () => void;
}) {
  const isKg = item.orderedAs === "KG";
  const maxQty = getItemQty(item);
  const [returnQty, setReturnQty] = useState<number>(
    existing ? (isKg ? (existing.returnedKg ?? 0) : (existing.returnedPieces ?? 0)) : 0
  );
  const [reason, setReason] = useState<ReturnReason | "">(existing?.reason ?? "");
  const [note, setNote] = useState(existing?.note ?? "");

  const unitPrice = maxQty > 0 ? getItemTotal(item) / maxQty : 0;
  const refundAmt = Math.round(unitPrice * returnQty);
  const remainingAmt = getItemTotal(item) - refundAmt;

  function buildEntry(): ReturnEntry {
    return {
      returnedKg: isKg ? returnQty : undefined,
      returnedPieces: !isKg ? Math.round(returnQty) : undefined,
      reason: reason as ReturnReason,
      note: note || undefined,
    };
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-2xl max-h-[90dvh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-4 pt-5 pb-3 border-b z-10">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
          <h2 className="text-lg font-bold">
            Return from{" "}
            <span className="text-primary">{item.product.nameUz || item.product.name}</span>?
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ordered: {maxQty} {isKg ? "kg" : "pcs"} · {formatPrice(getItemTotal(item))}
          </p>
        </div>

        <div className="p-4 space-y-5">
          {/* Quick buttons */}
          <div>
            <p className="text-sm font-semibold mb-2">Return amount</p>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setReturnQty(0)}
                className={cn(
                  "flex-1 h-11 rounded-xl border-2 font-medium text-sm transition-colors",
                  returnQty === 0 ? "border-primary bg-primary/5 text-primary" : "border-gray-200"
                )}
              >
                None
              </button>
              <button
                onClick={() =>
                  setReturnQty(isKg ? Math.round((maxQty / 2) * 2) / 2 : Math.floor(maxQty / 2))
                }
                className={cn(
                  "flex-1 h-11 rounded-xl border-2 font-medium text-sm transition-colors",
                  returnQty === (isKg ? Math.round((maxQty / 2) * 2) / 2 : Math.floor(maxQty / 2))
                    ? "border-orange-400 bg-orange-50 text-orange-600"
                    : "border-gray-200"
                )}
              >
                Half
              </button>
              <button
                onClick={() => setReturnQty(maxQty)}
                className={cn(
                  "flex-1 h-11 rounded-xl border-2 font-medium text-sm transition-colors",
                  returnQty === maxQty ? "border-red-400 bg-red-50 text-red-600" : "border-gray-200"
                )}
              >
                All
              </button>
            </div>

            {/* Custom input */}
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={maxQty}
                step={isKg ? 0.5 : 1}
                value={returnQty}
                onChange={(e) =>
                  setReturnQty(Math.min(maxQty, Math.max(0, Number(e.target.value))))
                }
                className="w-28 h-12 rounded-xl border-2 border-gray-200 text-center text-lg font-mono font-bold focus:border-primary focus:outline-none"
              />
              <span className="text-muted-foreground font-medium">{isKg ? "kg" : "pcs"}</span>
            </div>
          </div>

          {/* Reason */}
          <div>
            <p className="text-sm font-semibold mb-2">Reason (required)</p>
            <div className="grid grid-cols-2 gap-2">
              {RETURN_REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={cn(
                    "h-12 rounded-xl border-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors",
                    reason === r.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-gray-200 text-gray-700"
                  )}
                >
                  <span>{r.emoji}</span> {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <p className="text-sm font-semibold mb-2">Note (optional)</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add details…"
              rows={2}
              className="w-full rounded-xl border-2 border-gray-200 p-3 text-sm focus:border-primary focus:outline-none resize-none"
            />
          </div>

          {/* Live calculation */}
          {returnQty > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-1 text-sm font-mono">
              <div className="flex justify-between text-orange-700">
                <span>Refund</span>
                <span className="font-bold">−{formatPrice(refundAmt)}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Item total after return</span>
                <span className="font-bold">{formatPrice(remainingAmt)}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1 pb-2">
            <button
              onClick={onCancel}
              className="flex-1 h-14 rounded-xl border-2 border-gray-200 font-semibold text-base"
            >
              Cancel
            </button>
            <button
              disabled={returnQty > 0 && !reason}
              onClick={() => {
                if ("vibrate" in navigator) navigator.vibrate(50);
                onConfirm(buildEntry());
              }}
              className={cn(
                "flex-1 h-14 rounded-xl font-bold text-base text-white transition-colors",
                returnQty > 0 ? "bg-orange-500 disabled:opacity-50" : "bg-green-600"
              )}
            >
              {returnQty > 0 ? "Confirm Return" : "✓ No Return"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Item card ────────────────────────────────────────────────────────────────
function ItemCard({
  item,
  returnEntry,
  onTap,
}: {
  item: OrderItem;
  returnEntry?: ReturnEntry;
  onTap: () => void;
}) {
  const isKg = item.orderedAs === "KG";
  const qty = isKg
    ? Number(item.actualKg ?? item.requestedKg ?? 0)
    : Number(item.actualPieces ?? item.requestedPieces ?? 0);
  const total = getItemTotal(item);
  const hasReturn = returnEntry && (returnEntry.returnedKg ?? returnEntry.returnedPieces ?? 0) > 0;
  const returnedQty = returnEntry
    ? isKg
      ? (returnEntry.returnedKg ?? 0)
      : (returnEntry.returnedPieces ?? 0)
    : 0;

  return (
    <button
      onClick={onTap}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition-colors"
    >
      {/* Image / emoji */}
      <div className="h-14 w-14 rounded-xl bg-gray-100 shrink-0 overflow-hidden flex items-center justify-center">
        {item.product.imageUrl ? (
          <img
            src={item.product.imageUrl}
            alt={item.product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-2xl">🥬</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-base truncate">
          {item.product.nameUz || item.product.name}
        </p>
        <p className="text-sm text-muted-foreground">
          {qty} {isKg ? "kg" : "pcs"}
          {hasReturn ? ` · returning ${returnedQty} ${isKg ? "kg" : "pcs"}` : ""}
        </p>
        <p className="text-sm font-mono font-semibold">{formatPrice(total)}</p>
      </div>

      {/* Status indicator */}
      <div className="shrink-0">
        {hasReturn ? (
          <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center">
            <RotateCcw className="h-5 w-5 text-orange-500" />
          </div>
        ) : (
          <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Skip Sheet ───────────────────────────────────────────────────────────────
function SkipSheet({
  onConfirm,
  onCancel,
  skipping,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  skipping: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-t-2xl p-5 space-y-4">
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto" />
        <h2 className="text-lg font-bold text-center">Skip this stop?</h2>
        <p className="text-sm text-muted-foreground text-center">
          The shop owner will not receive their order. Admin will be notified.
        </p>
        <div>
          <p className="text-sm font-semibold mb-1.5">Reason</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Shop closed, no one present…"
            rows={2}
            className="w-full rounded-xl border-2 border-gray-200 p-3 text-sm focus:border-red-400 focus:outline-none resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1">Minimum 5 characters</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={skipping}
            className="flex-1 h-14 rounded-xl border-2 border-gray-200 font-semibold text-base"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={skipping || reason.trim().length < 5}
            className="flex-1 h-14 rounded-xl bg-red-500 text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {skipping ? <Loader2 className="h-5 w-5 animate-spin" /> : "Skip Stop"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main stop page ───────────────────────────────────────────────────────────
export default function StopPage({ params }: { params: Promise<{ stopId: string }> }) {
  const { stopId } = use(params);
  const router = useRouter();

  const [stop, setStop] = useState<StopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [returns, setReturns] = useState<Map<string, ReturnEntry>>(new Map());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [completing, setCompleting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [skipping, setSkipping] = useState(false);

  useEffect(() => {
    getStopDetails(stopId).then((data) => {
      setStop(data ?? null);
      setLoading(false);
    });
  }, [stopId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!stop) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <p className="text-lg font-semibold">Stop not found</p>
        <button onClick={() => router.back()} className="text-primary font-semibold">
          ← Go back
        </button>
      </div>
    );
  }

  const { order } = stop;
  const shop = order.shop;
  const items = order.items;
  const orderTotal = Number(order.actualTotal ?? order.estimatedTotal);

  // Compute totals
  let totalRefund = 0;
  for (const [itemId, ret] of returns) {
    const item = items.find((i) => i.id === itemId);
    if (item) totalRefund += getRefund(item, ret);
  }
  const toCollect = orderTotal - totalRefund;

  async function handleComplete() {
    if (!stop) return;
    if ("vibrate" in navigator) navigator.vibrate(100);
    setCompleting(true);

    const returnsPayload = Array.from(returns.entries())
      .filter(([, ret]) => (ret.returnedKg ?? ret.returnedPieces ?? 0) > 0)
      .map(([orderItemId, ret]) => ({ orderItemId, ...ret }));

    const result = await completeDelivery({
      stopId: stop.id,
      returns: returnsPayload,
      deliveryNote: deliveryNote || undefined,
    });

    if (result.success) {
      setSuccess(true);
      toast.success("Delivery completed!");
      if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);

      // Find next pending stop or go to done page
      setTimeout(() => {
        const allStops = stop.route.stops;
        const completedIds = new Set(
          allStops
            .filter((s) =>
              ["COMPLETED", "PARTIAL_RETURN", "FULL_RETURN", "SKIPPED"].includes(s.status)
            )
            .map((s) => s.id)
        );
        // Current stop is now done — find next pending
        const nextStop = allStops.find(
          (s) => s.id !== stop.id && s.status === "PENDING" && !completedIds.has(s.id)
        );
        if (nextStop) {
          router.push(`/driver/stop/${nextStop.id}`);
        } else {
          router.push(`/driver/done?routeId=${stop.route.id}`);
        }
      }, 1200);
    } else {
      toast.error(result.error ?? "Failed to complete delivery");
      setCompleting(false);
    }
  }

  async function handleSkip(reason: string) {
    if (!stop) return;
    setSkipping(true);
    const result = await skipStop({ stopId: stop.id, reason });
    if (result.success) {
      toast("Stop skipped");
      const allStops = stop.route.stops;
      const next = allStops.find((s) => s.id !== stop.id && s.status === "PENDING");
      if (next) {
        router.push(`/driver/stop/${next.id}`);
      } else {
        router.push(`/driver/done?routeId=${stop.route.id}`);
      }
    } else {
      toast.error(result.error ?? "Failed to skip stop");
      setSkipping(false);
    }
    setShowSkip(false);
  }

  const editingItem = editingItemId ? items.find((i) => i.id === editingItemId) : null;

  return (
    <div className="flex flex-col min-h-dvh">
      {/* ─── Header ────────────────────────────────── */}
      <div className="bg-white border-b px-4 pt-3 pb-4 space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-primary font-medium text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Route
          </button>
          <button
            onClick={() => setShowSkip(true)}
            className="text-sm font-semibold text-red-500 active:opacity-70"
          >
            Skip Stop
          </button>
        </div>
        <h1 className="text-2xl font-bold">{shop.name}</h1>
        <a
          href={`tel:${shop.phone}`}
          className="inline-flex items-center gap-2 text-primary font-semibold text-base"
        >
          📞 {shop.phone}
        </a>
      </div>

      {/* ─── Item checklist ───────────────────────── */}
      <div className="flex-1 pb-56">
        <div className="px-4 py-3">
          <p className="font-bold text-base">Check items with the shop owner</p>
          <p className="text-sm text-muted-foreground">Tap an item to mark a return</p>
        </div>

        <div className="bg-white border-y divide-y">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              returnEntry={returns.get(item.id)}
              onTap={() => setEditingItemId(item.id)}
            />
          ))}
        </div>
      </div>

      {/* ─── Sticky bottom summary ────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_16px_rgba(0,0,0,0.1)] p-4 space-y-3 pb-safe">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Original total</span>
            <span className="font-mono">{formatPrice(orderTotal)}</span>
          </div>
          {totalRefund > 0 && (
            <div className="flex justify-between text-orange-600">
              <span>Returned</span>
              <span className="font-mono font-semibold">−{formatPrice(totalRefund)}</span>
            </div>
          )}
          <div className="border-t pt-1.5 flex justify-between items-baseline">
            <span className="font-bold text-base">TO COLLECT</span>
            <span className="font-mono font-bold text-2xl text-primary">
              {formatPrice(toCollect)}
            </span>
          </div>
        </div>

        <textarea
          value={deliveryNote}
          onChange={(e) => setDeliveryNote(e.target.value)}
          placeholder="Delivery note (optional)…"
          rows={2}
          className="w-full rounded-xl border-2 border-gray-200 p-3 text-sm focus:border-primary focus:outline-none resize-none"
        />

        <button
          onClick={handleComplete}
          disabled={completing || success}
          className={cn(
            "w-full h-16 rounded-2xl font-bold text-xl text-white transition-all",
            "active:scale-[0.98] disabled:opacity-70",
            success ? "bg-green-600 scale-[0.98]" : "bg-primary"
          )}
        >
          {success ? (
            <span className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-6 w-6" /> Done!
            </span>
          ) : completing ? (
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          ) : (
            "✓  Complete Delivery"
          )}
        </button>
      </div>

      {/* ─── Return Sheet ─────────────────────────── */}
      {editingItem && (
        <ReturnSheet
          item={editingItem}
          existing={returns.get(editingItem.id)}
          onCancel={() => setEditingItemId(null)}
          onConfirm={(entry) => {
            setReturns((prev) => {
              const next = new Map(prev);
              next.set(editingItem.id, entry);
              return next;
            });
            setEditingItemId(null);
          }}
        />
      )}

      {/* ─── Skip Sheet ───────────────────────────── */}
      {showSkip && (
        <SkipSheet onConfirm={handleSkip} onCancel={() => setShowSkip(false)} skipping={skipping} />
      )}
    </div>
  );
}
