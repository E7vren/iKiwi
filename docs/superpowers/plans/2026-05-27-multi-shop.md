# Multi-Shop Per Customer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow one customer account to own multiple shop locations, each with independent orders, selected at checkout with GPS and map support.

**Architecture:** Remove the `@unique` constraint on `Shop.userId` so users can have many shops. Remove `shopId` from the JWT session; all shop-owner server actions look up shops by `session.user.id`. `placeOrder` accepts a `shopId` parameter validated against the user's own shops. A reusable `ShopSelector` component handles shop picking in the cart and order detail pages.

**Tech Stack:** Next.js 15 App Router, Prisma, Auth.js v5 (JWT), TanStack Query, mapbox-gl (dynamic import, same pattern as RouteMap), Tailwind CSS, shadcn/ui

---

### Task 1: Schema — remove unique constraint on Shop.userId

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Remove `@unique` from `Shop.userId`**

In `prisma/schema.prisma`, change:
```prisma
model Shop {
  id             String          @id @default(cuid())
  name           String
  ownerName      String
  phone          String
  address        String
  latitude       Decimal         @db.Decimal(9, 6)
  longitude      Decimal         @db.Decimal(9, 6)
  isActive       Boolean         @default(true)
  userId         String                              // ← removed @unique
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  orders         Order[]
  favorites      Favorite[]
  orderTemplates OrderTemplate[]
  priceAlerts    PriceAlert[]

  @@map("shops")
}
```

Also change `User` model relation from `shop Shop?` to `shops Shop[]`:
```prisma
model User {
  // ... existing fields ...
  shops          Shop[]           // ← was: shop Shop?
  deliveryStaff  DeliveryStaff?
  warehouseStaff WarehouseStaff?
  notifications  Notification[]
  dailyPrices    DailyPrice[]

  @@map("users")
}
```

- [ ] **Step 2: Push schema to database**

```bash
cd ikiwi-next
npx prisma db push
npx prisma generate
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: allow multiple shops per user (remove unique constraint)"
```

---

