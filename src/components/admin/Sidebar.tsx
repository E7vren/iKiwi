"use client";

import {
  Archive,
  ClipboardList,
  History,
  HelpCircle,
  LayoutDashboard,
  LayoutList,
  LogOut,
  MapPin,
  PackageSearch,
  Plus,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Logo } from "@/components/shared/Logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin",            label: "Dashboard",         icon: LayoutDashboard, exact: true },
  { href: "/admin/orders",     label: "Orders",            icon: ClipboardList },
  { href: "/admin/routes",     label: "Routes",            icon: Truck },
  { href: "/admin/staff",      label: "Staff",             icon: Users },
  { href: "/admin/categories", label: "Categories",        icon: LayoutList },
  { href: "/admin/products",   label: "Products & Prices", icon: ShoppingCart },
  { href: "/admin/map",        label: "Map",               icon: MapPin },
  { href: "/admin/shops",      label: "Shops",             icon: Store },
  { href: "/admin/settings",   label: "Settings",          icon: Settings },
];

const warehouseLinks = [
  { href: "/admin/warehouse",         label: "Stock",         icon: Archive,       exact: true },
  { href: "/admin/restock",           label: "Restock Tasks", icon: PackageSearch },
  { href: "/admin/warehouse/history", label: "History",       icon: History },
];

function getInitials(name: string | null | undefined) {
  if (!name) return "A";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function NavLink({ href, label, icon: Icon, exact }: (typeof links)[0]) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-label-lg transition-colors",
        active
          ? "bg-primary/12 text-primary font-semibold"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
      )}
      <Icon className={cn("h-5 w-5 shrink-0", active ? "text-primary" : "")} />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const { data: session } = useSession();
  const router = useRouter();

  return (
    <aside className="hidden md:flex flex-col w-[260px] shrink-0 border-r border-border bg-card h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-extrabold text-sm tracking-tight">iK</span>
          </div>
          <div>
            <p className="font-extrabold text-base leading-none tracking-tight text-foreground">iKiWi</p>
            <p className="text-label-md text-muted-foreground mt-0.5">Admin Console</p>
          </div>
        </div>
      </div>

      {/* New Order CTA */}
      <div className="px-3 pt-4 pb-2">
        <Button
          className="w-full gap-2 font-semibold"
          onClick={() => router.push("/admin/orders")}
        >
          <Plus className="h-4 w-4" />
          New Order
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {links.map((link) => (
          <NavLink key={link.href} {...link} />
        ))}
        <div className="pt-4">
          <p className="px-3 pb-1.5 text-label-md uppercase tracking-wider text-muted-foreground/70">
            Warehouse
          </p>
          {warehouseLinks.map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
        </div>
      </nav>

      {/* Bottom: user + support + sign out */}
      <div className="px-3 pb-4 border-t border-border pt-3 space-y-1">
        {session?.user && (
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary-foreground" style={{ color: "#3b5900" }}>
                {getInitials(session.user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-label-lg truncate">{session.user.name}</p>
              <p className="text-label-md text-muted-foreground truncate">{session.user.email}</p>
            </div>
          </div>
        )}
        <Link
          href="/admin/settings"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-label-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
        >
          <HelpCircle className="h-5 w-5 shrink-0" />
          Support
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-label-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  );
}

// Mobile bottom nav for admin
export function AdminBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card">
      <div className="flex overflow-x-auto">
        {[...links, ...warehouseLinks].map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 flex-col items-center gap-0.5 px-3 py-2 text-[9px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {label.split(" ")[0]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
