# iKiwi Production-Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve 33 identified security, correctness, and UX issues across 4 phases before production launch.

**Architecture:** Fixes are applied in-place to existing server actions and pages — no new abstractions, no schema migrations. TypeScript is verified with `npx tsc --noEmit` after each task. Biome is used for linting.

**Tech Stack:** Next.js 15, Prisma 7, NextAuth v5, Pusher, Zod 4, Tailwind, shadcn/ui, Biome (no test framework)

---

## File Map

| File | Phase | Change |
|------|-------|--------|
| `.gitignore` | 1.1 | Add .env, .env.local |
| `.env.example` | 4.6 | New file — document all env vars |
| `src/server/actions/shopping.ts` | 1.2, 1.4, 2.2, 4.5 | Auth guards, dedup, ActionResult |
| `src/server/actions/restock.ts` | 1.3 | Role guard for getRestockTasks |
| `src/server/actions/products.ts` | 1.6 | Auth check on getAvailableProducts |
| `src/server/actions/orders.ts` | 1.5, 1.8, 1.10, 2.4 | placeOrder tx, TOCTOU, shopActive, zero-price |
| `src/server/actions/delivery.ts` | 1.7, 2.5, 4.7 | null pointer, skip reason, logging |
| `src/lib/inventory/stock-engine.ts` | 1.9 | Atomic increment/decrement operators |
| `src/middleware.ts` | 1.11 | Rate limiting on login endpoint |
| `src/server/actions/inventory.ts` | 2.1, 2.7, 4.7 | supplierPrice fix, logging |
| `src/lib/validations/delivery.schema.ts` | 2.5 | skip reason min 5 chars |
| `src/lib/validations/order.schema.ts` | 2.4 | zero-price items block |
| `src/lib/validations/index.ts` | 4.3 | overridePrice ceiling |
| `src/server/actions/delivery-staff.ts` | 4.2 | adminResetPassword max 72 |
| `src/lib/errors.ts` | 4.1 | New — Prisma error normalization |
| `src/app/(warehouse)/warehouse/stock/page.tsx` | 2.1, 3.5, 3.6 | auto-refresh, labels, last-restocked |
| `src/app/(warehouse)/warehouse/tomorrow/page.tsx` | 3.1 | New — tomorrow's orders tab |
| `src/app/(warehouse)/WarehouseShell.tsx` | 3.1 | Add nav item for tomorrow's orders |
| `src/app/(driver)/driver/shopping/page.tsx` | 3.2 | "I'm on it" claim button |
| `src/app/(driver)/driver/page.tsx` | 2.6, 3.8 | WaitingState flash, all-done summary |
| `src/app/(admin)/admin/orders/page.tsx` | 3.3 | Date filter + shop search |
| `src/app/(admin)/admin/restock/page.tsx` | 2.3 | Re-assign button |
| `src/app/(shop)/page.tsx` (or landing) | 3.7 | Hero banner copy |

---

## Phase 1: Critical Security & Correctness

---

### Task 1: Environment Security

**Files:**
- Modify: `.gitignore`
- Create: `.env.example` (placeholder — filled in Task 19)

**Steps:**

- [ ] **Step 1: Add .env files to .gitignore**

Open `.gitignore` in the project root. Add these lines if not already present:

```
.env
.env.local
.env.*.local
```

- [ ] **Step 2: Verify .env.local is not tracked**

```bash
cd C:\Users\User\Desktop\ikiwi-next
git ls-files .env .env.local
```

Expected: empty output (no tracked env files). If any show up, remove them from tracking:

```bash
git rm --cached .env .env.local
```

- [ ] **Step 3: Rotate credentials (manual)**

In your hosting panel (Vercel / Neon / Supabase):
1. Generate a new database password → update `DATABASE_URL` in Vercel env vars
2. Generate a new `AUTH_SECRET`: `openssl rand -base64 32` → paste into Vercel
3. Delete the old credentials from the provider

These changes don't require a code deploy — they take effect on next cold start.

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "security: add .env files to .gitignore"
```

---

### Task 2: Server Action Auth Guards

**Files:**
- Modify: `src/server/actions/shopping.ts`
- Modify: `src/server/actions/restock.ts`
- Modify: `src/server/actions/products.ts`

**Steps:**

- [ ] **Step 1: Fix `generateShoppingList` — remove DELIVERY_STAFF write access**

In `src/server/actions/shopping.ts`, line 28–30, change:

```ts
// BEFORE
const allowed = ["COMPANY_ADMIN", "WAREHOUSE_STAFF", "DELIVERY_STAFF"] as const;
if (!session?.user || !allowed.includes(session.user.role as (typeof allowed)[number])) {
  return { success: false, error: "Unauthorized" };
}
```

To:

```ts
// AFTER
const allowed = ["COMPANY_ADMIN", "WAREHOUSE_STAFF"] as const;
if (!session?.user || !allowed.includes(session.user.role as (typeof allowed)[number])) {
  return { success: false, error: "Unauthorized" };
}
```

- [ ] **Step 2: Fix `getShoppingList` — restrict to staff roles (not SHOP_OWNER)**

In `src/server/actions/shopping.ts`, replace the auth check in `getShoppingList` (line 218–219):

```ts
// BEFORE
export async function getShoppingList() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
```

With:

```ts
// AFTER
export async function getShoppingList(): Promise<
  ActionResult<Awaited<ReturnType<typeof prisma.restockTask.findFirst>> | null>
