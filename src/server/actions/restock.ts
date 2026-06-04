"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeError } from "@/lib/errors";
import { applyStockChange } from "@/lib/inventory/stock-engine";
import { triggerEvent } from "@/lib/pusher";
import {
  createManualRestockSchema,
  restockReceivedSchema,
} from "@/lib/validations/inventory.schema";
import { serializeDecimals } from "@/lib/serialize";
import { sendStaffCredentialsEmail } from "@/lib/email";
import type { ActionResult } from "@/types";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "COMPANY_ADMIN") throw new Error("Unauthorized");
  return session;
}

async function requireWarehouseStaff() {
  const session = await auth();
  if (session?.user.role !== "WAREHOUSE_STAFF") throw new Error("Unauthorized");
  return session;
}

// ─── Warehouse staff profile ──────────────────────────────────────────────────

export async function getMyWarehouseProfile() {
  const session = await requireWarehouseStaff();

  const staff = await prisma.warehouseStaff.findUniqueOrThrow({
    where: { userId: session.user.id },
    include: {
      user: { select: { email: true, name: true } },
      assignedTasks: { select: { id: true, status: true, createdAt: true, completedAt: true } },
    },
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalCompleted = staff.assignedTasks.filter((t) => t.status === "COMPLETED").length;
  const monthCompleted = staff.assignedTasks.filter(
    (t) => t.status === "COMPLETED" && t.completedAt && new Date(t.completedAt) >= startOfMonth
  ).length;

  const completedWithTime = staff.assignedTasks.filter(
    (t) => t.status === "COMPLETED" && t.completedAt && t.createdAt
  );
  const onTimeRate =
    completedWithTime.length > 0
      ? Math.round(
          (completedWithTime.filter((t) => {
            const ms = new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime();
            return ms < 24 * 60 * 60 * 1000; // completed within 24h
          }).length /
            completedWithTime.length) *
            100
        )
      : null;

  return {
    id: staff.id,
    fullName: staff.fullName,
    phone: staff.phone,
    email: staff.user.email,
    stats: {
      totalCompleted,
      monthCompleted,
      onTimeRate,
    },
  };
}

// ─── Reading ──────────────────────────────────────────────────────────────────

export async function getRestockTasks(status?: string) {
  const session = await auth();
  const allowed = ["COMPANY_ADMIN", "WAREHOUSE_STAFF"] as const;
  if (!session?.user || !allowed.includes(session.user.role as (typeof allowed)[number])) {
    throw new Error("Unauthorized");
  }

  // biome-ignore lint/suspicious/noExplicitAny: dynamic filter
  const where: any = {};
  if (status) where.status = status;

  if (session.user.role === "WAREHOUSE_STAFF") {
    const staff = await prisma.warehouseStaff.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (staff) where.assignedToId = staff.id;
  }

  const tasks = await prisma.restockTask.findMany({
    where,
    include: {
      items: { include: { product: { include: { stockItem: true } } } },
      assignedTo: true,
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  return serializeDecimals(tasks);
}

export async function getAllWarehouseStaff() {
  await requireAdmin();
  return prisma.warehouseStaff.findMany({
    where: { isActive: true },
    include: { user: { select: { email: true } } },
    orderBy: { fullName: "asc" },
  });
}

// ─── Create manual restock task ───────────────────────────────────────────────

export async function createManualRestockTask(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();
    const data = createManualRestockSchema.parse(input);

    // Estimate cost from supplier prices
    const stockItems = await prisma.stockItem.findMany({
      where: { productId: { in: data.items.map((i) => i.productId) } },
      select: { productId: true, supplierPrice: true },
    });
    const priceMap = new Map(stockItems.map((s) => [s.productId, s.supplierPrice]));

    let estimatedCost = 0;
    for (const item of data.items) {
      const price = Number(priceMap.get(item.productId) ?? 0);
      if (item.neededKg) estimatedCost += price * item.neededKg;
      if (item.neededPieces) estimatedCost += price * item.neededPieces;
    }

    const task = await prisma.restockTask.create({
      data: {
        status: data.assignedToId ? "ASSIGNED" : "PENDING",
        priority: data.priority,
        triggerType: "MANUAL",
        assignedToId: data.assignedToId ?? null,
        assignedAt: data.assignedToId ? new Date() : null,
        adminNote: data.adminNote,
        estimatedCost: Math.round(estimatedCost) || null,
        items: {
          create: data.items.map((i) => ({
            productId: i.productId,
            neededKg: i.neededKg,
            neededPieces: i.neededPieces,
          })),
        },
      },
      include: { assignedTo: { include: { user: { select: { id: true } } } } },
    });

    if (task.assignedToId && task.assignedTo) {
      await triggerEvent(`private-warehouse-${task.assignedToId}`, "restock-assigned", {
        taskId: task.id,
      });
      await prisma.notification.create({
        data: {
          userId: task.assignedTo.user.id,
          type: "RESTOCK_ASSIGNED",
          title: "New restock task",
          message: `${data.items.length} item${data.items.length !== 1 ? "s" : ""} · est. ${Math.round(estimatedCost).toLocaleString()} UZS`,
        },
      });
    }

    revalidatePath("/admin/restock");
    revalidatePath("/warehouse");
    return { success: true, data: { id: task.id } };
  } catch (e) {
    return { success: false, error: normalizeError(e) };
  }
}

// ─── Assign an existing task to a staff member ───────────────────────────────

export async function assignRestockTask(input: {
  taskId: string;
  staffId: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  adminNote?: string;
}): Promise<ActionResult<void>> {
  try {
    await requireAdmin();

    const task = await prisma.restockTask.update({
      where: { id: input.taskId },
      data: {
        assignedToId: input.staffId,
        status: "ASSIGNED",
        assignedAt: new Date(),
        ...(input.priority ? { priority: input.priority } : {}),
        ...(input.adminNote ? { adminNote: input.adminNote } : {}),
      },
      include: { assignedTo: { include: { user: { select: { id: true } } } } },
    });

    if (task.assignedTo) {
      await triggerEvent(`private-warehouse-${input.staffId}`, "restock-assigned", {
        taskId: task.id,
      });
      await prisma.notification.create({
        data: {
          userId: task.assignedTo.user.id,
          type: "RESTOCK_ASSIGNED",
          title: "Restock task assigned to you",
          message: `Priority: ${task.priority}`,
        },
      });
    }

    revalidatePath("/admin/restock");
    revalidatePath("/warehouse");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: normalizeError(e) };
  }
}

// ─── Staff: start a task ──────────────────────────────────────────────────────

export async function startRestockTask(taskId: string): Promise<ActionResult<void>> {
  try {
    const session = await requireWarehouseStaff();
    const staff = await prisma.warehouseStaff.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!staff) return { success: false, error: "Staff profile not found" };
    await prisma.restockTask.update({
      where: { id: taskId, assignedToId: staff.id },
      data: { status: "IN_PROGRESS" },
    });
    revalidatePath("/warehouse");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: normalizeError(e) };
  }
}

// ─── Staff: complete a restock (goods received, stock updated) ────────────────

export async function completeRestockTask(input: unknown): Promise<ActionResult<void>> {
  try {
    const session = await requireWarehouseStaff();
    const data = restockReceivedSchema.parse(input);

    const staff = await prisma.warehouseStaff.findUnique({
      where: { userId: session.user.id },
      select: { id: true, fullName: true },
    });
    if (!staff) return { success: false, error: "Staff profile missing" };

    let completedItemCount = 0;

    await prisma.$transaction(async (tx) => {
      const task = await tx.restockTask.findUniqueOrThrow({
        where: { id: data.restockTaskId },
        include: { items: true },
      });

      if (task.assignedToId !== staff.id) throw new Error("Not your task");

      for (const line of data.items) {
        const restockItem = task.items.find((i) => i.id === line.restockItemId);
        if (!restockItem) continue;

        await tx.restockItem.update({
          where: { id: restockItem.id },
          data: {
            receivedKg: line.receivedKg,
            receivedPieces: line.receivedPieces,
            pricePaidPerKg: line.pricePaidPerKg,
            pricePaidPerPiece: line.pricePaidPerPiece,
            isReceived: true,
          },
        });

        if ((line.receivedKg ?? 0) > 0 || (line.receivedPieces ?? 0) > 0) {
          await applyStockChange(tx, {
            productId: restockItem.productId,
            deltaKg: line.receivedKg,
            deltaPieces: line.receivedPieces,
            type: "RESTOCK",
            performedBy: session.user.id,
            performedByRole: "WAREHOUSE_STAFF",
            warehouseStaffId: staff.id,
            restockTaskId: task.id,
            note: data.staffNote,
          });
          completedItemCount++;
        }
      }

      await tx.restockTask.update({
        where: { id: task.id },
        data: { status: "COMPLETED", completedAt: new Date(), staffNote: data.staffNote },
      });

      const admins = await tx.user.findMany({
        where: { role: "COMPANY_ADMIN" },
        select: { id: true },
      });
      await tx.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: "RESTOCK_COMPLETED" as const,
          title: "Restock completed",
          message: `${staff.fullName} restocked ${completedItemCount} product${completedItemCount !== 1 ? "s" : ""}`,
        })),
      });
    });

    await triggerEvent("private-admin", "restock-completed", { taskId: data.restockTaskId });
    revalidatePath("/admin/warehouse");
    revalidatePath("/admin/restock");
    revalidatePath("/warehouse");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: normalizeError(e) };
  }
}

