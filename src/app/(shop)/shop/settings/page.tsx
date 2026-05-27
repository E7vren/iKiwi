"use client";

import {
  ArrowLeft, Bell, ChevronRight, Database, Globe,
  ImageIcon, Info, Key, Lock, Mail, Monitor, Phone,
  Star, Trash2, Type,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { AppFooter } from "@/components/shared/AppFooter";
import { cn } from "@/lib/utils";
import { useLocaleStore, type Locale } from "@/store/localeStore";
import {
  useSettingsStore,
  type ImageQuality,
  type TextSize,
} from "@/store/settingsStore";

// ─── Custom toggle ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[26px] w-[46px] shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        checked ? "bg-primary" : "bg-gray-200 dark:bg-muted"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-[22px] w-[22px] rounded-full bg-white shadow-sm ring-0",
          "transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ─── Section primitives ────────────────────────────────────────────────────────

function GroupHeader({ label }: { label: string }) {
  return (
    <h3 className="mt-6 mb-2 text-[11px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">
      {label}
    </h3>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden divide-y divide-border">
      {children}
    </div>
  );
}

interface RowProps {
  icon?: React.ReactNode;
  label: string;
  subtitle?: string;
  value?: string;
  href?: string;
  onClick?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  noChevron?: boolean;
}

function SettingRow({ icon, label, subtitle, value, href, onClick, right, danger, noChevron }: RowProps) {
  const isInteractive = !!(href || onClick);
  const inner = (
    <div
      className={cn(
        "flex items-center min-h-[56px] px-4 py-3 gap-3 transition-colors",
        isInteractive && !danger && "hover:bg-accent active:bg-accent/80",
        isInteractive && danger && "hover:bg-red-50 dark:hover:bg-red-950/30 active:bg-red-100"
      )}
    >
      {icon && (
        <span className={cn("shrink-0", danger ? "text-red-500" : "text-muted-foreground")}>
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-[15px] font-medium leading-none block",
            danger ? "text-red-600 dark:text-red-400" : "text-foreground"
          )}
        >
          {label}
        </span>
        {subtitle && (
          <span className="text-[12px] text-muted-foreground mt-0.5 block">{subtitle}</span>
        )}
      </div>
      {right && <span className="shrink-0">{right}</span>}
      {value && !right && (
        <span className="text-[13px] text-muted-foreground shrink-0 mr-1">{value}</span>
      )}
      {!noChevron && isInteractive && !right && (
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground/60" />
      )}
    </div>
  );

  if (href) return <Link href={href} className="block">{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className="w-full text-left">{inner}</button>;
  return <>{inner}</>;
}

// ─── Generic bottom-sheet picker ──────────────────────────────────────────────

function PickerSheet<T extends string>({
  open, onClose, title, options, value, onChange,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  options: { value: T; label: string; subtitle?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" showCloseButton={false} className="rounded-t-2xl pb-safe-or-8">
        <SheetHeader className="pb-2 pt-1">
          <SheetTitle className="text-center text-base">{title}</SheetTitle>
        </SheetHeader>
        <div className="divide-y divide-border">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); onClose(); }}
              className={cn(
                "w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors",
                value === opt.value ? "bg-primary/5" : "hover:bg-accent"
              )}
            >
              <div>
                <p className={cn(
                  "text-[15px] font-medium",
                  value === opt.value ? "text-primary" : "text-foreground"
                )}>
                  {opt.label}
                </p>
                {opt.subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.subtitle}</p>
                )}
              </div>
              {value === opt.value && (
                <span className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { theme: resolvedTheme } = useTheme();

  const locale    = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const textSize     = useSettingsStore((s) => s.textSize);
  const setTextSize  = useSettingsStore((s) => s.setTextSize);
  const imageQuality    = useSettingsStore((s) => s.imageQuality);
  const setImageQuality = useSettingsStore((s) => s.setImageQuality);
  const notifications   = useSettingsStore((s) => s.notifications);
  const setNotif        = useSettingsStore((s) => s.setNotif);

  const [sizeOpen,    setSizeOpen]    = useState(false);
  const [langOpen,    setLangOpen]    = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [cacheOpen,   setCacheOpen]   = useState(false);
  const [deleteOpen,  setDeleteOpen]  = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  const sizeLabel:    Record<TextSize, string>     = { small: "Small", medium: "Medium", large: "Large" };
  const qualityLabel: Record<ImageQuality, string> = { high: "High", medium: "Medium", low: "Low" };
  const localeLabel:  Record<Locale, string>       = { uz: "O'zbekcha", en: "English", ru: "Русский" };

  function handleClearCache() {
    setCacheOpen(false);
    toast.success("Cache cleared");
  }

  function handleDeleteAccount() {
    if (deleteInput !== "DELETE") return;
    setDeleteOpen(false);
    setDeleteInput("");
    toast.error("Account deletion is not available in this version");
  }

  return (
    <div className="pb-6">

      {/* Top bar */}
      <div className="flex items-center gap-3 mb-2">
        <Link
          href="/shop/profile"
          className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-accent transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <h1 className="text-[18px] font-bold text-foreground">Settings</h1>
      </div>

      {/* 1 ── Account */}
      <GroupHeader label="Account" />
      <Group>
        <SettingRow icon={<Key className="h-5 w-5" />}   label="Change Password" href="/shop/profile" />
        <SettingRow icon={<Mail className="h-5 w-5" />}  label="Change Email"    href="/shop/profile" />
        <SettingRow icon={<Phone className="h-5 w-5" />} label="Change Phone"    href="/shop/profile" />
      </Group>

      {/* 2 ── Notifications */}
      <GroupHeader label="Notifications" />
      <Group>
        <SettingRow
          icon={<Bell className="h-5 w-5" />}
          label="Push Notifications"
          right={<Toggle checked={notifications.push} onChange={(v) => setNotif("push", v)} />}
          noChevron
        />
        <SettingRow
          icon={<Mail className="h-5 w-5" />}
          label="Email Alerts"
          right={<Toggle checked={notifications.email} onChange={(v) => setNotif("email", v)} />}
          noChevron
        />
        <SettingRow
          icon={<Phone className="h-5 w-5" />}
          label="SMS Alerts"
          right={<Toggle checked={notifications.sms} onChange={(v) => setNotif("sms", v)} />}
          noChevron
        />
        <SettingRow
          label="Order Updates"
          subtitle="Delivery status changes"
          right={<Toggle checked={notifications.orderUpdates} onChange={(v) => setNotif("orderUpdates", v)} />}
          noChevron
        />
        <SettingRow
          label="Price Changes"
          subtitle="When product prices are updated"
          right={<Toggle checked={notifications.priceChanges} onChange={(v) => setNotif("priceChanges", v)} />}
          noChevron
        />
        <SettingRow
          label="Promotions"
          subtitle="Deals and special offers"
          right={<Toggle checked={notifications.promotions} onChange={(v) => setNotif("promotions", v)} />}
          noChevron
        />
      </Group>

      {/* 3 ── Appearance */}
      <GroupHeader label="Appearance" />
      <Group>
        {/* Theme — inline ThemeToggle instead of sheet */}
        <div className="px-4 py-3 flex items-center gap-3 min-h-[56px]">
          <Monitor className="h-5 w-5 text-muted-foreground shrink-0" />
          <span className="text-[15px] font-medium text-foreground flex-1">Theme</span>
          <ThemeToggle />
        </div>
        <SettingRow
          icon={<Type className="h-5 w-5" />}
          label="Text Size"
          value={sizeLabel[textSize]}
          onClick={() => setSizeOpen(true)}
        />
      </Group>

      {/* 4 ── Preferences */}
      <GroupHeader label="Preferences" />
      <Group>
        <SettingRow
          icon={<Globe className="h-5 w-5" />}
          label="Language"
          value={localeLabel[locale]}
          onClick={() => setLangOpen(true)}
        />
        <SettingRow
          icon={<Info className="h-4 w-4" />}
          label="Currency"
          value="UZS"
          noChevron
        />
      </Group>

      {/* 5 ── Data & Storage */}
      <GroupHeader label="Data & Storage" />
      <Group>
        <SettingRow
          icon={<ImageIcon className="h-5 w-5" />}
          label="Image Quality"
          value={qualityLabel[imageQuality]}
          onClick={() => setQualityOpen(true)}
        />
        <SettingRow
          icon={<Database className="h-5 w-5" />}
          label="Clear Cache"
          noChevron
          onClick={() => setCacheOpen(true)}
        />
      </Group>

      {/* 6 ── About */}
      <GroupHeader label="About" />
      <Group>
        <SettingRow icon={<Lock className="h-4 w-4" />} label="Privacy Policy"   href="/shop/profile" />
        <SettingRow icon={<Info className="h-4 w-4" />} label="Terms of Service" href="/shop/profile" />
        <SettingRow icon={<Star className="h-4 w-4" />} label="Rate iKiwi"       href="/shop/profile" />
        <SettingRow label="Version" value="1.0.0" noChevron />
      </Group>

      {/* 7 ── Danger Zone */}
      <GroupHeader label="Danger Zone" />
      <Group>
        <SettingRow
          icon={<Trash2 className="h-5 w-5" />}
          label="Delete Account"
          danger noChevron
          onClick={() => setDeleteOpen(true)}
        />
      </Group>

      {/* Text size picker */}
      <PickerSheet
        open={sizeOpen}
        onClose={() => setSizeOpen(false)}
        title="Text Size"
        value={textSize}
        onChange={setTextSize}
        options={[
          { value: "small"  as TextSize, label: "Small" },
          { value: "medium" as TextSize, label: "Medium" },
          { value: "large"  as TextSize, label: "Large" },
        ]}
      />

      {/* Language picker */}
      <PickerSheet
        open={langOpen}
        onClose={() => setLangOpen(false)}
        title="Language"
        value={locale}
        onChange={setLocale}
        options={[
          { value: "uz" as Locale, label: "O'zbekcha", subtitle: "Uzbek" },
          { value: "en" as Locale, label: "English" },
          { value: "ru" as Locale, label: "Русский", subtitle: "Russian" },
        ]}
      />

      {/* Image quality picker */}
      <PickerSheet
        open={qualityOpen}
        onClose={() => setQualityOpen(false)}
        title="Image Quality"
        value={imageQuality}
        onChange={setImageQuality}
        options={[
          { value: "high"   as ImageQuality, label: "High",   subtitle: "Best quality, uses more data" },
          { value: "medium" as ImageQuality, label: "Medium", subtitle: "Balanced" },
          { value: "low"    as ImageQuality, label: "Low",    subtitle: "Saves data" },
        ]}
      />

      {/* Clear cache confirm */}
      <AlertDialog open={cacheOpen} onOpenChange={setCacheOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Cache?</AlertDialogTitle>
            <AlertDialogDescription>
              Locally cached data will be removed. The app may load slower until data is re-fetched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearCache}>Clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AppFooter />

      {/* Delete account confirm */}
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(o) => { setDeleteOpen(o); if (!o) setDeleteInput(""); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 dark:text-red-400">Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              This is permanent and cannot be undone. All shop data and orders will be erased.
              Type <strong className="text-foreground">DELETE</strong> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="mt-1"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteInput !== "DELETE"}
              onClick={handleDeleteAccount}
            >
              Delete Account
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
