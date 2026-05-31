import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LandingClient } from "./LandingClient";

export default async function RootPage() {
  const session = await auth();
  if (session?.user) {
    const role = session.user.role;
    if (role === "COMPANY_ADMIN")   redirect("/admin");
    if (role === "DELIVERY_STAFF")  redirect("/driver");
    if (role === "WAREHOUSE_STAFF") redirect("/warehouse");
    redirect("/shop");
  }
  return <LandingClient />;
}
