"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { triggerEvent } from "@/lib/pusher";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// ─── Schema ────────────────────────────────────────────────────────────────────

const applicationSchema = z.object({
  fullName:     z.string().trim().min(2, "Full name required").max(80),
  phone:        z.string().trim().min(7, "Phone required").max(20),
  email:        z.string().email().optional().or(z.literal("")),
  role:         z.enum(["DRIVER", "WAREHOUSE"]),
  vehicleType:  z.enum(["CAR", "MOTORCYCLE", "VAN", "TRUCK", "NONE"]).optional(),
  vehiclePlate: z.string().trim().max(20).optional().or(z.literal("")),
  experience:   z.string().trim().max(500).optional().or(z.literal("")),
  // Honeypot — should always be empty when submitted by a human
  honeypot:     z.string().optional(),
});

// ─── Rate limiting ────────────────────────────────────────────────────────────

const submissionAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT = 3;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = submissionAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    if (submissionAttempts.size > 10_000) submissionAttempts.clear();
    submissionAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

// ─── Submit application (public) ──────────────────────────────────────────────

export async function submitJobApplication(input: unknown): Promise<Result<{ id: string }>> {
  try {
    const data = applicationSchema.parse(input);

    // Honeypot trip — silently succeed without saving
    if (data.honeypot && data.honeypot.length > 0) {
      return { success: true, data: { id: "spam" } };
    }

    // Rate limit by IP
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(ip)) {
      return { success: false, error: "Too many submissions. Please try again later." };
    }

    const application = await prisma.jobApplication.create({
      data: {
        fullName:     data.fullName,
        phone:        data.phone,
        email:        data.email || null,
        role:         data.role,
        vehicleType:  data.role === "DRIVER" ? data.vehicleType ?? null : null,
        vehiclePlate: data.role === "DRIVER" ? (data.vehiclePlate || null) : null,
        experience:   data.experience || null,
      },
    });

    // Notify all admins
    try {
      const admins = await prisma.user.findMany({
        where: { role: "COMPANY_ADMIN" },
        select: { id: true },
      });
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId:  a.id,
          type:    "ORDER_PLACED" as const,
          message: `New ${data.role === "DRIVER" ? "driver" : "warehouse"} application from ${data.fullName}`,
        })),
      });
      await triggerEvent("private-admin", "new-application", {
        id:       application.id,
        fullName: application.fullName,
        role:     application.role,
      });
    } catch {
      // notification failure shouldn't block submission
    }

    return { success: true, data: { id: application.id } };
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" };
    return { success: false, error: "Something went wrong" };
  }
}

// ─── Admin: list applications ──────────────────────────────────────────────────

export async function getJobApplications(status?: "PENDING" | "REVIEWED" | "ACCEPTED" | "REJECTED") {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN") return [];

  return prisma.jobApplication.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

// ─── Admin: update application status ─────────────────────────────────────────

export async function updateApplicationStatus(
  id: string,
  status: "PENDING" | "REVIEWED" | "ACCEPTED" | "REJECTED",
  note?: string
): Promise<Result<void>> {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN") return { success: false, error: "Forbidden" };

  try {
    await prisma.jobApplication.update({
      where: { id },
      data: {
        status,
        adminNote:  note ?? undefined,
        reviewedAt: status !== "PENDING" ? new Date() : null,
      },
    });
    revalidatePath("/admin/applications");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to update application" };
  }
}
