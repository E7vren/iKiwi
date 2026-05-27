"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bell, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "ikiwi-notif-prompt-shown";

export function NotificationPermissionModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(() => setOpen(true), 1800);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  async function allow() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
    try {
      await Notification.requestPermission();
    } catch {}
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="notif-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={dismiss}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-card rounded-t-3xl px-6 pt-4 pb-10 shadow-2xl border-t border-border"
          >
            {/* Handle + close */}
            <div className="flex justify-center mb-4">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="absolute top-4 right-5 h-7 w-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>

            <div className="flex flex-col items-center text-center gap-4 mt-2">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 22 }}
                className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <Bell className="h-10 w-10 text-primary" />
              </motion.div>

              <div>
                <h3 className="text-[20px] font-bold text-foreground">Stay in the loop 🚚</h3>
                <p className="text-[14px] text-muted-foreground mt-2 leading-relaxed max-w-xs mx-auto">
                  Get notified when your order is on the way, and when prices drop on your favourite products.
                </p>
              </div>

              <div className="w-full space-y-2 mt-2">
                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 rounded-2xl text-[15px]"
                  onClick={allow}
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Yes, notify me
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={dismiss}
                >
                  Not now
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
