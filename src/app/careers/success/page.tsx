"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useLocaleStore } from "@/store/localeStore";
import { useTranslations } from "@/lib/translations";

export default function SuccessPage() {
  const locale = useLocaleStore((s) => s.locale);
  const T = useTranslations(locale);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-3">
          {T.applicationSuccess}
        </h1>
        <p className="text-muted-foreground leading-relaxed mb-8">
          {T.applicationSuccessDesc}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3 text-base font-semibold hover:bg-primary/90 transition-colors"
        >
          {T.backToHome}
        </Link>
      </div>
    </div>
  );
}
