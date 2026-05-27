"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Award,
  CheckCircle2,
  LogOut,
  Phone,
  TrendingUp,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyWarehouseProfile } from "@/server/actions/restock";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export default function WarehouseProfilePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["warehouse-profile"],
    queryFn:  () => getMyWarehouseProfile(),
  });

  if (isLoading) {
    return (
      <div className="px-4 pt-6 space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="px-4 pt-6 pb-8 space-y-5">
      {/* Avatar + name */}
      <Card className="border-0 shadow-sm p-5 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <span className="text-2xl font-bold text-primary">{getInitials(data.fullName)}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold truncate">{data.fullName}</p>
          <p className="text-sm text-muted-foreground truncate">{data.email}</p>
          {data.phone && (
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              {data.phone}
            </div>
          )}
        </div>
      </Card>

      {/* Stats */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">My Stats</p>
        </div>
        <div className="divide-y">
          <div className="flex items-center gap-4 px-4 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold">{data.stats.monthCompleted}</p>
              <p className="text-sm text-muted-foreground">Restocks this month</p>
            </div>
          </div>

          <div className="flex items-center gap-4 px-4 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold">{data.stats.totalCompleted}</p>
              <p className="text-sm text-muted-foreground">Total completed</p>
            </div>
          </div>

          {data.stats.onTimeRate != null && (
            <div className="flex items-center gap-4 px-4 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50">
                <Award className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-base font-semibold">{data.stats.onTimeRate}%</p>
                <p className="text-sm text-muted-foreground">On-time rate</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Menu */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => { window.location.href = "tel:+998712345678"; }}
          className="flex w-full items-center gap-4 border-b px-4 py-4 text-left hover:bg-muted/40 active:bg-muted transition-colors"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-green-600 bg-green-50">
            <Phone className="h-5 w-5" />
          </div>
          <span className="text-base font-medium">Contact iKiwi office</span>
        </button>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-4 border-t px-4 py-4 text-left hover:bg-red-50 active:bg-red-100 transition-colors"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <LogOut className="h-5 w-5 text-red-600" />
          </div>
          <span className="text-base font-medium text-red-600">Sign Out</span>
        </button>
      </Card>
    </div>
  );
}