### Task 2: Auth — remove shopId from JWT, keep shopActive

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/auth.config.ts`
- Modify: `src/types/next-auth.d.ts`

- [ ] **Step 1: Update `auth.ts` — load all shops, set shopActive**

Replace the `shop` include and return in `src/lib/auth.ts`:

```ts
"use server";

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
```

- [ ] **Step 2: Update `auth.config.ts` — remove shopId from token**

```ts
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
```

- [ ] **Step 3: Update `next-auth.d.ts` — remove shopId**

```ts
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
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.config.ts src/types/next-auth.d.ts
git commit -m "feat: remove shopId from JWT session, shopActive = any active shop"
```

---

### Task 3: Server actions — shops.ts

**Files:**
- Modify: `src/server/actions/shops.ts`

- [ ] **Step 1: Rewrite `shops.ts` with multi-shop actions**

Replace the entire file with:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { type UpdateShopInput, updateShopSchema } from "@/lib/validations";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireShopOwner() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SHOP_OWNER") return null;
  return session.user;
}

// ─── Shop owner: get all own shops ───────────────────────────────────────────

export async function getMyShops() {
  const user = await requireShopOwner();
  if (!user) return [];

  const shops = await prisma.shop.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return shops.map((s) => ({
    id: s.id,
    name: s.name,
    ownerName: s.ownerName,
    phone: s.phone,
    address: s.address,
    latitude: Number(s.latitude),
    longitude: Number(s.longitude),
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
  }));
}

export type MyShop = Awaited<ReturnType<typeof getMyShops>>[number];

// ─── Shop owner: add a new shop ───────────────────────────────────────────────

const addShopSchema = z.object({
  name:      z.string().min(2, "Shop name required"),
  ownerName: z.string().min(2, "Owner name required"),
  phone:     z.string().min(7, "Phone required"),
  address:   z.string().min(3, "Address required"),
  latitude:  z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type AddShopInput = z.infer<typeof addShopSchema>;

export async function addShop(input: AddShopInput): Promise<Result<{ id: string }>> {
  const user = await requireShopOwner();
  if (!user) return { success: false, error: "Forbidden" };

  const parsed = addShopSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { name, ownerName, phone, address, latitude, longitude } = parsed.data;

  const shop = await prisma.$transaction(async (tx) => {
    const shop = await tx.shop.create({
      data: { userId: user.id, name, ownerName, phone, address, latitude, longitude, isActive: true },
    });

    // Notify all admins
    const admins = await tx.user.findMany({
      where: { role: "COMPANY_ADMIN" },
      select: { id: true },
    });

    if (admins.length > 0) {
      await tx.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: "ORDER_PLACED" as const, // reuse existing type for now
          title: "New shop added",
          message: `New shop "${name}" at ${address} was added by a customer. Review in Admin → Shops.`,
        })),
      });
    }

    return shop;
  });

  revalidatePath("/shop/profile");
  revalidatePath("/admin/shops");
  return { success: true, data: { id: shop.id } };
}

// ─── Shop owner: update own shop ─────────────────────────────────────────────

const updateMyShopSchema = z.object({
  shopId:    z.string().min(1),
  name:      z.string().min(2, "Shop name required"),
  ownerName: z.string().min(2, "Owner name required"),
  phone:     z.string().min(7, "Phone required"),
  address:   z.string().min(3, "Address required"),
  latitude:  z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type UpdateMyShopInput = z.infer<typeof updateMyShopSchema>;

export async function updateMyShop(input: UpdateMyShopInput): Promise<Result<void>> {
  const user = await requireShopOwner();
  if (!user) return { success: false, error: "Forbidden" };

  const parsed = updateMyShopSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { shopId, name, ownerName, phone, address, latitude, longitude } = parsed.data;

  // Verify ownership
  const existing = await prisma.shop.findFirst({ where: { id: shopId, userId: user.id } });
  if (!existing) return { success: false, error: "Shop not found" };

  await prisma.shop.update({
    where: { id: shopId },
    data: { name, ownerName, phone, address, latitude, longitude },
  });

  revalidatePath("/shop/profile");
  return { success: true, data: undefined };
}

// ─── Shop owner: delete a shop ────────────────────────────────────────────────

export async function deleteMyShop(shopId: string): Promise<Result<void>> {
  const user = await requireShopOwner();
  if (!user) return { success: false, error: "Forbidden" };

  const shop = await prisma.shop.findFirst({
    where: { id: shopId, userId: user.id },
    include: {
      _count: {
        select: {
          orders: { where: { status: { notIn: ["DELIVERED", "CANCELLED"] } } },
        },
      },
    },
  });

  if (!shop) return { success: false, error: "Shop not found" };
  if (shop._count.orders > 0)
    return { success: false, error: "Cannot delete a shop with active orders" };

  await prisma.shop.delete({ where: { id: shopId } });
  revalidatePath("/shop/profile");
  return { success: true, data: undefined };
}

// ─── Shop owner: get this-month stats across all shops ───────────────────────

export async function getMyStats() {
  const user = await requireShopOwner();
  if (!user) return { count: 0, totalSpent: 0, avgOrder: 0 };

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: { shop: { userId: user.id }, createdAt: { gte: start } },
    select: { estimatedTotal: true, actualTotal: true },
  });

  const count = orders.length;
  const totalSpent = orders.reduce(
    (acc, o) => acc + Number(o.actualTotal ?? o.estimatedTotal),
    0
  );
  const avgOrder = count > 0 ? Math.round(totalSpent / count) : 0;
  return { count, totalSpent, avgOrder };
}

// ─── Admin: get all shops ─────────────────────────────────────────────────────

export async function getAllShops() {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN") return [];

  const shops = await prisma.shop.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return shops.map((s) => ({
    ...s,
    latitude: Number(s.latitude),
    longitude: Number(s.longitude),
  }));
}

// ─── Admin: toggle shop active / edit shop ────────────────────────────────────

export async function updateShop(input: UpdateShopInput): Promise<Result<{ isActive: boolean }>> {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN") return { success: false, error: "Forbidden" };

  const parsed = updateShopSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" };

  const shop = await prisma.shop.update({
    where: { id: parsed.data.shopId },
    data: { isActive: parsed.data.isActive },
  });

  revalidatePath("/admin/shops");
  return { success: true, data: { isActive: shop.isActive } };
}

// ─── Admin: update any shop's details (to help customer) ─────────────────────

const adminUpdateShopSchema = z.object({
  shopId:    z.string().min(1),
  name:      z.string().min(2).optional(),
  ownerName: z.string().min(2).optional(),
  phone:     z.string().min(7).optional(),
  address:   z.string().min(3).optional(),
  latitude:  z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isActive:  z.boolean().optional(),
});

export type AdminUpdateShopInput = z.infer<typeof adminUpdateShopSchema>;

export async function adminUpdateShop(input: AdminUpdateShopInput): Promise<Result<void>> {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN") return { success: false, error: "Forbidden" };

  const parsed = adminUpdateShopSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" };

  const { shopId, ...data } = parsed.data;
  await prisma.shop.update({ where: { id: shopId }, data });

  revalidatePath("/admin/shops");
  return { success: true, data: undefined };
}

// ─── Admin: get shop detail with orders ──────────────────────────────────────

export async function getShopWithOrders(shopId: string) {
  const session = await auth();
  if (session?.user?.role !== "COMPANY_ADMIN") return null;

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      user: { select: { email: true, name: true } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true, status: true, estimatedTotal: true, actualTotal: true, createdAt: true,
        },
      },
    },
  });

  if (!shop) return null;

  return {
    ...shop,
    latitude: Number(shop.latitude),
    longitude: Number(shop.longitude),
    orders: shop.orders.map((o) => ({
      ...o,
      estimatedTotal: Number(o.estimatedTotal),
      actualTotal: o.actualTotal != null ? Number(o.actualTotal) : null,
    })),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/actions/shops.ts
git commit -m "feat: multi-shop server actions (getMyShops, addShop, updateMyShop, deleteMyShop)"
```

