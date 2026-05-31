import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Clock,
  Leaf,
  ShieldCheck,
  Sparkles,
  Truck,
  Warehouse,
} from "lucide-react";
import { auth } from "@/lib/auth";

export default async function RootPage() {
  // If already logged in, send to their dashboard
  const session = await auth();
  if (session?.user) {
    const role = session.user.role;
    if (role === "COMPANY_ADMIN")   redirect("/admin");
    if (role === "DELIVERY_STAFF")  redirect("/driver");
    if (role === "WAREHOUSE_STAFF") redirect("/warehouse");
    redirect("/shop");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-extrabold text-sm tracking-tight">iK</span>
            </div>
            <span className="font-extrabold text-lg tracking-tight">
              i<span className="text-primary">K</span>i<span className="text-primary">W</span>i
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Get Started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">B2B Fresh Produce Delivery</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground max-w-4xl mx-auto leading-tight">
            Fresh produce, <span className="text-primary">delivered tomorrow</span> morning.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            iKiWi connects shop owners with fresh fruit and vegetable suppliers.
            Order today, get it delivered before opening — no more market runs at 5 AM.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3 text-base font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              Start ordering
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-base font-semibold text-foreground hover:bg-accent transition-colors"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Features ────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Built for busy shop owners
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Everything you need to keep your shelves stocked, without the early morning hassle.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Clock,
              title: "Order in 2 minutes",
              desc: "Browse the day's catalog, add items to cart, place order. Done.",
            },
            {
              icon: Truck,
              title: "Next-morning delivery",
              desc: "Orders placed before evening arrive at your shop the next morning, ready to sell.",
            },
            {
              icon: Leaf,
              title: "Always fresh",
              desc: "We source straight from the market each morning — quality you can rely on.",
            },
            {
              icon: ShieldCheck,
              title: "Transparent pricing",
              desc: "See daily market prices upfront. Final amount confirmed after weighing — no surprises.",
            },
            {
              icon: Warehouse,
              title: "Stock management",
              desc: "Track inventory, manage staff, and run your warehouse — all in one place.",
            },
            {
              icon: Sparkles,
              title: "3 languages",
              desc: "Use iKiwi in O'zbekcha, English, or Русский — your team chooses what works.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl bg-card border border-border p-6 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all"
            >
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-bold text-lg">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How it works ────────────────────────────────────────────────── */}
      <section className="bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">How it works</h2>
            <p className="mt-3 text-muted-foreground">From order to delivery in three simple steps</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { num: "1", title: "Browse & order", desc: "Sign up, see today's fresh products with live prices, and place your order before evening." },
              { num: "2", title: "We prepare overnight", desc: "Our team sources, weighs, and packs your order from the market early next morning." },
              { num: "3", title: "Delivered to your door", desc: "Your driver arrives before opening time. Pay on delivery in cash or by card." },
            ].map(({ num, title, desc }) => (
              <div key={num} className="text-center">
                <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-extrabold mx-auto mb-4 shadow-lg shadow-primary/20">
                  {num}
                </div>
                <h3 className="font-bold text-lg">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-24 text-center">
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
          Ready to stock smarter?
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Join shops across Uzbekistan saving hours every morning with iKiwi.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 mt-8 rounded-xl bg-primary text-primary-foreground px-8 py-4 text-base font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30"
        >
          Create your account
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-4 text-xs text-muted-foreground">Free to join · No setup fees</p>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-extrabold text-xs">iK</span>
              </div>
              <span className="font-bold text-foreground">iKiWi</span>
              <span className="text-sm text-muted-foreground">© 2026</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/shop/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="/shop/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">
                Login
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
