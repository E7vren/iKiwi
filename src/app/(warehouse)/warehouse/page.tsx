"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Info,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  completeRestockTask,
  getRestockTasks,
  startRestockTask,
} from "@/server/actions/restock";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Task = Awaited<ReturnType<typeof getRestockTasks>>[number];
type TaskStatus = "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

// ─── Helpers ────────────────────────────────────────────────────────────────────

const PRIORITY_BORDER: Record<string, string> = {
  URGENT: "border-l-red-500",
  HIGH:   "border-l-orange-400",
  NORMAL: "border-l-blue-400",
  LOW:    "border-l-gray-300",
};

const PRIORITY_BADGE: Record<string, string> = {
  URGENT: "bg-red-100 text-red-700",
  HIGH:   "bg-orange-100 text-orange-700",
  NORMAL: "bg-blue-100 text-blue-700",
  LOW:    "bg-gray-100 text-gray-500",
};

const STATUS_BADGE: Record<string, string> = {
  PENDING:     "bg-gray-100 text-gray-600",
  ASSIGNED:    "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLETED:   "bg-green-100 text-green-700",
  CANCELLED:   "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING:     "Pending",
  ASSIGNED:    "Assigned",
  IN_PROGRESS: "In Progress",
  COMPLETED:   "Completed",
  CANCELLED:   "Cancelled",
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

// ─── +/- Number Input ────────────────────────────────────────────────────────────

function NumInput({
  value,
  onChange,
  step = 1,
  label,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  step?: number;
  label: string;
  suffix?: string;
}) {
  function inc() { onChange(String(Math.max(0, Number(value || 0) + step))); }
  function dec() { onChange(String(Math.max(0, Number(value || 0) - step))); }

  return (
    <div className="space-y-1.5">
      <label className="text-sm text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={dec}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-border bg-card active:bg-muted transition-colors"
        >
          <Minus className="h-5 w-5 text-gray-600" />
        </button>
        <div className="relative flex-1">
          <input
            type="number"
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-12 w-full rounded-xl border-2 border-border bg-card px-3 text-center text-lg font-semibold focus:border-primary focus:outline-none"
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={inc}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-border bg-card active:bg-muted transition-colors"
        >
          <Plus className="h-5 w-5 text-gray-600" />
        </button>
      </div>
    </div>
  );
}

// ─── Complete Task Screen ────────────────────────────────────────────────────────

type LineState = {
  restockItemId: string;
  receivedKg:    string;
  receivedPieces: string;
  pricePaidPerKg: string;
  pricePaidPerPiece: string;
};

function CompleteScreen({ task, onBack, onDone }: { task: Task; onBack: () => void; onDone: () => void }) {
  const [lines, setLines] = useState<LineState[]>(
    task.items.map((item) => ({
      restockItemId:     item.id,
      receivedKg:        item.neededKg     != null ? fmt(Number(item.neededKg))     : "",
      receivedPieces:    item.neededPieces != null ? String(item.neededPieces)       : "",
      pricePaidPerKg:    item.product.stockItem?.supplierPrice != null
        ? String(Number(item.product.stockItem.supplierPrice)) : "",
      pricePaidPerPiece: item.product.stockItem?.supplierPrice != null
        ? String(Number(item.product.stockItem.supplierPrice)) : "",
    }))
  );
  const [staffNote, setStaffNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function updateLine(id: string, field: keyof LineState, value: string) {
    setLines((prev) =>
      prev.map((l) => (l.restockItemId === id ? { ...l, [field]: value } : l))
    );
  }

  const totalCost = lines.reduce((sum, l) => {
    return (
      sum +
      (Number(l.receivedKg || 0) * Number(l.pricePaidPerKg || 0)) +
      (Number(l.receivedPieces || 0) * Number(l.pricePaidPerPiece || 0))
    );
  }, 0);

  const estCost = task.estimatedCost != null ? Number(task.estimatedCost) : null;
  const diff    = estCost != null ? totalCost - estCost : null;

  async function handleConfirm() {
    setBusy(true);
    const res = await completeRestockTask({
      restockTaskId: task.id,
      items: lines.map((l) => ({
        restockItemId:    l.restockItemId,
        receivedKg:       l.receivedKg     ? Number(l.receivedKg)     : undefined,
        receivedPieces:   l.receivedPieces ? Number(l.receivedPieces) : undefined,
        pricePaidPerKg:   l.pricePaidPerKg    ? Number(l.pricePaidPerKg)    : undefined,
        pricePaidPerPiece: l.pricePaidPerPiece ? Number(l.pricePaidPerPiece) : undefined,
      })),
      staffNote: staffNote || undefined,
    });
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    setDone(true);
    toast.success("Stock updated!");
    setTimeout(() => onDone(), 1200);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <p className="text-xl font-bold text-green-700">Stock Updated!</p>
        <p className="text-sm text-muted-foreground">Returning to task list…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-base font-bold">Confirm restock items</h1>
            <p className="text-xs text-muted-foreground">Enter what you actually received</p>
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 py-4 space-y-4 pb-40">
        {/* Info banner */}
        <div className="flex gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Enter the actual amounts you brought back. This will update stock immediately.
          </p>
        </div>

        {/* Item cards */}
        {task.items.map((item, idx) => {
          const line = lines[idx];
          const isKg = item.neededKg != null;
          const isPiece = item.neededPieces != null;
          const itemTotal =
            (Number(line.receivedKg || 0) * Number(line.pricePaidPerKg || 0)) +
            (Number(line.receivedPieces || 0) * Number(line.pricePaidPerPiece || 0));

          return (
            <Card key={item.id} className="border-0 shadow-sm overflow-hidden">
              <div className="border-b bg-gray-50 px-4 py-3">
                <p className="text-base font-bold">{item.product.name}</p>
                <p className="text-sm text-muted-foreground">
                  Needed:{" "}
                  {isKg ? `${fmt(Number(item.neededKg))} kg` : ""}
                  {isKg && isPiece ? " · " : ""}
                  {isPiece ? `${item.neededPieces} pcs` : ""}
                </p>
              </div>
              <div className="px-4 py-4 space-y-4">
                {isKg && (
                  <>
                    <NumInput
                      label="Received (kg)"
                      value={line.receivedKg}
                      onChange={(v) => updateLine(item.id, "receivedKg", v)}
                      step={0.5}
                      suffix="kg"
                    />
                    <NumInput
                      label="Price paid (UZS/kg)"
                      value={line.pricePaidPerKg}
                      onChange={(v) => updateLine(item.id, "pricePaidPerKg", v)}
                      step={100}
                      suffix="UZS"
                    />
                  </>
                )}
                {isPiece && !isKg && (
                  <>
                    <NumInput
                      label="Received (pcs)"
                      value={line.receivedPieces}
                      onChange={(v) => updateLine(item.id, "receivedPieces", v)}
                      step={1}
                      suffix="pcs"
                    />
                    <NumInput
                      label="Price paid (UZS/piece)"
                      value={line.pricePaidPerPiece}
                      onChange={(v) => updateLine(item.id, "pricePaidPerPiece", v)}
                      step={100}
                      suffix="UZS"
                    />
                  </>
                )}
                {itemTotal > 0 && (
                  <p className="text-right text-sm font-semibold text-primary">
                    Total: {itemTotal.toLocaleString()} UZS
                  </p>
                )}
              </div>
            </Card>
          );
        })}

        {/* Staff note */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Notes (optional)</label>
          <Textarea
            value={staffNote}
            onChange={(e) => setStaffNote(e.target.value)}
            placeholder="Tomatoes were great quality, cucumbers are smaller than usual…"
            rows={3}
            className="text-base"
          />
        </div>
      </div>

      {/* Sticky bottom summary + confirm */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg px-4 pt-3 pb-6 space-y-3">
        <div className="rounded-xl bg-gray-50 px-4 py-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total cost paid</span>
            <span className="font-bold">{totalCost.toLocaleString()} UZS</span>
          </div>
          {estCost != null && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Estimate</span>
              <span>{estCost.toLocaleString()} UZS</span>
            </div>
          )}
          {diff != null && diff !== 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Difference</span>
              <span className={diff > 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                {diff > 0 ? "+" : ""}{diff.toLocaleString()} UZS
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-green-600 text-white text-base font-bold active:bg-green-700 disabled:opacity-60 transition-colors"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-5 w-5" />
          )}
          Confirm & Update Stock
        </button>
      </div>
    </div>
  );
}

// ─── Task Card ───────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onComplete,
}: {
  task: Task;
  onComplete: (task: Task) => void;
}) {
  const qc = useQueryClient();
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    setStarting(true);
    const res = await startRestockTask(task.id);
    setStarting(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Task started!");
    qc.invalidateQueries({ queryKey: ["warehouse-tasks"] });
  }

  const canStart    = task.status === "PENDING" || task.status === "ASSIGNED";
  const canComplete = task.status === "IN_PROGRESS";

  return (
    <Card
      className={`border-0 border-l-4 shadow-sm overflow-hidden ${PRIORITY_BORDER[task.priority] ?? "border-l-gray-300"}`}
    >
      <div className="px-4 py-4 space-y-3">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`${PRIORITY_BADGE[task.priority] ?? ""} border-0 gap-1 text-sm`}>
            {task.priority === "URGENT" && <Zap className="h-3.5 w-3.5" />}
            {task.priority}
          </Badge>
          <Badge className={`${STATUS_BADGE[task.status] ?? ""} border-0 text-sm`}>
            {STATUS_LABEL[task.status] ?? task.status}
          </Badge>
        </div>

        {/* Title */}
        <div>
          <p className="text-lg font-bold">
            Restock Task — {task.items.length} item{task.items.length !== 1 ? "s" : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
          </p>
        </div>

        {/* Items list */}
        <ul className="space-y-1.5">
          {task.items.map((item) => (
            <li key={item.id} className="flex items-baseline gap-2 text-base">
              <span className="text-muted-foreground">•</span>
              <span className="font-medium">{item.product.name}</span>
              <span className="text-muted-foreground ml-auto shrink-0">
                {item.neededKg     != null ? `${fmt(Number(item.neededKg))} kg`    : ""}
                {item.neededKg != null && item.neededPieces != null ? " / " : ""}
                {item.neededPieces != null ? `${item.neededPieces} pcs` : ""}
              </span>
            </li>
          ))}
        </ul>

        {/* Admin note */}
        {task.adminNote && (
          <div className="flex gap-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">{task.adminNote}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 gap-3">
          {task.estimatedCost != null && (
            <p className="text-sm text-muted-foreground">
              Est. {Number(task.estimatedCost).toLocaleString()} UZS
            </p>
          )}

          <div className="ml-auto">
            {canStart && (
              <button
                type="button"
                onClick={handleStart}
                disabled={starting}
                className="flex h-14 items-center gap-2 rounded-2xl bg-green-600 px-6 text-white text-base font-bold active:bg-green-700 disabled:opacity-60 transition-colors"
              >
                {starting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span>▶</span>
                )}
                Start Task
              </button>
            )}
            {canComplete && (
              <button
                type="button"
                onClick={() => onComplete(task)}
                className="flex h-14 items-center gap-2 rounded-2xl bg-green-600 px-6 text-white text-base font-bold active:bg-green-700 transition-colors"
              >
                <CheckCircle2 className="h-5 w-5" />
                Mark Complete
              </button>
            )}
            {task.status === "COMPLETED" && (
              <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                <CheckCircle2 className="h-5 w-5" />
                Done
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────────

type TabValue = "active" | "completed" | "all";

const TAB_STATUSES: Record<TabValue, string[]> = {
  active:    ["PENDING", "ASSIGNED", "IN_PROGRESS"],
  completed: ["COMPLETED"],
  all:       ["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
};

export default function WarehouseTasksPage() {
  const [tab, setTab] = useState<TabValue>("active");
  const [completeTask, setCompleteTask] = useState<Task | null>(null);
  const qc = useQueryClient();

  const { data: tasks, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["warehouse-tasks"],
    queryFn:  () => getRestockTasks(),
    refetchInterval: 30_000,
  });

  const filtered = (tasks ?? []).filter((t) =>
    TAB_STATUSES[tab].includes(t.status)
  );

  const activeCount    = (tasks ?? []).filter((t) => TAB_STATUSES.active.includes(t.status)).length;
  const completedCount = (tasks ?? []).filter((t) => t.status === "COMPLETED").length;

  // If a complete screen is active, render it fullscreen
  if (completeTask) {
    return (
      <CompleteScreen
        task={completeTask}
        onBack={() => setCompleteTask(null)}
        onDone={() => {
          setCompleteTask(null);
          qc.invalidateQueries({ queryKey: ["warehouse-tasks"] });
        }}
      />
    );
  }

  return (
    <div className="px-4 pt-4 space-y-4">
      {/* Tab filter */}
      <div className="flex items-center justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
          <TabsList className="h-10">
            <TabsTrigger value="active" className="px-4 text-sm">
              Active
              {activeCount > 0 && (
                <span className="ml-1.5 rounded-full bg-green-500 text-white text-[10px] px-1.5 py-0.5 font-bold">
                  {activeCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="px-4 text-sm">
              Completed
            </TabsTrigger>
            <TabsTrigger value="all" className="px-4 text-sm">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <RefreshCw className={`h-5 w-5 text-muted-foreground ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((k) => <Skeleton key={k} className="h-48 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <AlertTriangle className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-base font-semibold text-gray-600">No tasks here</p>
          <p className="text-sm text-muted-foreground">
            {tab === "active" ? "You have no active tasks right now." : "Nothing to show."}
          </p>
        </div>
      ) : (
        <div className="space-y-4 pb-4">
          {filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={(t) => setCompleteTask(t)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
