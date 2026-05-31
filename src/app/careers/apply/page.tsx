"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocaleStore } from "@/store/localeStore";
import { useTranslations } from "@/lib/translations";
import { submitJobApplication } from "@/server/actions/applications";

type Vehicle = "CAR" | "MOTORCYCLE" | "VAN" | "TRUCK" | "NONE";

export default function ApplyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocaleStore((s) => s.locale);
  const T = useTranslations(locale);

  const initialRole = searchParams.get("role") === "WAREHOUSE" ? "WAREHOUSE" : "DRIVER";

  const [role] = useState<"DRIVER" | "WAREHOUSE">(initialRole);
  const [fullName, setFullName]         = useState("");
  const [phone, setPhone]               = useState("");
  const [email, setEmail]               = useState("");
  const [vehicleType, setVehicleType]   = useState<Vehicle>("CAR");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [experience, setExperience]     = useState("");
  const [honeypot, setHoneypot]         = useState("");
  const [busy, setBusy]                 = useState(false);

  const vehicleOptions: { value: Vehicle; label: string }[] = [
    { value: "CAR",        label: T.vehicleCar },
    { value: "MOTORCYCLE", label: T.vehicleMotorcycle },
    { value: "VAN",        label: T.vehicleVan },
    { value: "TRUCK",      label: T.vehicleTruck },
    { value: "NONE",       label: T.vehicleNone },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await submitJobApplication({
      fullName, phone, email,
      role,
      vehicleType: role === "DRIVER" ? vehicleType : undefined,
      vehiclePlate,
      experience,
      honeypot,
    });
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    router.push("/careers/success");
  }

  const roleLabel = role === "DRIVER" ? T.driver : T.warehouseStaff;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-2xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-extrabold text-sm">iK</span>
            </div>
            <span className="font-extrabold text-lg">
              i<span className="text-primary">K</span>i<span className="text-primary">W</span>i
            </span>
          </Link>
          <Link
            href="/careers"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {T.careers}
          </Link>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary mb-2">
            {T.applicationFor}
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {roleLabel}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Honeypot — hidden field, bots fill in everything */}
          <div className="hidden" aria-hidden="true">
            <label>
              Leave this blank
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{T.fullNameLabel} *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-11 rounded-xl border border-border bg-card px-4 text-base focus:border-primary focus:outline-none transition-colors"
              placeholder="Akbar Karimov"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{T.phoneLabelReq} *</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-11 rounded-xl border border-border bg-card px-4 text-base focus:border-primary focus:outline-none transition-colors"
              placeholder="+998901234567"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{T.emailLabelOpt}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 rounded-xl border border-border bg-card px-4 text-base focus:border-primary focus:outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>

          {role === "DRIVER" && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">{T.vehicleQuestion} *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {vehicleOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setVehicleType(opt.value)}
                      className={`rounded-xl border-2 px-4 py-3 text-sm font-medium text-left transition-colors ${
                        vehicleType === opt.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-card text-foreground hover:border-primary/40"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {vehicleType !== "NONE" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{T.plateLabel}</label>
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    className="w-full h-11 rounded-xl border border-border bg-card px-4 text-base focus:border-primary focus:outline-none transition-colors"
                    placeholder="01 A 123 BC"
                  />
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{T.experienceLabel}</label>
            <textarea
              rows={4}
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base focus:border-primary focus:outline-none transition-colors resize-none"
              placeholder={T.experiencePlaceholder}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{experience.length}/500</p>
          </div>

          <button
            type="submit"
            disabled={busy || !fullName || phone.length < 7}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3.5 text-base font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? T.submitting : T.submitApplication}
          </button>
        </form>
      </main>
    </div>
  );
}
