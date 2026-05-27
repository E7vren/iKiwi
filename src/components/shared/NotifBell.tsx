"use client";

import { Bell } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getPusherClient } from "@/lib/pusherClient";
import { cn } from "@/lib/utils";

interface Notif {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function NotifBell() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);

  async function fetchNotifs() {
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (!res.ok) return;
      const data = await res.json();
      setNotifs(data.notifications);
      setUnread(data.unread);
    } catch {}
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchNotifs is stable (no closure deps)
  useEffect(() => {
    fetchNotifs();
    const id = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(id);
  }, []);

  // Pusher real-time: subscribe to the user's private channel
  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchNotifs is stable (no closure deps)
  useEffect(() => {
    if (!session?.user) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    const role = (session.user as { role?: string }).role;
    const shopId = (session.user as { shopId?: string }).shopId;
    const channelName = role === "COMPANY_ADMIN" ? "private-admin" : `private-shop-${shopId}`;

    const channel = pusher.subscribe(channelName);
    channel.bind("new-notification", () => {
      fetchNotifs();
    });
    if (role === "COMPANY_ADMIN") {
      channel.bind("new-order",         () => fetchNotifs());
      channel.bind("order-shortage",    () => fetchNotifs());
      channel.bind("restock-completed", () => fetchNotifs());
      channel.bind("stock-adjusted",    () => fetchNotifs());
    }

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [session?.user]);

  async function markAll() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read-all" }),
    });
    setNotifs((n) => n.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
  }

  async function markOne(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", id }),
    });
    setNotifs((n) => n.map((x) => (x.id === id ? { ...x, isRead: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors focus-visible:outline-none">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAll}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No notifications yet</p>
          ) : (
            notifs.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.isRead && markOne(n.id)}
                className={cn(
                  "w-full px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50 border-b last:border-0",
                  !n.isRead && "bg-primary/5"
                )}
              >
                <p className={cn("leading-snug", !n.isRead && "font-medium")}>{n.message}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </button>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
