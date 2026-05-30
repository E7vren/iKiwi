"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function getUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}

// ─── Change password ──────────────────────────────────────────────────────────

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password required"),
  newPassword:     z.string().min(8, "Password must be at least 8 characters"),
});

export async function changePassword(input: unknown): Promise<Result<void>> {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(input);
    const user = await getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!user.password) return { success: false, error: "No password set on this account" };

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return { success: false, error: "Current password is incorrect" };

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hash } });
    return { success: true, data: undefined };
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" };
    return { success: false, error: "Something went wrong" };
  }
}

// ─── Change email ─────────────────────────────────────────────────────────────

const changeEmailSchema = z.object({
  newEmail:        z.string().email("Invalid email address"),
  currentPassword: z.string().min(1, "Password required to confirm"),
});

export async function changeEmail(input: unknown): Promise<Result<void>> {
  try {
    const { newEmail, currentPassword } = changeEmailSchema.parse(input);
    const user = await getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!user.password) return { success: false, error: "No password set on this account" };

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return { success: false, error: "Password is incorrect" };

    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing && existing.id !== user.id) return { success: false, error: "Email already in use" };

    await prisma.user.update({ where: { id: user.id }, data: { email: newEmail } });
    return { success: true, data: undefined };
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" };
    return { success: false, error: "Something went wrong" };
  }
}

// ─── Change phone ─────────────────────────────────────────────────────────────

const changePhoneSchema = z.object({
  newPhone: z.string().min(7, "Phone number too short").max(20),
});

export async function changePhone(input: unknown): Promise<Result<void>> {
  try {
    const { newPhone } = changePhoneSchema.parse(input);
    const user = await getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    // Update name field is on User — phone is stored on the shop profile for shop owners
    // For staff it's on their staff record. We store it on name for now via DeliveryStaff/WarehouseStaff
    // For shop owners, update the phone on their shops
    await prisma.shop.updateMany({
      where: { userId: user.id },
      data: { phone: newPhone },
    });
    return { success: true, data: undefined };
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" };
    return { success: false, error: "Something went wrong" };
  }
}
