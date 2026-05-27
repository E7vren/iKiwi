import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DriverShell } from "./DriverShell";

export const metadata = { title: "iKiwi Driver" };

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "DELIVERY_STAFF") redirect("/");

  const staff = await prisma.deliveryStaff.findUnique({
    where: { userId: session.user.id },
    select: { id: true, isAvailable: true, fullName: true },
  });

  return (
    <DriverShell
      initialOnline={staff?.isAvailable ?? false}
      driverName={staff?.fullName ?? session.user.name ?? "Driver"}
      staffId={staff?.id ?? ""}
    >
      {children}
    </DriverShell>
  );
}
