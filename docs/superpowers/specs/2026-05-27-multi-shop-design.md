# Multi-Shop Per Customer Design

## Goal

Allow one customer account to own multiple shop locations. Each shop has its own address, map pin, and independent order history. Orders are placed per shop — selected at checkout and correctable while still pending.

## Architecture

**Approach:** True multi-shop — remove the one-to-one constraint between `User` and `Shop`. A user has many shops, each fully independent.

---

## Section 1 — Data Model

**Schema change:** Remove `@unique` from `Shop.userId`.

```prisma
model Shop {
  id        String   @id @default(cuid())
  userId    String                          // ← was @unique, now allows many per user
  isActive  Boolean  @default(true)         // true = active (admin can set false to deactivate)
  name      String
  ownerName String
  phone     String
  address   String
  latitude  Decimal  @db.Decimal(9, 6)
  longitude Decimal  @db.Decimal(9, 6)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  orders         Order[]
  favorites      Favorite[]
  orderTemplates OrderTemplate[]
  priceAlerts    PriceAlert[]
}
```

- New shops are created with `isActive = true` (auto-approved)
- Admin can set `isActive = false` to deactivate — customer cannot place new orders with that shop, past orders are preserved
- `session.user.shopId` is removed from the JWT; the active shop is carried through the cart/order flow instead

---

## Section 2 — Cart & Order Flow

### Placing an order

1. Customer fills cart as normal
2. Before the final confirm button, a **"Deliver to"** step shows all their active shops (radio list with name + address)
3. If only one shop exists, it is pre-selected but still displayed
4. A **"Use my location"** button selects the nearest shop by GPS distance
5. Customer taps **Confirm Order** — order is placed with the chosen `shopId`

### Correcting after placing

- On the order detail page, while `status === "PENDING"`, a **"Change delivery shop"** button is shown
- Tapping it opens the same shop selector sheet
- Selecting a different shop updates `order.shopId`
- Once the order moves to `PREPARING` or beyond, the button disappears and the shop is locked

### Orders list

- Each order card in the shop panel shows the shop name it belongs to
- Customer can filter orders by shop

---

## Section 3 — Adding & Managing Shops (Customer Side)

### Profile page

The current single-shop display is replaced by a **"My Shops"** section:
- Lists all shops with name, address, and Active/Inactive badge
- **"+ Add Shop"** button opens the add form
- Each shop has an **Edit** and **Delete** action
  - Delete is only allowed if the shop has no active or pending orders

### Add / Edit shop form

Fields:
- Shop name (required)
- Owner name (required)
- Phone (required)
- Location (required) — set via any of:
  1. **"Use my location"** — browser Geolocation API fills the pin instantly
  2. **Address search** — Mapbox geocoding API, suggestions dropdown, selecting one drops the pin
  3. **Draggable map pin** — always visible, drag to fine-tune after GPS or search sets it

### Auto-approval

- On submit, shop is created with `isActive = true` immediately
- Admin receives a notification: *"New shop added by [user name]: [shop name], [address]. Review in Admin → Shops."*

---

## Section 4 — Admin Side

### Shops list page (`/admin/shops`)

New columns and controls:
- **User** column — email/name of the account that owns the shop
- Shops are filterable by user (search by user name/email)
- Each shop has an **Active toggle** — admin can deactivate at any time
- Admin can **Edit** any shop (name, address, coordinates) to help a customer who set it wrong
- Newly created shops show a **"New"** badge until the admin opens/acknowledges them

### Notification

Admin receives an in-app notification + the existing notification bell when a new shop is auto-approved.

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Remove `@unique` from `Shop.userId` |
| `src/server/actions/shops.ts` | Add `addShop`, `updateMyShop`, `deleteShop`, `getMyShops`, `updateOrderShop` |
| `src/server/actions/orders.ts` | Remove `session.user.shopId` dependency; accept `shopId` param in `placeOrder` |
| `src/lib/auth.ts` | Remove `shopId` from session JWT |
| `src/app/(shop)/shop/cart/page.tsx` | Add "Deliver to" shop selector step before confirm |
| `src/app/(shop)/orders/[id]/OrderDetailClient.tsx` | Add "Change delivery shop" button (PENDING only) |
| `src/app/(shop)/shop/orders/page.tsx` | Show shop name on each order card |
| `src/app/(shop)/shop/profile/page.tsx` | Replace single-shop section with "My Shops" list + Add Shop form |
| `src/components/shop/ShopSelector.tsx` | New — reusable shop picker sheet (used in cart + order detail) |
| `src/components/shop/ShopLocationForm.tsx` | New — add/edit shop form with GPS + map + geocoding |
| `src/app/(admin)/admin/shops/page.tsx` | Add User column, Active toggle, Edit action, New badge |

---

## Error Handling

- If a customer has no active shops when opening the cart → show "Add a shop first" prompt with a link to profile
- If the selected shop gets deactivated by admin between cart and submit → return an error, prompt to select another
- If GPS is denied by the browser → fall back to address search only (GPS button disabled with tooltip)
- Deleting a shop with active/pending orders → blocked with an error message listing the order IDs