> {
  try {
    const session = await auth();
    const allowed = ["COMPANY_ADMIN", "WAREHOUSE_STAFF", "DELIVERY_STAFF"] as const;
    if (!session?.user || !allowed.includes(session.user.role as (typeof allowed)[number])) {
      return { success: false, error: "Unauthorized" };
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const task = await prisma.restockTask.findFirst({
      where: {
        triggerType: "MANUAL",
        priority:    "URGENT",
        adminNote:   { startsWith: "[SHOPPING_LIST]" },
        createdAt:   { gte: today, lt: tomorrow },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id:       true,
                name:     true,
                unitType: true,
                stockItem: { select: { availableKg: true, availablePieces: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: task };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to fetch shopping list" };
  }
}
```

- [ ] **Step 3: Update the driver shopping page to use the new ActionResult signature**

In `src/app/(driver)/driver/shopping/page.tsx`, update the `useQuery` call:

```ts
// BEFORE
const { data: task, isLoading } = useQuery({
  queryKey:        ["driver-shopping-list"],
  queryFn:         () => getShoppingList(),
  refetchInterval: 60_000,
});

// ...
if (!task || task.items.length === 0) {
```

```ts
// AFTER
const { data: result, isLoading } = useQuery({
  queryKey:        ["driver-shopping-list"],
  queryFn:         () => getShoppingList(),
  refetchInterval: 60_000,
});
const task = result?.success ? result.data : null;

// ...
if (!task || task.items.length === 0) {
```

- [ ] **Step 4: Fix `getRestockTasks` — exclude SHOP_OWNER**

In `src/server/actions/restock.ts`, line 79–82, change:

```ts
// BEFORE
export async function getRestockTasks(status?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
```

To:

```ts
// AFTER
export async function getRestockTasks(status?: string) {
  const session = await auth();
  const allowed = ["COMPANY_ADMIN", "WAREHOUSE_STAFF"] as const;
  if (!session?.user || !allowed.includes(session.user.role as (typeof allowed)[number])) {
    throw new Error("Unauthorized");
  }
```

- [ ] **Step 5: Fix `getAvailableProducts` — require authentication**

In `src/server/actions/products.ts`, line 107, add an auth check at the top of the function:

```ts
// BEFORE
export async function getAvailableProducts() {
  const today = todayUTC();
```

```ts
// AFTER
export async function getAvailableProducts() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const today = todayUTC();
```

Also add the auth import at the top of the file if not already there:

```ts
import { auth } from "@/lib/auth";
```

- [ ] **Step 6: Verify TypeScript**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx tsc --noEmit
```

Expected: exit code 0, no errors.

- [ ] **Step 7: Commit**

```bash
git add src/server/actions/shopping.ts src/server/actions/restock.ts src/server/actions/products.ts src/app/(driver)/driver/shopping/page.tsx
git commit -m "security: restrict server action auth guards to correct roles"
```

---

### Task 3: `placeOrder` — Wrap in Transaction + Live `shopActive` Check

**Files:**
- Modify: `src/server/actions/orders.ts`

**Steps:**

- [ ] **Step 1: Add live `shopActive` DB check**

In `src/server/actions/orders.ts`, in `placeOrder`, after the JWT check on line 41 (`if (!session.user.shopActive) return ...`), replace the stale JWT check with a live DB lookup:

```ts
// BEFORE (line 41)
if (!session.user.shopActive) return { success: false, error: "Your shop is not yet approved" };
```

```ts
// AFTER
const shop = await prisma.shop.findUnique({
  where:  { id: session.user.shopId },
  select: { isActive: true },
});
if (!shop?.isActive) return { success: false, error: "Your shop is not yet approved" };
```

- [ ] **Step 2: Wrap order creation in `$transaction`**

In `placeOrder`, find the section starting at `const order = await prisma.order.create(` (line 102). Wrap everything from the `order.create` call through the notification `createMany` inside a `$transaction`. The stock shortage check (which also creates a RestockTask) stays inside the transaction too. Email and Pusher events remain outside.

Replace from `const order = await prisma.order.create` through the end of the shortage block with:

```ts
  const { order, admins } = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        shopId: session.user.shopId,
        estimatedTotal,
        notes: parsed.data.notes ?? null,
        items: { create: itemsData },
      },
      include: {
        shop:  { select: { name: true } },
        items: { select: { id: true } },
      },
    });

    const admins = await tx.user.findMany({
      where:  { role: "COMPANY_ADMIN" },
      select: { id: true, email: true },
    });

    if (admins.length) {
      await tx.notification.createMany({
        data: admins.map((a) => ({
          userId:  a.id,
          type:    "ORDER_PLACED" as const,
          message: `New order from ${order.shop.name} — ${order.items.length} items, est. ${estimatedTotal.toLocaleString("ru-RU")} UZS`,
        })),
      });
    }

    // Stock shortage check (advisory — create restock task but don't block)
    const productIds = itemsData.map((i) => i.productId);
    const stockItems = await tx.stockItem.findMany({
      where:  { productId: { in: productIds } },
      select: { productId: true, availableKg: true, availablePieces: true },
    });
    const stockMap = new Map(stockItems.map((s) => [s.productId, s]));

    type Shortage = { productId: string; orderedAs: "KG" | "PIECE"; shortBy: number };
    const shortages: Shortage[] = [];

    for (const item of itemsData) {
      const stock = stockMap.get(item.productId);
      if (!stock) continue;

      if (item.orderedAs === "KG" && item.requestedKg != null) {
        const available = Number(stock.availableKg ?? 0);
        const shortBy   = item.requestedKg - available;
        if (shortBy > 0) shortages.push({ productId: item.productId, orderedAs: "KG", shortBy });
      } else if (item.orderedAs === "PIECE" && item.requestedPieces != null) {
        const available = stock.availablePieces ?? 0;
        const shortBy   = item.requestedPieces - available;
        if (shortBy > 0) shortages.push({ productId: item.productId, orderedAs: "PIECE", shortBy });
      }
    }

    if (shortages.length > 0) {
      await tx.restockTask.create({
        data: {
          status:         "PENDING",
          priority:       "URGENT",
          triggerType:    "ORDER_SHORTAGE",
          triggerOrderId: order.id,
          items: {
            create: shortages.map((s) => ({
              productId:    s.productId,
              neededKg:     s.orderedAs === "KG"    ? s.shortBy            : undefined,
              neededPieces: s.orderedAs === "PIECE" ? Math.ceil(s.shortBy) : undefined,
            })),
          },
        },
      });

      const shortId = order.id.slice(-6).toUpperCase();
      await tx.notification.createMany({
        data: admins.map((a) => ({
          userId:  a.id,
          type:    "ORDER_SHORTAGE_ALERT" as const,
          title:   "Order needs restock",
          message: `Order #${shortId} has ${shortages.length} item${shortages.length !== 1 ? "s" : ""} below current stock. Urgent restock task created.`,
        })),
      });
    }

    return { order, admins };
  });

  // Pusher and email — outside transaction (non-fatal)
  if (admins.length) {
    await triggerEvent("private-admin", "new-order", {
      orderId:        order.id,
      shopName:       order.shop.name,
      itemCount:      order.items.length,
      estimatedTotal,
    });

    if (admins[0].email) {
      await sendNewOrderEmail({
        adminEmail:    admins[0].email,
        shopName:      order.shop.name,
        orderId:       order.id,
        itemCount:     order.items.length,
        estimatedTotal,
      });
    }
  }
```

Also delete the old standalone shortage `triggerEvent` call (if any) since it's now inside the transaction.

- [ ] **Step 3: Verify TypeScript**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/server/actions/orders.ts
git commit -m "fix: wrap placeOrder in transaction and re-validate shopActive from DB"
```

---

### Task 4: `updateOrderStatus` — Fix TOCTOU Race

**Files:**
- Modify: `src/server/actions/orders.ts`

**Steps:**

- [ ] **Step 1: Move `currentOrder` fetch inside the transaction**

In `src/server/actions/orders.ts`, in `updateOrderStatus`, find lines 225–246:

```ts
// BEFORE — currentOrder fetched OUTSIDE the transaction
const currentOrder = await prisma.order.findUniqueOrThrow({
  where:  { id: parsed.data.orderId },
  select: { status: true },
});

const order = await prisma.$transaction(async (tx) => {
  const updated = await tx.order.update({
    where: { id: parsed.data.orderId },
    data:  { status: parsed.data.status },
    include: { shop: { include: { user: true } } },
  });

  if (parsed.data.status === "PREPARING") {
    await reserveStockForOrder(tx, parsed.data.orderId, session.user.id);
  } else if (
    parsed.data.status === "CANCELLED" &&
    ["PREPARING", "READY", "OUT_FOR_DELIVERY"].includes(currentOrder.status)
  ) {
    await releaseStockForOrder(tx, parsed.data.orderId, session.user.id);
  }

  return updated;
});
```

Replace with:

```ts
// AFTER — currentOrder fetched INSIDE the transaction (atomic)
const order = await prisma.$transaction(async (tx) => {
  const currentOrder = await tx.order.findUniqueOrThrow({
    where:  { id: parsed.data.orderId },
    select: { status: true },
  });

  const updated = await tx.order.update({
    where: { id: parsed.data.orderId },
    data:  { status: parsed.data.status },
    include: { shop: { include: { user: true } } },
  });

  if (parsed.data.status === "PREPARING") {
    await reserveStockForOrder(tx, parsed.data.orderId, session.user.id);
  } else if (
    parsed.data.status === "CANCELLED" &&
    ["PREPARING", "READY", "OUT_FOR_DELIVERY"].includes(currentOrder.status)
  ) {
    await releaseStockForOrder(tx, parsed.data.orderId, session.user.id);
  }

  return updated;
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/server/actions/orders.ts
git commit -m "fix: move currentOrder fetch inside transaction in updateOrderStatus (TOCTOU)"
```

---

### Task 5: `completeDelivery` — Fix Null Pointer

**Files:**
- Modify: `src/server/actions/delivery.ts`

**Steps:**

- [ ] **Step 1: Add null guard on `order.shop.user`**

In `src/server/actions/delivery.ts`, around line 186–197, find:

```ts
// BEFORE — crashes with null on FULL_RETURN when shop has no linked user
const notificationType = hasReturns ? "RETURN_PROCESSED" : "DELIVERY_COMPLETED";
const notificationMsg = hasReturns
  ? `${Math.round(totalReturned).toLocaleString()} UZS worth returned. Final total: ${deliveredTotal.toLocaleString()} UZS`
  : `Order delivered. Total: ${deliveredTotal.toLocaleString()} UZS`;

await tx.notification.create({
  data: {
    userId:  order.shop.user.id,
    type:    notificationType,
    message: notificationMsg,
  },
});
```

Replace with:

```ts
// AFTER — guard on user existence
const notificationType = hasReturns ? "RETURN_PROCESSED" : "DELIVERY_COMPLETED";
const notificationMsg = hasReturns
  ? `${Math.round(totalReturned).toLocaleString()} UZS worth returned. Final total: ${deliveredTotal.toLocaleString()} UZS`
  : `Order delivered. Total: ${deliveredTotal.toLocaleString()} UZS`;

if (order.shop.user?.id) {
  await tx.notification.create({
    data: {
      userId:  order.shop.user.id,
      type:    notificationType,
      message: notificationMsg,
    },
  });
}
```

- [ ] **Step 2: Add returned item names to the partial delivery notification (item 3.4)**

In the same `completeDelivery` function, enrich the `notificationMsg` for partial returns to include which items were returned:

```ts
// BEFORE
const notificationMsg = hasReturns
  ? `${Math.round(totalReturned).toLocaleString()} UZS worth returned. Final total: ${deliveredTotal.toLocaleString()} UZS`
  : `Order delivered. Total: ${deliveredTotal.toLocaleString()} UZS`;
```

```ts
// AFTER — include returned item names
const returnedNames = data.returns
  .map((r) => {
    const item = order.items.find((i) => i.id === r.orderItemId);
    return item ? item.product?.name ?? "item" : "item";
  })
  .filter(Boolean)
  .slice(0, 3)
  .join(", ");

const notificationMsg = hasReturns
  ? `Returned: ${returnedNames}${data.returns.length > 3 ? ` +${data.returns.length - 3} more` : ""}. Final: ${deliveredTotal.toLocaleString()} UZS`
  : `Order delivered. Total: ${deliveredTotal.toLocaleString()} UZS`;
```

Note: `order.items` already includes product info (the query includes `items: true`), but the product `name` may require a separate select. If `item.product` is not available on the raw `OrderItem`, add `product: { select: { name: true } }` to the `stop` query's `items` include:

```ts
// In the tx.routeStop.findUnique include:
items: {
  include: { product: { select: { name: true } } },
},
```

Check the existing query structure and adjust accordingly.

- [ ] **Step 3: Verify TypeScript**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/server/actions/delivery.ts
git commit -m "fix: guard order.shop.user?.id; add returned item names to partial delivery notification"
```

---

### Task 6: Stock Engine — Fix Read-Modify-Write Race

**Files:**
- Modify: `src/lib/inventory/stock-engine.ts`

The current code reads the stock record, computes new values in JS, then writes back. Two concurrent requests can both read the same old value and clobber each other. Fix: use Prisma's `{ increment }` operator so the database computes the delta atomically.

**Steps:**

- [ ] **Step 1: Rewrite `applyStockChange` to use atomic operators**

Replace the entire body of `applyStockChange` (lines 25–125) with:

```ts
import type { $Enums, Prisma } from "@prisma/client";

type MovementType = $Enums.MovementType;
type Role = $Enums.Role;

export type StockChangeInput = {
  productId:         string;
  deltaKg?:          number;
  deltaPieces?:      number;
  type:              MovementType;
  performedBy:       string;
  performedByRole:   Role;
  orderId?:          string;
  restockTaskId?:    string;
  warehouseStaffId?: string;
  reason?:           string;
  note?:             string;
};

export async function applyStockChange(
  tx: Prisma.TransactionClient,
  input: StockChangeInput
) {
  const stockItem = await tx.stockItem.findUnique({
    where: { productId: input.productId },
    select: { id: true, availableKg: true, availablePieces: true },
  });
  if (!stockItem) {
    throw new Error(`No stock record for product ${input.productId}`);
  }

  const dKg     = input.deltaKg     ?? 0;
  const dPieces = input.deltaPieces ?? 0;

  const updateData: Prisma.StockItemUpdateInput = {};

  switch (input.type) {
    case "RESTOCK":
    case "INITIAL_STOCK":
    case "RETURN":
    case "ADJUSTMENT":
    case "WASTE":
    case "THEFT":
    case "COUNT_CORRECTION":
      if (dKg     !== 0) updateData.availableKg     = { increment: dKg };
      if (dPieces !== 0) updateData.availablePieces = { increment: dPieces };
      break;

    case "RELEASED":
      if (dKg !== 0) {
        updateData.availableKg = { increment: dKg };
        updateData.reservedKg  = { decrement: dKg };
      }
      if (dPieces !== 0) {
        updateData.availablePieces = { increment: dPieces };
        updateData.reservedPieces  = { decrement: dPieces };
      }
      break;

    case "RESERVED":
      if (dKg !== 0) {
        updateData.availableKg = { decrement: dKg };
        updateData.reservedKg  = { increment: dKg };
      }
      if (dPieces !== 0) {
        updateData.availablePieces = { decrement: dPieces };
        updateData.reservedPieces  = { increment: dPieces };
      }
      break;

    case "CONSUMED":
      if (dKg     !== 0) updateData.reservedKg     = { decrement: dKg };
      if (dPieces !== 0) updateData.reservedPieces = { decrement: dPieces };
      break;
  }

  if (input.type === "RESTOCK") {
    updateData.lastRestockedAt = new Date();
  }

  const updated = await tx.stockItem.update({
    where:  { id: stockItem.id },
    data:   updateData,
    select: { availableKg: true, availablePieces: true },
  });

  if (updated.availableKg !== null && Number(updated.availableKg) < 0) {
    console.warn(`[Stock] Negative available for product ${input.productId}: ${Number(updated.availableKg)} kg`);
  }

  return tx.stockMovement.create({
    data: {
      stockItemId:      stockItem.id,
      type:             input.type,
      deltaKg:          dKg     !== 0 ? dKg     : null,
      deltaPieces:      dPieces !== 0 ? dPieces : null,
      newBalanceKg:     updated.availableKg    != null ? Number(updated.availableKg)    : null,
      newBalancePieces: updated.availablePieces ?? null,
      orderId:          input.orderId,
      restockTaskId:    input.restockTaskId,
      performedBy:      input.performedBy,
      performedByRole:  input.performedByRole,
      reason:           input.reason,
      note:             input.note,
      warehouseStaffId: input.warehouseStaffId,
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx tsc --noEmit
```

Expected: exit code 0. If Prisma complains about `{ increment }` on `Decimal` fields, run `npx prisma generate` first.

- [ ] **Step 3: Commit**

```bash
git add src/lib/inventory/stock-engine.ts
git commit -m "fix: use Prisma atomic increment/decrement in stock-engine to eliminate race condition"
```

---

### Task 7: Rate Limiting on Login

**Files:**
- Modify: `src/middleware.ts`

The login endpoint (`/api/auth/callback/credentials`) is unbounded. Add in-memory IP-based rate limiting: max 10 attempts per 15 minutes.

**Steps:**

- [ ] **Step 1: Add rate limiter to middleware**

Replace the contents of `src/middleware.ts` with:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

// In-memory rate limiter: IP → { count, resetAt }
// Resets on cold starts — sufficient for basic brute-force protection.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT     = 10;

function isRateLimited(ip: string): boolean {
  const now     = Date.now();
  const entry   = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;
  const session = (req as any).auth;

  // Rate-limit the credentials login callback
  if (pathname === "/api/auth/callback/credentials" && req.method === "POST") {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(ip)) {
      return new NextResponse("Too many login attempts. Try again in 15 minutes.", {
        status: 429,
        headers: { "Retry-After": "900" },
      });
    }
  }

  const isAuth  = !!session?.user;
  const role    = session?.user?.role;

  const homeDest =
    role === "COMPANY_ADMIN"   ? "/admin"
    : role === "DELIVERY_STAFF"  ? "/driver"
    : role === "WAREHOUSE_STAFF" ? "/warehouse"
    : "/shop";

  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    if (isAuth) return NextResponse.redirect(new URL(homeDest, req.url));
    return NextResponse.next();
  }

  if (!isAuth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/admin")     && role !== "COMPANY_ADMIN")   return NextResponse.redirect(new URL(homeDest, req.url));
  if (pathname.startsWith("/driver")    && role !== "DELIVERY_STAFF")  return NextResponse.redirect(new URL(homeDest, req.url));
  if (pathname.startsWith("/warehouse") && role !== "WAREHOUSE_STAFF") return NextResponse.redirect(new URL(homeDest, req.url));

  if (
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/driver") &&
    !pathname.startsWith("/warehouse") &&
    role !== "SHOP_OWNER"
  ) {
    return NextResponse.redirect(new URL(homeDest, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|ikiwi-logo.png).*)"],
};
```

Note: the matcher currently excludes `/api` routes. To rate-limit the login callback, we need to also match it. Update the matcher:

```ts
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|ikiwi-logo.png).*)",
  ],
};
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "security: add IP-based rate limiting to login endpoint (10 attempts / 15 min)"
```

---

## Phase 2: Important Correctness

---

### Task 8: `supplierPrice` Overwrite Fix + Notification Dedup

**Files:**
- Modify: `src/server/actions/inventory.ts`
- Modify: `src/server/actions/shopping.ts`

**Steps:**

- [ ] **Step 1: Fix `supplierPrice` overwrite in `warehouseLogIncoming`**

In `src/server/actions/inventory.ts`, around line 239–241:

```ts
// BEFORE — costPerPiece clobbers costPerKg if both are set
const update: Record<string, unknown> = { lastRestockedAt: new Date() };
if (data.costPerKg     !== undefined) update.supplierPrice = data.costPerKg;
if (data.costPerPiece  !== undefined) update.supplierPrice = data.costPerPiece;
```

```ts
// AFTER — only one price field wins; kg takes precedence
const update: Record<string, unknown> = { lastRestockedAt: new Date() };
if      (data.costPerKg    !== undefined) update.supplierPrice = data.costPerKg;
else if (data.costPerPiece !== undefined) update.supplierPrice = data.costPerPiece;
```

- [ ] **Step 2: Add notification dedup in `generateShoppingList`**

In `src/server/actions/shopping.ts`, inside the `$transaction` callback, find the block that creates notifications (around line 172–189). Change it so notifications are only sent when a NEW task is created (not when updating an existing one):

```ts
// BEFORE — always notifies
await tx.notification.createMany({
  data: [...admins, ...warehouseStaff, ...deliveryStaff].map(...),
  skipDuplicates: true,
});
```

Restructure the transaction block so `existingTask` is checked before sending notifications:

```ts
if (existingTask) {
  await tx.restockItem.deleteMany({ where: { restockTaskId: existingTask.id } });
  await tx.restockItem.createMany({
    data: deficits.map((d) => ({
      restockTaskId: existingTask.id,
      productId:     d.productId,
      neededKg:      d.toBuyKg     > 0 ? d.toBuyKg     : null,
      neededPieces:  d.toBuyPieces > 0 ? d.toBuyPieces : null,
    })),
  });
  taskId = existingTask.id;
  // No notifications on update — list already sent earlier today
} else {
  const task = await tx.restockTask.create({
    data: {
      status:      "PENDING",
      priority:    "URGENT",
      triggerType: "MANUAL",
      adminNote:   `[SHOPPING_LIST] Generated ${new Date().toISOString()}`,
      items: {
        create: deficits.map((d) => ({
          productId:    d.productId,
          neededKg:     d.toBuyKg     > 0 ? d.toBuyKg     : null,
          neededPieces: d.toBuyPieces > 0 ? d.toBuyPieces : null,
        })),
      },
    },
  });
  taskId = task.id;

  // Only notify on first generation today
  const [admins, warehouseStaff, deliveryStaff] = await Promise.all([
    tx.user.findMany({ where: { role: "COMPANY_ADMIN" }, select: { id: true } }),
    tx.warehouseStaff.findMany({ where: { isActive: true }, include: { user: { select: { id: true } } } }),
    tx.deliveryStaff.findMany({ where: { isActive: true }, include: { user: { select: { id: true } } } }),
  ]);

  const names = deficits.slice(0, 3).map((d) => d.productName).join(", ");
  const extra = deficits.length > 3 ? ` +${deficits.length - 3} more` : "";
  const msg   = `Shopping list: ${deficits.length} product${deficits.length !== 1 ? "s" : ""} needed — ${names}${extra}`;

  await tx.notification.createMany({
    data: [
      ...admins.map((u) => ({ userId: u.id, type: "ORDER_SHORTAGE_ALERT" as const, title: "Shopping list ready", message: msg })),
      ...warehouseStaff.map((s) => ({ userId: s.user.id, type: "ORDER_SHORTAGE_ALERT" as const, title: "Shopping list ready", message: msg })),
      ...deliveryStaff.map((d) => ({ userId: d.user.id, type: "ORDER_SHORTAGE_ALERT" as const, title: "Shopping list ready", message: msg })),
    ],
    skipDuplicates: true,
  });
}
```

Also move the `[admins, warehouseStaff, deliveryStaff]` lookup to only happen in the new-task branch (it's now inside the `else` block above). Remove the old lookup that was shared.

- [ ] **Step 3: Verify TypeScript**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/server/actions/inventory.ts src/server/actions/shopping.ts
git commit -m "fix: supplier price else-if precedence; dedup shopping list notifications"
```

---

### Task 9: Zero-Price Checkout Block + Skip Reason Required

**Files:**
- Modify: `src/lib/validations/order.schema.ts`
- Modify: `src/lib/validations/delivery.schema.ts`

**Steps:**

- [ ] **Step 1: Block zero-price `overridePrice` in `setActualCostSchema`**

In `src/lib/validations/order.schema.ts`, the `overridePrice` field already has `.int().positive()`. The issue is that `estimatedPrice` used as the line total could be 0 if a daily price was set to 0. Add a check in `placeOrder` itself (in `src/server/actions/orders.ts`) — after computing `lineTotal`, block if it equals zero:

```ts
// In placeOrder, after computing lineTotal for each item:
if (lineTotal === 0) {
  return { success: false, error: `Price for "${product.name}" is zero — cannot place order` };
}
```

Add this check immediately after each `lineTotal` computation block (there are two — one for KG, one for PIECE).

- [ ] **Step 2: Make skip reason required (min 5 chars)**

In `src/lib/validations/delivery.schema.ts`, change `skipStopSchema`:

```ts
// BEFORE
export const skipStopSchema = z.object({
  stopId: z.string().min(1),
  reason: z.string().max(300).optional(),
});
```

```ts
// AFTER
export const skipStopSchema = z.object({
  stopId: z.string().min(1),
  reason: z.string().min(5, "Reason must be at least 5 characters").max(300),
});
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/validations/order.schema.ts src/lib/validations/delivery.schema.ts src/server/actions/orders.ts
git commit -m "fix: block zero-price checkout; require skip reason (min 5 chars)"
```

---

### Task 10: Driver WaitingState Flash + Auto-Refresh After Incoming

**Files:**
- Modify: `src/app/(driver)/driver/page.tsx`
- Modify: `src/app/(warehouse)/warehouse/stock/page.tsx`

**Steps:**

- [ ] **Step 1: Fix driver WaitingState flash**

In `src/app/(driver)/driver/page.tsx`, line 244, the flash occurs because `fetching` initialises as `false` — so on first render `fetching=false, route=null` hits line 321 (`if (!route) return <WaitingState />`) immediately, before the `useEffect` fires.

Fix: initialise `fetching` as `true` so the "waiting for data" branch is taken on first render and only cleared after the initial fetch resolves.

```ts
// BEFORE (line ~244)
const [fetching, setFetching] = useState(false);

// AFTER
const [fetching, setFetching] = useState(true);
```

That's the entire change. The existing render order `if (fetching && !route) return <WaitingState />` then correctly shows waiting during the initial fetch, and transitions to the route view once data arrives.

- [ ] **Step 2: Auto-refresh shopping list after `warehouseLogIncoming`**

In `src/app/(warehouse)/warehouse/stock/page.tsx`, the `handleIncoming` function calls `warehouseLogIncoming`. After a successful result, invalidate the shopping list query:

```ts
// Find the existing queryClient from useQueryClient()
// It should already be imported via useQueryClient from react-query

// After the successful warehouseLogIncoming call:
if (result.success) {
  queryClient.invalidateQueries({ queryKey: ["driver-shopping-list"] });
  queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
  toast.success("Stock updated");
  setIncomingOpen(false);
} else {
  toast.error(result.error);
}
```

Make sure `useQueryClient` is imported at the top of the file:

```ts
import { useQuery, useQueryClient } from "@tanstack/react-query";
```

And add `const queryClient = useQueryClient();` inside the component.

- [ ] **Step 3: Verify TypeScript**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(driver)/driver/page.tsx src/app/(warehouse)/warehouse/stock/page.tsx
git commit -m "fix: guard WaitingState behind isLoading; invalidate shopping list after incoming"
```

---

### Task 11: Re-Assign Button for ASSIGNED Restock Tasks

**Files:**
- Modify: `src/app/(admin)/admin/restock/page.tsx`
- Modify: `src/server/actions/restock.ts`

**Steps:**

- [ ] **Step 1: Add `reassignRestockTask` server action**

In `src/server/actions/restock.ts`, add after `getAllWarehouseStaff`:

```ts
export async function reassignRestockTask(input: {
  taskId:       string;
  assignedToId: string | null;
}): Promise<ActionResult<void>> {
  try {
    await requireAdmin();
    await prisma.restockTask.update({
      where: { id: input.taskId },
      data:  { assignedToId: input.assignedToId },
    });
    revalidatePath("/admin/restock");
    revalidatePath("/warehouse");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to reassign task" };
  }
}
```

- [ ] **Step 2: Add re-assign button to restock task cards**

In `src/app/(admin)/admin/restock/page.tsx`, find where ASSIGNED tasks are rendered. Add a "Re-assign" button next to each ASSIGNED task card that opens a small popover/dialog with a staff selector. When confirmed, call `reassignRestockTask`.

Import the new action:

```ts
import { reassignRestockTask } from "@/server/actions/restock";
```

Add state for the re-assign dialog:

```ts
const [reassignTaskId, setReassignTaskId] = useState<string | null>(null);
const [reassignStaffId, setReassignStaffId] = useState<string>("");
```

In the ASSIGNED task card JSX, add a button:

```tsx
{task.status === "ASSIGNED" && (
  <Button
    size="sm"
    variant="outline"
    onClick={() => setReassignTaskId(task.id)}
  >
    Re-assign
  </Button>
)}
```

Add the re-assign dialog (reuse the existing Dialog pattern in the file):

```tsx
<Dialog open={!!reassignTaskId} onOpenChange={(o) => !o && setReassignTaskId(null)}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Re-assign Task</DialogTitle>
    </DialogHeader>
    <Select value={reassignStaffId} onValueChange={setReassignStaffId}>
      <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
      <SelectContent>
        {staffList.map((s) => (
          <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>
        ))}
      </SelectContent>
    </Select>
    <Button
      onClick={async () => {
        if (!reassignTaskId || !reassignStaffId) return;
        const result = await reassignRestockTask({ taskId: reassignTaskId, assignedToId: reassignStaffId });
        if (result.success) {
          queryClient.invalidateQueries({ queryKey: ["restock-tasks"] });
          setReassignTaskId(null);
          toast.success("Task reassigned");
        } else {
          toast.error(result.error);
        }
      }}
    >
      Confirm
    </Button>
  </DialogContent>
</Dialog>
```

Note: `staffList` should already be fetched on the page (check if it's available; if not, fetch it with `useQuery` → `getAllWarehouseStaff()`).

- [ ] **Step 3: Verify TypeScript**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/server/actions/restock.ts src/app/(admin)/admin/restock/page.tsx
git commit -m "feat: add re-assign button for ASSIGNED restock tasks"
```

---

## Phase 3: UX Completeness

---

### Task 12: Warehouse Stock Row UX (Labels + Last-Restocked Indicator)

**Files:**
- Modify: `src/app/(warehouse)/warehouse/stock/page.tsx`

**Steps:**

- [ ] **Step 1: Add text labels to Count/Incoming buttons**

Find the two icon-only buttons per product row in the stock page. Change from icon-only to icon + label:

```tsx
// BEFORE
<Button size="icon" variant="ghost" onClick={() => openCount(item)}>
  <ClipboardCheck className="h-4 w-4" />
</Button>
<Button size="icon" variant="ghost" onClick={() => openIncoming(item)}>
  <PackagePlus className="h-4 w-4" />
</Button>
```

```tsx
// AFTER
<Button size="sm" variant="ghost" className="gap-1.5" onClick={() => openCount(item)}>
  <ClipboardCheck className="h-4 w-4" />
  Count
</Button>
<Button size="sm" variant="ghost" className="gap-1.5" onClick={() => openIncoming(item)}>
  <PackagePlus className="h-4 w-4" />
  Incoming
</Button>
```

- [ ] **Step 2: Add last-restocked date indicator to each row**

`getAllStockForStaff` already returns `StockItem` which has `lastRestockedAt`. In the product row, add a small indicator below the stock numbers:

```tsx
{item.lastRestockedAt && (
  <p className="text-[10px] text-muted-foreground mt-0.5">
    Last in: {formatDistanceToNow(new Date(item.lastRestockedAt), { addSuffix: true })}
  </p>
)}
```

Make sure `formatDistanceToNow` is imported from `date-fns`.

- [ ] **Step 3: Verify TypeScript**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(warehouse)/warehouse/stock/page.tsx
git commit -m "ux: add text labels to Count/Incoming buttons and last-restocked indicator"
```

---

### Task 13: Tomorrow's Orders Tab in Warehouse

**Files:**
- Create: `src/app/(warehouse)/warehouse/tomorrow/page.tsx`
- Modify: `src/server/actions/orders.ts` (add `getTomorrowOrders`)
- Modify: `src/app/(warehouse)/WarehouseShell.tsx`

**Steps:**

- [ ] **Step 1: Add `getTomorrowOrders` server action**

In `src/server/actions/orders.ts`, add at the bottom:

```ts
export async function getTomorrowOrders() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "COMPANY_ADMIN" && session.user.role !== "WAREHOUSE_STAFF")) {
    throw new Error("Unauthorized");
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);

  // B2B model: shops order the day before. "Tomorrow's orders" = placed today.
  const orders = await prisma.order.findMany({
    where: {
      status:    { notIn: ["CANCELLED"] },
      createdAt: { gte: today, lt: tomorrow },
    },
    include: {
      shop:  { select: { id: true, name: true, address: true } },
      items: { include: { product: { select: { id: true, name: true, unitType: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((o) => ({
    ...o,
    estimatedTotal: Number(o.estimatedTotal),
    items: o.items.map((i) => ({
      ...i,
      requestedKg:     i.requestedKg     != null ? Number(i.requestedKg)     : null,
      requestedPieces: i.requestedPieces ?? null,
      estimatedPrice:  Number(i.estimatedPrice),
    })),
  }));
}
```

- [ ] **Step 2: Create the tomorrow's orders page**

Create `src/app/(warehouse)/warehouse/tomorrow/page.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getTomorrowOrders } from "@/server/actions/orders";
import { formatDistanceToNow } from "date-fns";

type Order = Awaited<ReturnType<typeof getTomorrowOrders>>[number];

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export default function TomorrowOrdersPage() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey:        ["tomorrow-orders"],
    queryFn:         () => getTomorrowOrders(),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((k) => <Skeleton key={k} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <Package className="h-12 w-12 text-gray-300 mb-4" />
        <p className="font-semibold text-lg">No orders yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Today's orders will appear here as shops place them.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <p className="text-sm text-muted-foreground">
        {orders.length} order{orders.length !== 1 ? "s" : ""} placed today for tomorrow's delivery
      </p>

      {orders.map((order: Order) => (
        <div key={order.id} className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">{order.shop.name}</p>
              {order.shop.address && (
                <p className="text-xs text-muted-foreground">{order.shop.address}</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
            </p>
          </div>

          <div className="px-4 py-3 space-y-1">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-700">{item.product.name}</span>
                <span className="font-medium">
                  {item.orderedAs === "KG"
                    ? `${fmt(item.requestedKg ?? 0)} kg`
                    : `${item.requestedPieces ?? 0} pcs`}
                </span>
              </div>
            ))}
          </div>

          <div className="px-4 py-2 border-t bg-gray-50 flex justify-end">
            <span className="text-sm font-semibold">
              Est. {order.estimatedTotal.toLocaleString("ru-RU")} UZS
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Add "Tomorrow" nav item to WarehouseShell**

Open `src/app/(warehouse)/WarehouseShell.tsx`. Find the `NAV` array and add a new entry:

```ts
import { ClipboardList, Package, ShoppingCart } from "lucide-react";

const NAV = [
  { href: "/warehouse",          label: "Tasks",    icon: ClipboardList, exact: true  },
  { href: "/warehouse/stock",    label: "Stock",    icon: Package,       exact: false },
  { href: "/warehouse/tomorrow", label: "Tomorrow", icon: ShoppingCart,  exact: false },
];
```

Adjust the import from `lucide-react` to include `Package` and `ShoppingCart` (or whatever icons are appropriate — avoid `ShoppingCart` if it's confusing; use `CalendarDays` instead):

```ts
import { CalendarDays, ClipboardList, Package } from "lucide-react";

const NAV = [
  { href: "/warehouse",          label: "Tasks",    icon: ClipboardList, exact: true  },
  { href: "/warehouse/stock",    label: "Stock",    icon: Package,       exact: false },
  { href: "/warehouse/tomorrow", label: "Tomorrow", icon: CalendarDays,  exact: false },
];
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/orders.ts src/app/(warehouse)/warehouse/tomorrow/page.tsx src/app/(warehouse)/WarehouseShell.tsx
git commit -m "feat: add tomorrow's orders tab to warehouse panel"
```

---

### Task 14: Driver Shopping List — "I'm On It" Claim

**Files:**
- Modify: `src/server/actions/shopping.ts`
- Modify: `src/app/(driver)/driver/shopping/page.tsx`

**Steps:**

- [ ] **Step 1: Add `claimShoppingList` server action**

`RestockTask.assignedToId` links to `WarehouseStaff` only (confirmed in schema). Use `adminNote` to record the driver claim instead.

In `src/server/actions/shopping.ts`, add:

```ts
export async function claimShoppingList(taskId: string): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (session?.user.role !== "DELIVERY_STAFF") {
      return { success: false, error: "Unauthorized" };
    }

    await prisma.restockTask.update({
      where: { id: taskId },
      data:  {
        adminNote: `[SHOPPING_LIST] Claimed by driver ${session.user.id} at ${new Date().toISOString()}`,
      },
    });

    revalidatePath("/driver/shopping");
    revalidatePath("/admin/restock");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to claim task" };
  }
}
```

- [ ] **Step 2: Add "I'm on it" button to the driver shopping page**

In `src/app/(driver)/driver/shopping/page.tsx`, below the header section, add a claim button when the task exists and isn't already claimed:

```tsx
import { useState, useTransition } from "react";
import { claimShoppingList } from "@/server/actions/shopping";

// Inside the component, after task is loaded:
const [isPending, startTransition] = useTransition();

// In the JSX, after the header div:
{task && (
  <div className="px-4 pt-3">
    <Button
      className="w-full"
      disabled={isPending}
      onClick={() => startTransition(async () => {
        const result = await claimShoppingList(task.id);
        if (!result.success) toast.error(result.error);
        else toast.success("Marked as 'on it' — team notified");
      })}
    >
      {isPending ? "Updating…" : "I'm on it"}
    </Button>
  </div>
)}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/server/actions/shopping.ts src/app/(driver)/driver/shopping/page.tsx
git commit -m "feat: driver can claim shopping list with 'I'm on it' button"
```

---

### Task 15: Admin Orders — Date Filter + Shop Search

**Files:**
- Modify: `src/server/actions/orders.ts`
- Modify: `src/app/(admin)/admin/orders/page.tsx`

**Steps:**

- [ ] **Step 1: Extend `getAllOrders` to accept date and shop search filters**

In `src/server/actions/orders.ts`, update `getAllOrders`:

```ts
export async function getAllOrders(
  filters: {
    status?:   string;
    shopId?:   string;
    shopName?: string;
    dateFrom?: string;
    dateTo?:   string;
    page?:     number;
    limit?:    number;
  } = {}
) {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN") return { orders: [], total: 0 };

  const { status, shopId, shopName, dateFrom, dateTo, page = 1, limit = 50 } = filters;
  const where: Prisma.OrderWhereInput = {};

  if (status && status !== "ALL") where.status = status as Prisma.EnumOrderStatusFilter;
  if (shopId) where.shopId = shopId;
  if (shopName) where.shop = { name: { contains: shopName, mode: "insensitive" } };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setUTCHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        shop:  { select: { id: true, name: true, ownerName: true, phone: true } },
        items: { include: { product: { select: { id: true, name: true, unitType: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders: orders.map(formatOrder), total, pages: Math.ceil(total / limit) || 1 };
}
```

- [ ] **Step 2: Add date filter + shop search inputs to the admin orders page**

In `src/app/(admin)/admin/orders/page.tsx`, find the existing filter controls (status filter). Add two new inputs next to it:

```tsx
// Add state:
const [shopSearch, setShopSearch] = useState("");
const [dateFrom, setDateFrom]     = useState("");
const [dateTo, setDateTo]         = useState("");

// Add to the filters passed to getAllOrders:
queryFn: () => getAllOrders({ status: selectedStatus, shopName: shopSearch || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page }),

// Add inputs in the filter toolbar:
<Input
  placeholder="Search shop…"
  value={shopSearch}
  onChange={(e) => setShopSearch(e.target.value)}
  className="w-40"
/>
<Input
  type="date"
  value={dateFrom}
  onChange={(e) => setDateFrom(e.target.value)}
  className="w-36"
/>
<Input
  type="date"
  value={dateTo}
  onChange={(e) => setDateTo(e.target.value)}
  className="w-36"
/>
```

Add `shopSearch`, `dateFrom`, `dateTo` to the `queryKey` array so the query re-runs when they change:

```ts
queryKey: ["admin-orders", selectedStatus, shopSearch, dateFrom, dateTo, page],
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/server/actions/orders.ts src/app/(admin)/admin/orders/page.tsx
git commit -m "feat: date filter and shop search on admin orders page"
```

---

### Task 16: Hero Banner Copy + All-Done Screen Summary

**Files:**
- Modify: shop landing / hero component
- Modify: `src/app/(driver)/driver/page.tsx`

**Steps:**

- [ ] **Step 1: Fix hero banner copy**

Find the shop landing page (likely `src/app/(shop)/page.tsx` or a hero component). Look for copy that implies same-day ordering. Update to reflect the day-before model:

```tsx
// Find something like:
// "Order fresh produce for today's delivery"
// Replace with:
// "Order today, delivered tomorrow"

// Or find: "Get today's fresh produce"
// Replace with: "Order by tonight for tomorrow's delivery"
```

Search for the exact text:

```bash
grep -r "today" src/app/\(shop\)/ --include="*.tsx" -n
```

Update the found string to match the B2B day-before model.

- [ ] **Step 2: Add delivery summary to all-done screen**

In `src/app/(driver)/driver/page.tsx`, find the "all deliveries complete" or "route done" state. It currently shows a generic completion message. Add a summary of what was delivered:

```tsx
// Find the completed route state, likely something like:
// if (route.status === "COMPLETED") return <CompletedState />

// In the completed state, show a summary:
<div className="text-center py-8 px-4">
  <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
  <p className="text-xl font-bold">All done!</p>
  <p className="text-muted-foreground mt-1">Great work today</p>

  {/* Delivery summary */}
  <div className="mt-6 text-left space-y-2">
    {route.stops.map((stop) => (
      <div key={stop.id} className="flex justify-between text-sm border rounded-lg px-3 py-2">
        <span>{stop.order.shop.name}</span>
        <span className={cn(
          "font-medium",
          stop.status === "COMPLETED"     && "text-green-600",
          stop.status === "PARTIAL_RETURN" && "text-amber-600",
          stop.status === "FULL_RETURN"   && "text-red-500",
          stop.status === "SKIPPED"       && "text-gray-400",
        )}>
          {stop.status === "COMPLETED"      ? "Delivered"         : ""}
          {stop.status === "PARTIAL_RETURN" ? "Partial return"    : ""}
          {stop.status === "FULL_RETURN"    ? "Full return"       : ""}
          {stop.status === "SKIPPED"        ? "Skipped"           : ""}
        </span>
      </div>
    ))}
  </div>
</div>
```

Adapt to the actual data shape available on the route object.

- [ ] **Step 3: Verify TypeScript**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(shop)/ src/app/(driver)/driver/page.tsx
git commit -m "ux: fix day-before ordering copy; add delivery summary to all-done screen"
```

---

## Phase 4: Production-Hardened

---

### Task 17: Prisma Error Normalization Helper

**Files:**
- Create: `src/lib/errors.ts`
- Modify: key server actions to use it

**Steps:**

- [ ] **Step 1: Create `src/lib/errors.ts`**

```ts
import { Prisma } from "@prisma/client";

export function normalizeError(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case "P2002": return "This record already exists";
      case "P2025": return "Record not found";
      case "P2003": return "Related record not found";
      case "P2014": return "This change would violate a required relation";
      default:      return "Database error";
    }
  }
  if (e instanceof Error) return e.message;
  return "An unexpected error occurred";
}
```

- [ ] **Step 2: Replace raw `e instanceof Error ? e.message : "..."` catch blocks**

In the following files, replace all catch blocks that look like:

```ts
} catch (e) {
  return { success: false, error: e instanceof Error ? e.message : "Failed to ..." };
}
```

With:

```ts
import { normalizeError } from "@/lib/errors";

} catch (e) {
  return { success: false, error: normalizeError(e) };
}
```

Files to update:
- `src/server/actions/inventory.ts` (3 catch blocks)
- `src/server/actions/shopping.ts` (2 catch blocks)
- `src/server/actions/restock.ts` (all catch blocks)
- `src/server/actions/delivery.ts` (3 catch blocks)
- `src/server/actions/orders.ts` (all catch blocks)

- [ ] **Step 3: Verify TypeScript**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/errors.ts src/server/actions/
git commit -m "feat: add Prisma error normalization to prevent schema leakage"
```

---

### Task 18: Schema Hardening + Price Override Audit Log

**Files:**
- Modify: `src/server/actions/delivery-staff.ts`
- Modify: `src/lib/validations/order.schema.ts`
- Modify: `src/server/actions/orders.ts`

**Steps:**

- [ ] **Step 1: Add `.max(72)` to `adminResetPassword` password validation**

In `src/server/actions/delivery-staff.ts`, around line 228:

```ts
// BEFORE
if (newPassword.length < 8) {
  return { success: false, error: "Password must be at least 8 characters" };
}
```

```ts
// AFTER
if (newPassword.length < 8)  return { success: false, error: "Password must be at least 8 characters" };
if (newPassword.length > 72) return { success: false, error: "Password must be at most 72 characters" };
```

- [ ] **Step 2: Add ceiling validation on `overridePrice`**

In `src/lib/validations/order.schema.ts`:

```ts
// BEFORE
overridePrice: z.number().int().positive().optional(),
```

```ts
// AFTER — 100,000,000 UZS ceiling prevents typo zeros
overridePrice: z.number().int().positive().max(100_000_000).optional(),
```

- [ ] **Step 3: Add audit log for price overrides**

In `src/server/actions/orders.ts`, inside the `setActualCost` function, after the `await tx.orderItem.update(...)` for items where `adminAdjusted === true`, add a `StockMovement`-style audit entry using a simple console.info (or a proper audit table if one exists):

Since there's no dedicated audit table, log with structured context:

```ts
if (adminAdjusted) {
  console.info("[AUDIT] Price override", {
    orderId:     parsed.data.orderId,
    orderItemId,
    overridePrice,
    adminId:     session.user.id,
    adminNote,
    timestamp:   new Date().toISOString(),
  });
}
```

Place this immediately after the `tx.orderItem.update` call inside the loop.

- [ ] **Step 4: Verify TypeScript**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/delivery-staff.ts src/lib/validations/order.schema.ts src/server/actions/orders.ts
git commit -m "hardening: password max 72 chars; overridePrice ceiling; price override audit log"
```

---

### Task 19: `.env.example` + Structured Error Logging

**Files:**
- Create: `.env.example`
- Modify: `src/server/actions/delivery.ts`
- Modify: `src/server/actions/inventory.ts`

**Steps:**

- [ ] **Step 1: Create `.env.example`**

Create `.env.example` in the project root:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/ikiwi?schema=public"

# Auth (generate with: openssl rand -base64 32)
AUTH_SECRET="change-me-in-production"

# Pusher
PUSHER_APP_ID="your-app-id"
PUSHER_KEY="your-key"
PUSHER_SECRET="your-secret"
PUSHER_CLUSTER="your-cluster"
NEXT_PUBLIC_PUSHER_KEY="your-key"
NEXT_PUBLIC_PUSHER_CLUSTER="your-cluster"

# Cron (generate with: openssl rand -hex 32)
CRON_SECRET="change-me-in-production"

# Email (Resend)
RESEND_API_KEY="re_..."
EMAIL_FROM="noreply@yourdomain.com"
```

- [ ] **Step 2: Add structured error logging to `completeDelivery`**

In `src/server/actions/delivery.ts`, replace the bare `catch` in `completeDelivery`:

```ts
// BEFORE
} catch (e) {
  return { success: false, error: normalizeError(e) };
}
```

```ts
// AFTER
} catch (e) {
  console.error("[completeDelivery] failed", {
    stopId: (input as any)?.stopId,
    error:  e instanceof Error ? e.message : String(e),
  });
  return { success: false, error: normalizeError(e) };
}
```

- [ ] **Step 3: Add structured error logging to `warehouseLogIncoming`**

In `src/server/actions/inventory.ts`, replace the catch in `warehouseLogIncoming`:

```ts
// AFTER
} catch (e) {
  console.error("[warehouseLogIncoming] failed", {
    input:  JSON.stringify(input),
    error:  e instanceof Error ? e.message : String(e),
  });
  return { success: false, error: normalizeError(e) };
}
```

- [ ] **Step 4: Final TypeScript check across entire project**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 5: Run Biome check**

```bash
cd C:\Users\User\Desktop\ikiwi-next && npx biome check src/
```

Fix any reported issues.

- [ ] **Step 6: Commit**

```bash
git add .env.example src/server/actions/delivery.ts src/server/actions/inventory.ts
git commit -m "hardening: add .env.example; structured error logging on key actions"
```

---

## Manual Smoke Test Checklist

Run after completing each phase before starting the next:

**Phase 1:**
- [ ] Login with wrong password 11 times → see 429 response
- [ ] Log in as SHOP_OWNER → try calling `generateShoppingList` via dev tools → confirm 403/Unauthorized
- [ ] Place order → confirm it appears in DB even if Pusher is unreachable
- [ ] Move order to CANCELLED from PREPARING → confirm stock is released (check StockMovement table)
- [ ] Simulate FULL_RETURN delivery → confirm no crash in server logs

**Phase 2:**
- [ ] Log incoming stock → confirm shopping list query refreshes automatically
- [ ] Generate shopping list twice in one day → confirm notification sent only once
- [ ] Try to place order with a product that has a 0 UZS price → confirm error message
- [ ] Try to skip a delivery stop with a 3-char reason → confirm validation error

**Phase 3:**
- [ ] Warehouse panel → "Tomorrow" tab → shows today's orders from shops
- [ ] Driver shopping page → "I'm on it" button appears → tap → success toast
- [ ] Admin orders → search by shop name → correct results filter
- [ ] Admin orders → set date range → orders outside range hidden
- [ ] Driver route complete → all-done screen shows per-stop summary

**Phase 4:**
- [ ] Try to reset a password to a 100-char string → confirm error
- [ ] Set override price above 100,000,000 → confirm validation error
- [ ] Check server logs for `[AUDIT]` entries after a price override
- [ ] Call `getShoppingList` as SHOP_OWNER → confirm `{ success: false, error: "Unauthorized" }`
