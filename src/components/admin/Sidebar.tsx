"use client";

import {
  Archive,
  ClipboardList,
  History,
  LayoutDashboard,
  LayoutList,
  LogOut,
  MapPin,
  PackageSearch,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Logo } from "@/components/shared/Logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {/* Vertical lime accent bar for active item */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
      )}
      <Icon className="h-5 w-5 shrink-0" />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const { data: session } = useSession();

  return (
    <aside className="hidden md:flex flex-col w-[260px] shrink-0 border-r border-border bg-card h-screen sticky top-0">
      <div className="px-5 py-4 border-b border-border">
        <Logo size={32} />
        <p className="text-label-md text-muted-foreground mt-0.5 ml-0.5">Admin Panel</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
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

      <div className="px-3 pb-4 border-t border-border pt-3 space-y-3">
        {session?.user && (
          <div className="flex items-center gap-2.5 px-1">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/15 text-xs font-bold" style={{ color: "#3b5900" }}>
                {getInitials(session.user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-label-lg truncate">{session.user.name}</p>
              <p className="text-label-md text-muted-foreground truncate">{session.user.email}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-label-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Sign out
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
