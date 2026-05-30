"use client";

import { Banknote, CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getMyShops, updatePaymentMethod } from "@/server/actions/shops";
import { useLocaleStore } from "@/store/localeStore";
import { useTranslations } from "@/lib/translations";

const METHODS = [
  {
    value: "CASH" as const,
    icon: Banknote,
    label: "Cash on Delivery",
    labelUz: "Yetkazib berganda naqd",
    labelRu: "Наличные при доставке",
    desc: "Pay in cash when your order arrives",
    descUz: "Buyurtma yetkazilganda naqd to'lang",
    descRu: "Оплатите наличными при получении заказа",
  },
  {
    value: "CARD" as const,
    icon: CreditCard,
    label: "Credit / Debit Card",
    labelUz: "Kredit / debet karta",
    labelRu: "Кредитная / дебетовая карта",
    desc: "Pay by card when your order arrives",
    descUz: "Buyurtma yetkazilganda karta bilan to'lang",
    descRu: "Оплатите картой при получении заказа",
  },
];

export default function PaymentPage() {
  const qc = useQueryClient();
  const locale = useLocaleStore((s) => s.locale);
  const T = useTranslations(locale);
  const [saving, setSaving] = useState<string | null>(null);

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ["my-shops"],
    queryFn: () => getMyShops(),
  });

  async function handleSelect(shopId: string, method: "CASH" | "CARD") {
    setSaving(shopId + method);
    const res = await updatePaymentMethod(shopId, method);
    setSaving(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Payment method updated");
    qc.invalidateQueries({ queryKey: ["my-shops"] });
  }

  function getLabel(m: (typeof METHODS)[number]) {
    if (locale === "uz") return m.labelUz;
    if (locale === "ru") return m.labelRu;
    return m.label;
  }

  function getDesc(m: (typeof METHODS)[number]) {
    if (locale === "uz") return m.descUz;
    if (locale === "ru") return m.descRu;
    return m.desc;
  }

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-xl font-bold">{T.paymentMethod}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {locale === "uz"
            ? "Har bir do'kon uchun to'lov usulini tanlang"
            : locale === "ru"
            ? "Выберите способ оплаты для каждого магазина"
            : "Choose how you'd like to pay for each shop's deliveries"}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((k) => (
            <div key={k} className="h-40 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : shops.length === 0 ? (
        <p className="text-muted-foreground text-sm">{T.noShopsYet}</p>
      ) : (
        shops.map((shop) => (
          <div key={shop.id} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {shop.name}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {METHODS.map((method) => {
                const selected = shop.paymentMethod === method.value;
                const busy = saving === shop.id + method.value;
                const Icon = method.icon;
                return (
                  <button
                    key={method.value}
                    type="button"
                    disabled={!!saving}
                    onClick={() => handleSelect(shop.id, method.value)}
                    className={`relative flex items-start gap-4 rounded-2xl border-2 p-4 text-left transition-all ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        selected ? "bg-primary/10" : "bg-muted"
                      }`}
                    >
                      {busy ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <Icon className={`h-5 w-5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm ${selected ? "text-primary" : "text-foreground"}`}>
                        {getLabel(method)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {getDesc(method)}
                      </p>
                    </div>
                    {selected && (
                      <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Info banner */}
      <div className="rounded-xl bg-muted/50 border border-border px-4 py-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {locale === "uz"
            ? "To'lov buyurtma yetkazilganda amalga oshiriladi. Narx tasdiqlangandan so'ng xabar beriladi."
            : locale === "ru"
            ? "Оплата производится при доставке заказа. Вы получите уведомление после подтверждения суммы."
            : "Payment is collected at the time of delivery. You'll be notified once the final amount is confirmed."}
        </p>
      </div>
    </div>
  );
}
