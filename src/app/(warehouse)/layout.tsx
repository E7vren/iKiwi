import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WarehouseShell } from "./WarehouseShell";

export const metadata = { title: "iKiwi Warehouse" };

export default async function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "WAREHOUSE_STAFF") redirect("/");

  const staff = await prisma.warehouseStaff.findUnique({
    where:  { userId: session.user.id },
    select: { id: true, fullName: true, phone: true },
  });

  return (
    <WarehouseShell
      staffName={staff?.fullName ?? session.user.name ?? "Staff"}
      staffId={session.user.warehouseStaffId ?? ""}
      userEmail={session.user.email ?? ""}
    >
      {children}
    </WarehouseShell>
  );
}
