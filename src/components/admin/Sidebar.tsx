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
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const { data: session } = useSession();

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 border-r bg-card h-screen sticky top-0">
      <div className="px-5 py-4 border-b">
        <Logo size={32} />
        <p className="text-xs text-muted-foreground mt-0.5 ml-0.5">Admin Panel</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {links.map((link) => (
          <NavLink key={link.href} {...link} />
        ))}
        <div className="pt-3">
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Warehouse
          </p>
          {warehouseLinks.map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
        </div>
      </nav>

      <div className="px-3 pb-4 border-t pt-3 space-y-3">
        {session?.user && (
          <div className="flex items-center gap-2.5 px-1">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {getInitials(session.user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{session.user.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{session.user.email}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-card">
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
