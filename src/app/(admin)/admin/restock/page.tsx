"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  PackageSearch,
  Plus,
  ShoppingCart,
  User,
  X,
  Zap,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getAllStock } from "@/server/actions/inventory";
import {
  assignRestockTask,
  createManualRestockTask,
  getAllWarehouseStaff,
  getRestockTasks,
  reassignRestockTask,
} from "@/server/actions/restock";
import { generateShoppingList, type ShoppingItem } from "@/server/actions/shopping";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Task = Awaited<ReturnType<typeof getRestockTasks>>[number];
type Staff = Awaited<ReturnType<typeof getAllWarehouseStaff>>[number];
type StockRow = Awaited<ReturnType<typeof getAllStock>>[number];

type TaskStatus = "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

// ─── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "Pending",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  NORMAL: "bg-gray-100 text-gray-600",
  LOW: "bg-slate-100 text-slate-500",
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

// ─── Assign Dialog ───────────────────────────────────────────────────────────────

type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

function AssignDialog({
  task,
  staff,
  onClose,
}: {
  task: Task;
  staff: Staff[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [staffId, setStaffId] = useState(task.assignedToId ?? "");
  const [priority, setPriority] = useState<Priority>(task.priority as Priority);
  const [adminNote, setAdminNote] = useState(task.adminNote ?? "");
  const [busy, setBusy] = useState(false);
  function handleStaffChange(v: string | null) {
    setStaffId(v ?? "");
  }

  async function handleAssign() {
    if (!staffId) {
      toast.error("Select a staff member");
      return;
    }
    setBusy(true);
    const res = await assignRestockTask({
      taskId: task.id,
      staffId,
      priority,
      adminNote: adminNote.trim() || undefined,
    });
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Task assigned");
    qc.invalidateQueries({ queryKey: ["admin-restock"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Warehouse Staff</Label>
            <Select value={staffId} onValueChange={handleStaffChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select staff..." />
              </SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.fullName} — {s.user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <div className="grid grid-cols-4 gap-2">
              {(["URGENT", "HIGH", "NORMAL", "LOW"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                    priority === p
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-gray-300"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Note for staff (optional)</Label>
            <Textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="e.g. Get firm ripe tomatoes..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={busy || !staffId}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Re-assign Dialog ────────────────────────────────────────────────────────────

function ReassignDialog({
  task,
  staff,
  onClose,
}: {
  task: Task;
  staff: Staff[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [staffId, setStaffId] = useState(task.assignedToId ?? "");
  const [busy, setBusy] = useState(false);

  async function handleReassign() {
    if (!staffId) {
      toast.error("Select a staff member");
      return;
    }
    setBusy(true);
    const res = await reassignRestockTask({ taskId: task.id, assignedToId: staffId });
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Task reassigned");
    qc.invalidateQueries({ queryKey: ["admin-restock"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Re-assign Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Warehouse Staff</Label>
            <Select value={staffId} onValueChange={(v) => setStaffId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select staff..." />
              </SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.fullName} — {s.user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleReassign} disabled={busy || !staffId}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Restock Task Dialog ──────────────────────────────────────────────────

type NewItem = {
  productId: string;
  productName: string;
  neededKg: string;
  neededPieces: string;
};

function CreateDialog({
  staff,
  lowStock,
  onClose,
}: {
  staff: Staff[];
  lowStock: StockRow[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [items, setItems] = useState<NewItem[]>([]);
  const [assignedToId, setAssignedToId] = useState("");
  function handleAssignedChange(v: string | null) {
    setAssignedToId(v ?? "");
  }
  const [priority, setPriority] = useState("NORMAL");
  const [adminNote, setAdminNote] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const suggestions = lowStock.filter((r) => !items.some((i) => i.productId === r.productId));

  function addSuggestion(r: StockRow) {
    const needed = r.targetStockKg
      ? Math.max(0, Number(r.targetStockKg) - Number(r.availableKg ?? 0))
      : 0;
    setItems((prev) => [
      ...prev,
      {
        productId: r.productId,
        productName: r.product.name,
        neededKg: needed > 0 ? fmt(needed) : "",
        neededPieces: "",
      },
    ]);
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function updateItem(productId: string, field: "neededKg" | "neededPieces", value: string) {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, [field]: value } : i)));
  }

  async function handleCreate() {
    if (items.length === 0) {
      toast.error("Add at least one product");
      return;
    }
    setBusy(true);
    const res = await createManualRestockTask({
      items: items.map((i) => ({
        productId: i.productId,
        neededKg: i.neededKg ? Number(i.neededKg) : undefined,
        neededPieces: i.neededPieces ? Number(i.neededPieces) : undefined,
      })),
      assignedToId: assignedToId || undefined,
      priority,
      adminNote: adminNote || undefined,
    });
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Restock task created");
    qc.invalidateQueries({ queryKey: ["admin-restock"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Restock Task</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-2 py-1">
          {([1, 2, 3] as const).map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        <div className="py-2 min-h-[260px]">
          {/* Step 1: Products */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Select products to restock</p>

              {suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Low stock suggestions
                  </p>
                  {suggestions.slice(0, 6).map((r) => (
                    <button
                      key={r.productId}
                      type="button"
                      onClick={() => addSuggestion(r)}
                      className="w-full flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm hover:bg-amber-100 transition-colors"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="font-medium flex-1">{r.product.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.availableKg != null
                          ? `${fmt(Number(r.availableKg))} kg`
                          : `${r.availablePieces ?? 0} pcs`}
                      </span>
                      <Plus className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {items.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Selected ({items.length})
                  </p>
                  {items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2"
                    >
                      <span className="flex-1 text-sm font-medium">{item.productName}</span>
                      <Input
                        type="number"
                        value={item.neededKg}
                        onChange={(e) => updateItem(item.productId, "neededKg", e.target.value)}
                        placeholder="kg"
                        className="h-7 w-20 text-xs text-center"
                      />
                      <Input
                        type="number"
                        value={item.neededPieces}
                        onChange={(e) => updateItem(item.productId, "neededPieces", e.target.value)}
                        placeholder="pcs"
                        className="h-7 w-20 text-xs text-center"
                      />
                      <button type="button" onClick={() => removeItem(item.productId)}>
                        <X className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Assignment */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm font-medium">Assign & set priority</p>
              <div className="space-y-1.5">
                <Label>Assign to (optional)</Label>
                <Select value={assignedToId} onValueChange={handleAssignedChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Leave unassigned..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <div className="grid grid-cols-4 gap-2">
                  {(["URGENT", "HIGH", "NORMAL", "LOW"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                        priority === p
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-gray-300"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Notes */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm font-medium">Review & add notes</p>
              <div className="rounded-lg bg-gray-50 p-3 space-y-1">
                <p className="text-xs text-muted-foreground">
                  {items.length} product{items.length !== 1 ? "s" : ""}
                </p>
                {assignedToId && (
                  <p className="text-xs text-muted-foreground">
                    Assigned to: {staff.find((s) => s.id === assignedToId)?.fullName ?? "—"}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Priority: {priority}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Admin note (optional)</Label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Instructions for the warehouse staff..."
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={step === 1 && items.length === 0}
            >
              Next
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Task
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Task Card ───────────────────────────────────────────────────────────────────

function TaskCard({ task, staff }: { task: Task; staff: Staff[] }) {
  const [expanded, setExpanded] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);

  return (
    <>
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="p-4 space-y-3">
          {/* Header row */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${STATUS_COLORS[task.status as TaskStatus]} border-0 text-xs`}>
                  {STATUS_LABELS[task.status as TaskStatus]}
                </Badge>
                <Badge className={`${PRIORITY_COLORS[task.priority]} border-0 text-xs`}>
                  {task.priority === "URGENT" && <Zap className="h-3 w-3 mr-1" />}
                  {task.priority}
                </Badge>
                <span className="text-xs text-muted-foreground capitalize">
                  {task.triggerType.replace("_", " ").toLowerCase()}
                </span>
              </div>
              <p className="text-sm font-medium">
                {task.items.length} product{task.items.length !== 1 ? "s" : ""}
                {task.estimatedCost != null && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · est. {Number(task.estimatedCost).toLocaleString()} UZS
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {task.assignedTo ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  {task.assignedTo.fullName}
                </div>
              ) : (
                task.status === "PENDING" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setAssignOpen(true)}
                  >
                    Assign
                  </Button>
                )
              )}
              {task.status === "ASSIGNED" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setReassignOpen(true)}
                >
                  Re-assign
                </Button>
              )}
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="rounded p-1 hover:bg-gray-100 transition-colors"
              >
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          </div>

          {/* Expanded items */}
          {expanded && (
            <div className="border-t pt-3 space-y-2">
              {task.items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Need: {item.neededKg != null ? `${fmt(Number(item.neededKg))} kg` : ""}
                      {item.neededKg != null && item.neededPieces != null ? " / " : ""}
                      {item.neededPieces != null ? `${item.neededPieces} pcs` : ""}
                    </p>
                  </div>
                  {item.isReceived ? (
                    <div className="text-right">
                      <CheckCircle2 className="h-4 w-4 text-green-600 inline" />
                      <p className="text-xs text-muted-foreground">
                        {item.receivedKg != null ? `${fmt(Number(item.receivedKg))} kg` : ""}
                        {item.receivedKg != null && item.receivedPieces != null ? " / " : ""}
                        {item.receivedPieces != null ? `${item.receivedPieces} pcs` : ""}
                      </p>
                    </div>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-500 border-0 text-xs shrink-0">
                      Pending
                    </Badge>
                  )}
                </div>
              ))}
              {task.adminNote && (
                <div className="rounded bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  Note: {task.adminNote}
                </div>
              )}
              {task.staffNote && (
                <div className="rounded bg-gray-50 px-3 py-2 text-xs text-gray-700">
                  Staff note: {task.staffNote}
                </div>
              )}
              {task.completedAt && (
                <p className="text-xs text-muted-foreground">
                  Completed {formatDistanceToNow(new Date(task.completedAt), { addSuffix: true })}
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {assignOpen && (
        <AssignDialog task={task} staff={staff} onClose={() => setAssignOpen(false)} />
      )}
      {reassignOpen && (
        <ReassignDialog task={task} staff={staff} onClose={() => setReassignOpen(false)} />
      )}
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────────

const TABS: { value: string; label: string; statuses: TaskStatus[] }[] = [
  { value: "active", label: "Active", statuses: ["PENDING", "ASSIGNED", "IN_PROGRESS"] },
  { value: "completed", label: "Completed", statuses: ["COMPLETED"] },
  {
    value: "all",
    label: "All",
    statuses: ["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
  },
];

export default function RestockPage() {
  const [tab, setTab] = useState("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[] | null>(null);
  const [askPending, startAsk] = useTransition();

  function handleGenerateShoppingList() {
    startAsk(async () => {
      const result = await generateShoppingList();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.data.items.length === 0) {
        toast.success(result.data.message ?? "Stock is sufficient for all orders!");
      } else {
        setShoppingItems(result.data.items);
        toast.success(
          `Shopping list generated — ${result.data.items.length} product${result.data.items.length !== 1 ? "s" : ""} needed`
        );
      }
    });
  }

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["admin-restock"],
    queryFn: () => getRestockTasks(),
    refetchInterval: 30_000,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["warehouse-staff"],
    queryFn: () => getAllWarehouseStaff(),
  });

  const { data: stockData = [] } = useQuery({
    queryKey: ["admin-stock"],
    queryFn: () => getAllStock(),
  });

  const lowStock = stockData.filter((r) => {
    const kgLow =
      r.minStockKg != null && r.availableKg != null && Number(r.availableKg) < Number(r.minStockKg);
    const piecesLow =
      r.minStockPieces != null && r.availablePieces != null && r.availablePieces < r.minStockPieces;
    return kgLow || piecesLow;
  });

  const activeStatuses = TABS.find((t) => t.value === tab)?.statuses ?? [];

  const filtered = (tasks ?? []).filter((t) => activeStatuses.includes(t.status as TaskStatus));

  const pendingCount = (tasks ?? []).filter((t) => t.status === "PENDING").length;
  const assignedCount = (tasks ?? []).filter((t) => t.status === "ASSIGNED").length;
  const inProgressCount = (tasks ?? []).filter((t) => t.status === "IN_PROGRESS").length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-headline-lg">Restock Tasks</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((k) => (
            <Skeleton key={k} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-headline-lg">Restock Tasks</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleGenerateShoppingList}
            disabled={askPending}
            className="gap-2 border-primary/40 text-primary hover:bg-primary/5"
          >
            {askPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
            Shopping List
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pending", count: pendingCount, icon: Clock, color: "text-gray-600" },
          { label: "Assigned", count: assignedCount, icon: User, color: "text-blue-600" },
          {
            label: "In Progress",
            count: inProgressCount,
            icon: PackageSearch,
            color: "text-amber-600",
          },
        ].map(({ label, count, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-sm p-3 flex items-center gap-3">
            <Icon className={`h-5 w-5 ${color} shrink-0`} />
            <div>
              <p className="text-lg font-bold">{count}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">{lowStock.length}</span> product
            {lowStock.length !== 1 ? "s" : ""} below minimum stock level
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
            onClick={() => setCreateOpen(true)}
          >
            Create Task
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {TABS.map((t) => {
            const count = (tasks ?? []).filter((task) =>
              t.statuses.includes(task.status as TaskStatus)
            ).length;
            return (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                {t.label}
                {count > 0 && (
                  <span className="rounded-full bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 font-medium">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Task list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No tasks in this category
          </div>
        ) : (
          filtered.map((task) => <TaskCard key={task.id} task={task} staff={staff} />)
        )}
      </div>

      {createOpen && (
        <CreateDialog staff={staff} lowStock={lowStock} onClose={() => setCreateOpen(false)} />
      )}

      {/* Shopping list result sheet */}
      <Sheet open={shoppingItems !== null} onOpenChange={(o) => !o && setShoppingItems(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Shopping List — Today
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-3">
            {(shoppingItems ?? []).map((item) => (
              <div key={item.productId} className="rounded-xl border bg-card p-3 space-y-1.5">
                <p className="font-semibold text-sm">{item.productName}</p>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground">
                      {item.toBuyKg > 0 ? `${fmt(item.toBuyKg)} kg` : ""}
                      {item.toBuyKg > 0 && item.toBuyPieces > 0 ? " / " : ""}
                      {item.toBuyPieces > 0 ? `${item.toBuyPieces} pcs` : ""}
                    </p>
                    <p>to buy</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {item.availableKg > 0 ? `${fmt(item.availableKg)} kg` : ""}
                      {item.availableKg > 0 && item.availablePieces > 0 ? " / " : ""}
                      {item.availablePieces > 0 ? `${item.availablePieces} pcs` : ""}
                      {item.availableKg === 0 && item.availablePieces === 0 ? "0" : ""}
                    </p>
                    <p>in stock</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {item.neededKg > 0 ? `${fmt(item.neededKg)} kg` : ""}
                      {item.neededKg > 0 && item.neededPieces > 0 ? " / " : ""}
                      {item.neededPieces > 0 ? `${item.neededPieces} pcs` : ""}
                    </p>
                    <p>ordered</p>
                  </div>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-2 text-center">
              Alert sent to all warehouse staff and delivery drivers
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
