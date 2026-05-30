"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ClipboardList,
  Home,
  Settings,
  ShoppingCart,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TopBar } from "@/components/shop/TopBar";
import { BottomNav } from "@/components/shop/BottomNav";
import { NotifBell } from "@/components/shared/NotifBell";
import { ThemeToggleIcon } from "@/components/shared/ThemeToggle";
import { useCartStore } from "@/store/cartStore";

// ─── Context ──────────────────────────────────────────────────────────────────

interface ShopCtxValue { userName: string; }
const ShopCtx = createContext<ShopCtxValue>({ userName: "" });
export function useShopCtx() { return useContext(ShopCtx); }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

// ─── Sidebar nav items ────────────────────────────────────────────────────────

const NAV = [
  { href: "/shop",               label: "Home",          icon: Home,          exact: true  },
  { href: "/shop/orders",        label: "Orders",        icon: ClipboardList, exact: false },
  { href: "/shop/notifications", label: "Notifications", icon: Bell,          exact: false },
  { href: "/shop/profile",       label: "Profile",       icon: User,          exact: false },
];

// ─── Desktop sidebar ──────────────────────────────────────────────────────────

function ShopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 sticky top-0 h-screen bg-card border-r border-border overflow-y-auto">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-border">
        <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground font-extrabold text-[13px] tracking-tight">iK</span>
        </div>
        <div className="leading-none">
          <p className="font-extrabold text-base tracking-tight">
            i<span className="text-primary">K</span>i<span className="text-primary">W</span>i
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Fresh Produce Delivery</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary" />
              )}
              <Icon className={cn("h-5 w-5 shrink-0", active ? "text-primary" : "")} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Settings + Premium */}
      <div className="px-3 pb-4 space-y-1">
        <Link
          href="/shop/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
            pathname === "/shop/settings"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Settings className="h-5 w-5 shrink-0" />
          Settings
        </Link>

      </div>
    </aside>
  );
}

// ─── Desktop top header ───────────────────────────────────────────────────────

function ShopDesktopHeader({ userName }: { userName: string }) {
  const cartItems = useCartStore((s) => s.items);
  const cartCount = cartItems.reduce((acc, i) => acc + i.qty, 0);

  return (
    <header className="hidden md:flex items-center justify-end gap-1 h-14 px-6 border-b border-border bg-card shadow-[0px_1px_4px_rgba(0,0,0,0.04)] sticky top-0 z-20">
      {/* Theme toggle */}
      <ThemeToggleIcon />

      {/* Cart */}
      <Link
        href="/shop/cart"
        className="relative h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
        aria-label="Cart"
      >
        <ShoppingCart className="h-5 w-5 text-muted-foreground" />
        {cartCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
            {cartCount > 9 ? "9+" : cartCount}
          </span>
        )}
      </Link>

      {/* Notification bell */}
      <NotifBell />

      {/* Avatar */}
      <Link
        href="/shop/profile"
        className="ml-1 h-9 w-9 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
        aria-label="Profile"
      >
        <span className="text-primary-foreground text-sm font-bold leading-none tracking-wide">
          {initials(userName)}
        </span>
      </Link>
    </header>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export function ShopShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  return (
    <ShopCtx.Provider value={{ userName }}>
      <div className="flex min-h-screen bg-background">
        {/* Desktop sidebar */}
        <ShopSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile top bar */}
          <div className="md:hidden">
            <TopBar userName={userName} />
          </div>

          {/* Desktop header */}
          <ShopDesktopHeader userName={userName} />

          {/* Page content */}
          <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:py-6 md:pb-8 md:max-w-5xl md:w-full md:mx-auto">
            {children}
          </main>

          {/* Mobile bottom nav */}
          <BottomNav />
        </div>
      </div>
    </ShopCtx.Provider>
  );
}