---

### Task 4: Update orders.ts — accept shopId param, fix userId-based queries

**Files:**
- Modify: `src/server/actions/orders.ts`
- Modify: `src/lib/validations/order.schema.ts`
- Modify: `src/app/api/orders/route.ts`
- Modify: `src/app/api/receipt/[orderId]/route.ts`

- [ ] **Step 1: Add `shopId` to `createOrderSchema`**

In `src/lib/validations/order.schema.ts`, add `shopId` to `createOrderSchema`:

```ts
export const createOrderSchema = z.object({
  shopId: z.string().min(1, "Shop is required"),
  items: z.array(orderItemSchema).min(1, "Order must have at least one item"),
  notes: z.string().max(500).optional(),
});
```

- [ ] **Step 2: Update `placeOrder` — validate shopId belongs to user**

In `src/server/actions/orders.ts`, replace the shopId block at the top of `placeOrder`:

```ts
export async function placeOrder(input: CreateOrderInput): Promise<Result<{ id: string }>> {
  const session = await auth();
  if (session?.user?.role !== "SHOP_OWNER") return { success: false, error: "Forbidden" };

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" };

  // Validate that the given shopId belongs to this user and is active
  const shop = await prisma.shop.findFirst({
    where: { id: parsed.data.shopId, userId: session.user.id, isActive: true },
    select: { id: true },
  });
  if (!shop) return { success: false, error: "Invalid or inactive shop" };

  const shopId = shop.id;
  // ... rest of function unchanged (shopId variable already used below)
```

Also add an `updateOrderShop` action at the end of the file:

```ts
export async function updateOrderShop(
  orderId: string,
  shopId: string
): Promise<Result<void>> {
  const session = await auth();
  if (session?.user?.role !== "SHOP_OWNER") return { success: false, error: "Forbidden" };

  // Verify the order belongs to this user and is still PENDING
  const order = await prisma.order.findFirst({
    where: { id: orderId, shop: { userId: session.user.id }, status: "PENDING" },
    select: { id: true },
  });
  if (!order) return { success: false, error: "Order not found or already confirmed" };

  // Verify the new shop belongs to this user and is active
  const newShop = await prisma.shop.findFirst({
    where: { id: shopId, userId: session.user.id, isActive: true },
    select: { id: true },
  });
  if (!newShop) return { success: false, error: "Invalid shop" };

  await prisma.order.update({ where: { id: orderId }, data: { shopId } });
  revalidatePath("/shop/orders");
  return { success: true, data: undefined };
}
```

- [ ] **Step 3: Update `getMyOrders` — filter by userId instead of shopId**

In `src/server/actions/orders.ts`, replace `getMyOrders`:

```ts
export async function getMyOrders(page = 1, limit = 30) {
  const session = await auth();
  if (session?.user?.role !== "SHOP_OWNER") return { orders: [], total: 0 };

  const where = { shop: { userId: session.user.id } };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        shop: { select: { id: true, name: true, ownerName: true, phone: true, address: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, unitType: true, imageUrl: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: orders.map(formatOrder),
    total,
    pages: Math.ceil(total / limit) || 1,
  };
}
```

- [ ] **Step 4: Update `getOrderById` — fix ownership check**

In `getOrderById`, replace:
```ts
if (session.user.role === "SHOP_OWNER" && row.shopId !== session.user.shopId) return null;
```
with:
```ts
if (session.user.role === "SHOP_OWNER" && row.shop.userId !== session.user.id) return null;
```

Also add `userId` to the shop select in `getOrderById`:
```ts
shop: {
  select: {
    id: true, name: true, ownerName: true, phone: true, address: true,
    latitude: true, longitude: true,
    userId: true,  // ← add this
  },
},
```

- [ ] **Step 5: Update `/api/orders/route.ts` — filter by userId**

```ts
const where: Prisma.OrderWhereInput =
  session.user.role === "SHOP_OWNER"
    ? { shop: { userId: session.user.id } }
    : {};
```

- [ ] **Step 6: Update `/api/receipt/[orderId]/route.ts` — fix ownership check**

Load `shop: { select: { userId: true } }` in the order query, then:
```ts
if (session.user.role === "SHOP_OWNER" && order.shop?.userId !== session.user.id) {
  return new Response("Forbidden", { status: 403 });
}
```

- [ ] **Step 7: Commit**

```bash
git add src/server/actions/orders.ts src/lib/validations/order.schema.ts \
        src/app/api/orders/route.ts src/app/api/receipt/[orderId]/route.ts
git commit -m "feat: placeOrder accepts shopId param, orders filtered by userId"
```

