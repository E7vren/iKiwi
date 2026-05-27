/**
 * iKiwi shared animation presets.
 * Use these constants for motion props to keep transitions consistent
 * across the whole app.
 */

export const animations = {
  // Full-page entrance (fade up)
  pageEnter: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2, ease: "easeOut" },
  },

  // Staggered list wrapper
  listContainer: {
    animate: { transition: { staggerChildren: 0.04 } },
  },

  // Individual list items (used as variants)
  listItem: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
  },

  // whileTap press feedback for interactive cards / rows
  tap: { scale: 0.97 },

  // whileTap for small buttons (tighter press)
  buttonTap: { scale: 0.94 },

  // Heart icon pop — use as animate prop when toggled
  heartPop: { scale: [1, 1.42, 1] },

  // Section stagger delays (ms converted to seconds)
  sectionDelay: (index: number) => ({ delay: index * 0.06 }),

  // Spring config used across the app
  spring: { type: "spring" as const, stiffness: 300, damping: 30 },
  springBouncy: { type: "spring" as const, stiffness: 340, damping: 24 },
} as const;