// ─── Re-assign an existing ASSIGNED task to a different staff member ─────────

export async function reassignRestockTask(input: {
  taskId: string;
  assignedToId: string | null;
}): Promise<ActionResult<void>> {
  try {
    await requireAdmin();
    await prisma.restockTask.update({
      where: { id: input.taskId },
      data: { assignedToId: input.assignedToId },
    });
    revalidatePath("/admin/restock");
    revalidatePath("/warehouse");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: normalizeError(e) };
  }
}

// ─── Create warehouse staff account ──────────────────────────────────────────

const createWarehouseStaffSchema = z.object({
  fullName: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
  password: z.string().min(8).max(100),
});

export async function createWarehouseStaff(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();
    const data = createWarehouseStaffSchema.parse(input);
    const { fullName, email, phone, password } = data;
    const passwordHash = await bcrypt.hash(password, 10);

    const staff = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: passwordHash,
          name: fullName,
          role: "WAREHOUSE_STAFF",
        },
      });
      return tx.warehouseStaff.create({
        data: { userId: user.id, fullName, phone },
      });
    });

    revalidatePath("/admin/staff");
    return { success: true, data: { id: staff.id } };
  } catch (e) {
    return { success: false, error: normalizeError(e) };
  }
}

// ─── Admin: list all warehouse staff (active + inactive) ─────────────────────

