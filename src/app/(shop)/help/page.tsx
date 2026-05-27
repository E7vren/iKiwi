"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronDown, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AppFooter } from "@/components/shared/AppFooter";
import { cn } from "@/lib/utils";

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const FAQ_CATEGORIES = [
  {
    id: "ordering",
    emoji: "🛒",
    label: "Ordering",
    items: [
      {
        q: "How do I place an order?",
        a: "Browse the catalog, tap a product to add it to your cart, set your quantity, then open your cart and tap 'Place Order'. You'll receive a confirmation immediately.",
      },
      {
        q: "Can I edit an order after placing it?",
        a: "Once an order is placed it can't be edited in-app. Contact iKiwi via WhatsApp or phone as soon as possible — changes are only possible before your order enters the 'Preparing' stage.",
      },
      {
        q: "What does 'Estimated total' mean?",
        a: "Some products are sold by weight. Your cart shows an estimate based on the quantity you requested. The final price is confirmed after iKiwi weighs your actual delivery.",
      },
      {
        q: "How do I cancel an order?",
        a: "Contact iKiwi immediately via WhatsApp or phone. Cancellations are only possible before the order enters 'Preparing' status.",
      },
      {
        q: "Can I save an order to repeat later?",
        a: "Order Templates are coming soon! They'll let you save your common orders and reorder with one tap.",
      },
    ],
  },
  {
    id: "prices",
    emoji: "💰",
    label: "Prices & Costs",
    items: [
      {
        q: "Why is the final cost different from my estimate?",
        a: "Some products are sold by weight (kg). When iKiwi weighs your exact order, the actual weight may differ slightly from your request, so the final cost adjusts accordingly. Pieces are counted exactly as ordered.",
      },
      {
        q: "When are prices updated?",
        a: "Prices are updated daily by the iKiwi team, usually in the morning. You'll receive a notification when prices change for products in your cart or watch list.",
      },
      {
        q: "What currency are prices shown in?",
        a: "All prices are in Uzbekistani Som (UZS).",
      },
      {
        q: "Can I get notified when a price drops?",
        a: "Price Alerts are coming soon! You'll be able to set a threshold for any product and get notified when it drops below your target price.",
      },
    ],
  },
  {
    id: "delivery",
    emoji: "📦",
    label: "Delivery",
    items: [
      {
        q: "What are the delivery hours?",
        a: "iKiwi typically delivers in the morning (8 AM – 12 PM). Your specific delivery window will be confirmed by our team after you place your order.",
      },
      {
        q: "How do I track my delivery?",
        a: "Open your Orders tab, find your order, and tap it to view the tracking timeline: Placed → Preparing → Ready → Out for Delivery → Delivered. You'll also get notifications at each stage.",
      },
      {
        q: "What if my delivery is late or incorrect?",
        a: "Contact iKiwi immediately via WhatsApp or phone. We'll resolve any delivery issues promptly at no extra cost to you.",
      },
    ],
  },
  {
    id: "account",
    emoji: "🏪",
    label: "My Shop Account",
    items: [
      {
        q: "How do I update my shop information?",
        a: "Go to Profile → Edit Shop Info. You can update your shop name, owner name, phone number, and address.",
      },
      {
        q: "Why is my account pending approval?",
        a: "New shop accounts require verification by the iKiwi team to ensure quality. Approval usually takes 1–2 business days. You'll receive an email once approved.",
      },
      {
        q: "How do I change my password?",
        a: "Go to Profile → Settings → Account → Change Password. You'll need your current password to set a new one.",
      },
      {
        q: "How do I delete my account?",
        a: "Go to Profile → Settings → Danger Zone → Delete Account. This is permanent and will erase all your shop data and order history.",
      },
    ],
  },
] as const;

type FaqItem = { q: string; a: string };

function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="divide-y divide-border">
      {items.map((item, i) => {
        const isOpen = openIdx === i;
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => setOpenIdx(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-3 py-3.5 px-0 text-left"
            >
              <span className={cn(
                "text-[14px] font-medium leading-snug transition-colors",
                isOpen ? "text-primary" : "text-foreground"
              )}>
                {item.q}
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )} />
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <p className="text-[13px] text-muted-foreground pb-4 leading-relaxed">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const searchResults = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return null;
    const results: Array<{ category: string; emoji: string; q: string; a: string }> = [];
    for (const cat of FAQ_CATEGORIES) {
      for (const item of cat.items) {
        if (item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)) {
          results.push({ category: cat.label, emoji: cat.emoji, q: item.q, a: item.a });
        }
      }
    }
    return results;
  }, [query]);

  const displayCategories = activeCategory
    ? FAQ_CATEGORIES.filter((c) => c.id === activeCategory)
    : FAQ_CATEGORIES;

  return (
    <div className="pb-8">
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/shop/profile"
          className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-accent transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <h1 className="text-[18px] font-bold text-foreground">Help & FAQ</h1>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help articles…"
          className="w-full rounded-xl bg-muted border border-border pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
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

      {/* Search results */}
      {searchResults !== null ? (
        searchResults.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-2xl mb-3">🔍</p>
            <p className="font-semibold text-foreground">No results for &ldquo;{query}&rdquo;</p>
            <p className="text-sm mt-1">Try different keywords or browse categories below.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-card border border-border shadow-sm px-4 divide-y divide-border">
            {searchResults.map((r, i) => (
              <div key={i} className="py-3.5">
                <p className="text-[11px] text-muted-foreground mb-1">
                  {r.emoji} {r.category}
                </p>
                <p className="text-sm font-medium text-foreground mb-1">{r.q}</p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{r.a}</p>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {/* Category chips */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 mb-4">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium border transition-colors",
                activeCategory === null
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "bg-card border-border text-foreground hover:border-primary/40"
              )}
            >
              All
            </button>
            {FAQ_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium border transition-colors",
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-card border-border text-foreground hover:border-primary/40"
                )}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>

          {/* Category cards */}
          <div className="space-y-3">
            {displayCategories.map((cat) => (
              <div key={cat.id} className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <span className="text-xl">{cat.emoji}</span>
                  <h2 className="font-semibold text-[15px] text-foreground">{cat.label}</h2>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {cat.items.length} articles
                  </span>
                </div>
                <div className="px-4">
                  <FaqAccordion items={cat.items} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Contact section */}
      <div className="mt-6 rounded-2xl bg-primary/5 border border-primary/10 px-4 py-4 text-center">
        <p className="text-sm font-semibold text-foreground mb-1">Still need help?</p>
        <p className="text-xs text-muted-foreground mb-3">
          Our support team responds in under 15 minutes.
        </p>
        <Link
          href="https://wa.me/998901234567"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          💬 Contact iKiwi on WhatsApp
        </Link>
      </div>

      <AppFooter />
    </div>
  );
}
