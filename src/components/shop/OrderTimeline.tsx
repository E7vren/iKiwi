"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";

const STEPS: { status: OrderStatus | "PLACED"; label: string }[] = [
  { status: "PLACED",           label: "Placed" },
  { status: "PREPARING",        label: "Preparing" },
  { status: "READY",            label: "Ready" },
  { status: "OUT_FOR_DELIVERY", label: "On the way" },
  { status: "DELIVERED",        label: "Delivered" },
];

function statusToStepIndex(status: OrderStatus): number {
  const map: Record<OrderStatus, number> = {
    PENDING:              0,
    PREPARING:            1,
    READY:                2,
    OUT_FOR_DELIVERY:     3,
    DELIVERED:            4,
    PARTIALLY_DELIVERED:  4,
    CANCELLED:            -1,
  };
  return map[status] ?? 0;
}

interface TimelineProps {
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export function OrderTimeline({ status, createdAt, updatedAt }: TimelineProps) {
  const cancelled = status === "CANCELLED";
  const activeIndex = statusToStepIndex(status);

  function timeLabel(stepIndex: number): string | null {
    if (stepIndex === 0) {
      return new Date(createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    }
    if (stepIndex === activeIndex && stepIndex > 0) {
      return new Date(updatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    }
    return null;
  }

  if (cancelled) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 px-4 py-3">
        <span className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center shrink-0">
          <X className="h-4 w-4 text-white" />
        </span>
        <div>
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">Order Cancelled</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(updatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {STEPS.map((step, i) => {
        const isCompleted = i < activeIndex;
        const isActive = i === activeIndex;
        const isFuture = i > activeIndex;
        const time = timeLabel(i);
        const isLast = i === STEPS.length - 1;

        return (
          <div key={step.status} className="flex gap-4">
            {/* Left: dot + connector */}
            <div className="flex flex-col items-center">
              <div className="relative flex items-center justify-center">
                {isCompleted && (
                  <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />
                  </div>
                )}
                {isActive && (
                  <motion.div
                    className="h-7 w-7 rounded-full bg-primary flex items-center justify-center"
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <div className="h-2.5 w-2.5 rounded-full bg-primary-foreground" />
                  </motion.div>
                )}
                {isFuture && (
                  <div className="h-7 w-7 rounded-full border-2 border-border bg-background" />
                )}
              </div>
              {!isLast && (
                <div className={cn(
                  "w-0.5 flex-1 my-1",
                  isCompleted ? "bg-primary" : "bg-border"
                )}
                  style={{ minHeight: 24 }}
                />
              )}
            </div>

            {/* Right: label + time */}
            <div className={cn("pb-6", isLast && "pb-0")}>
              <p className={cn(
                "text-sm font-medium leading-7",
                isCompleted && "text-foreground",
                isActive && "text-primary font-semibold",
                isFuture && "text-muted-foreground"
              )}>
                {step.label}
                {isActive && (
                  <span className="ml-2 text-xs font-normal text-primary/70">(now)</span>
                )}
              </p>
              {time && (
                <p className="text-xs text-muted-foreground -mt-1">{time}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
