import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        // biome-ignore lint/suspicious/noExplicitAny: Auth.js user type doesn't include custom fields
        token.role = (user as any).role;
        // biome-ignore lint/suspicious/noExplicitAny: Auth.js user type doesn't include custom fields
        token.shopActive = (user as any).shopActive ?? false;
        // biome-ignore lint/suspicious/noExplicitAny: Auth.js user type doesn't include custom fields
        token.staffId          = (user as any).staffId          ?? null;
        // biome-ignore lint/suspicious/noExplicitAny: Auth.js user type doesn't include custom fields
        token.warehouseStaffId = (user as any).warehouseStaffId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        // biome-ignore lint/suspicious/noExplicitAny: Auth.js token type doesn't include custom fields
        session.user.role = token.role as any;
        session.user.shopActive = token.shopActive as boolean;
        session.user.staffId          = token.staffId          as string | null;
        session.user.warehouseStaffId = token.warehouseStaffId as string | null;
      }
      return session;
    },
  },
  providers: [],
};
