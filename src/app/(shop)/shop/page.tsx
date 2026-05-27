"use client";

import Fuse from "fuse.js";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowLeft, ChevronRight, Heart, Mic, RefreshCw,
  RotateCw, Search, ShoppingCart, Sparkles, X,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect, useMemo, useRef, useState,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CoachMarks } from "@/components/shop/CoachMarks";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductSheet } from "@/components/shop/ProductSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getCategoryName, formatPrice } from "@/lib/utils";
import { useLocaleStore } from "@/store/localeStore";
import { useTranslations } from "@/lib/translations";
import { useCartStore } from "@/store/cartStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import type { Product } from "@/types";

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchProducts(): Promise<Product[]> {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchRecentOrder() {
  const res = await fetch("/api/orders?limit=1");
  if (!res.ok) return null;
  const data = await res.json();
  return data.orders?.[0] ?? null;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getGreeting(name: string, T: { goodMorning: string; goodAfternoon: string; goodEvening: string; workingLate: string }) {
  const h = new Date().getHours();
  if (h < 12) return { text: `${T.goodMorning}, ${name}`, emoji: "☀️" };
  if (h < 17) return { text: `${T.goodAfternoon}, ${name}`, emoji: "👋" };
  if (h < 21) return { text: `${T.goodEvening}, ${name}`, emoji: "🌆" };
  return { text: `${T.workingLate}, ${name}?`, emoji: "🌙" };
}

function getTodayLabel(locale: string) {
  return new Date().toLocaleDateString(
    locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : "en-US",
    { weekday: "long", month: "long", day: "numeric" }
  );
}

function getBannerDismissKey() {
  return `ikiwi-banner-${new Date().toISOString().slice(0, 10)}`;
}

function getRecentSearches(): string[] {
  try { return JSON.parse(localStorage.getItem("ikiwi-searches") ?? "[]"); }
  catch { return []; }
}

function saveSearch(q: string) {
  const prev = getRecentSearches().filter((s) => s !== q).slice(0, 4);
  localStorage.setItem("ikiwi-searches", JSON.stringify([q, ...prev]));
}

function haptic(ms = 30) {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
}

// ─── Loading skeletons ────────────────────────────────────────────────────────

function HomeSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-11 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 w-20 rounded-full" />)}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Hero banner ──────────────────────────────────────────────────────────────

const BANNERS = [
  { id: "fresh", text: "Fresh produce delivered to your door 🥬", sub: "Order today, delivered tomorrow morning", color: "from-primary/10 to-emerald-50" },
  { id: "delivery", text: "Free delivery on orders over 100,000 UZS", sub: "Tap to place your order now", color: "from-blue-50 to-sky-50" },
];

function HeroBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(getBannerDismissKey()) === "1";
  });
  const [idx] = useState(0);

  if (dismissed) return null;
  const banner = BANNERS[idx % BANNERS.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      className={`relative rounded-2xl bg-gradient-to-r ${banner.color} border border-primary/10 px-4 py-3`}
    >
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          localStorage.setItem(getBannerDismissKey(), "1");
        }}
        className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <p className="text-[14px] font-semibold text-[#1A1A1A] pr-6">{banner.text}</p>
      <p className="text-[12px] text-muted-foreground mt-0.5">{banner.sub}</p>
    </motion.div>
  );
}

// ─── Continue card ─────────────────────────────────────────────────────────────

