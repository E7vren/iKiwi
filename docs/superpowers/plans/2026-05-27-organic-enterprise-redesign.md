# Organic Enterprise Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the entire iKiwi app (admin, shop, driver, warehouse panels) to match the "Organic Enterprise" design system defined in `Design.md`.

**Architecture:** All design tokens live in `src/app/globals.css` CSS custom properties; component files (`button.tsx`, `card.tsx`, `input.tsx`, Sidebar, shells) use those tokens via Tailwind utility classes. Tasks flow from tokens → components → shells/layouts, so each task's changes cascade cleanly into the next.

**Tech Stack:** Next.js 15 App Router, Tailwind v4 (`@import "tailwindcss"`), shadcn/ui (Base UI primitives), `next/font/google`, `class-variance-authority`, Hanken Grotesk typeface.

---

## Design Reference (Design.md Summary)

Key values to implement:

| Token | Value |
|---|---|
| Primary (buttons/CTAs) | `#98d62d` bg / `#3b5900` text |
| Primary (focus rings/accents) | `#456800` |
| Background | `#f1fbff` |
| Card surface | `#ffffff` |
| Body text | `#131d21` |
| Muted text | `#586062` |
| Muted surface | `#e4f0f4` |
| Border | `#c2cab0` |
| Error | `#ba1a1a` |
| Font | Hanken Grotesk (400/500/600/700) |
| Border radius DEFAULT | 8px (`0.5rem`) |
| Card radius | 16px (`1rem`) |
| Sidebar width | 260px |
| Card shadow | `0px 4px 20px rgba(0,0,0,0.05)` |

---

## Files Modified

| File | What changes |
|---|---|
| `src/app/layout.tsx` | Replace Inter/Geist with Hanken Grotesk |
| `src/app/globals.css` | Full token overhaul: colors, typography, radius, shadows |
| `src/components/ui/button.tsx` | Verify default variant uses new primary tokens |
| `src/components/ui/card.tsx` | Replace `ring-1` with Design.md shadow + 16px radius |
| `src/components/ui/input.tsx` | Lime ring on focus, bg from surface token |
| `src/components/admin/Sidebar.tsx` | 260px width, vertical accent bar active state |
| `src/app/(admin)/layout.tsx` | Surface-container bg for header |
| `src/app/(admin)/admin/page.tsx` | Metric card: charcoal icon square + data-display type |
| `src/components/shop/TopBar.tsx` | Token-aware classes |
| `src/components/shop/BottomNav.tsx` | Update FAB shadow color |
| `src/app/(warehouse)/WarehouseShell.tsx` | No structural change — tokens already used |
| `src/app/(driver)/DriverShell.tsx` | No structural change — tokens already used |

---

## Task 1: Add Hanken Grotesk Font

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace font imports**

Open `src/app/layout.tsx`. Replace the existing font imports and variables:

```tsx
import type { Metadata, Viewport } from "next";
import { Geist_Mono, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";
import { ThemeController } from "@/components/shared/ThemeController";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "iKiwi — Fresh Fruits & Vegetables", template: "%s | iKiwi" },
  description: "B2B fresh produce delivery for shops in Uzbekistan",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#456800",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", hanken.variable)}>
      <body className={`${geistMono.variable} antialiased`}>
        <Providers>
          <ThemeController />
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: { borderRadius: "0.5rem" },
            }}
            richColors
          />
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/User/Desktop/ikiwi-next
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing ones unrelated to this file).

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(design): switch font to Hanken Grotesk"
```

---

## Task 2: Update Light Mode CSS Tokens

**Files:**
- Modify: `src/app/globals.css` (the `:root { … }` block, lines 120–153)

- [ ] **Step 1: Replace the `:root` block**

Find and replace the entire `:root { … }` block (currently lines 120–153) with:

