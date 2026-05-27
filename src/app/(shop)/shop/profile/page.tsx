"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bell, ChevronRight, ClipboardList, CreditCard,
  FileText, Heart, HelpCircle, Lock,
  LogOut, MapPin, Pencil, Phone, Plus,
  Settings, Star, Store, Trash2,
} from "lucide-react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ShopLocationForm, type LocationValue } from "@/components/shop/ShopLocationForm";
import { getMyShops, addShop, updateMyShop, deleteMyShop, getMyStats, type MyShop } from "@/server/actions/shops";
import { ContactModal } from "@/components/shop/ContactModal";
import { AppFooter } from "@/components/shared/AppFooter";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString("ru-RU");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <h3 className="mt-6 mb-2 text-[11px] font-semibold uppercase tracking-[0.6px] text-[#5F6368]">
      {label}
    </h3>
  );
}

function MenuCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden divide-y divide-border">
      {children}
    </div>
  );
}

interface RowProps {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  noChevron?: boolean;
}

function MenuRow({ icon, label, badge, href, onClick, danger, noChevron }: RowProps) {
  const inner = (
    <div className={cn(
      "flex items-center h-14 px-4 gap-3 transition-colors",
      danger ? "hover:bg-red-50 dark:hover:bg-red-950/30 active:bg-red-100" : "hover:bg-accent active:bg-accent/80"
    )}>
      <span className={cn("shrink-0", danger ? "text-red-500" : "text-muted-foreground")}>
        {icon}
      </span>
      <span className={cn(
        "flex-1 text-[15px] font-medium leading-none",
        danger ? "text-red-600 dark:text-red-400" : "text-foreground"
      )}>
        {label}
      </span>
      {badge && <span className="text-[12px] text-muted-foreground mr-1 shrink-0">{badge}</span>}
      {!noChevron && <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#9E9E9E]" />}
    </div>
  );

  if (href)    return <Link href={href} className="block">{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className="w-full text-left">{inner}</button>;
  return <>{inner}</>;
}

// ─── Add/Edit shop dialog ─────────────────────────────────────────────────────

const shopFormSchema = z.object({
  name:      z.string().min(2, "Shop name required"),
  ownerName: z.string().min(2, "Owner name required"),
  phone:     z.string().min(7, "Phone required"),
});
type ShopFormFields = z.infer<typeof shopFormSchema>;

function AddEditShopDialog({
  open, onClose, initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: MyShop | null;
}) {
  const qc = useQueryClient();
  const [location, setLocation] = useState<LocationValue | null>(
    initial ? { address: initial.address, latitude: initial.latitude, longitude: initial.longitude } : null
  );

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<ShopFormFields>({
    resolver: zodResolver(shopFormSchema),
    defaultValues: initial
      ? { name: initial.name, ownerName: initial.ownerName, phone: initial.phone }
      : { name: "", ownerName: "", phone: "" },
  });

  useEffect(() => {
    if (open) {
      reset(initial
        ? { name: initial.name, ownerName: initial.ownerName, phone: initial.phone }
        : { name: "", ownerName: "", phone: "" }
      );
      setLocation(initial
        ? { address: initial.address, latitude: initial.latitude, longitude: initial.longitude }
        : null
      );
    }
  }, [open, initial, reset]);

  async function onSubmit(data: ShopFormFields) {
    if (!location) { toast.error("Please set a location"); return; }
    const payload = { ...data, ...location };

    const result = initial
      ? await updateMyShop({ shopId: initial.id, ...payload })
      : await addShop(payload);

    if (!result.success) { toast.error(result.error); return; }
    toast.success(initial ? "Shop updated" : "Shop added!");
    qc.invalidateQueries({ queryKey: ["my-shops"] });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Shop" : "Add New Shop"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Shop name *</Label>
            <Input {...register("name")} placeholder="Yunusobod Market" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Owner name *</Label>
            <Input {...register("ownerName")} placeholder="Akbar Karimov" />
            {errors.ownerName && <p className="text-xs text-destructive">{errors.ownerName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Phone *</Label>
            <Input {...register("phone")} placeholder="+998 90 123 45 67" />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>
          <ShopLocationForm value={location} onChange={setLocation} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : initial ? "Save Changes" : "Add Shop"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Section wrapper with staggered fade-up ───────────────────────────────────

function Section({ delay, children }: { delay: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [editShop, setEditShop]         = useState<MyShop | null>(null);
  const [addOpen, setAddOpen]           = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MyShop | null>(null);
  const [signOutOpen, setSignOutOpen]   = useState(false);
  const [contactOpen, setContactOpen]   = useState(false);

  const { data: shops = [], isLoading: shopsLoading } = useQuery({
    queryKey: ["my-shops"],
    queryFn: () => getMyShops(),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["my-stats"],
    queryFn:  () => getMyStats(),
  });

  const userName = session?.user?.name ?? "Shop Owner";

  return (
    <div className="pb-6">

      {/* 1 ── My Shops */}
      <Section delay={0}>
        <div className="rounded-2xl bg-card border border-border shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base">My Shops</h3>
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="gap-1 h-8">
              <Plus className="h-3.5 w-3.5" /> Add Shop
            </Button>
          </div>
          {shopsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((k) => <Skeleton key={k} className="h-16 rounded-xl" />)}
            </div>
          ) : shops.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No shops yet. Add your first shop.
            </p>
          ) : (
            <div className="space-y-2">
              {shops.map((shop) => (
                <div key={shop.id} className="rounded-xl border bg-background p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{shop.name}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        shop.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                      }`}>
                        {shop.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 shrink-0" /> {shop.address}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditShop(shop)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(shop)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* 2 ── Stats */}
      <Section delay={0.06}>
        <SectionHeader label="This Month" />
        <Link href="/shop/orders" className="block">
          <div className="rounded-2xl bg-card border border-border shadow-sm px-2 py-4 hover:bg-accent transition-colors">
            {statsLoading ? (
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <Skeleton className="h-6 w-14" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 divide-x divide-border">
                {([
                  { value: String(stats?.count ?? 0),               label: "Orders" },
                  { value: `${compact(stats?.totalSpent ?? 0)} UZS`, label: "Total Spent" },
                  { value: `${compact(stats?.avgOrder ?? 0)} UZS`,   label: "Avg Order" },
                ] as const).map(({ value, label }) => (
                  <div key={label} className="flex flex-col items-center px-2 py-1">
                    <span className="text-[17px] font-bold text-[#1A1A1A] tabular-nums leading-tight">
                      {value}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Link>
      </Section>

      {/* 3 ── Account */}
      <Section delay={0.12}>
        <SectionHeader label="Account" />
        <MenuCard>
          <MenuRow icon={<Store className="h-5 w-5" />}      label="Shop Information"  onClick={() => setAddOpen(true)} />
          <MenuRow icon={<MapPin className="h-5 w-5" />}     label="Delivery Address"  href="/shop/orders" />
          <MenuRow icon={<CreditCard className="h-5 w-5" />} label="Payment Method"    href="/shop/profile" />
        </MenuCard>
      </Section>

      {/* 4 ── Activity */}
      <Section delay={0.18}>
        <SectionHeader label="Activity" />
        <MenuCard>
          <MenuRow
            icon={<ClipboardList className="h-5 w-5" />}
            label="Order History"
            badge={stats?.count ? `${stats.count} this month` : undefined}
            href="/shop/orders"
          />
          <MenuRow icon={<Heart className="h-5 w-5" />}        label="Favourite Products" href="/shop" />
          <MenuRow icon={<Bell className="h-5 w-5" />}         label="Price Alerts"        href="/shop/notifications" />
          <MenuRow icon={<ClipboardList className="h-5 w-5" />} label="Order Templates"    href="/shop/orders" />
        </MenuCard>
      </Section>

      {/* 5 ── Preferences */}
      <Section delay={0.22}>
        <SectionHeader label="Preferences" />
        <MenuCard>
          <MenuRow icon={<Settings className="h-5 w-5" />} label="Settings" href="/shop/settings" />
        </MenuCard>
      </Section>

      {/* 6 ── Support */}
      <Section delay={0.26}>
        <SectionHeader label="Support" />
        <MenuCard>
          <MenuRow icon={<Phone className="h-5 w-5" />}         label="Contact iKiwi"    onClick={() => setContactOpen(true)} />
          <MenuRow icon={<HelpCircle className="h-5 w-5" />}    label="Help & FAQ"        href="/help" />
          <MenuRow icon={<Star className="h-5 w-5" />}          label="Rate iKiwi"        href="/shop/profile" />
        </MenuCard>
      </Section>

      {/* 7 ── About */}
      <Section delay={0.3}>
        <div className="mt-6 rounded-2xl bg-card border border-border shadow-sm overflow-hidden divide-y divide-border">
          <MenuRow icon={<FileText className="h-4 w-4" />} label="Terms of Service" href="/shop/profile" />
          <MenuRow icon={<Lock className="h-4 w-4" />}     label="Privacy Policy"   href="/shop/profile" />
          <div className="flex items-center h-14 px-4 gap-3">
            <span className="text-muted-foreground text-sm shrink-0">ℹ️</span>
            <span className="flex-1 text-[15px] text-muted-foreground">Version 1.0.0</span>
          </div>
        </div>
      </Section>

      {/* 8 ── Sign out */}
      <Section delay={0.34}>
        <div className="mt-6">
          <MenuCard>
            <MenuRow
              icon={<LogOut className="h-5 w-5" />}
              label="Sign Out"
              danger noChevron
              onClick={() => setSignOutOpen(true)}
            />
          </MenuCard>
        </div>
      </Section>

      <AppFooter />

      {/* Add/Edit shop dialog */}
      <AddEditShopDialog
        open={addOpen || !!editShop}
        onClose={() => { setAddOpen(false); setEditShop(null); }}
        initial={editShop}
      />

      {/* Contact modal */}
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />

      {/* Delete shop confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Past order history will be preserved, but you won&apos;t be able to place new orders with this shop.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                if (!deleteTarget) return;
                const result = await deleteMyShop(deleteTarget.id);
                if (!result.success) { toast.error(result.error); return; }
                toast.success("Shop deleted");
                qc.invalidateQueries({ queryKey: ["my-shops"] });
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sign out confirm */}
      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of iKiwi?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll need to sign back in to place orders or check prices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
