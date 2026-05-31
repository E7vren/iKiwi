"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Briefcase, Check, Loader2, Mail, Phone, Truck, User, Warehouse, X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  getJobApplications,
  updateApplicationStatus,
} from "@/server/actions/applications";

type App = Awaited<ReturnType<typeof getJobApplications>>[number];

type Status = "PENDING" | "REVIEWED" | "ACCEPTED" | "REJECTED";

const STATUS_BADGE: Record<Status, string> = {
  PENDING:  "bg-amber-100 text-amber-700",
  REVIEWED: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

const VEHICLE_ICON: Record<string, string> = {
  CAR: "🚗", MOTORCYCLE: "🏍️", VAN: "🚐", TRUCK: "🚚", NONE: "🚙",
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | Status>("PENDING");
  const [selected, setSelected] = useState<App | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function load() {
    setLoading(true);
    try { setApps(await getJobApplications()); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = tab === "all" ? apps : apps.filter((a) => a.status === tab);
  const counts = {
    PENDING:  apps.filter((a) => a.status === "PENDING").length,
    REVIEWED: apps.filter((a) => a.status === "REVIEWED").length,
    ACCEPTED: apps.filter((a) => a.status === "ACCEPTED").length,
    REJECTED: apps.filter((a) => a.status === "REJECTED").length,
  };

  async function setStatus(status: Status) {
    if (!selected) return;
    setBusy(true);
    const res = await updateApplicationStatus(selected.id, status, note || undefined);
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success(`Marked ${status.toLowerCase()}`);
    setSelected(null);
    setNote("");
    load();
  }

  function buildStaffUrl(app: App): string {
    const params = new URLSearchParams();
    params.set("apply", "1");
    params.set("name", app.fullName);
    params.set("phone", app.phone);
    if (app.email) params.set("email", app.email);
    if (app.role === "DRIVER" && app.vehicleType && app.vehicleType !== "NONE") {
      params.set("vehicleType", app.vehicleType);
    }
    if (app.vehiclePlate) params.set("vehiclePlate", app.vehiclePlate);
    return `/admin/staff?${params.toString()}`;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-headline-lg">Applications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {apps.length} total · {counts.PENDING} pending review
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="h-10">
          <TabsTrigger value="PENDING" className="text-sm">
            Pending
            {counts.PENDING > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.5 font-bold">
                {counts.PENDING}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="REVIEWED" className="text-sm">Reviewed</TabsTrigger>
          <TabsTrigger value="ACCEPTED" className="text-sm">Accepted</TabsTrigger>
          <TabsTrigger value="REJECTED" className="text-sm">Rejected</TabsTrigger>
          <TabsTrigger value="all" className="text-sm">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Table */}
      <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((k) => <Skeleton key={k} className="h-14 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">No applications</p>
            <p className="text-sm text-muted-foreground mt-1">
              {tab === "PENDING" ? "Nothing waiting for review" : "No applications in this status"}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Submitted</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((app) => (
                <TableRow
                  key={app.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => { setSelected(app); setNote(app.adminNote ?? ""); }}
                >
                  <TableCell>
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {getInitials(app.fullName)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">{app.fullName}</p>
                    {app.email && (
                      <p className="text-xs text-muted-foreground">{app.email}</p>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {app.phone}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      {app.role === "DRIVER" ? (
                        <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span>{app.role === "DRIVER" ? "Driver" : "Warehouse"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {app.vehicleType ? (
                      <span>
                        {VEHICLE_ICON[app.vehicleType] ?? "—"}{" "}
                        <span className="text-muted-foreground capitalize">
                          {app.vehicleType.toLowerCase()}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${STATUS_BADGE[app.status]} border-0 text-xs capitalize`}>
                      {app.status.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(app);
                        setNote(app.adminNote ?? "");
                      }}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setNote(""); } }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Application details</SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Header */}
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-base font-bold shrink-0">
                    {getInitials(selected.fullName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold">{selected.fullName}</p>
                    <Badge className={`${STATUS_BADGE[selected.status]} border-0 text-xs capitalize mt-1`}>
                      {selected.status.toLowerCase()}
                    </Badge>
                  </div>
                </div>

                {/* Contact */}
                <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="text-xs text-muted-foreground">Applying for</p>
                      <p className="font-medium">
                        {selected.role === "DRIVER" ? "Driver" : "Warehouse Staff"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <a href={`tel:${selected.phone}`} className="font-medium text-primary hover:underline">
                        {selected.phone}
                      </a>
                    </div>
                  </div>
                  {selected.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="text-xs text-muted-foreground">Email</p>
                        <a href={`mailto:${selected.email}`} className="font-medium text-primary hover:underline">
                          {selected.email}
                        </a>
                      </div>
                    </div>
                  )}
                  {selected.vehicleType && (
                    <div className="flex items-start gap-3">
                      <Truck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="text-xs text-muted-foreground">Vehicle</p>
                        <p className="font-medium">
                          {VEHICLE_ICON[selected.vehicleType]} {selected.vehicleType.charAt(0) + selected.vehicleType.slice(1).toLowerCase()}
                          {selected.vehiclePlate && (
                            <span className="text-muted-foreground ml-2 font-mono text-xs">
                              {selected.vehiclePlate}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Experience */}
                {selected.experience && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      About / Experience
                    </p>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {selected.experience}
                    </p>
                  </div>
                )}

                {/* Admin note */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Admin note (optional)
                  </label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Notes about this candidate..."
                    rows={3}
                  />
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  {selected.status !== "ACCEPTED" && (
                    <Link
                      href={buildStaffUrl(selected)}
                      onClick={() => setStatus("ACCEPTED")}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                      <Check className="h-4 w-4" />
                      Accept & create staff account
                    </Link>
                  )}
                  {selected.status === "PENDING" && (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={busy}
                      onClick={() => setStatus("REVIEWED")}
                    >
                      {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Mark as reviewed
                    </Button>
                  )}
                  {selected.status !== "REJECTED" && (
                    <Button
                      variant="outline"
                      className="w-full text-destructive hover:bg-destructive/5 border-destructive/30"
                      disabled={busy}
                      onClick={() => setStatus("REJECTED")}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject application
                    </Button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Submitted {formatDistanceToNow(new Date(selected.createdAt), { addSuffix: true })}
                  {selected.reviewedAt && (
                    <> · Reviewed {formatDistanceToNow(new Date(selected.reviewedAt), { addSuffix: true })}</>
                  )}
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
