"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function AdminSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && value.trim()) {
      router.push(`/admin/orders?search=${encodeURIComponent(value.trim())}`);
    }
    if (e.key === "Escape") {
      setValue("");
      inputRef.current?.blur();
    }
  }

  return (
    <div className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search orders by shop… (Enter)"
        className="w-full h-9 rounded-full border border-border bg-muted/40 pl-9 pr-4 text-body-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
      />
    </div>
  );
}
