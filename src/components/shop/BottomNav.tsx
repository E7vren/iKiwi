"use client";

import { motion } from "framer-motion";
import { Bell, ClipboardList, Home, ShoppingCart, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/translations";
import { useLocaleStore } from "@/store/localeStore";
import { useCartStore } from "@/store/cartStore";
import { formatPrice } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();
  const locale = useLocaleStore((s) => s.locale);
  const T = useTranslations(locale);

  const cartItems = useCartStore((s) => s.items);
  const cartCount = cartItems.reduce((acc, i) => acc + i.qty, 0);
  const cartTotal = useCartStore((s) => s.total());

  const [unread, setUnread] = useState(0);

  async function fetchUnread() {
    try {
      const res = await fetch("/api/notifications?limit=1");
      if (!res.ok) return;
      const data = await res.json();
      setUnread(data.unread ?? 0);
    } catch {}
  }

  // Poll every 30s for unread notifications
  useEffect(() => {
    fetchUnread();
    const id = setInterval(fetchUnread, 30_000);
    return () => clearInterval(id);
  }, []);

  const links = [
    { href: "/shop",                 label: T.catalog, icon: Home,          badge: 0 },
    { href: "/shop/orders",          label: T.orders,  icon: ClipboardList, badge: 0 },
    { href: "/shop/notifications",   label: T.alerts,  icon: Bell,          badge: unread },
    { href: "/shop/profile",         label: T.profile, icon: User,          badge: 0 },
  ];

  const onCart = pathname === "/shop/cart";

  return (
    <>
      {/* Floating cart FAB — hidden on the cart page itself */}
      {cartCount > 0 && !onCart && (
        <Link
          href="/shop/cart"
          className="fixed z-50 md:hidden"
          style={{ bottom: "calc(64px + env(safe-area-inset-bottom) + 12px)", right: "16px" }}
        >
          <div className="flex items-center gap-2 bg-primary text-white rounded-2xl px-4 py-2.5 shadow-lg"
            style={{ boxShadow: "0 4px 16px rgba(152,214,45,0.45)" }}>
            <ShoppingCart className="h-5 w-5 shrink-0" />
            <div className="leading-tight">
              <p className="text-xs font-bold leading-none">
                {Math.floor(cartCount * 10) / 10} items
              </p>
              <p className="text-[10px] opacity-90">{formatPrice(cartTotal)} UZS</p>
            </div>
          </div>
        </Link>
      )}

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border md:hidden"
        style={{ boxShadow: "0 -1px 4px rgba(0,0,0,0.04)" }}
      >
        <div
          className="grid grid-cols-4"
          style={{ paddingBottom: "env(safe-area-inset-bottom)", height: "calc(64px + env(safe-area-inset-bottom))" }}
        >
          {links.map(({ href, label, icon: Icon, badge }) => {
            const active = href === "/shop" ? pathname === "/shop" : pathname.startsWith(href);
            return (
              <motion.div
                key={href}
                whileTap={{ scale: 0.92 }}
                transition={{ duration: 0.1 }}
                className="relative"
              >
                {/* Active pill — top edge */}
                {active && (
                  <div className="absolute top-0 inset-x-0 h-[3px] rounded-b-full bg-primary" />
                )}

                <Link
                  href={href}
                  className="flex flex-col items-center justify-center gap-1 w-full h-16"
                  style={{ minHeight: 44 }}
                >
                  <div className="relative">
                    <Icon
                      className={cn(
                        "h-6 w-6 transition-colors duration-200",
                        active ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    {badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex min-w-[16px] h-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-0.5 leading-none">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </div>

                  <span
                    className={cn(
                      "text-[11px] font-medium leading-none transition-colors duration-200",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </nav>
    </>
  );
}
