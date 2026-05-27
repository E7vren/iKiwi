import { redirect } from "next/navigation";
import { BottomNav } from "@/components/shop/BottomNav";
import { TopBar } from "@/components/shop/TopBar";
import { Logo } from "@/components/shared/Logo";
import { auth } from "@/lib/auth";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SHOP_OWNER") redirect("/admin");

  if (!session.user.shopActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-sm space-y-4">
          <Logo size={64} className="justify-center mb-6" />
          <h2 className="text-xl font-bold">No Active Shops</h2>
          <p className="text-muted-foreground">
            You don&apos;t have any active shops yet. Add a shop in your profile, or wait for admin approval if your shop was recently deactivated.
          </p>
          <a href="/shop/profile" className="inline-block mt-4 px-6 py-2 rounded-full bg-primary text-white text-sm font-medium">
            Go to Profile
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar userName={session.user.name ?? "Shop"} />

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-4 md:pb-8">{children}</main>

      <BottomNav />
    </div>
  );
}