---

### Task 5: ShopSelector component

**Files:**
- Create: `src/components/shop/ShopSelector.tsx`

- [ ] **Step 1: Create `ShopSelector.tsx`**

```tsx
"use client";

import { MapPin, Navigation } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { MyShop } from "@/server/actions/shops";

interface Props {
  shops: MyShop[];
  value: string | null;           // selected shopId
  onChange: (shopId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function ShopSelector({ shops, value, onChange, open, onOpenChange }: Props) {
  const [gpsLoading, setGpsLoading] = useState(false);

  function handleGps() {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const { latitude, longitude } = pos.coords;
        let nearest = shops[0];
        let minDist = Infinity;
        for (const s of shops) {
          const d = distanceKm(latitude, longitude, s.latitude, s.longitude);
          if (d < minDist) { minDist = d; nearest = s; }
        }
        if (nearest) onChange(nearest.id);
      },
      () => setGpsLoading(false)
    );
  }

  const activeShops = shops.filter((s) => s.isActive);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Deliver to which shop?</SheetTitle>
        </SheetHeader>

        <Button
          variant="outline"
          className="w-full mb-4 gap-2"
          disabled={gpsLoading}
          onClick={handleGps}
        >
          <Navigation className="h-4 w-4 text-primary" />
          {gpsLoading ? "Detecting location…" : "Use my location (nearest shop)"}
        </Button>

        <div className="space-y-2">
          {activeShops.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No active shops. Add one in your profile.
            </p>
          )}
          {activeShops.map((shop) => (
            <button
              key={shop.id}
              type="button"
              onClick={() => { onChange(shop.id); onOpenChange(false); }}
              className={cn(
                "w-full text-left rounded-xl border p-4 transition-colors",
                value === shop.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              )}
            >
              <p className="font-semibold text-sm">{shop.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" /> {shop.address}
              </p>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shop/ShopSelector.tsx
git commit -m "feat: ShopSelector bottom sheet component with GPS nearest"
```

---

### Task 6: ShopLocationForm component (GPS + map + address search)

**Files:**
- Create: `src/components/shop/ShopLocationForm.tsx`

- [ ] **Step 1: Create `ShopLocationForm.tsx`**

```tsx
"use client";

import { Loader2, MapPin, Navigation, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface LocationValue {
  address: string;
  latitude: number;
  longitude: number;
}

interface Props {
  value: LocationValue | null;
  onChange: (v: LocationValue) => void;
  className?: string;
}

const TASHKENT = { lat: 41.2995, lng: 69.2401 };

export function ShopLocationForm({ value, onChange, className }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value?.address ?? "");
  const [suggestions, setSuggestions] = useState<Array<{ place_name: string; center: [number, number] }>>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !token || token.includes("your_mapbox")) return;
    let map: any;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      mapboxgl.accessToken = token;
      const center = value
        ? [value.longitude, value.latitude]
        : [TASHKENT.lng, TASHKENT.lat];

      map = new mapboxgl.Map({
        container: mapRef.current!,
        style: "mapbox://styles/mapbox/streets-v12",
        center: center as [number, number],
        zoom: value ? 15 : 12,
      });

      mapInstance.current = map;

      // Draggable marker
      const marker = new mapboxgl.Marker({ draggable: true, color: "#2e7d32" })
        .setLngLat(center as [number, number])
        .addTo(map);

      markerRef.current = marker;

      marker.on("dragend", () => {
        const { lng, lat } = marker.getLngLat();
        reverseGeocode(lng, lat);
      });

      map.on("click", (e: any) => {
        const { lng, lat } = e.lngLat;
        marker.setLngLat([lng, lat]);
        reverseGeocode(lng, lat);
      });
    });

    return () => { map?.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function moveMarker(lng: number, lat: number) {
    markerRef.current?.setLngLat([lng, lat]);
    mapInstance.current?.flyTo({ center: [lng, lat], zoom: 15 });
  }

  async function reverseGeocode(lng: number, lat: number) {
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=en`
      );
      const data = await res.json();
      const place = data.features?.[0]?.place_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setSearchQuery(place);
      onChange({ address: place, latitude: lat, longitude: lng });
    } catch {
      onChange({ address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, latitude: lat, longitude: lng });
    }
  }

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.length < 3) { setSuggestions([]); return; }
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&language=en&limit=5`
      );
      const data = await res.json();
      setSuggestions(data.features ?? []);
      setSearchOpen(true);
    } catch { /* silent */ }
  }

  function selectSuggestion(s: { place_name: string; center: [number, number] }) {
    const [lng, lat] = s.center;
    setSearchQuery(s.place_name);
    setSuggestions([]);
    setSearchOpen(false);
    moveMarker(lng, lat);
    onChange({ address: s.place_name, latitude: lat, longitude: lng });
  }

  function handleGps() {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const { latitude, longitude } = pos.coords;
        moveMarker(longitude, latitude);
        reverseGeocode(longitude, latitude);
      },
      () => setGpsLoading(false)
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <Label>Location *</Label>

      {/* GPS button */}
      <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGps} disabled={gpsLoading}>
        {gpsLoading
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Navigation className="h-4 w-4 text-primary" />}
        {gpsLoading ? "Detecting…" : "Use my current location"}
      </Button>

      {/* Address search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search address…"
          className="pl-9"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => suggestions.length > 0 && setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
        />
        {searchOpen && suggestions.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent flex items-start gap-2"
                onClick={() => selectSuggestion(s)}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                <span>{s.place_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        className="w-full h-48 rounded-xl overflow-hidden border"
        style={{ minHeight: 192 }}
      />
      <p className="text-xs text-muted-foreground">Tap the map or drag the pin to fine-tune</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shop/ShopLocationForm.tsx
git commit -m "feat: ShopLocationForm with GPS, Mapbox geocoding, draggable pin"
```