export async function getAllWarehouseStaffAdmin() {
  await requireAdmin();
  return prisma.warehouseStaff.findMany({
    include: { user: { select: { email: true, id: true } } },
    orderBy: { fullName: "asc" },
  });
}

// ─── Admin: toggle warehouse staff active ────────────────────────────────────

export async function toggleWarehouseStaffActive(
  staffId: string
): Promise<ActionResult<void>> {
  try {
    await requireAdmin();
    const staff = await prisma.warehouseStaff.findUniqueOrThrow({ where: { id: staffId } });
    await prisma.warehouseStaff.update({
      where: { id: staffId },
      data: { isActive: !staff.isActive },
    });
    revalidatePath("/admin/staff");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: normalizeError(e) };
  }
}

// ─── Admin: reset warehouse staff password ───────────────────────────────────

export async function resetWarehouseStaffPassword(
  staffId: string,
  newPassword: string
): Promise<ActionResult<void>> {
  try {
    await requireAdmin();
    const staff = await prisma.warehouseStaff.findUniqueOrThrow({ where: { id: staffId } });
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: staff.userId }, data: { password: hash } });
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: normalizeError(e) };
  }
}

/** Admin: reset warehouse staff password AND send credentials via email. Returns plain-text password. */
export async function resetAndSendWarehousePassword(
  staffId: string,
  newPassword: string
): Promise<ActionResult<{ password: string; email: string; sentEmail: boolean }>> {
  try {
    await requireAdmin();
    if (newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters" };
    }
    const staff = await prisma.warehouseStaff.findUniqueOrThrow({
      where: { id: staffId },
      include: { user: { select: { email: true } } },
    });
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: staff.userId }, data: { password: hash } });

    let sentEmail = false;
    try {
      await sendStaffCredentialsEmail({
        staffEmail: staff.user.email,
        staffName: staff.fullName,
        password: newPassword,
      });
      sentEmail = true;
    } catch {
      // Don't block on email failure
    }
    return { success: true, data: { password: newPassword, email: staff.user.email, sentEmail } };
  } catch (e) {
    return { success: false, error: normalizeError(e) };
  }
}
