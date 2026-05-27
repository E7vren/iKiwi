"use client";

import { motion } from "framer-motion";
import { Check, Download, ExternalLink, Loader2, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/lib/utils";
import { NotificationPermissionModal } from "@/components/shop/NotificationPermissionModal";

type ConfirmationOrder = {
  id: string;
  estimatedTotal: number;
  actualTotal: number | null;
  notes: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    orderedAs: "KG" | "PIECE";
    requestedKg: number | null;
    requestedPieces: number | null;
    estimatedPrice: number;
    product: { name: string };
  }>;
};

function itemQty(item: ConfirmationOrder["items"][0]): string {
  if (item.orderedAs === "KG") return `${item.requestedKg ?? "?"} kg`;
  return `${item.requestedPieces ?? "?"} pcs`;
}

export function ConfirmationClient({ order }: { order: ConfirmationOrder }) {
  const router = useRouter();
  const shortId = order.id.slice(-6).toUpperCase();
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/receipt/${order.id}`);
      if (!res.ok) throw new Error("Failed to generate receipt");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `iKiwi-Order-${shortId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't generate receipt. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
    <div className="flex flex-col items-center py-8 gap-6 max-w-sm mx-auto">
      {/* Animated checkmark */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.2, 1] }}
        transition={{ duration: 0.5, times: [0, 0.6, 1], ease: "easeOut" }}
        className="h-24 w-24 rounded-full bg-primary flex items-center justify-center shadow-lg"
        style={{ boxShadow: "0 8px 32px rgba(46,125,50,0.35)" }}
      >
        <Check className="h-12 w-12 text-primary-foreground" strokeWidth={2.5} />
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="text-center space-y-1"
      >
        <h1 className="text-2xl font-bold text-foreground">Order placed! 🥝</h1>
        <p className="text-muted-foreground text-sm">
          We&apos;ve received your order and will start preparing it soon.
        </p>
      </motion.div>

      {/* Order card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.3 }}
        className="w-full rounded-2xl bg-card border border-border shadow-sm overflow-hidden"
      >
        {/* Order meta */}
        <div className="px-4 py-3 bg-primary/5 border-b border-border flex justify-between items-center">
          <span className="text-sm font-semibold text-foreground">Order #{shortId}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(order.createdAt).toLocaleDateString("en-GB", {
              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </span>
        </div>

        {/* Items */}
        <div className="px-4 py-3 space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-foreground">
                {item.product.name}{" "}
                <span className="text-muted-foreground text-xs">× {itemQty(item)}</span>
              </span>
              <span className="font-medium text-foreground shrink-0 ml-2">
                {formatPrice(item.estimatedPrice)}
              </span>
            </div>
          ))}
        </div>

        <Separator />

        {/* Total */}
        <div className="px-4 py-3 flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Estimated total</span>
          <span className="text-lg font-bold text-primary">{formatPrice(order.estimatedTotal)}</span>
        </div>

        {/* Disclaimer */}
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-lg px-3 py-2">
            Final cost will be confirmed after iKiwi weighs your order. You&apos;ll be notified of any changes.
          </p>
        </div>
      </motion.div>

      {/* Delivery info */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-xs text-center text-muted-foreground px-4"
      >
        🚚 Delivery: <span className="font-medium text-foreground">Tomorrow morning</span>
        {" "}· Our team will contact you to confirm the exact time.
      </motion.p>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75, duration: 0.3 }}
        className="w-full space-y-2"
      >
        <Button
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => router.push(`/orders/${order.id}`)}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Track Order
        </Button>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Download Receipt PDF
        </Button>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push("/shop")}
        >
          <ShoppingBag className="h-4 w-4 mr-2" />
          Continue Shopping
        </Button>
      </motion.div>
    </div>

    <NotificationPermissionModal />
    </>
  );
}
