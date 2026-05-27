"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { Shop } from "@/types";

const MapboxMap = dynamic(() => import("@/components/admin/MapboxMap").then((m) => m.MapboxMap), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-xl" />,
});

async function fetchShops(): Promise<Shop[]> {
  const res = await fetch("/api/shops");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function AdminMapPage() {
  const { data: shops = [], isLoading } = useQuery({
    queryKey: ["shops"],
    queryFn: fetchShops,
  });

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-3rem)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Delivery Map</h1>
        <p className="text-sm text-muted-foreground">
          {shops.filter((s) => s.isActive).length} active ·{" "}
          {shops.filter((s) => !s.isActive).length} pending
        </p>
      </div>

      <div className="flex-1 min-h-0">
        {isLoading ? (
          <Skeleton className="w-full h-full rounded-xl" />
        ) : (
          <MapboxMap shops={shops} />
        )}
      </div>
    </div>
  );
}
