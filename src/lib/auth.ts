import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validations";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  // biome-ignore lint/suspicious/noExplicitAny: PrismaAdapter type incompatibility with Auth.js v5 beta
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: {
            shops:          { select: { id: true, isActive: true } },
            deliveryStaff:  { select: { id: true } },
            warehouseStaff: { select: { id: true } },
          },
        });

        if (!user?.password) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        const shopActive = user.shops.some((s) => s.isActive);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          shopActive,
          staffId:          user.deliveryStaff?.id   ?? null,
          warehouseStaffId: user.warehouseStaff?.id  ?? null,
        };
      },
    }),
  ],
});
