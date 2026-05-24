# iKiwi Production-Readiness Plan

**Date:** 2026-05-24  
**Status:** Approved  
**Phases:** 4  
**Total items:** 33

---

## Context

iKiwi is a B2B produce delivery app. Shops order the day before delivery. The app is functionally complete (warehouse panel, shopping list, driver panel, admin restock) but has critical security gaps, race conditions, and UX rough edges that must be resolved before production.

A full expert review (backend + security + UX) surfaced ~30 issues. This plan resolves them in four prioritised sprints.

---

## Phase 1 — Critical Security & Correctness (11 items)

Must ship before any real users touch the system.

| # | Item | File(s) |
|---|------|---------|
| 1.1 | Rotate DB password + AUTH_SECRET; add `.env`, `.env.local` to `.gitignore` | `.gitignore`, infra |
| 1.2 | Split `generateShoppingList` — writable only by COMPANY_ADMIN / WAREHOUSE_STAFF; DELIVERY_STAFF gets read-only `getShoppingList` | `shopping.ts` |
| 1.3 | Fix `getRestockTasks` role guard — exclude SHOP_OWNER (internal data leakage) | `inventory.ts` |
| 1.4 | Fix `getShoppingList` role guard — restrict to staff roles only | `shopping.ts` |
| 1.5 | Re-check `shopActive` live from DB in `placeOrder` (JWT is stale) | `orders.ts` |
| 1.6 | Add auth check to `getAvailableProducts` | `products.ts` |
| 1.7 | Fix `completeDelivery` null pointer — `order.shop.user?.id` inside `$transaction` | `delivery.ts` |
| 1.8 | Wrap `placeOrder` outer `prisma.order.create()` in `$transaction` | `orders.ts` |
| 1.9 | Fix stock-engine read-modify-write race — use `{ increment/decrement }` Prisma operators | `stock-engine.ts` |
| 1.10 | Move `currentOrder` fetch inside transaction in `updateOrderStatus` (TOCTOU) | `orders.ts` |
| 1.11 | Rate-limit `/api/auth/callback/credentials` login endpoint | `middleware.ts` or route handler |

---

## Phase 2 — Important Correctness & Reliability (7 items)

Bugs that will surface under normal usage.

| # | Item | File(s) |
|---|------|---------|
| 2.1 | Auto-refresh shopping list query after `warehouseLogIncoming` completes | `warehouse/stock/page.tsx` |
| 2.2 | Notification dedup in `generateShoppingList` — only send notifications when `!existingTask` | `shopping.ts` |
| 2.3 | Re-assign button for ASSIGNED restock tasks (currently stuck once assigned) | `admin/restock/page.tsx` |
| 2.4 | Block zero-price item checkout at order submission | `orders.ts`, shop UI |
| 2.5 | Make delivery skip reason required (min 5 chars) in Zod schema | `delivery.ts` validation |
| 2.6 | Fix driver WaitingState flash on first load | driver panel page |
| 2.7 | Fix `supplierPrice` overwrite — use `else if` so `costPerKg` and `costPerPiece` don't clobber each other | `inventory.ts` |

---

## Phase 3 — UX Completeness (8 items)

Features that are missing or confusing for real users.

| # | Item | File(s) |
|---|------|---------|
| 3.1 | Tomorrow's orders tab in warehouse panel (what's coming in) | new warehouse page |
| 3.2 | "I'm on it" claim button on driver shopping list | `driver/shopping/page.tsx` |
| 3.3 | Admin order: date filter + shop search + delivery attribution column | `admin/orders/page.tsx` |
| 3.4 | Partial delivery detail in shop notifications (which items weren't delivered) | notification system |
| 3.5 | Incoming indicator on warehouse stock rows (show last restocked date) | `warehouse/stock/page.tsx` |
| 3.6 | Visible text labels on Count/Incoming icon buttons (not just icons) | `warehouse/stock/page.tsx` |
| 3.7 | Fix hero banner copy — update to reflect day-before ordering model | shop landing |
| 3.8 | All-done screen stop summary (show what was delivered vs ordered) | driver panel |

---

## Phase 4 — Production-Hardened (7 items)

Invisible polish that matters in production.

| # | Item | File(s) |
|---|------|---------|
| 4.1 | Normalize Prisma errors — catch `PrismaClientKnownRequestError`, return generic messages (no table/column leakage) | shared error utility |
| 4.2 | `adminResetPassword`: add `.max(72)` to password Zod schema (bcrypt truncation guard) | auth actions |
| 4.3 | `setActualCostSchema.overridePrice`: add ceiling validation (e.g. `z.number().max(100_000_000)`) | delivery schema |
| 4.4 | Audit log for price overrides — record who changed what and when | delivery actions |
| 4.5 | `getShoppingList`: return `ActionResult<...>` instead of throwing on auth failure | `shopping.ts` |
| 4.6 | Add `.env.example` with all required keys documented (`CRON_SECRET`, `PUSHER_*`, `AUTH_SECRET`, `DATABASE_URL`) | root |
| 4.7 | Add structured error logging (`console.error` with context) to `completeDelivery` and `warehouseLogIncoming` catch blocks | `delivery.ts`, `inventory.ts` |

---

## Implementation Order

Phases are sequential — don't start Phase 2 until Phase 1 is complete and verified.

Within each phase, items can be parallelised except where one depends on another (e.g. 1.8 and 1.9 both touch order/stock flow and should be reviewed together).

## Verification Approach

- TypeScript: `tsc --noEmit` must pass after each phase
- Manual smoke test per phase: place order → stock mutation → shopping list generation → driver receives notification
- Phase 1 security items: verify with direct API calls that guarded endpoints reject unauthorized roles

## Out of Scope

- Automated test suite (separate effort)
- Mobile app / native wrapper
- Payment gateway integration
- Multi-tenant / multi-branch support
