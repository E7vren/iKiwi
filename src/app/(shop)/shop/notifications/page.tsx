"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, Package, RefreshCw, Tag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useLocaleStore } from "@/store/localeStore";
import { useTranslations } from "@/lib/translations";

const TAB_VALUES = ["all", "unread", "orders", "prices"] as const;
type Tab = (typeof TAB_VALUES)[number];

const ORDER_TYPES = new Set(["ORDER_PLACED", "STATUS_CHANGED", "ACTUAL_COST_SET"]);

interface Notif {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

function typeIcon(type: string) {
  if (type === "PRICE_UPDATED") return <Tag className="h-4 w-4 text-amber-500" />;
  if (ORDER_TYPES.has(type))    return <Package className="h-4 w-4 text-blue-500" />;
  return <Bell className="h-4 w-4 text-primary" />;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function filterNotifs(notifs: Notif[], tab: Tab): Notif[] {
  if (tab === "unread")  return notifs.filter((n) => !n.isRead);
  if (tab === "orders")  return notifs.filter((n) => ORDER_TYPES.has(n.type));
  if (tab === "prices")  return notifs.filter((n) => n.type === "PRICE_UPDATED");
  return notifs;
}

// ─── Swipeable row ─────────────────────────────────────────────────────────────

function NotifRow({
  notif,
  onMarkRead,
  onDismiss,
}: {
  notif: Notif;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: "100%", height: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.22 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 0.45 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 72 || info.velocity.x > 500) {
          notif.isRead ? onDismiss(notif.id) : onMarkRead(notif.id);
        }
      }}
      onClick={() => !notif.isRead && onMarkRead(notif.id)}
      className={cn(
        "flex items-start gap-3 px-4 py-3.5 select-none cursor-pointer transition-colors",
        !notif.isRead ? "bg-primary/5 hover:bg-primary/8" : "bg-card hover:bg-accent"
      )}
    >
      {/* Icon bubble */}
      <div
        className={cn(
          "mt-0.5 h-8 w-8 shrink-0 flex items-center justify-center rounded-full",
          !notif.isRead ? "bg-primary/10" : "bg-muted"
        )}
      >
        {typeIcon(notif.type)}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm leading-snug",
            !notif.isRead ? "font-semibold text-foreground" : "text-muted-foreground"
          )}
        >
          {notif.message}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(notif.createdAt)}</p>
        {!notif.isRead && (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic">Swipe → to mark read</p>
        )}
      </div>

      {/* Unread dot */}
      {!notif.isRead && (
        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </motion.div>
  );
}

// ─── Pull indicator ────────────────────────────────────────────────────────────

function PullIndicator({ dist, refreshing }: { dist: number; refreshing: boolean }) {
  if (dist <= 6 && !refreshing) return null;
  const progress = Math.min(dist / 60, 1);
  return (
    <div className="flex justify-center py-2">
      <motion.div
        animate={refreshing ? { rotate: 360 } : { rotate: progress * 180 }}
        transition={refreshing ? { duration: 0.7, repeat: Infinity, ease: "linear" } : { duration: 0 }}
        style={{
          scale: 0.5 + progress * 0.5,
          opacity: 0.4 + progress * 0.6,
        }}
      >
        <RefreshCw className="h-5 w-5 text-primary" />
      </motion.div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const T = useTranslations(locale);

  const TABS = [
    { value: "all"    as Tab, label: T.tabAll     },
    { value: "unread" as Tab, label: T.tabUnread  },
    { value: "orders" as Tab, label: T.orders     },
    { value: "prices" as Tab, label: T.tabPrices  },
  ];

  const [notifs,    setNotifs]    = useState<Notif[]>([]);
  const [unread,    setUnread]    = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<Tab>("all");
  const [pullDist,  setPullDist]  = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const touchStartY = useRef(0);

  async function load() {
    try {
      const res = await fetch("/api/notifications?limit=50");
      if (!res.ok) return;
      const data = await res.json();
      setNotifs(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Pull-to-refresh
  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY === 0) touchStartY.current = e.touches[0].clientY;
    }
    function onTouchMove(e: TouchEvent) {
      if (!touchStartY.current) return;
      const d = e.touches[0].clientY - touchStartY.current;
      if (d > 0 && window.scrollY === 0) setPullDist(Math.min(d * 0.4, 80));
    }
    async function onTouchEnd() {
      if (pullDist > 50 && !refreshing) {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }
      touchStartY.current = 0;
      setPullDist(0);
    }
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove",  onTouchMove,  { passive: true });
    document.addEventListener("touchend",   onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove",  onTouchMove);
      document.removeEventListener("touchend",   onTouchEnd);
    };
  }, [pullDist, refreshing]);

  async function markAll() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read-all" }),
    });
    setNotifs((n) => n.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
  }

  async function markOne(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", id }),
    });
    setNotifs((n) => n.map((x) => (x.id === id ? { ...x, isRead: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
  }

  function dismissOne(id: string) {
    setNotifs((n) => n.filter((x) => x.id !== id));
  }

  const filtered  = filterNotifs(notifs, tab);
  const tabLabel  = TABS.find((t) => t.value === tab)?.label ?? "";

  return (
    <div className="space-y-4">
      <PullIndicator dist={pullDist} refreshing={refreshing} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{T.alerts}</h1>
          {unread > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">{unread} {T.tabUnread.toLowerCase()}</p>
          )}
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={markAll}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {T.markAllRead}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              tab === t.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            {t.label}
            {t.value === "unread" && unread > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 text-white text-[10px] px-1 leading-tight inline-block">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
            <Bell className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-[16px] text-foreground">🔔 {T.noNotifications}</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {T.notifEmptyDesc}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden divide-y divide-border">
          <AnimatePresence initial={false}>
            {filtered.map((n) => (
              <NotifRow
                key={n.id}
                notif={n}
                onMarkRead={markOne}
                onDismiss={dismissOne}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
