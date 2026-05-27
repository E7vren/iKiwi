"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, ExternalLink, Loader2, MapPin, Pencil, Phone, Search, User, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminUpdateShop, updateShop } from "@/server/actions/shops";
import type { Shop } from "@/types";

async function fetchShops(): Promise<Shop[]> {
  const res = await fetch("/api/shops");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function AdminEditShopDialog({
  shop,
  onClose,
}: {
  shop: Shop & { createdAt: string };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: shop.name,
    ownerName: shop.ownerName,
    phone: shop.phone,
    address: shop.address,
    latitude: String(shop.latitude),
    longitude: String(shop.longitude),
  });
  const [busy, setBusy] = useState(false);

  function field(k: keyof typeof form) {
    return {
      value: form[k],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [k]: e.target.value })),
    };
  }

  async function handleSave() {
    setBusy(true);
    const result = await adminUpdateShop({
      shopId: shop.id,
      name: form.name,
      ownerName: form.ownerName,
      phone: form.phone,
      address: form.address,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
    });
    setBusy(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Shop updated");
    qc.invalidateQueries({ queryKey: ["shops"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Shop — {shop.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {(["name", "ownerName", "phone", "address", "latitude", "longitude"] as const).map((k) => (
            <div key={k} className="space-y-1">
              <Label className="capitalize">{k}</Label>
              <Input {...field(k)} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminShopsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "PENDING">("ALL");
  const [editingShop, setEditingShop] = useState<Shop | null>(null);

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ["shops"],
    queryFn: fetchShops,
  });

  async function toggle(shopId: string, isActive: boolean) {
    const result = await updateShop({ shopId, isActive });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(isActive ? "Shop approved!" : "Shop blocked");
    qc.invalidateQueries({ queryKey: ["shops"] });
  }

  const filtered = shops.filter((s) => {
    const matchFilter =
      filter === "ALL" ||
      (filter === "ACTIVE" && s.isActive) ||
      (filter === "PENDING" && !s.isActive);
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.ownerName.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q) ||
      s.phone.includes(q);
    return matchFilter && matchSearch;
  });

  const pending = shops.filter((s) => !s.isActive).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-headline-lg">Shops</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {shops.length} shops ·{" "}
            {pending > 0 && (
              <span className="text-orange-600 font-medium">{pending} pending approval</span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search shops…"
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {(["ALL", "ACTIVE", "PENDING"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {f === "ALL"
                ? `All (${shops.length})`
                : f === "ACTIVE"
                  ? `Active (${shops.length - pending})`
                  : `Pending (${pending})`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {(["a", "b", "c", "d"] as const).map((k) => (
              <Skeleton key={k} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <p>No shops found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop</TableHead>
                <TableHead className="hidden md:table-cell">Owner</TableHead>
                <TableHead className="hidden lg:table-cell">Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[160px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((shop) => (
                <TableRow key={shop.id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-sm">{shop.name}</p>
                      {Date.now() - new Date(shop.createdAt).getTime() < 24 * 60 * 60 * 1000 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          NEW
                        </span>
                      )}
                    </div>
                    {shop.user && (
                      <p className="text-xs text-muted-foreground">{shop.user.email}</p>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="space-y-0.5">
                      <p className="text-sm flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {shop.ownerName}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {shop.phone}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <p className="text-sm text-muted-foreground flex items-center gap-1 max-w-[200px] truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {shop.address}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        shop.isActive
                          ? "bg-green-100 text-green-700 border-0 text-xs"
                          : "bg-amber-100 text-amber-700 border-0 text-xs"
                      }
                    >
                      {shop.isActive ? "Active" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditingShop(shop)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <a
                        href={`https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="icon" variant="ghost" className="h-7 w-7">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                      {shop.isActive ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                          onClick={() => toggle(shop.id, false)}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Block
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-primary hover:bg-primary/90"
                          onClick={() => toggle(shop.id, true)}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      {editingShop && (
        <AdminEditShopDialog shop={editingShop} onClose={() => setEditingShop(null)} />
      )}
    </div>
  );
}
