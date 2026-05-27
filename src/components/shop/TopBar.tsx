"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/shared/Logo";
import { ThemeToggleIcon } from "@/components/shared/ThemeToggle";
import { cn } from "@/lib/utils";

interface Props {
  userName: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TopBar({ userName }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 bg-background border-b border-transparent transition-all duration-200",
        scrolled ? "border-border shadow-[0_1px_8px_rgba(0,0,0,0.07)] dark:shadow-[0_1px_8px_rgba(0,0,0,0.3)]" : ""
      )}
    >
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        <Link href="/shop" aria-label="Go to catalog">
          <Logo size={32} />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggleIcon />
          <Link
            href="/shop/profile"
            className="h-9 w-9 rounded-full bg-primary flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <span className="text-white text-sm font-bold leading-none tracking-wide">
              {initials(userName)}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
