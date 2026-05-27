import { redirect } from "next/navigation";
import { AdminBottomNav, Sidebar } from "@/components/admin/Sidebar";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { NotifBell } from "@/components/shared/NotifBell";
import { ThemeToggleIcon } from "@/components/shared/ThemeToggle";
import { auth } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "COMPANY_ADMIN") redirect("/admin");

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card px-6 shadow-[0px_1px_4px_rgba(0,0,0,0.04)]">
          {/* Search bar */}
          <AdminSearch />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggleIcon />
            <NotifBell />
          </div>
        </header>
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto pb-20 md:pb-6">{children}</main>
        <AdminBottomNav />
      </div>
    </div>
  );
}
