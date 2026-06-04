"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  UserCheck,
  UserX,
} from "lucide-react";
import { useForm } from "react-hook-form";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createStaffSchema,
  type CreateStaffInput,
} from "@/lib/validations/delivery-staff.schema";
import {
  adminResetPassword,
  adminResetAndSendPassword,
  adminToggleStaffActive,
  createDeliveryStaff,
  getAllStaffWithStats,
  getStaffDetails,
  updateDeliveryStaff,
} from "@/server/actions/delivery-staff";
import {
  createWarehouseStaff,
  getAllWarehouseStaffAdmin,
  resetWarehouseStaffPassword,
  resetAndSendWarehousePassword,
  toggleWarehouseStaffActive,
} from "@/server/actions/restock";

// ─── Types ────────────────────────────────────────────────────────────────────

type StaffRow = Awaited<ReturnType<typeof getAllStaffWithStats>>[number];
type StaffDetails = Awaited<ReturnType<typeof getStaffDetails>>;

// ─── Constants ────────────────────────────────────────────────────────────────

const VEHICLE_ICON: Record<string, string> = {
  MOTORCYCLE: "🏍️",
  CAR:        "🚗",
  VAN:        "🚐",
  TRUCK:      "🚚",
};

const VEHICLE_LABELS = ["MOTORCYCLE", "CAR", "VAN", "TRUCK"] as const;