function ContinueCard({ cartCount, cartTotal, recentOrder }: {
  cartCount: number;
  cartTotal: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recentOrder: any;
}) {
  if (cartCount > 0) {
    return (
      <Link href="/shop/cart">
        <motion.div
          whileTap={{ scale: 0.98 }}
          className="rounded-2xl bg-primary/5 border border-primary/15 px-4 py-3.5 flex items-center gap-3"
        >
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <ShoppingCart className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-[#1A1A1A]">
              🛒 Continue your cart
            </p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {cartCount} item{cartCount !== 1 ? "s" : ""} · {formatPrice(cartTotal)} UZS est.
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </motion.div>
      </Link>
    );
  }

  if (recentOrder) {
    const preview = recentOrder.items
      .slice(0, 3)
      .map((i: { product: { name: string } }) => i.product.name)
      .join(", ");
    const more = recentOrder.items.length > 3 ? ` +${recentOrder.items.length - 3}` : "";
    return (
      <Link href="/shop/orders">
        <motion.div
          whileTap={{ scale: 0.98 }}
          className="rounded-2xl bg-card border border-border shadow-sm px-4 py-3.5 flex items-center gap-3"
        >
          <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center shrink-0">
            <RotateCw className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-[#1A1A1A]">🔁 Reorder your last order</p>
            <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
              {preview}{more} · {formatPrice(recentOrder.actualTotal ?? recentOrder.estimatedTotal)} UZS
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </motion.div>
      </Link>
    );
  }

  return null;
}

// ─── Category chips ───────────────────────────────────────────────────────────

interface Category { id: string; nameEn: string; nameUz: string; nameRu: string | null; icon: string | null; sortOrder: number; }

function CategoryChips({ categories, active, onSelect, locale }: {
  categories: Category[];
  active: string;
  onSelect: (id: string) => void;
  locale: string;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
      {[{ id: "ALL", nameEn: "All", nameUz: "Hammasi", nameRu: "Всё", icon: null, sortOrder: -1 }, ...categories].map((c) => {
        const isActive = active === c.id;
        const label = getCategoryName(c as Category & { nameEn: string }, locale);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-150 ${
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card border border-border text-foreground hover:border-primary/40"
            }`}
          >
            {c.icon && <span className="text-[13px]">{c.icon}</span>}
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Search overlay ───────────────────────────────────────────────────────────

function SearchOverlay({ products, onClose }: {
  products: Product[];
  onClose: (query?: string) => void;
}) {
  const locale = useLocaleStore((s) => s.locale);
  const TSearch = useTranslations(locale);
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
    inputRef.current?.focus();
  }, []);

  const fuse = useMemo(() => new Fuse(products, {
    keys: ["name", "nameUz", "nameRu"],
    threshold: 0.3,
    minMatchCharLength: 1,
  }), [products]);

  const suggestions = query.trim().length > 0
    ? fuse.search(query.trim()).slice(0, 6).map((r) => r.item)
    : [];

  function displayName(p: Product) {
    return locale === "ru" && p.nameRu ? p.nameRu : p.nameUz || p.name;
  }

  function commit(q: string) {
    if (!q.trim()) return;
    saveSearch(q.trim());
    onClose(q.trim());
  }

  function startVoice() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
      if (!SR) { toast.error("Voice search not supported in this browser"); return; }
      const rec = new SR();
      rec.lang = locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : "en-US";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (e: any) => setQuery(e.results[0][0].transcript);
      rec.onerror = () => toast.error("Voice search failed");
      rec.start();
    } catch { toast.error("Voice search not available"); }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Search bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button type="button" onClick={() => onClose()} className="shrink-0">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit(query)}
            placeholder={TSearch.searchProducts}
            className="w-full rounded-xl bg-muted pl-9 pr-10 py-2.5 text-[15px] outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={startVoice}
          className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center hover:bg-accent transition-colors"
          aria-label="Voice search"
        >
          <Mic className="h-4.5 w-4.5 text-primary" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {suggestions.length > 0 ? (
          <div className="py-2">
            <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {TSearch.suggestions}
            </p>
            {suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => commit(displayName(p))}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent text-left"
              >
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[15px] font-medium">{displayName(p)}</p>
                  <p className="text-[12px] text-muted-foreground">{p.category.icon} {getCategoryName(p.category, locale)}</p>
                </div>
              </button>
            ))}
          </div>
        ) : query.trim().length > 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground">
            <p className="text-[15px]">{TSearch.noResults} &ldquo;{query}&rdquo;</p>
          </div>
        ) : recentSearches.length > 0 ? (
          <div className="py-2">
            <div className="flex items-center justify-between px-4 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {TSearch.recent}
              </p>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("ikiwi-searches");
                  setRecentSearches([]);
                }}
                className="text-[12px] text-primary"
              >
                {TSearch.clearAll}
              </button>
            </div>
            {recentSearches.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => commit(s)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent text-left"
              >
                <RefreshCw className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-[15px]">{s}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="px-4 py-10 text-center text-muted-foreground">
            <Search className="h-10 w-10 mx-auto opacity-20 mb-3" />
            <p className="text-[14px]">{TSearch.searchVeg}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Recommendations carousel ──────────────────────────────────────────────────

function RecommendationsCarousel({
  products,
  onSelect,
  label,
}: {
  products: Product[];
  onSelect: (p: Product) => void;
  label: string;
}) {
  if (products.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-[15px] font-bold text-[#1A1A1A]">{label}</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
        {products.map((p) => {
          const name = p.nameUz || p.name;
          const price = p.pricePerKg ?? p.pricePerPiece;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className="shrink-0 flex flex-col items-center gap-1.5 w-20"
            >
              <div className="h-16 w-16 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-center text-3xl">
                {p.category.icon ?? "🛒"}
              </div>
              <p className="text-[11px] font-medium text-center leading-tight line-clamp-2">{name}</p>
              {price != null && (
                <p className="text-[10px] font-bold text-primary">{formatPrice(price)}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Favourites carousel ──────────────────────────────────────────────────────

function FavouritesCarousel({
  products,
  onSelect,
  locale,
  favLabel,
  savedLabel,
}: {
  products: Product[];
  onSelect: (p: Product) => void;
  locale: string;
  favLabel: string;
  savedLabel: string;
}) {
  if (products.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.13 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Heart className="h-4 w-4 text-red-500 fill-red-500" />
        <h2 className="text-[15px] font-bold text-foreground">{favLabel}</h2>
        <span className="ml-auto text-[12px] text-muted-foreground">
          {products.length} {savedLabel}
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
        {products.map((p) => {
          const name = locale === "ru" && p.nameRu ? p.nameRu : p.nameUz || p.name;
          const price = p.pricePerKg ?? p.pricePerPiece;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className="shrink-0 flex flex-col items-center gap-1.5 w-20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-xl"
            >
              <div className="relative h-16 w-16 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-center text-3xl">
                {p.category.icon ?? "🛒"}
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 flex items-center justify-center">
                  <Heart className="h-2.5 w-2.5 text-red-500 fill-red-500" />
                </span>
              </div>
              <p className="text-[11px] font-medium text-center leading-tight line-clamp-2">
                {name}
              </p>
              {price != null && (
                <p className="text-[10px] font-bold text-primary">{formatPrice(price)}</p>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Pull indicator ───────────────────────────────────────────────────────────

function PullIndicator({ distance, refreshing }: { distance: number; refreshing: boolean }) {
  const show = distance > 6 || refreshing;
  if (!show) return null;
  const progress = Math.min(distance / 60, 1);
  return (
    <div className="flex justify-center py-2">
      <motion.div
        animate={refreshing ? { rotate: 360 } : { rotate: progress * 180 }}
        transition={refreshing ? { duration: 0.7, repeat: Infinity, ease: "linear" } : { duration: 0 }}
        style={{ scale: 0.5 + progress * 0.5, opacity: 0.4 + progress * 0.6 }}
      >
        <RefreshCw className="h-5 w-5 text-primary" />
      </motion.div>
    </div>
  );
}

// ─── Rotating placeholder ─────────────────────────────────────────────────────

const PLACEHOLDERS = ["Search tomatoes…", "Search apples…", "Search onions…", "Search products…"];

function useRotatingPlaceholder() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % PLACEHOLDERS.length), 3000);
    return () => clearInterval(id);
  }, []);
  return PLACEHOLDERS[idx];
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ShopHomePage() {
  const qc = useQueryClient();
  const locale = useLocaleStore((s) => s.locale);
  const T = useTranslations(locale);
  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const favoriteIds = useFavoritesStore((s) => s.ids);

  const cartCount = cartItems.reduce((acc, i) => acc + i.qty, 0);
  const cartTotal = cartItems.reduce((acc, i) => acc + i.pricePerUnit * i.qty, 0);

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const placeholder = useRotatingPlaceholder();

  // Category
  const [cat, setCat] = useState("ALL");

  // Sheet
  const [selected, setSelected] = useState<Product | null>(null);

  // Lazy loading
  const [visibleCount, setVisibleCount] = useState(8);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Pull-to-refresh
  const [pullDist, setPullDist] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);

  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  const { data: recentOrder } = useQuery({
    queryKey: ["recent-order"],
    queryFn: fetchRecentOrder,
    enabled: cartCount === 0,
    staleTime: 60_000,
  });


  // Infinite scroll sentinel
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount((c) => c + 8); },
      { threshold: 0.1 }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [products.length, cat, searchQuery]);

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
        haptic(30);
        setRefreshing(true);
        await Promise.all([
          refetch(),
          qc.invalidateQueries({ queryKey: ["recent-order"] }),
        ]);
        setRefreshing(false);
      }
      touchStartY.current = 0;
      setPullDist(0);
    }
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullDist, refreshing, refetch, qc]);

  // Derived
  const categories = Array.from(
    new Map(products.map((p) => [p.category.id, p.category])).values()
  ).sort((a, b) => a.sortOrder - b.sortOrder);

  const filtered = products.filter((p) => {
    if (!p.isAvailable) return false;
    if (cat !== "ALL" && p.categoryId !== cat) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.nameUz.toLowerCase().includes(q) ||
      (p.nameRu ?? "").toLowerCase().includes(q)
    );
  });

  const visible = filtered.slice(0, visibleCount);

  // Reset visible count when filter changes
  useEffect(() => { setVisibleCount(8); }, [cat, searchQuery]);

  // Recommendations: products from different categories than current selection
  const recommendedCatId = cat !== "ALL" ? categories.find((c) => c.id !== cat)?.id : categories[1]?.id;
  const recommendations = products
    .filter((p) => p.isAvailable && p.categoryId === recommendedCatId && p.pricePerKg != null)
    .slice(0, 8);

  const greeting = getGreeting("👋", T);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <HomeSkeleton />
      </div>
    );
  }

  return (
    <>
      {/* Search overlay (portal over everything) */}
      <AnimatePresence>
        {searchOpen && (
          <SearchOverlay
            products={products}
            onClose={(q) => {
              setSearchOpen(false);
              if (q) { setSearchQuery(q); setCat("ALL"); }
            }}
          />
        )}
      </AnimatePresence>

      <div className="space-y-5">
        {/* Pull indicator */}
        <PullIndicator distance={pullDist} refreshing={refreshing} />

        {/* 1 ── Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-[22px] font-bold text-[#1A1A1A] leading-tight">
            {greeting.text} {greeting.emoji}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">{getTodayLabel(locale)}</p>
        </motion.div>

        {/* 2 ── Search bar */}
        <motion.button
          type="button"
          onClick={() => setSearchOpen(true)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="w-full flex items-center gap-3 rounded-2xl bg-card border border-border px-4 py-3 text-left shadow-sm hover:border-primary/40 transition-colors"
        >
          <Search className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
          <AnimatePresence mode="wait">
            <motion.span
              key={placeholder}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="flex-1 text-[15px] text-muted-foreground"
            >
              {searchQuery || placeholder}
            </motion.span>
          </AnimatePresence>
          {searchQuery ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSearchQuery(""); }}
              className="shrink-0"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : (
            <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </motion.button>

        {/* 3 ── Continue card */}
        {(cartCount > 0 || recentOrder) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <ContinueCard
              cartCount={cartCount}
              cartTotal={cartTotal}
              recentOrder={recentOrder}
            />
          </motion.div>
        )}

        {/* 4 ── Hero banner */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12 }}
        >
          <HeroBanner />
        </motion.div>

        {/* 5 ── Favourites carousel */}
        {favoriteIds.length > 0 && (
          <FavouritesCarousel
            products={products.filter((p) => favoriteIds.includes(p.id))}
            onSelect={setSelected}
            locale={locale}
            favLabel={T.yourFavourites}
            savedLabel={T.saved}
          />
        )}

        {/* 5b ── No-prices alert */}
        {!isLoading && products.length > 0 && !products.some((p) => p.isAvailable && (p.pricePerKg != null || p.pricePerPiece != null)) && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-[13px] text-amber-800">{T.noPricesAlert}</p>
          </div>
        )}

        {/* 6 ── Category chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <CategoryChips
            categories={categories}
            active={cat}
            onSelect={(id) => { setCat(id); haptic(20); }}
            locale={locale}
          />
        </motion.div>

        {/* 7 ── Product grid */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-4xl mb-3">🥬</p>
            <p className="text-[15px] font-medium">{T.noProductsFound}</p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-2 text-[13px] text-primary underline"
              >
                {T.clearSearch}
              </button>
            )}
          </div>
        ) : (
          <>
            <motion.div
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
            >
              {visible.map((p) => (
                <motion.div
                  key={p.id}
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 24 } },
                  }}
                >
                  <ProductCard
                    product={p}
                    onDetails={() => setSelected(p)}
                  />
                </motion.div>
              ))}
            </motion.div>

            {/* Infinite scroll sentinel */}
            {visibleCount < filtered.length && (
              <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="h-2 w-2 rounded-full bg-primary/30"
                      animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.7, 0.3] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* 8 ── Recommendations */}
        <RecommendationsCarousel products={recommendations} onSelect={setSelected} label={T.youMightLike} />
      </div>

      {/* Product detail sheet */}
      <ProductSheet product={selected} onClose={() => setSelected(null)} />

      {/* First-visit coach marks */}
      <CoachMarks />
    </>
  );
}