---

### Task 7: Cart page — shop selector step

**Files:**
- Modify: `src/app/(shop)/shop/cart/page.tsx`

- [ ] **Step 1: Add shop selector to cart page**

Replace the entire `src/app/(shop)/shop/cart/page.tsx`:

```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronRight, Loader2, MapPin, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ShopSelector } from "@/components/shop/ShopSelector";
import { formatPrice } from "@/lib/utils";
import { getMyShops, type MyShop } from "@/server/actions/shops";
import { placeOrder } from "@/server/actions/orders";
import { useCartStore } from "@/store/cartStore";
import type { CartItem } from "@/types";

function SwipeableCartItem({
  item, onRemove, onIncrease, onDecrease,
}: {
  item: CartItem;
  onRemove: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const unitLabel = item.orderedAs === "KG" ? "kg" : "pcs";

  return (
    <AnimatePresence>
      <motion.div
        layout
        className="relative overflow-hidden rounded-xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
      >
        <div className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 bg-red-50 rounded-xl w-full">
          <Trash2 className="h-5 w-5 text-destructive" />
          <span className="text-xs text-destructive ml-1.5 font-medium">Remove</span>
        </div>
        <motion.div
          drag="x"
          dragConstraints={{ left: -100, right: 0 }}
          dragElastic={0.1}
          onDragEnd={(_, info) => { if (info.offset.x < -80) onRemove(); }}
          className="relative flex items-center gap-3 rounded-xl bg-card border border-border shadow-sm p-3 cursor-grab active:cursor-grabbing"
          whileTap={{ scale: 0.99 }}
        >
          <div className="h-12 w-12 rounded-lg bg-primary/5 flex items-center justify-center text-2xl shrink-0">
            {item.orderedAs === "KG" ? "⚖️" : "📦"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatPrice(item.pricePerUnit)} / {unitLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={onDecrease}>
              {item.qty <= (item.orderedAs === "KG" ? 0.5 : 1)
                ? <Trash2 className="h-3 w-3 text-destructive" />
                : <Minus className="h-3 w-3" />}
            </Button>
            <span className="w-12 text-center text-sm font-semibold">
              {item.qty} {unitLabel}
            </span>
            <Button size="icon" className="h-7 w-7 bg-primary hover:bg-primary/90" onClick={onIncrease}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-sm font-bold text-right w-20 shrink-0">
            {formatPrice(item.pricePerUnit * item.qty)}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function CartPage() {
  const router = useRouter();
  const { items, addItem, updateQty, removeItem, clearCart } = useCartStore();
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [shops, setShops] = useState<MyShop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const total = items.reduce((acc, i) => acc + i.pricePerUnit * i.qty, 0);
  const selectedShop = shops.find((s) => s.id === selectedShopId) ?? null;

  useEffect(() => {
    getMyShops().then((data) => {
      setShops(data);
      // Auto-select if only one active shop
      const active = data.filter((s) => s.isActive);
      if (active.length === 1) setSelectedShopId(active[0].id);
    });
  }, []);

  async function handlePlaceOrder() {
    if (items.length === 0) return;
    if (!selectedShopId) {
      setSelectorOpen(true);
      return;
    }
    setLoading(true);

    const orderItems = items.map((i) =>
      i.orderedAs === "KG"
        ? { productId: i.productId, orderedAs: "KG" as const, requestedKg: i.qty }
        : { productId: i.productId, orderedAs: "PIECE" as const, requestedPieces: i.qty }
    );

    const result = await placeOrder({
      shopId: selectedShopId,
      items: orderItems,
      notes: notes.trim() || undefined,
    });

    setLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    clearCart();
    router.push(`/orders/${result.data.id}/confirmation`);
  }

  if (items.length === 0) {
    return (
      <div className="py-24 text-center space-y-4">
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground/30" />
        <div>
          <p className="font-semibold text-lg">Your cart is empty</p>
          <p className="text-sm text-muted-foreground mt-1">Add products from the catalog</p>
        </div>
        <Button onClick={() => router.push("/shop")} className="bg-primary hover:bg-primary/90">
          Browse Catalog
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Your Cart</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} product{items.length !== 1 ? "s" : ""}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">← Swipe left to remove an item</p>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const step = item.orderedAs === "KG" ? 0.5 : 1;
            return (
              <SwipeableCartItem
                key={`${item.productId}::${item.orderedAs}`}
                item={item}
                onRemove={() => removeItem(item.productId, item.orderedAs)}
                onIncrease={() =>
                  addItem({ productId: item.productId, name: item.name, unitType: item.unitType, orderedAs: item.orderedAs, pricePerUnit: item.pricePerUnit }, step)
                }
                onDecrease={() => {
                  const newQty = Math.round((item.qty - step) * 10) / 10;
                  if (newQty <= 0) removeItem(item.productId, item.orderedAs);
                  else updateQty(item.productId, item.orderedAs, newQty);
                }}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {/* Deliver to — shop selector */}
      <div>
        <Label className="text-sm mb-2 block">Deliver to</Label>
        {shops.filter((s) => s.isActive).length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            You have no active shops.{" "}
            <Link href="/shop/profile" className="underline font-medium">
              Add one in your profile.
            </Link>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSelectorOpen(true)}
            className="w-full rounded-xl border border-border bg-card p-4 text-left flex items-center gap-3 hover:border-primary/40 transition-colors"
          >
            <MapPin className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              {selectedShop ? (
                <>
                  <p className="font-semibold text-sm">{selectedShop.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedShop.address}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Tap to select delivery shop</p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        )}
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          Quantities shown are estimates. Staff will confirm exact weights/counts and notify you of the final cost.
        </p>
      </div>

      {/* Order summary */}
      <div className="rounded-xl bg-card border border-border shadow-sm p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Products</span>
          <span>{items.length}</span>
        </div>
        <Separator />
        <div className="flex justify-between font-bold pt-1">
          <span>Estimated Total</span>
          <span className="text-primary text-lg">{formatPrice(total)}</span>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Order notes (optional)</Label>
        <Textarea
          id="notes"
          placeholder="Special requests, delivery time, etc…"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          className="shrink-0 text-destructive border-destructive/30 hover:bg-destructive/5"
          onClick={clearCart}
        >
          <Trash2 className="h-4 w-4 mr-1.5" /> Clear
        </Button>
        <Button
          onClick={handlePlaceOrder}
          disabled={loading || shops.filter((s) => s.isActive).length === 0}
          className="flex-1 bg-primary hover:bg-primary/90"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {selectedShopId ? `Place Order · ${formatPrice(total)}` : "Select shop to order"}
        </Button>
      </div>

      <ShopSelector
        shops={shops}
        value={selectedShopId}
        onChange={setSelectedShopId}
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(shop\)/shop/cart/page.tsx
git commit -m "feat: cart page shop selector with confirmation step"
```

