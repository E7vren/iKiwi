import { DefaultSession } from "next-auth";

type AppRole = "COMPANY_ADMIN" | "SHOP_OWNER" | "DELIVERY_STAFF" | "WAREHOUSE_STAFF";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      shopActive: boolean;
      staffId: string | null;
      warehouseStaffId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppRole;
    shopActive: boolean;
    staffId: string | null;
    warehouseStaffId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AppRole;
    shopActive: boolean;
    staffId: string | null;
    warehouseStaffId: string | null;
  }
}
