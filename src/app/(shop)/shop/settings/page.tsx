"use client";

import {
  ArrowLeft, Bell, ChevronRight, Database, Eye, EyeOff, Globe,
  ImageIcon, Info, Key, Lock, Loader2, Mail, Monitor,
  Phone, Trash2, Type,
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
import { useTranslations } from "@/lib/translations";
import {
  useSettingsStore,
  type ImageQuality,
  type TextSize,
} from "@/store/settingsStore";
import { changeEmail, changePassword, changePhone } from "@/server/actions/account";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

// ─── Account change dialogs ───────────────────────────────────────────────────

function PasswordField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext]       = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy]       = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    const res = await changePassword({ currentPassword: current, newPassword: next });
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Password updated");
    setCurrent(""); setNext(""); setConfirm("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><label className="text-sm font-medium">Current Password</label><PasswordField value={current} onChange={setCurrent} /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">New Password</label><PasswordField value={next} onChange={setNext} placeholder="Min 8 characters" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Confirm New Password</label><PasswordField value={confirm} onChange={setConfirm} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !current || next.length < 8 || next !== confirm}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Update
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChangeEmailDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy]         = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await changeEmail({ newEmail: email, currentPassword: password });
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Email updated — please log in again");
    setEmail(""); setPassword("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Change Email</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><label className="text-sm font-medium">New Email Address</label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Confirm with Password</label><PasswordField value={password} onChange={setPassword} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !email || !password}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Update
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChangePhoneDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy]   = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await changePhone({ newPhone: phone });
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Phone number updated");
    setPhone("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Change Phone</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><label className="text-sm font-medium">New Phone Number</label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998901234567" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || phone.length < 7}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Update
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { theme: resolvedTheme } = useTheme();

  const locale    = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const T = useTranslations(locale);

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
  const [pwOpen,      setPwOpen]      = useState(false);
  const [emailOpen,   setEmailOpen]   = useState(false);
  const [phoneOpen,   setPhoneOpen]   = useState(false);

  const sizeLabel:    Record<TextSize, string>     = { small: T.sizeSmall, medium: T.sizeMedium, large: T.sizeLarge };
  const qualityLabel: Record<ImageQuality, string> = { high: T.qualityHigh, medium: T.qualityMedium, low: T.qualityLow };
  const localeLabel:  Record<Locale, string>       = { uz: "O'zbekcha", en: "English", ru: "Русский" };

  function handleClearCache() {
    setCacheOpen(false);
    toast.success(T.clearCacheSuccess);
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
        <h1 className="text-[18px] font-bold text-foreground">{T.settings}</h1>
      </div>

      {/* 1 ── Account */}
      <GroupHeader label={T.account} />
      <Group>
        <SettingRow icon={<Key className="h-5 w-5" />}   label={T.changePassword} onClick={() => setPwOpen(true)} />
        <SettingRow icon={<Mail className="h-5 w-5" />}  label={T.changeEmail}    onClick={() => setEmailOpen(true)} />
        <SettingRow icon={<Phone className="h-5 w-5" />} label={T.changePhone}    onClick={() => setPhoneOpen(true)} />
      </Group>

      {/* 2 ── Notifications */}
      <GroupHeader label={T.notifications} />
      <Group>
        <SettingRow
          icon={<Bell className="h-5 w-5" />}
          label={T.pushNotifications}
          right={<Toggle checked={notifications.push} onChange={(v) => setNotif("push", v)} />}
          noChevron
        />
        <SettingRow
          icon={<Mail className="h-5 w-5" />}
          label={T.emailAlerts}
          right={<Toggle checked={notifications.email} onChange={(v) => setNotif("email", v)} />}
          noChevron
        />
        <SettingRow
          icon={<Phone className="h-5 w-5" />}
          label={T.smsAlerts}
          right={<Toggle checked={notifications.sms} onChange={(v) => setNotif("sms", v)} />}
          noChevron
        />
        <SettingRow
          label={T.orderUpdates}
          subtitle={T.orderUpdatesDesc}
          right={<Toggle checked={notifications.orderUpdates} onChange={(v) => setNotif("orderUpdates", v)} />}
          noChevron
        />
        <SettingRow
          label={T.priceChanges}
          subtitle={T.priceChangesDesc}
          right={<Toggle checked={notifications.priceChanges} onChange={(v) => setNotif("priceChanges", v)} />}
          noChevron
        />
        <SettingRow
          label={T.promotions}
          subtitle={T.promotionsDesc}
          right={<Toggle checked={notifications.promotions} onChange={(v) => setNotif("promotions", v)} />}
          noChevron
        />
      </Group>

      {/* 3 ── Appearance */}
      <GroupHeader label={T.appearance} />
      <Group>
        <div className="px-4 py-3 flex items-center gap-3 min-h-[56px]">
          <Monitor className="h-5 w-5 text-muted-foreground shrink-0" />
          <span className="text-[15px] font-medium text-foreground flex-1">{T.theme}</span>
          <ThemeToggle />
        </div>
        <SettingRow
          icon={<Type className="h-5 w-5" />}
          label={T.textSize}
          value={sizeLabel[textSize]}
          onClick={() => setSizeOpen(true)}
        />
      </Group>

      {/* 4 ── Preferences */}
      <GroupHeader label={T.preferences} />
      <Group>
        <SettingRow
          icon={<Globe className="h-5 w-5" />}
          label={T.language}
          value={localeLabel[locale]}
          onClick={() => setLangOpen(true)}
        />
        <SettingRow
          icon={<Info className="h-4 w-4" />}
          label={T.currency}
          value="UZS"
          noChevron
        />
      </Group>

      {/* 5 ── Data & Storage */}
      <GroupHeader label={T.dataStorage} />
      <Group>
        <SettingRow
          icon={<ImageIcon className="h-5 w-5" />}
          label={T.imageQuality}
          value={qualityLabel[imageQuality]}
          onClick={() => setQualityOpen(true)}
        />
        <SettingRow
          icon={<Database className="h-5 w-5" />}
          label={T.clearCache}
          noChevron
          onClick={() => setCacheOpen(true)}
        />
      </Group>

      {/* 6 ── About */}
      <GroupHeader label={T.about} />
      <Group>
        <SettingRow icon={<Lock className="h-4 w-4" />} label={T.privacyPolicy}  href="/shop/privacy" />
        <SettingRow icon={<Info className="h-4 w-4" />} label={T.termsOfService} href="/shop/terms" />
        <SettingRow label={T.version} value="1.0.0" noChevron />
      </Group>

      {/* 7 ── Danger Zone */}
      <GroupHeader label={T.dangerZone} />
      <Group>
        <SettingRow
          icon={<Trash2 className="h-5 w-5" />}
          label={T.deleteAccount}
          danger noChevron
          onClick={() => setDeleteOpen(true)}
        />
      </Group>

      {/* Text size picker */}
      <PickerSheet
        open={sizeOpen}
        onClose={() => setSizeOpen(false)}
        title={T.textSize}
        value={textSize}
        onChange={setTextSize}
        options={[
          { value: "small"  as TextSize, label: T.sizeSmall },
          { value: "medium" as TextSize, label: T.sizeMedium },
          { value: "large"  as TextSize, label: T.sizeLarge },
        ]}
      />

      {/* Language picker */}
      <PickerSheet
        open={langOpen}
        onClose={() => setLangOpen(false)}
        title={T.language}
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
        title={T.imageQuality}
        value={imageQuality}
        onChange={setImageQuality}
        options={[
          { value: "high"   as ImageQuality, label: T.qualityHigh },
          { value: "medium" as ImageQuality, label: T.qualityMedium },
          { value: "low"    as ImageQuality, label: T.qualityLow },
        ]}
      />

      {/* Clear cache confirm */}
      <AlertDialog open={cacheOpen} onOpenChange={setCacheOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{T.clearCacheTitle}</AlertDialogTitle>
            <AlertDialogDescription>{T.clearCacheDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{T.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearCache}>{T.clear}</AlertDialogAction>
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
            <AlertDialogTitle className="text-red-600 dark:text-red-400">{T.deleteAccountTitle}</AlertDialogTitle>
            <AlertDialogDescription>{T.deleteAccountDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.target.value)}
            placeholder={T.typeDeleteConfirm}
            className="mt-1"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{T.cancel}</AlertDialogCancel>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteInput !== "DELETE"}
              onClick={handleDeleteAccount}
            >
              {T.deleteAccount}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ChangePasswordDialog open={pwOpen}    onClose={() => setPwOpen(false)} />
      <ChangeEmailDialog    open={emailOpen} onClose={() => setEmailOpen(false)} />
      <ChangePhoneDialog    open={phoneOpen} onClose={() => setPhoneOpen(false)} />
    </div>
  );
}
