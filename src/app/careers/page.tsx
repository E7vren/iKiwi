"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Truck, Warehouse } from "lucide-react";
import { useLocaleStore } from "@/store/localeStore";
import { useTranslations } from "@/lib/translations";

export default function CareersPage() {
  const locale = useLocaleStore((s) => s.locale);
  const T = useTranslations(locale);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-extrabold text-sm">iK</span>
            </div>
            <span className="font-extrabold text-lg">
              i<span className="text-primary">K</span>i<span className="text-primary">W</span>i
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {T.backToHome}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          {T.careersTitle}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          {T.careersSubtitle}
        </p>
      </section>

      {/* Role cards */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/careers/apply?role=DRIVER"
            className="group rounded-2xl border border-border bg-card p-7 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all"
          >
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <Truck className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-bold text-xl mb-2">{T.careerDriverTitle}</h2>
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
            <h2 className="font-bold text-xl mb-2">{T.careerWarehouseTitle}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              {T.careerWarehouseDesc}
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-2.5 transition-all">
              {T.applyAsWarehouse}
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
