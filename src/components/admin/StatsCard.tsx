import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  color?: "green" | "blue" | "orange" | "purple";
}

const colors = {
  green: "bg-green-50 text-green-600",
  blue: "bg-blue-50 text-blue-600",
  orange: "bg-orange-50 text-orange-600",
  purple: "bg-purple-50 text-purple-600",
};

export function StatsCard({ title, value, sub, icon: Icon, color = "green" }: StatsCardProps) {
  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl shrink-0",
          colors[color]
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold mt-0.5 leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}
