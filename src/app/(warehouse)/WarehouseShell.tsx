"use client";

import { Archive, CalendarDays, ClipboardList, LogOut, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/shared/Logo";
import { NotifBell } from "@/components/shared/NotifBell";
import { ThemeToggleIcon } from "@/components/shared/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getPusherClient } from "@/lib/pusherClient";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/warehouse", label: "My Tasks", icon: ClipboardList, exact: true },
  { href: "/warehouse/stock", label: "Stock", icon: Archive },
  { href: "/warehouse/tomorrow", label: "Tomorrow", icon: CalendarDays, exact: false },
  { href: "/warehouse/profile", label: "Profile", icon: User },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function WarehouseShell({
  children,
  staffName,
  staffId,
  userEmail,
}: {
  children: React.ReactNode;
  staffName: string;
  staffId: string;
  userEmail: string;
}) {
  const pathname = usePathname();

  // Pusher: subscribe to private-warehouse-{staffId}
  useEffect(() => {
    if (!staffId) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe(`private-warehouse-${staffId}`);

    channel.bind("restock-assigned", () => {
      toast("📋 New restock task assigned!", {
        description: "Pull down to refresh your tasks.",
      });
    });

    channel.bind("restock-cancelled", () => {
      toast("Task cancelled", { description: "A task was removed from your list." });
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`private-warehouse-${staffId}`);
    };
  }, [staffId]);

  return (
    <div className="flex flex-col min-h-dvh bg-gray-50 force-light">
      {/* ─── Top bar ─────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-white border-b px-4 h-14 shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <Logo size={28} />
          <span className="text-xs font-semibold text-muted-foreground -ml-1">Warehouse</span>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggleIcon />
          <NotifBell />

          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full focus-visible:outline-none">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {getInitials(staffName)}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-3 py-2">
                <p className="text-sm font-semibold truncate">{staffName}</p>
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600 gap-2"
                onSelect={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ─── Main content ────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>

      {/* ─── Bottom nav ──────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-white">
        <div className="flex">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon
                  className={cn("h-6 w-6", active ? "text-primary" : "text-muted-foreground")}
                />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