const ROUTE_STATUS: Record<string, { label: string; cls: string }> = {
  PLANNED:     { label: "Planned",   cls: "bg-blue-100 text-blue-700" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-emerald-100 text-emerald-700" },
  COMPLETED:   { label: "Completed", cls: "bg-muted text-muted-foreground" },
  CANCELLED:   { label: "Cancelled", cls: "bg-red-100 text-red-600" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type StatusKind = "online" | "offline" | "inactive";

function getStatusKind(s: StaffRow): StatusKind {
  if (!s.isActive) return "inactive";
  if (s.isAvailable) {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (s.lastSeenAt && new Date(s.lastSeenAt) >= tenMinAgo) return "online";
  }
  return "offline";
}

function StatusDot({ kind }: { kind: StatusKind }) {
  const cls = {
    online:   "bg-green-500",
    offline:  "bg-gray-300",
    inactive: "bg-red-400",
  }[kind];
  const title = { online: "Online", offline: "Offline", inactive: "Inactive" }[kind];
  return (
    <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${cls}`} title={title} />
  );
}

function SortIcon({ col, sort }: { col: string; sort: { key: string; dir: "asc" | "desc" } }) {
  if (sort.key !== col) return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50 inline ml-1" />;
  return sort.dir === "asc"
    ? <ChevronUp className="h-3.5 w-3.5 text-primary inline ml-1" />
    : <ChevronDown className="h-3.5 w-3.5 text-primary inline ml-1" />;
}

function todayStopCount(s: StaffRow) {
  return s.routes.reduce((sum, r) => sum + r._count.stops, 0);
}

// ─── Add Staff Dialog (React Hook Form + Zod) ─────────────────────────────────

function AddStaffDialog({
  open,
  onClose,
  onSuccess,
  onShowCreds,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onShowCreds: (creds: Creds) => void;
  prefill?: { fullName?: string; email?: string; phone?: string; vehicleType?: string; vehiclePlate?: string };
}) {
  const [showPwd, setShowPwd] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateStaffInput>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: {
      fullName:     prefill?.fullName ?? "",
      email:        prefill?.fullName ? generateWorkEmail(prefill.fullName)    : "",
      phone:        prefill?.phone    ?? "+998",
      password:     prefill?.fullName ? generateWorkPassword(prefill.fullName) : "",
      vehicleType:  (prefill?.vehicleType as "CAR" | "MOTORCYCLE" | "VAN" | "TRUCK" | undefined) ?? "CAR",
      vehiclePlate: prefill?.vehiclePlate ?? "",
    },
  });

  useEffect(() => {
    if (open && prefill?.fullName) {
      setValue("fullName", prefill.fullName);
      setValue("email",    generateWorkEmail(prefill.fullName));
      setValue("password", generateWorkPassword(prefill.fullName));
      if (prefill.phone)        setValue("phone", prefill.phone);
      if (prefill.vehicleType)  setValue("vehicleType", prefill.vehicleType as "CAR" | "MOTORCYCLE" | "VAN" | "TRUCK");
      if (prefill.vehiclePlate) setValue("vehiclePlate", prefill.vehiclePlate);
    }
  }, [open, prefill, setValue]);

  const vehicleType = watch("vehicleType");

  async function onSubmit(data: CreateStaffInput) {
    const result = await createDeliveryStaff(data);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Staff member added");
    onShowCreds({
      fullName:  data.fullName,
      email:     data.email,
      password:  data.password,
      sentEmail: true, // createDeliveryStaff already sends the email
    });
    reset();
    onClose();
    onSuccess();
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Staff Member</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-1">
          {/* Full name */}
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input {...register("fullName")} placeholder="Aziz Karimov" />
            {errors.fullName && (
              <p className="text-xs text-red-500">{errors.fullName.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label>Email <span className="text-muted-foreground text-xs">(becomes their login)</span></Label>
            <Input type="email" {...register("email")} placeholder="aziz@ikiwi.uz" />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input {...register("phone")} placeholder="+998901112233" />
            {errors.phone && (
              <p className="text-xs text-red-500">{errors.phone.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label>
              Initial Password{" "}
              <span className="text-muted-foreground text-xs">(shown once — will be emailed)</span>
            </Label>
            <div className="relative">
              <Input
                type={showPwd ? "text" : "password"}
                {...register("password")}
                placeholder="Min 8 characters"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700"
                onClick={() => setShowPwd((v) => !v)}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          {/* Vehicle type (radio cards) */}
          <div className="space-y-2">
            <Label>Vehicle Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {VEHICLE_LABELS.map((v) => (
                <label
                  key={v}
                  className={`flex items-center gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors ${
                    vehicleType === v
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    value={v}
                    {...register("vehicleType")}
                    className="sr-only"
                    onChange={() => setValue("vehicleType", v)}
                  />
                  <span className="text-xl">{VEHICLE_ICON[v]}</span>
                  <span className="text-sm font-medium">
                    {v.charAt(0) + v.slice(1).toLowerCase()}
                  </span>
                </label>
              ))}
            </div>
            {errors.vehicleType && (
              <p className="text-xs text-red-500">{errors.vehicleType.message as string}</p>
            )}
          </div>

          {/* Vehicle plate */}
          <div className="space-y-1.5">
            <Label>
              License Plate{" "}
              <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              {...register("vehiclePlate")}
              placeholder="01 A 123 BC"
              className="font-mono tracking-wider"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Staff Member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Staff Dialog ────────────────────────────────────────────────────────

function EditStaffDialog({
  staff,
  onClose,
  onSuccess,
}: {
  staff: StaffRow | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState<string>("CAR");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (staff) {
      setFullName(staff.fullName);
      setPhone(staff.phone);
      setVehicleType(staff.vehicleType);
      setVehiclePlate(staff.vehiclePlate ?? "");
    }
  }, [staff]);

  async function handleSave() {
    if (!staff) return;
    setSaving(true);
    const result = await updateDeliveryStaff({
      id:           staff.id,
      fullName:     fullName || undefined,
      phone:        phone || undefined,
      vehicleType:  vehicleType || undefined,
      vehiclePlate: vehiclePlate || undefined,
    });
    setSaving(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Staff member updated");
    onClose();
    onSuccess();
  }

  return (
    <Dialog open={!!staff} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit {staff?.fullName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Vehicle Type</Label>
            <Select value={vehicleType} onValueChange={(v) => v && setVehicleType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_LABELS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {VEHICLE_ICON[v]} {v.charAt(0) + v.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>License Plate <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <Input
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value)}
              className="font-mono tracking-wider"
              placeholder="01 A 123 BC"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reset Password Dialog ────────────────────────────────────────────────────

function ResetPasswordDialog({
  staff,
  onClose,
}: {
  staff: StaffRow | null;
  onClose: () => void;
}) {
  const [newPwd, setNewPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!staff) setNewPwd(""); }, [staff]);

  async function handleReset() {
    if (!staff) return;
    setSaving(true);
    const result = await adminResetPassword({ staffId: staff.id, newPassword: newPwd });
    setSaving(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Password reset successfully");
    setNewPwd("");
    onClose();
  }

  return (
    <Dialog open={!!staff} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">
            Set a new password for <strong>{staff?.fullName}</strong>.
          </p>
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showPwd ? "text" : "password"}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="Min 8 characters"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700"
                onClick={() => setShowPwd((v) => !v)}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={handleReset}
            disabled={saving || newPwd.length < 8}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Reset Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Staff Detail Sheet ───────────────────────────────────────────────────────

function StaffDetailSheet({
  staffId,
  allStaff,
  onClose,
  onEdit,
  onResetPassword,
  onToggleActive,
}: {
  staffId: string | null;
  allStaff: StaffRow[];
  onClose: () => void;
  onEdit: (s: StaffRow) => void;
  onResetPassword: (s: StaffRow) => void;
  onToggleActive: (s: StaffRow) => void;
}) {
  const [details, setDetails] = useState<StaffDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!staffId) { setDetails(null); return; }
    setLoading(true);
    getStaffDetails(staffId)
      .then(setDetails)
      .catch(() => toast.error("Failed to load staff details"))
      .finally(() => setLoading(false));
  }, [staffId]);

  const staffRow = allStaff.find((s) => s.id === staffId) ?? null;
  const status = staffRow ? getStatusKind(staffRow) : "offline";

  return (
    <Sheet open={!!staffId} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle>Staff Details</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="space-y-3 pt-6">
            {[1, 2, 3, 4].map((k) => (
              <Skeleton key={k} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : details ? (
          <div className="space-y-6 pt-5">
            {/* Avatar + name */}
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
                {getInitials(details.staff.fullName)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold">{details.staff.fullName}</h2>
                  <StatusDot kind={status} />
                </div>
                <p className="text-sm text-muted-foreground">{details.staff.user.email}</p>
                <p className="text-sm text-muted-foreground">{details.staff.phone}</p>
              </div>
            </div>

            {/* Vehicle info */}
            <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vehicle</h3>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{VEHICLE_ICON[details.staff.vehicleType]}</span>
                <div>
                  <p className="text-sm font-medium">
                    {details.staff.vehicleType.charAt(0) + details.staff.vehicleType.slice(1).toLowerCase()}
                  </p>
                  {details.staff.vehiclePlate && (
                    <p className="text-xs font-mono text-muted-foreground">{details.staff.vehiclePlate}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Performance
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "This week", value: details.stats.routesThisWeek, unit: "routes" },
                  { label: "All-time", value: details.stats.totalDeliveries, unit: "deliveries" },
                  { label: "Avg / route", value: details.stats.avgDeliveries, unit: "stops" },
                  { label: "On-time rate", value: `${details.stats.onTimeRate}%`, unit: "" },
                  { label: "Return rate", value: `${details.stats.returnRate}%`, unit: "" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border bg-card p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
                    {s.unit && <p className="text-[10px] text-muted-foreground">{s.unit}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Recent routes */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Recent Routes (7 days)
              </h3>
              {details.recentRoutes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No routes this week</p>
              ) : (
                <div className="space-y-2">
                  {details.recentRoutes.map((r) => {
                    const badge = ROUTE_STATUS[r.status] ?? { label: r.status, cls: "bg-muted text-muted-foreground" };
                    return (
                      <div key={r.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 bg-card text-sm">
                        <div>
                          <p className="font-medium">{format(new Date(r.date), "EEE, MMM d")}</p>
                          <p className="text-xs text-muted-foreground">
                            {r._count.stops} stops
                            {r.totalDistanceKm != null && ` · ${Number(r.totalDistanceKm).toFixed(1)} km`}
                          </p>
                        </div>
                        <Badge className={`text-xs border-0 ${badge.cls}`}>{badge.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            {staffRow && (
              <div className="flex flex-col gap-2 pt-2 border-t">
                <Button variant="outline" className="w-full justify-start" onClick={() => { onClose(); onEdit(staffRow); }}>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Edit Info
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => { onClose(); onResetPassword(staffRow); }}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Reset Password
                </Button>
                <Button
                  variant="outline"
                  className={`w-full justify-start ${staffRow.isActive ? "text-destructive hover:bg-destructive/5 border-destructive/30" : "text-green-700 hover:bg-green-50 border-green-300"}`}
                  onClick={() => { onClose(); onToggleActive(staffRow); }}
                >
                  {staffRow.isActive ? (
                    <><UserX className="h-4 w-4 mr-2" />Deactivate</>
                  ) : (
                    <><UserCheck className="h-4 w-4 mr-2" />Activate</>
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            Failed to load
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Auto-generate work email + password from name ───────────────────────────

/** Returns the "given name" — last word in Uzbek "Surname Firstname" format. */
function getGivenName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return parts[parts.length - 1];
}

/** Normalize a name to lowercase ASCII letters only. Strips apostrophes & accents. */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ʻʼ'`ʹ]/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** "G'ulomov Shohruh" → "shohruh@ikiwi.com" */
function generateWorkEmail(fullName: string): string {
  const slug = normalizeName(getGivenName(fullName));
  return slug ? `${slug}@ikiwi.com` : "";
}

/** "G'ulomov Shohruh" → "Shohruh123!" */
function generateWorkPassword(fullName: string): string {
  const slug = normalizeName(getGivenName(fullName));
  if (!slug) return "";
  return slug.charAt(0).toUpperCase() + slug.slice(1) + "123!";
}

// ─── Credentials reveal modal ─────────────────────────────────────────────────

interface Creds {
  fullName: string;
  email:    string;
  password: string;
  sentEmail: boolean;
}

function CredentialsModal({ creds, onClose }: { creds: Creds | null; onClose: () => void }) {
  const [copied, setCopied] = useState<"email" | "password" | "all" | null>(null);

  if (!creds) return null;

  function copy(text: string, key: "email" | "password" | "all") {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const fullCreds = `Email: ${creds.email}\nPassword: ${creds.password}`;

  return (
    <Dialog open={!!creds} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Credentials ready for {creds.fullName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            {creds.sentEmail
              ? "An email with these credentials was sent. You can also copy and share them via WhatsApp, Telegram or SMS."
              : "Email could not be sent — please share these credentials manually with the staff member."}
          </p>

          {/* Email row */}
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Email</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm">{creds.email}</code>
              <Button size="sm" variant="outline" className="h-8 px-2 shrink-0" onClick={() => copy(creds.email, "email")}>
                {copied === "email" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* Password row */}
          <div className="rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1.5">
              Password (shown once)
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm font-bold">{creds.password}</code>
              <Button size="sm" variant="outline" className="h-8 px-2 shrink-0" onClick={() => copy(creds.password, "password")}>
                {copied === "password" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2 leading-snug">
              ⚠️ This password won&apos;t be shown again. Save it somewhere safe or share now.
            </p>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => copy(fullCreds, "all")}
          >
            {copied === "all" ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy both
              </>
            )}
          </Button>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Warehouse staff types ────────────────────────────────────────────────────

type WHStaff = Awaited<ReturnType<typeof getAllWarehouseStaffAdmin>>[number];

// ─── Add Warehouse Staff Dialog ───────────────────────────────────────────────

function AddWarehouseDialog({
  open,
  onClose,
  onSuccess,
  onShowCreds,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onShowCreds: (creds: Creds) => void;
  prefill?: { fullName?: string; email?: string; phone?: string };
}) {
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    fullName: prefill?.fullName ?? "",
    email:    prefill?.fullName ? generateWorkEmail(prefill.fullName)    : "",
    phone:    prefill?.phone    ?? "",
    password: prefill?.fullName ? generateWorkPassword(prefill.fullName) : "",
  });

  useEffect(() => {
    if (open && prefill?.fullName) {
      setForm({
        fullName: prefill.fullName,
        email:    generateWorkEmail(prefill.fullName),
        phone:    prefill.phone ?? "",
        password: generateWorkPassword(prefill.fullName),
      });
    }
  }, [open, prefill]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createWarehouseStaff(form);
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Warehouse staff added");
    onShowCreds({
      fullName:  form.fullName,
      email:     form.email,
      password:  form.password,
      sentEmail: false, // createWarehouseStaff doesn't currently email — admin shares manually
    });
    setForm({ fullName: "", email: "", phone: "", password: "" });
    onClose();
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Warehouse Staff</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Akbar Karimov" required />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="akbar@ikiwi.uz" required />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998901234567" required />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min 8 characters"
                required
                minLength={8}
              />
              <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Staff
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reset Warehouse Password Dialog ─────────────────────────────────────────

function ResetWHPasswordDialog({
  staff,
  onClose,
}: {
  staff: WHStaff | null;
  onClose: () => void;
}) {
  const [showPw, setShowPw] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!staff) return;
    setBusy(true);
    const res = await resetWarehouseStaffPassword(staff.id, password);
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Password updated");
    setPassword("");
    onClose();
  }

  return (
    <Dialog open={!!staff} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset Password — {staff?.fullName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
                minLength={8}
              />
              <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || password.length < 8}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Warehouse Staff Tab ──────────────────────────────────────────────────────

function WarehouseStaffTab({
  prefill,
  autoOpen,
  onConsumePrefill,
  onShowCreds,
}: {
  prefill?: { fullName?: string; email?: string; phone?: string };
  autoOpen?: boolean;
  onConsumePrefill?: () => void;
  onShowCreds: (creds: Creds) => void;
}) {
  const [whStaff, setWhStaff] = useState<WHStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<WHStaff | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpen) {
      setAddOpen(true);
      onConsumePrefill?.();
    }
  }, [autoOpen, onConsumePrefill]);

  async function handleResetAndSend(s: WHStaff) {
    setResettingId(s.id);
    const newPw = generateWorkPassword(s.fullName) || "Password123!";
    const res = await resetAndSendWarehousePassword(s.id, newPw);
    setResettingId(null);
    if (!res.success) { toast.error(res.error); return; }
    onShowCreds({
      fullName:  s.fullName,
      email:     res.data!.email,
      password:  res.data!.password,
      sentEmail: res.data!.sentEmail,
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    try { setWhStaff(await getAllWarehouseStaffAdmin()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(s: WHStaff) {
    setTogglingId(s.id);
    const res = await toggleWarehouseStaffActive(s.id);
    setTogglingId(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success(s.isActive ? "Staff deactivated" : "Staff activated");
    load();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {whStaff.length} staff · {whStaff.filter((s) => s.isActive).length} active
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Warehouse Staff
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((k) => <Skeleton key={k} className="h-14 w-full" />)}
          </div>
        ) : whStaff.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3">🏭</p>
            <p className="font-medium text-foreground">No warehouse staff yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add your first warehouse staff member to get started</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {whStaff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                      {getInitials(s.fullName)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">{s.fullName}</p>
                    <p className="text-xs text-muted-foreground sm:hidden">{s.user.email}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {s.user.email}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {s.phone}
                  </TableCell>
                  <TableCell>
                    <Badge className={s.isActive ? "bg-green-100 text-green-700 border-0" : "bg-muted text-muted-foreground border-0"}>
                      {s.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={() => handleResetAndSend(s)}
                        disabled={resettingId === s.id}
                        title="Reset password and send via email"
                      >
                        {resettingId === s.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Reset & Send
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={() => setResetTarget(s)}
                        title="Set a custom password"
                      >
                        <KeyRound className="h-3 w-3 mr-1" /> Custom
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className={`h-7 w-7 ${s.isActive ? "hover:text-red-600" : "hover:text-green-700"}`}
                        disabled={togglingId === s.id}
                        onClick={() => handleToggle(s)}
                        title={s.isActive ? "Deactivate" : "Activate"}
                      >
                        {togglingId === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : s.isActive ? (
                          <UserX className="h-3.5 w-3.5" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AddWarehouseDialog open={addOpen} onClose={() => setAddOpen(false)} onSuccess={load} prefill={prefill} onShowCreds={onShowCreds} />
      <ResetWHPasswordDialog staff={resetTarget} onClose={() => setResetTarget(null)} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type SortKey = "fullName" | "vehicleType" | "status" | "today";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

export default function AdminStaffPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading…</div>}>
      <StaffPageInner />
    </Suspense>
  );
}

function StaffPageInner() {
  const sp = useSearchParams();

  // Read prefill params from URL (e.g. coming from /admin/applications "Accept")
  const applyParam   = sp.get("apply") === "1";
  const roleParam    = sp.get("role");
  const nameParam    = sp.get("name") ?? undefined;
  const emailParam   = sp.get("email") ?? undefined;
  const phoneParam   = sp.get("phone") ?? undefined;
  const vehicleParam = sp.get("vehicleType") ?? undefined;
  const plateParam   = sp.get("vehiclePlate") ?? undefined;

  const initialTab: "delivery" | "warehouse" =
    applyParam && roleParam === "WAREHOUSE" ? "warehouse" : "delivery";

  const [tab, setTab] = useState<"delivery" | "warehouse">(initialTab);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "fullName", dir: "asc" });

  // Prefill state — consumed on first render
  const [deliveryPrefill, setDeliveryPrefill] = useState<{
    fullName?: string; email?: string; phone?: string; vehicleType?: string; vehiclePlate?: string;
  } | null>(applyParam && roleParam === "DRIVER" ? {
    fullName: nameParam, email: emailParam, phone: phoneParam,
    vehicleType: vehicleParam, vehiclePlate: plateParam,
  } : null);
  const [warehousePrefill, setWarehousePrefill] = useState<{
    fullName?: string; email?: string; phone?: string;
  } | null>(applyParam && roleParam === "WAREHOUSE" ? {
    fullName: nameParam, email: emailParam, phone: phoneParam,
  } : null);

  // Auto-open the right dialog when arriving from applications
  const [autoOpenDelivery,  setAutoOpenDelivery]  = useState(applyParam && roleParam === "DRIVER");
  const [autoOpenWarehouse, setAutoOpenWarehouse] = useState(applyParam && roleParam === "WAREHOUSE");

  // Dialog/sheet states
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffRow | null>(null);
  const [resetTarget, setResetTarget] = useState<StaffRow | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [resettingDeliveryId, setResettingDeliveryId] = useState<string | null>(null);
  const [creds, setCreds] = useState<Creds | null>(null);

  async function handleDeliveryResetAndSend(s: StaffRow) {
    setResettingDeliveryId(s.id);
    const newPw = generateWorkPassword(s.fullName) || "Password123!";
    const res = await adminResetAndSendPassword({ staffId: s.id, newPassword: newPw });
    setResettingDeliveryId(null);
    if (!res.success) { toast.error(res.error); return; }
    setCreds({
      fullName:  s.fullName,
      email:     res.data!.email,
      password:  res.data!.password,
      sentEmail: res.data!.sentEmail,
    });
  }

  // Auto-open delivery dialog when arriving from a driver application
  useEffect(() => {
    if (autoOpenDelivery) {
      setAddOpen(true);
      setAutoOpenDelivery(false);
    }
  }, [autoOpenDelivery]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStaff(await getAllStaffWithStats());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggleActive(s: StaffRow) {
    setTogglingId(s.id);
    const result = await adminToggleStaffActive(s.id);
    setTogglingId(null);
    if (!result.success) { toast.error(result.error); return; }
    toast.success(result.data!.isActive ? "Staff activated" : "Staff deactivated");
    load();
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  const sorted = [...staff].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    if (sort.key === "fullName")    return a.fullName.localeCompare(b.fullName) * dir;
    if (sort.key === "vehicleType") return a.vehicleType.localeCompare(b.vehicleType) * dir;
    if (sort.key === "status")      return getStatusKind(a).localeCompare(getStatusKind(b)) * dir;
    if (sort.key === "today")       return (todayStopCount(a) - todayStopCount(b)) * dir;
    return 0;
  });

  // Stats
  const onlineCount   = staff.filter((s) => getStatusKind(s) === "online").length;
  const routesToday   = staff.filter((s) => s.routes.length > 0).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-headline-lg">Staff</h1>
        {tab === "delivery" && (
          <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Driver
          </Button>
        )}
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 border-b border-border">
        {(["delivery", "warehouse"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "delivery" ? "🚚 Delivery Staff" : "🏭 Warehouse Staff"}
          </button>
        ))}
      </div>

      {tab === "warehouse" && (
        <WarehouseStaffTab
          prefill={warehousePrefill ?? undefined}
          autoOpen={autoOpenWarehouse}
          onConsumePrefill={() => {
            setAutoOpenWarehouse(false);
            setWarehousePrefill(null);
          }}
          onShowCreds={setCreds}
        />
      )}
      {tab === "delivery" && (<>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { title: "Total Drivers", value: staff.length, color: "blue" },
          { title: "Online Today",  value: onlineCount,  color: "green" },
          { title: "Routes Today",  value: routesToday,  color: "purple" },
        ].map(({ title, value, color }) => {
          const clr: Record<string, string> = {
            blue:   "bg-blue-50 text-blue-600",
            green:  "bg-green-50 text-green-600",
            purple: "bg-purple-50 text-purple-600",
          };
          return (
            <Card key={title} className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-data-display ${loading ? "text-muted-foreground" : ""}`}>
                  {loading ? "…" : value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((k) => <Skeleton key={k} className="h-14 w-full" />)}
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3">🚗</p>
            <p className="font-medium text-gray-700">No delivery staff yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add your first driver to get started</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/40"
                  onClick={() => toggleSort("fullName")}
                >
                  Name <SortIcon col="fullName" sort={sort} />
                </TableHead>
                <TableHead className="hidden sm:table-cell">Phone</TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/40 hidden md:table-cell"
                  onClick={() => toggleSort("vehicleType")}
                >
                  Vehicle <SortIcon col="vehicleType" sort={sort} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/40"
                  onClick={() => toggleSort("status")}
                >
                  Status <SortIcon col="status" sort={sort} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/40 hidden lg:table-cell"
                  onClick={() => toggleSort("today")}
                >
                  Today <SortIcon col="today" sort={sort} />
                </TableHead>
                <TableHead className="w-[160px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((s) => {
                const status  = getStatusKind(s);
                const stops   = todayStopCount(s);
                return (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-muted/40/80"
                    onClick={() => setSelectedId(s.id)}
                  >
                    {/* Avatar */}
                    <TableCell>
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                        {getInitials(s.fullName)}
                      </div>
                    </TableCell>

                    {/* Name */}
                    <TableCell>
                      <p className="font-medium text-sm">{s.fullName}</p>
                      <p className="text-xs text-muted-foreground md:hidden">
                        {VEHICLE_ICON[s.vehicleType]} {s.vehicleType.charAt(0) + s.vehicleType.slice(1).toLowerCase()}
                        {s.vehiclePlate && ` · ${s.vehiclePlate}`}
                      </p>
                    </TableCell>

                    {/* Phone */}
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {s.phone}
                    </TableCell>

                    {/* Vehicle */}
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-sm">
                        <span>{VEHICLE_ICON[s.vehicleType]}</span>
                        <span>{s.vehicleType.charAt(0) + s.vehicleType.slice(1).toLowerCase()}</span>
                      </div>
                      {s.vehiclePlate && (
                        <p className="text-xs font-mono text-muted-foreground">{s.vehiclePlate}</p>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <StatusDot kind={status} />
                        <span className="text-sm capitalize">
                          {status === "online" ? "Online" : status === "offline" ? "Offline" : "Inactive"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Today */}
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {stops > 0 ? `${stops} stops` : s.isActive ? "—" : <span className="text-red-400">Inactive</span>}
                    </TableCell>

                    {/* Actions */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2"
                          onClick={() => setSelectedId(s.id)}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2"
                          onClick={() => setEditTarget(s)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2"
                          disabled={resettingDeliveryId === s.id}
                          onClick={() => handleDeliveryResetAndSend(s)}
                          title="Reset password and send via email"
                        >
                          {resettingDeliveryId === s.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Mail className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className={`h-7 w-7 ${s.isActive ? "hover:text-red-600" : "hover:text-green-700"}`}
                          disabled={togglingId === s.id}
                          onClick={() => handleToggleActive(s)}
                        >
                          {togglingId === s.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : s.isActive ? (
                            <UserX className="h-3.5 w-3.5" />
                          ) : (
                            <UserCheck className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialogs & Sheet */}
      <AddStaffDialog
        open={addOpen}
        onClose={() => { setAddOpen(false); setDeliveryPrefill(null); }}
        onSuccess={load}
        onShowCreds={setCreds}
        prefill={deliveryPrefill ?? undefined}
      />
      <EditStaffDialog
        staff={editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={load}
      />
      <ResetPasswordDialog
        staff={resetTarget}
        onClose={() => setResetTarget(null)}
      />
      <StaffDetailSheet
        staffId={selectedId}
        allStaff={staff}
        onClose={() => setSelectedId(null)}
        onEdit={setEditTarget}
        onResetPassword={setResetTarget}
        onToggleActive={handleToggleActive}
      />
      </>)}

      {/* Credentials reveal modal — shown after creating staff or resetting password */}
      <CredentialsModal creds={creds} onClose={() => setCreds(null)} />
    </div>
  );
}
