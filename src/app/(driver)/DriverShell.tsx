"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Truck, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ThemeToggleIcon } from "@/components/shared/ThemeToggle";
import { getPusherClient } from "@/lib/pusherClient";
import { toggleStaffAvailability, updateMyLocation } from "@/server/actions/delivery-staff";
import { useLocaleStore } from "@/store/localeStore";
import { useTranslations } from "@/lib/translations";

interface DriverCtxValue {
  isOnline:     boolean;
  setOnline:    (val: boolean) => Promise<void>;
  clearShopBadge: () => void;
}

const DriverCtx = createContext<DriverCtxValue>({
  isOnline:       false,
  setOnline:      async () => {},
  clearShopBadge: () => {},
});

export function useDriverCtx() {
  return useContext(DriverCtx);
}


export function DriverShell({
  children,
  initialOnline,
  driverName,
  staffId,
}: {
  children:      React.ReactNode;
  initialOnline: boolean;
  driverName:    string;
  staffId:       string;
}) {
  const pathname        = usePathname();
  const locale          = useLocaleStore((s) => s.locale);
  const T               = useTranslations(locale);

  const NAV = [
    { href: "/driver",          label: T.navRoutes,   icon: Truck,        exact: true  },
    { href: "/driver/shopping", label: T.navShopping, icon: ShoppingCart, exact: false },
    { href: "/driver/profile",  label: T.navProfile,  icon: User,         exact: false },
  ];
  const [isOnline,      setIsOnline]      = useState(initialOnline);
  const [toggling,      setToggling]      = useState(false);
  const [shopBadge,     setShopBadge]     = useState(0);
  const lastGeoRef = useRef(0);

  async function setOnline(val: boolean) {
    if (toggling) return;
    if (val && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {});
    }
    setToggling(true);
    const result = await toggleStaffAvailability({ isAvailable: val });
    setToggling(false);
    if (result.success) {
      setIsOnline(val);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(50);
      toast(val ? "You are now online" : "You are now offline");
    } else {
      toast.error(result.error ?? "Failed to update status");
    }
  }

  // Clear shopping badge when on the shopping tab
  useEffect(() => {
    if (pathname.startsWith("/driver/shopping")) setShopBadge(0);
  }, [pathname]);

  // Live location tracking
  useEffect(() => {
    if (!isOnline || !("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastGeoRef.current < 25_000) return;
        lastGeoRef.current = now;
        updateMyLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      null,
      { enableHighAccuracy: true, maximumAge: 30_000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline]);

  // Pusher: subscribe to private-driver-{staffId}
  useEffect(() => {
    if (!staffId) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe(`private-driver-${staffId}`);

    channel.bind("shopping-list-ready", (data: { count: number }) => {
      setShopBadge((n) => n + (data?.count ?? 1));
      toast("Shopping list updated", {
        description: `${data?.count ?? ""} product${data?.count !== 1 ? "s" : ""} needed — check Shopping tab`,
      });
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`private-driver-${staffId}`);
    };
  }, [staffId]);

  return (
    <DriverCtx.Provider value={{ isOnline, setOnline, clearShopBadge: () => setShopBadge(0) }}>
      <div className="flex flex-col min-h-dvh bg-background">
        {/* ─── Top bar ─────────────────────────────────── */}
        <header className="sticky top-0 z-20 flex items-center justify-between bg-card border-b px-4 h-14 shrink-0 shadow-[0px_1px_4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <span className="text-primary-foreground font-bold text-base">iK</span>
            </div>
            <div className="leading-none">
              <p className="font-bold text-sm">iKiwi</p>
              <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">{driverName}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <ThemeToggleIcon />
            <span className={cn("text-sm font-semibold transition-colors", isOnline ? "text-green-600" : "text-gray-400")}>
              {isOnline ? T.navOnline : T.navOffline}
            </span>
            <button
              role="switch"
              aria-checked={isOnline}
              aria-label="Toggle availability"
              disabled={toggling}
              onClick={() => setOnline(!isOnline)}
              className={cn(
                "relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full",
                "border-2 border-transparent transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                isOnline ? "bg-primary" : "bg-muted-foreground/40"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-md ring-0 transition-transform duration-200",
                  isOnline ? "translate-x-6" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
        </header>

        {/* ─── Page content ────────────────────────────── */}
        <main className="flex-1 pb-20">{children}</main>

        {/* ─── Bottom nav ──────────────────────────────── */}
        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-card">
          <div className="flex">
            {NAV.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              const isShopping = href === "/driver/shopping";
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors relative",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <span className="relative">
                    <Icon className={cn("h-6 w-6", active ? "text-primary" : "text-muted-foreground")} />
                    {isShopping && shopBadge > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                        {shopBadge > 9 ? "9+" : shopBadge}
                      </span>
                    )}
                  </span>
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </DriverCtx.Provider>
  );
}
