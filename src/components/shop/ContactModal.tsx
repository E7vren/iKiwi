"use client";

import { Mail, MessageCircle, Phone, X } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface ContactModalProps {
  open: boolean;
  onClose: () => void;
  orderRef?: string;
}

interface ContactButtonProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  href: string;
  color: string;
}

function ContactButton({ icon, title, subtitle, href, color }: ContactButtonProps) {
  return (
    <Link
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className={cn(
        "flex items-center gap-4 rounded-2xl p-4 border border-border transition-colors",
        "hover:bg-accent active:scale-[0.98] transition-all duration-150"
      )}
    >
      <span className={cn("h-12 w-12 rounded-full flex items-center justify-center shrink-0", color)}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[15px] text-foreground">{title}</p>
        <p className="text-[13px] text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </Link>
  );
}

export function ContactModal({ open, onClose, orderRef }: ContactModalProps) {
  const waMessage = encodeURIComponent(
    orderRef
      ? `Hi iKiwi, I need help with order #${orderRef}`
      : "Hi iKiwi, I need some help"
  );

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" showCloseButton={false} className="rounded-t-2xl pb-safe-or-8 max-w-lg mx-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-[17px]">Contact iKiwi</SheetTitle>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </SheetHeader>

        <div className="space-y-3">
          <ContactButton
            href="tel:+998901234567"
            icon={<Phone className="h-5 w-5 text-green-700" />}
            title="Call us"
            subtitle="+998 90 123 45 67"
            color="bg-green-50 dark:bg-green-950/30"
          />
          <ContactButton
            href={`https://wa.me/998901234567?text=${waMessage}`}
            icon={<MessageCircle className="h-5 w-5 text-emerald-600" />}
            title="WhatsApp"
            subtitle="Fast responses · 9 AM – 8 PM"
            color="bg-emerald-50 dark:bg-emerald-950/30"
          />
          <ContactButton
            href="mailto:support@ikiwi.uz"
            icon={<Mail className="h-5 w-5 text-blue-600" />}
            title="Email"
            subtitle="support@ikiwi.uz"
            color="bg-blue-50 dark:bg-blue-950/30"
          />
        </div>

        <p className="mt-4 text-center text-[12px] text-muted-foreground">
          Average response time: &lt; 15 minutes
        </p>
      </SheetContent>
    </Sheet>
  );
}