---

### Task 8: Order detail — change delivery shop (PENDING only)

**Files:**
- Modify: `src/app/(shop)/orders/[id]/OrderDetailClient.tsx`

- [ ] **Step 1: Add "Change delivery shop" button**

At the top of `OrderDetailClient.tsx`, add these imports:
```tsx
import { useQuery } from "@tanstack/react-query";
import { ShopSelector } from "@/components/shop/ShopSelector";
import { getMyShops } from "@/server/actions/shops";
import { updateOrderShop } from "@/server/actions/orders";
```

Inside the component, add state and handler (after existing state declarations):
```tsx
const [shopSelectorOpen, setShopSelectorOpen] = useState(false);
const [changingShop, setChangingShop] = useState(false);

const { data: myShops = [] } = useQuery({
  queryKey: ["my-shops"],
  queryFn: () => getMyShops(),
  enabled: order.status === "PENDING",
});

async function handleChangeShop(shopId: string) {
  setChangingShop(true);
  const result = await updateOrderShop(order.id, shopId);
  setChangingShop(false);
  if (!result.success) {
    toast.error(result.error);
    return;
  }
  toast.success("Delivery shop updated");
  setShopSelectorOpen(false);
  // Reload the page to reflect the change
  window.location.reload();
}
```

Find the shop/address display block in the component. After the shop address line (and only when `order.status === "PENDING"`), add:
```tsx
{order.status === "PENDING" && (
  <Button
    size="sm"
    variant="outline"
    className="mt-2 h-7 text-xs"
    disabled={changingShop}
    onClick={() => setShopSelectorOpen(true)}
  >
    {changingShop ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
    Change delivery shop
  </Button>
)}
```

At the end of the component's JSX (before the closing tag), add:
```tsx
<ShopSelector
  shops={myShops}
  value={order.shopId}
  onChange={handleChangeShop}
  open={shopSelectorOpen}
  onOpenChange={setShopSelectorOpen}
/>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(shop\)/orders/\[id\]/OrderDetailClient.tsx
git commit -m "feat: change delivery shop on PENDING orders"
```

