"use client";

import { LogOut, Mail, ShieldCheck, User } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Logo } from "@/components/shared/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useLocaleStore, type Locale } from "@/store/localeStore";

function getInitials(name: string | null | undefined) {
  if (!name) return "A";
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

const LANGUAGES: { value: Locale; flag: string; native: string; label: string }[] = [
  { value: "uz", flag: "🇺🇿", native: "O'zbek",  label: "Uzbek" },
  { value: "en", flag: "🇬🇧", native: "English", label: "English" },
  { value: "ru", flag: "🇷🇺", native: "Русский", label: "Russian" },
];

export default function AdminSettingsPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const { locale, setLocale } = useLocaleStore();

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your account and display preferences
        </p>
      </div>

      {/* Account */}
      <div className="rounded-xl bg-white border shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Account
        </h2>
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
              {getInitials(user?.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-bold text-base">{user?.name ?? "Admin"}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Company Admin
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-2.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{user?.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 shrink-0" />
            <span>iKiwi Administrator</span>
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="rounded-xl bg-white border shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Language
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Affects category names and dynamic content throughout the app
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              type="button"
              onClick={() => setLocale(lang.value)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-4 px-3 transition-all ${
                locale === lang.value
                  ? "border-primary bg-primary/5"
                  : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
              }`}
            >
              <span className="text-3xl">{lang.flag}</span>
              <span
                className={`text-sm font-medium ${
                  locale === lang.value ? "text-primary" : "text-gray-700"
                }`}
              >
                {lang.native}
              </span>
              <span className="text-xs text-muted-foreground">{lang.label}</span>
              {locale === lang.value && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div className="rounded-xl bg-white border shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Appearance
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Choose your preferred color theme</p>
        </div>
        <ThemeToggle />
      </div>

      {/* About */}
      <div className="rounded-xl bg-white border shadow-sm p-6 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          About
        </h2>
        <Logo size={32} />
        <p className="text-sm text-muted-foreground leading-relaxed">
          iKiWi Admin Panel — manage products, prices, orders, and shop accounts.
        </p>
        <p className="text-xs text-muted-foreground">Version 1.0.0</p>
      </div>

      {/* Sign out */}
      <Button
        variant="outline"
        className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Sign out
      </Button>
    </div>
  );
}