```css
:root {
  --background:           #f1fbff;
  --foreground:           #131d21;
  --card:                 #ffffff;
  --card-foreground:      #131d21;
  --popover:              #ffffff;
  --popover-foreground:   #131d21;
  --primary:              #98d62d;
  --primary-foreground:   #3b5900;
  --secondary:            #dae1e3;
  --secondary-foreground: #131d21;
  --muted:                #e4f0f4;
  --muted-foreground:     #586062;
  --accent:               #eaf5fa;
  --accent-foreground:    #131d21;
  --destructive:          #ba1a1a;
  --destructive-foreground: #ffffff;
  --border:               #c2cab0;
  --input:                #eaf5fa;
  --ring:                 #456800;
  --radius:               0.5rem;
  --sidebar:              #f1fbff;
  --sidebar-foreground:   #131d21;
  --sidebar-primary:      #456800;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent:       #e4f0f4;
  --sidebar-accent-foreground: #131d21;
  --sidebar-border:       #c2cab0;
  --sidebar-ring:         #456800;
  /* chart tokens — green scale matching brand */
  --chart-1:              #98d62d;
  --chart-2:              #6da823;
  --chart-3:              #456800;
  --chart-4:              #334f00;
  --chart-5:              #1e3000;
}
```

- [ ] **Step 2: Start dev server and verify light mode appearance**

```bash
cd C:/Users/User/Desktop/ikiwi-next
npx next dev --port 3001
```