---

### Task 9: Orders list — show shop name per order

**Files:**
- Modify: `src/app/(shop)/shop/orders/page.tsx`

- [ ] **Step 1: Add shop name badge to each order card**

In the order card render, find where the order header/title is shown and add the shop name. Look for the order status badge section and add after it:

```tsx
{order.shop?.name && (
  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
    <MapPin className="h-3 w-3" /> {order.shop.name}
  </span>
)}
```

Add `MapPin` to the import from `lucide-react`.

The `Order` type already includes `shop` with `name`, so no type changes are needed.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(shop\)/shop/orders/page.tsx
git commit -m "feat: show shop name on each order card in orders list"
```

---

### Task 10: Profile page — My Shops section

**Files:**
- Modify: `src/app/(shop)/shop/profile/page.tsx`

- [ ] **Step 1: Replace single-shop display with My Shops list**

At the top of the file, update imports to add:
```tsx
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import { ShopLocationForm, type LocationValue } from "@/components/shop/ShopLocationForm";
import { getMyShops, addShop, updateMyShop, deleteMyShop, type MyShop } from "@/server/actions/shops";
```

Add a new `AddEditShopDialog` component before the page component:

```tsx
const shopFormSchema = z.object({
  name:      z.string().min(2, "Shop name required"),
  ownerName: z.string().min(2, "Owner name required"),
  phone:     z.string().min(7, "Phone required"),
});
type ShopFormFields = z.infer<typeof shopFormSchema>;

