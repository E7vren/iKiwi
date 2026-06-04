import { redirect } from "next/navigation";
import { ShopShell } from "@/components/shop/ShopShell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SHOP_OWNER") redirect("/admin");

  // Re-check shop status from DB — the JWT can be stale if admin activated the
  // shop after the user logged in. Cheap query (indexed userId).
  const activeShopCount = await prisma.shop.count({
    where: { userId: session.user.id, isActive: true },
  });
  const shopActive = activeShopCount > 0;

  if (!shopActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-sm space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6">
            <span className="text-primary-foreground font-extrabold text-2xl">iK</span>
          </div>
          <h2 className="text-xl font-bold">No Active Shops</h2>
          <p className="text-muted-foreground">
            You don&apos;t have any active shops yet. Add a shop in your profile, or wait for admin
            approval if your shop was recently deactivated.
          </p>
          <a
            href="/shop/profile"
            className="inline-block mt-4 px-6 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium"
          >
            Go to Profile
          </a>
        </div>
      </div>
    );
  }

  return (
    <ShopShell userName={session.user.name ?? "Shop"}>
      {children}
    </ShopShell>
  );
}
