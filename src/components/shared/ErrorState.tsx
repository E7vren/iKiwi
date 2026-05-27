"use client";

import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Button without asChild — project uses base-ui Button which doesn't support it

interface ErrorStateProps {
  type?: "network" | "server" | "permission" | "empty";
  title?: string;
  description?: string;
  onRetry?: () => void;
  contactSupport?: boolean;
  className?: string;
  icon?: React.ReactNode;
  action?: { label: string; href?: string; onClick?: () => void };
}

const DEFAULTS: Record<NonNullable<ErrorStateProps["type"]>, { icon: React.ReactNode; title: string; description: string }> = {
  network: {
    icon: <WifiOff className="h-10 w-10 text-muted-foreground/50" />,
    title: "Couldn't reach iKiwi",
    description: "Check your connection and try again.",
  },
  server: {
    icon: <AlertTriangle className="h-10 w-10 text-amber-500/70" />,
    title: "Something went wrong on our end",
    description: "We're looking into it. Please try again in a moment.",
  },
  permission: {
    icon: <AlertTriangle className="h-10 w-10 text-muted-foreground/50" />,
    title: "You don't have access to this",
    description: "If this seems wrong, contact iKiwi for help.",
  },
  empty: {
    icon: null,
    title: "Nothing here yet",
    description: "",
  },
};

export function ErrorState({
  type = "server",
  title,
  description,
  onRetry,
  contactSupport = false,
  className,
  icon,
  action,
}: ErrorStateProps) {
  const defaults = DEFAULTS[type];
  const displayIcon = icon ?? defaults.icon;
  const displayTitle = title ?? defaults.title;
  const displayDesc = description ?? defaults.description;

  return (
    <div className={cn("flex flex-col items-center justify-center py-20 text-center px-6 gap-4", className)}>
      {displayIcon && <div className="mb-1">{displayIcon}</div>}
      <div className="space-y-1.5">
        <p className="font-semibold text-[15px] text-foreground">{displayTitle}</p>
        {displayDesc && <p className="text-sm text-muted-foreground">{displayDesc}</p>}
      </div>
      <div className="flex gap-2 flex-wrap justify-center mt-1">
        {onRetry && (
          <Button
            size="sm"
            onClick={onRetry}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Try again
          </Button>
        )}
        {contactSupport && (
          <Link
            href="/shop/profile"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-accent text-xs h-8 px-3 font-medium transition-colors"
          >
            Contact Support
          </Link>
        )}
        {action && (
          action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-accent text-xs h-8 px-3 font-medium transition-colors"
            >
              {action.label}
            </Link>
          ) : (
            <Button size="sm" variant="outline" onClick={action.onClick}>
              {action.label}
            </Button>
          )
        )}
      </div>
    </div>
  );
}