Open `http://localhost:3001/login`. Background should be a very light blue-tinted white (`#f1fbff`). Any primary-colored element (buttons, active states) should show lime green.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): organic enterprise light mode tokens"
```

---

## Task 3: Update Dark Mode CSS Tokens

**Files:**
- Modify: `src/app/globals.css` (the `.dark { … }` block, currently lines 156–189)

- [ ] **Step 1: Replace the `.dark` block**

Find and replace the entire `.dark { … }` block with:

```css
.dark {
  /* Organic Enterprise dark palette — derived from inverse tokens */
  --background:           #0e1a1f;
  --foreground:           #e7f3f7;
  --card:                 #172025;
  --card-foreground:      #e7f3f7;
  --popover:              #1c282e;
  --popover-foreground:   #e7f3f7;
  --primary:              #9bd930;
  --primary-foreground:   #1a3200;
  --secondary:            #2b3b40;
  --secondary-foreground: #c6d9de;
  --muted:                #1f2e34;
  --muted-foreground:     #8aa7b0;
  --accent:               #1f2e34;
  --accent-foreground:    #e7f3f7;
  --destructive:          #f28b82;
  --destructive-foreground: #1a0000;
  --border:               oklch(1 0 0 / 12%);
  --input:                oklch(1 0 0 / 10%);
  --ring:                 #9bd930;
  --sidebar:              #111c21;
  --sidebar-foreground:   #e7f3f7;
  --sidebar-primary:      #9bd930;
  --sidebar-primary-foreground: #1a3200;
  --sidebar-accent:       #1f2e34;
  --sidebar-accent-foreground: #e7f3f7;
  --sidebar-border:       oklch(1 0 0 / 12%);
  --sidebar-ring:         #9bd930;
  --chart-1:              #9bd930;
  --chart-2:              #76b820;
  --chart-3:              #567d15;
  --chart-4:              #3a550e;
  --chart-5:              #203009;
}
```

- [ ] **Step 2: Verify dark mode**

In the running dev server, switch to dark mode via the ThemeToggle. Background should be `#0e1a1f` (very dark charcoal with slight blue-green tint). Lime green primary should be slightly brighter (`#9bd930`) for contrast on dark surfaces.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): organic enterprise dark mode tokens"
```

---

## Task 4: Update @theme Block, Typography, Radius, and Shadows

**Files:**
- Modify: `src/app/globals.css` (top `@theme { … }` block, lines 7–39; `@theme inline { … }` block lines 77–118; `@layer utilities` block lines 204–222)

- [ ] **Step 1: Replace the `@theme { … }` brand block**

Find the `@theme {` block (lines 7–39) and replace it entirely:

```css
@theme {
  /* Organic Enterprise brand tokens */
  --color-primary:           #98d62d;
  --color-primary-dark:      #456800;
  --color-primary-foreground:#3b5900;
  --color-background:        #f1fbff;
  --color-surface:           #ffffff;
  --color-surface-low:       #eaf5fa;
  --color-surface-container: #e4f0f4;
  --color-border:            #c2cab0;
  --color-muted:             #586062;
  --color-foreground:        #131d21;
  --color-error:             #ba1a1a;
  --color-success:           #456800;
  --color-warning:           #e07b00;

  /* Typography */
  --font-sans: var(--font-sans);
  --font-mono: var(--font-geist-mono);

  /* Radius — Design.md scale */
  --radius-sm:   0.25rem;
  --radius-md:   0.75rem;
  --radius-lg:   1rem;
  --radius-xl:   1.5rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-card:     0px 4px 20px rgba(0,0,0,0.05);
  --shadow-elevated: 0px 8px 32px rgba(0,0,0,0.10);
}
```

- [ ] **Step 2: Replace the `@layer utilities` typography block**

Find the `@layer utilities { … }` block (lines 203–222) and replace it:

```css
/* ─── Organic Enterprise typography scale ──────────────────────────────────── */
@layer utilities {
  /* 32px / 700 / -0.01em — large numeric values, metrics */
  .text-data-display {
    font-size: 2rem; font-weight: 700; line-height: 2.5rem;
    letter-spacing: -0.01em;
  }
  /* 28px / 700 / -0.02em — hero headings */
  .text-headline-lg {
    font-size: 1.75rem; font-weight: 700; line-height: 2.25rem;
    letter-spacing: -0.02em;
  }
  /* 20px / 700 — page titles */
  .text-headline-md {
    font-size: 1.25rem; font-weight: 700; line-height: 1.75rem;
  }
  /* 16px / 600 — section headings, card titles */
  .text-headline-sm {
    font-size: 1rem; font-weight: 600; line-height: 1.5rem;
  }
  /* 16px / 400 — primary body text */
  .text-body-lg {
    font-size: 1rem; line-height: 1.5rem;
  }
  /* 14px / 400 — secondary body text */
  .text-body-md {
    font-size: 0.875rem; line-height: 1.25rem;
  }
  /* 14px / 600 — emphasized labels, nav items */
  .text-label-lg {
    font-size: 0.875rem; font-weight: 600; line-height: 1.25rem;
  }
  /* 12px / 500 — small labels, section headers */
  .text-label-md {
    font-size: 0.75rem; font-weight: 500; line-height: 1rem;
    letter-spacing: 0.03125rem;
  }

  /* ── Legacy aliases (kept for backward compat) ── */
  .text-display   { @apply text-data-display; }
  .text-h1        { @apply text-headline-lg; }
  .text-h2        { @apply text-headline-md; }
  .text-h3        { @apply text-headline-sm; }
  .text-body      { @apply text-body-lg; }
  .text-body-sm   { @apply text-body-md; }
  .text-label     { @apply text-label-md; }
  .text-caption   { font-size: 0.6875rem; }
}
```

- [ ] **Step 3: Update the `@theme inline` block's radius lines**

In the `@theme inline { … }` block, find these lines:

```css
  --radius-sm:           calc(var(--radius) * 0.6);
  --radius-md:           calc(var(--radius) * 0.8);
  --radius-lg:           var(--radius);
  --radius-xl:           calc(var(--radius) * 1.4);
  --radius-2xl:          calc(var(--radius) * 1.8);
  --radius-3xl:          calc(var(--radius) * 2.2);
  --radius-4xl:          calc(var(--radius) * 2.6);
```

Replace them with fixed values matching Design.md. **Also add `--radius: 0.5rem;` before them** so that the Tailwind `rounded` (no suffix) utility resolves to 8px — used by buttons and inputs:

```css
  --radius:              0.5rem;    /* button / input radius = 8px */
  --radius-sm:           0.25rem;
  --radius-md:           0.75rem;
  --radius-lg:           1rem;      /* card radius = 16px */
  --radius-xl:           1.5rem;
  --radius-2xl:          2rem;
  --radius-3xl:          2.5rem;
  --radius-4xl:          3rem;
```

- [ ] **Step 4: Update `html[data-text-size]` font-size rules**

The text-size rules should stay as-is (they scale the base font size). Verify they still exist in the file:

```css
html[data-text-size="small"]  { font-size: 14px; }
html[data-text-size="medium"] { font-size: 16px; }
html[data-text-size="large"]  { font-size: 18px; }
```

- [ ] **Step 5: Verify build compiles**

```bash
cd C:/Users/User/Desktop/ikiwi-next
npx tsc --noEmit 2>&1 | head -20
```

Expected: exit 0 (no type errors from CSS changes).

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): typography scale, radius, shadow tokens"
```

---

## Task 5: Update Card Component

**Files:**
- Modify: `src/components/ui/card.tsx`

Card spec from Design.md:
- White background (`bg-card`)
- **16px corner radius** — use `rounded-lg` which maps to `--radius-lg: 1rem` = 16px ✓
- **Shadow:** `0px 4px 20px rgba(0,0,0,0.05)` — replace current `ring-1 ring-foreground/10`
- 1px border `border-border` for definition in flat environments

- [ ] **Step 1: Update Card component**

Replace the entire `src/components/ui/card.tsx` with:

```tsx
import type * as React from "react";
import { cn } from "@/lib/utils";

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-4 overflow-hidden rounded-lg bg-card py-4 text-sm text-card-foreground",
        "border border-border/60 shadow-[0px_4px_20px_rgba(0,0,0,0.05)]",
        "has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0",
        "data-[size=sm]:gap-3 data-[size=sm]:py-3",
        "*:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-lg px-4 group-data-[size=sm]/card:px-3",
        "has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        "has-data-[slot=card-description]:grid-rows-[auto_auto]",
        "[.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "text-headline-sm leading-snug group-data-[size=sm]/card:text-body-md group-data-[size=sm]/card:font-semibold",
        className
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-body-md text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-4 group-data-[size=sm]/card:px-3", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-lg border-t border-border/60 bg-muted/40 p-4 group-data-[size=sm]/card:p-3",
        className
      )}
      {...props}
    />
  );
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "feat(design): card — 16px radius, ambient shadow"
```

---

## Task 6: Update Button Component Radius

**Files:**
- Modify: `src/components/ui/button.tsx`

Design.md: "Buttons & Inputs: Use a **8px (0.5rem) radius** for a sturdy, professional feel."

The current button uses `rounded-lg` everywhere. After Task 4, `--radius-lg: 1rem` = 16px — too round for buttons. Change to `rounded` = `var(--radius)` = 8px for all sizes.

Also verify: `bg-primary text-primary-foreground` on the `default` variant will automatically pick up `#98d62d` bg and `#3b5900` text from the updated tokens — no change needed to the variant string.

- [ ] **Step 1: Update button.tsx**

Replace the entire `src/components/ui/button.tsx` with:

```tsx
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs:  "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm:  "h-7 gap-1 px-3 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg:  "h-10 gap-1.5 px-5 text-base",
        icon:    "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat(design): button — 8px radius, updated sizes"
```

---

## Task 7: Update Input Component Focus State

**Files:**
- Modify: `src/components/ui/input.tsx`

Design.md says: "Focus state should use a Lime Green border and a soft outer glow."
The `--ring` variable is now `#456800` (dark olive) but the glow should be lime (`#98d62d`).
We fix focus to use lime ring.

- [ ] **Step 1: Update input.tsx**

Replace the entire `src/components/ui/input.tsx` with:

```tsx
import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded border border-input bg-input px-3 py-1.5 text-body-md transition-colors outline-none",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "placeholder:text-muted-foreground/70",
        // Focus: lime green border + soft lime glow
        "focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/25",
        // Disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-50",
        // Invalid
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        // Dark adjustments
        "dark:bg-input/20 dark:border-border/60",
        "dark:focus-visible:border-primary dark:focus-visible:ring-primary/30",
        className
      )}
      {...props}
    />
  );
}

export { Input };
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/input.tsx
git commit -m "feat(design): input — lime green focus ring, surface bg"
```

---

## Task 8: Update Admin Sidebar

**Files:**
- Modify: `src/components/admin/Sidebar.tsx`

Design.md changes:
- Width: **260px** (currently `w-60` = 240px)
- Active state: vertical lime accent bar on the left + slightly elevated muted bg
- Section label style: `text-label-md`
- Nav icon size matches Design.md (24px icon, 14px label)

- [ ] **Step 1: Update Sidebar.tsx**

Replace the entire file with:

```tsx
"use client";

import {
  Archive,
  ClipboardList,
  History,
  LayoutDashboard,
  LayoutList,
  LogOut,
  MapPin,
  PackageSearch,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Logo } from "@/components/shared/Logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin",            label: "Dashboard",         icon: LayoutDashboard, exact: true },
  { href: "/admin/orders",     label: "Orders",            icon: ClipboardList },
  { href: "/admin/routes",     label: "Routes",            icon: Truck },
  { href: "/admin/staff",      label: "Staff",             icon: Users },
  { href: "/admin/categories", label: "Categories",        icon: LayoutList },
  { href: "/admin/products",   label: "Products & Prices", icon: ShoppingCart },
  { href: "/admin/map",        label: "Map",               icon: MapPin },
  { href: "/admin/shops",      label: "Shops",             icon: Store },
  { href: "/admin/settings",   label: "Settings",          icon: Settings },
];

const warehouseLinks = [
  { href: "/admin/warehouse",         label: "Stock",         icon: Archive,       exact: true },
  { href: "/admin/restock",           label: "Restock Tasks", icon: PackageSearch },
  { href: "/admin/warehouse/history", label: "History",       icon: History },
];

function getInitials(name: string | null | undefined) {
  if (!name) return "A";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function NavLink({ href, label, icon: Icon, exact }: (typeof links)[0]) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-label-lg transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {/* Vertical lime accent bar for active item */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
      )}
      <Icon className="h-5 w-5 shrink-0" />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const { data: session } = useSession();

  return (
    <aside className="hidden md:flex flex-col w-[260px] shrink-0 border-r border-border bg-card h-screen sticky top-0">
      <div className="px-5 py-4 border-b border-border">
        <Logo size={32} />
        <p className="text-label-md text-muted-foreground mt-0.5 ml-0.5">Admin Panel</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {links.map((link) => (
          <NavLink key={link.href} {...link} />
        ))}
        <div className="pt-4">
          <p className="px-3 pb-1.5 text-label-md uppercase tracking-wider text-muted-foreground/70">
            Warehouse
          </p>
          {warehouseLinks.map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
        </div>
      </nav>

      <div className="px-3 pb-4 border-t border-border pt-3 space-y-3">
        {session?.user && (
          <div className="flex items-center gap-2.5 px-1">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/15 text-primary-dark text-xs font-bold">
                {getInitials(session.user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-label-lg truncate">{session.user.name}</p>
              <p className="text-label-md text-muted-foreground truncate">{session.user.email}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-label-lg text-muted-foreground hover:bg-destructive/8 hover:text-destructive transition-colors"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

// Mobile bottom nav for admin
export function AdminBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card">
      <div className="flex overflow-x-auto">
        {[...links, ...warehouseLinks].map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 flex-col items-center gap-0.5 px-3 py-2 text-[9px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {label.split(" ")[0]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Verify sidebar visually**

In the dev server at `http://localhost:3001/admin`, confirm:
- Sidebar is 260px wide
- Active link has a small lime-green vertical bar on the left edge
- Inactive links show `text-muted-foreground`, hover gives subtle muted bg

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/Sidebar.tsx
git commit -m "feat(design): admin sidebar — 260px, vertical accent bar"
```

---

## Task 9: Update Admin Layout Header

**Files:**
- Modify: `src/app/(admin)/layout.tsx`

Design.md: header uses `surface-container` (`#e4f0f4` / `--muted`) to separate from the white card bg.

- [ ] **Step 1: Update admin layout.tsx**

Replace the current file content:

```tsx
import { redirect } from "next/navigation";
import { AdminBottomNav, Sidebar } from "@/components/admin/Sidebar";
import { NotifBell } from "@/components/shared/NotifBell";
import { ThemeToggleIcon } from "@/components/shared/ThemeToggle";
import { auth } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "COMPANY_ADMIN") redirect("/admin");

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-1 border-b border-border bg-card px-6 shadow-[0px_1px_4px_rgba(0,0,0,0.04)]">
          <ThemeToggleIcon />
          <NotifBell />
        </header>
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto pb-20 md:pb-6">{children}</main>
        <AdminBottomNav />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(admin\)/layout.tsx
git commit -m "feat(design): admin layout — card bg header, ambient shadow"
```

---

## Task 10: Update Admin Dashboard Metric Cards

**Files:**
- Modify: `src/app/(admin)/admin/page.tsx`

Design.md metric card spec:
- "White background, 16px corner radius." → `Card` component handles this now
- "Features a **prominent icon in a charcoal-tinted square** on the left." → `bg-foreground/10 text-foreground` icon container, 12px radius
- "**Large data-display typography** for the main value." → `.text-data-display` class (32px/700)
- "With smaller **'vs yesterday' comparison text** below." → `.text-label-md text-muted-foreground`

The current `StatCard` has colored icon backgrounds (`bg-green-50 text-green-600`). Replace with a unified charcoal-tinted icon style.

- [ ] **Step 1: Update the `StatCard` component inside `admin/page.tsx`**

Find the `StatCard` function (starting around line 55) and replace it with:

```tsx
function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  trend?: number;
  color?: string; // kept for compat, ignored
}) {
  const trendUp   = trend !== undefined && trend >= 0;
  const trendDown = trend !== undefined && trend < 0;

  return (
    <Card className="border-0">
      <CardContent className="flex items-start gap-4 pt-4">
        {/* Charcoal icon square — 12px radius per Design.md */}
        <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/8 text-foreground">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-label-md text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
          <p className="text-data-display leading-none">{value}</p>
          {sub && (
            <p className="text-label-md text-muted-foreground mt-1 flex items-center gap-1">
              {trendUp   && <TrendingUp   className="h-3.5 w-3.5 text-primary shrink-0" />}
              {trendDown && <TrendingDown className="h-3.5 w-3.5 text-destructive shrink-0" />}
              {sub}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

Also remove the `colors` object (lines ~70–76 in original) since it's no longer used.

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Check dashboard visually**

At `http://localhost:3001/admin`, metric cards should show:
- Large bold numbers (`text-data-display` = 32px/700)
- Charcoal icon box (subtle dark bg, dark icon)
- Muted trend label below the value

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/admin/page.tsx"
git commit -m "feat(design): admin metric cards — charcoal icon, data-display type"
```

---

## Task 11: Update Shop TopBar

**Files:**
- Modify: `src/components/shop/TopBar.tsx`

The TopBar is mostly token-based already. Update the avatar button to use `primary-container` tone correctly, and use `headline-sm` for profile initials.

- [ ] **Step 1: Update TopBar.tsx**

Replace the entire file:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/shared/Logo";
import { ThemeToggleIcon } from "@/components/shared/ThemeToggle";
import { cn } from "@/lib/utils";

interface Props {
  userName: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TopBar({ userName }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 bg-background border-b border-transparent transition-all duration-200",
        scrolled
          ? "border-border shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_8px_rgba(0,0,0,0.25)]"
          : ""
      )}
    >
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        <Link href="/shop" aria-label="Go to catalog">
          <Logo size={32} />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggleIcon />
          <Link
            href="/shop/profile"
            className="h-9 w-9 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
            aria-label="Profile"
          >
            <span className="text-primary-foreground text-sm font-bold leading-none tracking-wide">
              {initials(userName)}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shop/TopBar.tsx
git commit -m "feat(design): shop TopBar — design token cleanup"
```

---

## Task 12: Update Shop BottomNav FAB Shadow

**Files:**
- Modify: `src/components/shop/BottomNav.tsx`

The FAB has a hardcoded `rgba(22,163,74,0.4)` shadow (old green). Update to use lime green from new palette.

- [ ] **Step 1: Find and replace the hardcoded shadow in BottomNav.tsx**

Find this line (~line 60):
```tsx
style={{ boxShadow: "0 4px 16px rgba(22,163,74,0.4)" }}
```

Replace with:
```tsx
style={{ boxShadow: "0 4px 16px rgba(152,214,45,0.45)" }}
```

That's `rgba(#98d62d, 0.45)` — the new primary lime green.

- [ ] **Step 2: Commit**

```bash
git add src/components/shop/BottomNav.tsx
git commit -m "feat(design): shop BottomNav FAB — update shadow to lime green"
```

---

## Task 13: Verify All Four Panels

**Files:** No changes — visual verification pass only.

- [ ] **Step 1: Start dev server**

```bash
cd C:/Users/User/Desktop/ikiwi-next
npx next dev --port 3001
```

- [ ] **Step 2: Admin panel checklist**

Visit `http://localhost:3001/admin`. Verify:
- [ ] Background is `#f1fbff` (very light blue-white), not pure white
- [ ] Sidebar is 260px, lime vertical bar on active link
- [ ] Metric cards show 32px bold numbers with charcoal icon boxes
- [ ] Font is visually different from Inter — Hanken Grotesk has slightly wider letterforms
- [ ] Dark mode: toggle ThemeToggle, bg becomes `#0e1a1f`

- [ ] **Step 3: Warehouse panel checklist**

Visit `http://localhost:3001/warehouse`. Verify:
- [ ] Header and bottom nav use `bg-card` (white in light, dark card in dark)
- [ ] Primary accent color on active nav items is lime green

- [ ] **Step 4: Driver panel checklist**

Visit `http://localhost:3001/driver`. Verify:
- [ ] Online/offline toggle is lime green when active
- [ ] Same font/bg tokens as rest of app

- [ ] **Step 5: Shop panel checklist**

Visit `http://localhost:3001/shop`. Verify:
- [ ] Top bar logo + avatar, background `#f1fbff`
- [ ] Bottom nav active indicator is lime `#98d62d`
- [ ] Cart FAB shows lime green with correct shadow color

- [ ] **Step 6: Final TypeScript + build check**

```bash
npx tsc --noEmit 2>&1
npx next build 2>&1 | tail -20
```

Expected: TypeScript exit 0, build completes without errors.

- [ ] **Step 7: Commit any fixups then tag**

```bash
git add -A
git commit -m "feat(design): organic enterprise redesign complete"
```

---

## Summary of Color Mapping

| Role | Light | Dark |
|------|-------|------|
| Page background | `#f1fbff` | `#0e1a1f` |
| Card / surface | `#ffffff` | `#172025` |
| Body text | `#131d21` | `#e7f3f7` |
| Muted text | `#586062` | `#8aa7b0` |
| Primary (buttons, active) | `#98d62d` lime | `#9bd930` |
| Primary text on lime | `#3b5900` | `#1a3200` |
| Focus ring | `#456800` dark olive | `#9bd930` |
| Border | `#c2cab0` | rgba white 12% |
| Muted surface | `#e4f0f4` | `#1f2e34` |
| Error | `#ba1a1a` | `#f28b82` |
