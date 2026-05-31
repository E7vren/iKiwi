"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight, Check, ChevronDown, Clock, Globe, Leaf,
  Moon, ShieldCheck, Sparkles, Sun, Truck, Warehouse,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useLocaleStore, type Locale } from "@/store/localeStore";
import { useTranslations } from "@/lib/translations";

// ─── Hero produce photos (Unsplash) ───────────────────────────────────────────

const HERO_IMG =
  "https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=1400&q=80";

const GALLERY = [
  {
    key: "admin",
    img:  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80",
    blurb: "Dashboards, analytics, staff management",
  },
  {
    key: "shop",
    img:  "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80",
    blurb: "Browse, search, order in seconds",
  },
  {
    key: "warehouse",
    img:  "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=900&q=80",
    blurb: "Stock counts, restock tasks, history",
  },
  {
    key: "driver",
    img:  "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=900&q=80",
    blurb: "Routes, deliveries, live status",
  },
];

const PRODUCE_PHOTOS = [
  "https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1518843875459-f738682238a6?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=600&q=80",
];

// ─── Language Switcher ────────────────────────────────────────────────────────

function LanguageSwitcher() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const [open, setOpen] = useState(false);

  const langs: { code: Locale; label: string; flag: string }[] = [
    { code: "uz", label: "O'zbekcha", flag: "🇺🇿" },
    { code: "en", label: "English",   flag: "🇬🇧" },
    { code: "ru", label: "Русский",   flag: "🇷🇺" },
  ];

  const current = langs.find((l) => l.code === locale) ?? langs[0];

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("[data-lang-switcher]")) setOpen(false);
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div data-lang-switcher className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{current.label}</span>
        <span className="sm:hidden">{current.flag}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-border bg-card shadow-lg overflow-hidden z-50">
          {langs.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => { setLocale(lang.code); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-left transition-colors ${
                locale === lang.code
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-accent"
              }`}
            >
              <span className="text-base">{lang.flag}</span>
              {lang.label}
              {locale === lang.code && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Theme toggle (inline, no SSR mismatch) ───────────────────────────────────

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-9" />;
  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      aria-label={isDark ? "Switch to light" : "Switch to dark"}
    >
      {isDark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LandingClient() {
  const locale = useLocaleStore((s) => s.locale);
  const T = useTranslations(locale);

  const features = [
    { icon: Clock,        title: T.landFeat1Title, desc: T.landFeat1Desc },
    { icon: Truck,        title: T.landFeat2Title, desc: T.landFeat2Desc },
    { icon: Leaf,         title: T.landFeat3Title, desc: T.landFeat3Desc },
    { icon: ShieldCheck,  title: T.landFeat4Title, desc: T.landFeat4Desc },
    { icon: Warehouse,    title: T.landFeat5Title, desc: T.landFeat5Desc },
    { icon: Sparkles,     title: T.landFeat6Title, desc: T.landFeat6Desc },
  ];

  const steps = [
    { num: "1", title: T.landStep1Title, desc: T.landStep1Desc },
    { num: "2", title: T.landStep2Title, desc: T.landStep2Desc },
    { num: "3", title: T.landStep3Title, desc: T.landStep3Desc },
  ];

  const galleryLabels: Record<string, string> = {
    admin:     T.landGalleryAdmin,
    shop:      T.landGalleryShop,
    warehouse: T.landGalleryWh,
    driver:    T.landGalleryDrv,
  };

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
          <div className="flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link
              href="/login"
              className="hidden sm:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              {T.landLogin}
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 sm:px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              {T.landGetStarted}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-12 sm:pt-24 sm:pb-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 mb-6">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">{T.landBadge}</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.05]">
                {T.landHeroLine1}{" "}
                <span className="text-primary">{T.landHeroAccent}</span>.
              </h1>
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl">
                {T.landHeroSubtitle}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3 text-base font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                >
                  {T.landStartOrdering}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-base font-semibold text-foreground hover:bg-accent transition-colors"
                >
                  {T.landHaveAccount}
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative"
            >
              <div className="relative aspect-[5/4] rounded-3xl overflow-hidden shadow-2xl shadow-primary/10 border border-border">
                <Image
                  src={HERO_IMG}
                  alt="Fresh produce"
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              {/* Floating produce badges */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute -top-4 -right-4 sm:top-6 sm:-right-6 bg-card border border-border rounded-2xl shadow-lg px-4 py-3 flex items-center gap-2"
              >
                <span className="text-2xl">🥬</span>
                <div>
                  <p className="text-xs text-muted-foreground">Today's stock</p>
                  <p className="text-sm font-bold">Fresh greens</p>
                </div>
              </motion.div>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                className="absolute -bottom-4 -left-4 sm:-bottom-6 sm:left-6 bg-card border border-border rounded-2xl shadow-lg px-4 py-3 flex items-center gap-2"
              >
                <span className="text-2xl">🚚</span>
                <div>
                  <p className="text-xs text-muted-foreground">Delivered</p>
                  <p className="text-sm font-bold">Tomorrow 7 AM</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Produce strip ────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-muted/30 py-6 overflow-hidden">
        <div className="flex gap-4 px-4 max-w-6xl mx-auto">
          {PRODUCE_PHOTOS.map((src, i) => (
            <div key={i} className="relative flex-1 aspect-square rounded-2xl overflow-hidden">
              <Image src={src} alt="Fresh produce" fill className="object-cover" sizes="(max-width: 768px) 25vw, 200px" />
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{T.landFeaturesTitle}</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">{T.landFeaturesSub}</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-2xl bg-card border border-border p-6 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all"
            >
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-bold text-lg">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── How it works ────────────────────────────────────────────────── */}
      <section className="bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{T.landHowTitle}</h2>
            <p className="mt-3 text-muted-foreground">{T.landHowSub}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map(({ num, title, desc }, i) => (
              <motion.div
                key={num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="text-center"
              >
                <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-extrabold mx-auto mb-4 shadow-lg shadow-primary/20">
                  {num}
                </div>
                <h3 className="font-bold text-lg">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Gallery ─────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{T.landGalleryTitle}</h2>
          <p className="mt-3 text-muted-foreground">{T.landGallerySub}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {GALLERY.map(({ key, img, blurb }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="group relative rounded-2xl overflow-hidden border border-border bg-card hover:shadow-xl hover:shadow-primary/10 transition-all"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={img}
                  alt={galleryLabels[key]}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h3 className="text-xl font-bold text-white">{galleryLabels[key]}</h3>
                  <p className="text-sm text-white/80 mt-1">{blurb}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Careers ─────────────────────────────────────────────────────── */}
      <section className="bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{T.careersTitle}</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">{T.careersSubtitle}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Link
              href="/careers/apply?role=DRIVER"
              className="group rounded-2xl border border-border bg-card p-7 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all"
            >
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <Truck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold text-xl mb-2">{T.careerDriverTitle}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                {T.careerDriverDesc}
              </p>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-2.5 transition-all">
                {T.applyAsDriver}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>

            <Link
              href="/careers/apply?role=WAREHOUSE"
              className="group rounded-2xl border border-border bg-card p-7 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all"
            >
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <Warehouse className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold text-xl mb-2">{T.careerWarehouseTitle}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                {T.careerWarehouseDesc}
              </p>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-2.5 transition-all">
                {T.applyAsWarehouse}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              {T.landFinalTitle}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{T.landFinalSub}</p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 mt-8 rounded-xl bg-primary text-primary-foreground px-8 py-4 text-base font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30"
            >
              {T.landFinalCta}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-4 text-xs text-muted-foreground">{T.landFinalNote}</p>
          </motion.div>
        </div>
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
              <Link href="/careers" className="text-muted-foreground hover:text-foreground transition-colors">
                {T.careers}
              </Link>
              <Link href="/shop/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                {T.landTerms}
              </Link>
              <Link href="/shop/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                {T.landPrivacy}
              </Link>
              <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">
                {T.landLogin}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