function AddEditShopDialog({
  open, onClose, initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: MyShop | null; // null = add, non-null = edit
}) {
  const qc = useQueryClient();
  const [location, setLocation] = useState<LocationValue | null>(
    initial ? { address: initial.address, latitude: initial.latitude, longitude: initial.longitude } : null
  );

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<ShopFormFields>({
    resolver: zodResolver(shopFormSchema),
    defaultValues: initial
      ? { name: initial.name, ownerName: initial.ownerName, phone: initial.phone }
      : { name: "", ownerName: "", phone: "" },
  });

  useEffect(() => {
    if (open) {
      reset(initial
        ? { name: initial.name, ownerName: initial.ownerName, phone: initial.phone }
        : { name: "", ownerName: "", phone: "" }
      );
      setLocation(initial
        ? { address: initial.address, latitude: initial.latitude, longitude: initial.longitude }
        : null
      );
    }
  }, [open, initial, reset]);

  async function onSubmit(data: ShopFormFields) {
    if (!location) { toast.error("Please set a location"); return; }
    const payload = { ...data, ...location };

    const result = initial
      ? await updateMyShop({ shopId: initial.id, ...payload })
      : await addShop(payload);

    if (!result.success) { toast.error(result.error); return; }
    toast.success(initial ? "Shop updated" : "Shop added!");
    qc.invalidateQueries({ queryKey: ["my-shops"] });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Shop" : "Add New Shop"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Shop name *</Label>
            <Input {...register("name")} placeholder="Yunusobod Market" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Owner name *</Label>
            <Input {...register("ownerName")} placeholder="Akbar Karimov" />
            {errors.ownerName && <p className="text-xs text-destructive">{errors.ownerName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Phone *</Label>
            <Input {...register("phone")} placeholder="+998 90 123 45 67" />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>
          <ShopLocationForm value={location} onChange={setLocation} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : initial ? "Save Changes" : "Add Shop"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

In `ProfilePage`, replace `getMyShop` usage with `getMyShops`:

```tsx
const [editShop, setEditShop] = useState<MyShop | null>(null);
const [addOpen, setAddOpen] = useState(false);
const [deleteTarget, setDeleteTarget] = useState<MyShop | null>(null);

const { data: shops = [], isLoading: shopsLoading } = useQuery({
  queryKey: ["my-shops"],
  queryFn: () => getMyShops(),
});
```

Replace Section 1 (header card) with:

```tsx
<Section delay={0}>
  <div className="rounded-2xl bg-card border border-border shadow-sm p-5 space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold text-base">My Shops</h3>
      <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="gap-1 h-8">
        <Plus className="h-3.5 w-3.5" /> Add Shop
      </Button>
    </div>
    {shopsLoading ? (
      <div className="space-y-2">
        {[1, 2].map((k) => <Skeleton key={k} className="h-16 rounded-xl" />)}
      </div>
    ) : shops.length === 0 ? (
      <p className="text-sm text-muted-foreground text-center py-4">
        No shops yet. Add your first shop.
      </p>
    ) : (
      <div className="space-y-2">
        {shops.map((shop) => (
          <div key={shop.id} className="rounded-xl border bg-background p-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm">{shop.name}</p>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  shop.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                }`}>
                  {shop.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" /> {shop.address}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button type="button" onClick={() => setEditShop(shop)}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent transition-colors">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button type="button" onClick={() => setDeleteTarget(shop)}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
</Section>
```

Add delete confirmation dialog and new shop dialogs before `</div>` at the end:

```tsx
<AddEditShopDialog
  open={addOpen || !!editShop}
  onClose={() => { setAddOpen(false); setEditShop(null); }}
  initial={editShop}
/>

<AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
      <AlertDialogDescription>
        This cannot be undone. The shop and its past orders history will be preserved, but you won't be able to place new orders with it.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        className="bg-red-600 hover:bg-red-700 text-white"
        onClick={async () => {
          if (!deleteTarget) return;
          const result = await deleteMyShop(deleteTarget.id);
          if (!result.success) { toast.error(result.error); return; }
          toast.success("Shop deleted");
          qc.invalidateQueries({ queryKey: ["my-shops"] });
          setDeleteTarget(null);
        }}
      >
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(shop\)/shop/profile/page.tsx
git commit -m "feat: My Shops section on profile with add/edit/delete"
```

---

### Task 11: Shop layout — fix pending screen for multi-shop

**Files:**
- Modify: `src/app/(shop)/layout.tsx`

- [ ] **Step 1: Update pending screen message**

The layout already checks `session.user.shopActive`. With our auth change, this is now true if any shop is active. The only case this shows is if the user has zero active shops. Update the message:

```tsx
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
```

**Note:** After adding the first shop and the session JWT not yet refreshed, the user may need to sign out and back in once. This is expected JWT behavior.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(shop\)/layout.tsx
git commit -m "feat: update shop layout pending screen for multi-shop"
```

---

### Task 12: Admin shops page — New badge + Edit shop

**Files:**
- Modify: `src/app/(admin)/admin/shops/page.tsx`

- [ ] **Step 1: Add New badge, Edit button, and admin edit dialog**

Update imports to add:
```tsx
import { adminUpdateShop, type AdminUpdateShopInput } from "@/server/actions/shops";
import { Pencil } from "lucide-react";
```

Add an `AdminEditShopDialog` component:

```tsx
function AdminEditShopDialog({ shop, onClose }: { shop: Shop & { latitude: number; longitude: number }; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: shop.name,
    ownerName: shop.ownerName,
    phone: shop.phone,
    address: shop.address,
    latitude: String(shop.latitude),
    longitude: String(shop.longitude),
  });
  const [busy, setBusy] = useState(false);

  function field(k: keyof typeof form) {
    return {
      value: form[k],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [k]: e.target.value })),
    };
  }

  async function handleSave() {
    setBusy(true);
    const result = await adminUpdateShop({
      shopId: shop.id,
      name: form.name,
      ownerName: form.ownerName,
      phone: form.phone,
      address: form.address,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
    });
    setBusy(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Shop updated");
    qc.invalidateQueries({ queryKey: ["shops"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Shop — {shop.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {(["name", "ownerName", "phone", "address", "latitude", "longitude"] as const).map((k) => (
            <div key={k} className="space-y-1">
              <Label className="capitalize">{k}</Label>
              <Input {...field(k)} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Add state for edit dialog in the main component:
```tsx
const [editingShop, setEditingShop] = useState<(typeof filtered)[number] | null>(null);
```

In the table row actions cell, add the Edit button before the block/approve button:
```tsx
<Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingShop(shop)}>
  <Pencil className="h-3.5 w-3.5" />
</Button>
```

For the "New" badge, add after the shop name in the first cell:
```tsx
{Date.now() - new Date(shop.createdAt).getTime() < 24 * 60 * 60 * 1000 && (
  <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
    NEW
  </span>
)}
```

At the bottom of the component JSX, add:
```tsx
{editingShop && (
  <AdminEditShopDialog shop={editingShop} onClose={() => setEditingShop(null)} />
)}
```

Add missing imports: `Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Label, Loader2` from shadcn/ui.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(admin\)/admin/shops/page.tsx
git commit -m "feat: admin shops - New badge, Edit dialog for coordinates/details"
```

---

### Task 13: Verify — type check and manual smoke test

- [ ] **Step 1: Run TypeScript compiler**

```bash
cd ikiwi-next
npx tsc --noEmit
```

Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 2: Start the dev server and test manually**

```bash
npm run dev
```

Test checklist:
1. Sign in as a shop owner → profile page shows "My Shops" section with "+ Add Shop"
2. Add a new shop → GPS and map pin work, shop appears in list with "Active" badge
3. Admin receives notification in bell icon
4. Go to cart → "Deliver to" selector shows the new shop
5. Select a shop, place order → order appears in orders list with shop name
6. Open order detail → "Change delivery shop" button visible
7. Change shop → order updates, button disappears on refresh
8. Admin goes to `/admin/shops` → new shop shows "NEW" badge, Edit button opens dialog

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: multi-shop per customer - complete implementation"
```
