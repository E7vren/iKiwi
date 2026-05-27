"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const SLIDES = [
  {
    emoji: "🥝",
    title: "Welcome to iKiwi",
    description: "Fresh fruits and vegetables, delivered to your shop every morning.",
    bg: "from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/10",
  },
  {
    emoji: "📱",
    title: "Order in minutes",
    description: "Browse our full catalog, add to cart, and place your order — all in under 2 minutes.",
    bg: "from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/10",
  },
  {
    emoji: "🚚",
    title: "Track every step",
    description: "Get real-time updates when your order is prepared, on the way, and delivered.",
    bg: "from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/10",
  },
];

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
};

export default function OnboardingPage() {
  const router = useRouter();
  const [[slide, dir], setSlide] = useState([0, 0]);
  const isLast = slide === SLIDES.length - 1;

  function goTo(next: number, direction: number) {
    if (next < 0 || next >= SLIDES.length) return;
    setSlide([next, direction]);
  }

  function finish() {
    router.push("/login");
  }

  function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    const swipe = Math.abs(info.offset.x) > 60 || Math.abs(info.velocity.x) > 400;
    if (!swipe) return;
    if (info.offset.x < 0 && slide < SLIDES.length - 1) goTo(slide + 1, 1);
    else if (info.offset.x > 0 && slide > 0) goTo(slide - 1, -1);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-hidden">
      {/* Skip */}
      <div className="flex justify-end p-5 pt-safe-top">
        <button
          type="button"
          onClick={finish}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
        >
          Skip
        </button>
      </div>

      {/* Slide area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={slide}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center select-none"
          >
            {/* Illustration circle */}
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.08, type: "spring", stiffness: 260, damping: 22 }}
              className={`w-52 h-52 rounded-full bg-gradient-to-br ${SLIDES[slide].bg} flex items-center justify-center mb-10 shadow-sm border border-white/40 dark:border-white/10`}
            >
              <span className="text-8xl">{SLIDES[slide].emoji}</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="text-2xl font-bold text-foreground mb-3"
            >
              {SLIDES[slide].title}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26 }}
              className="text-[16px] text-muted-foreground leading-relaxed max-w-xs"
            >
              {SLIDES[slide].description}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="px-6 pb-12 space-y-6">
        {/* Dot indicators */}
        <div className="flex justify-center gap-2">
          {SLIDES.map((_, i) => (
            <motion.button
              key={i}
              type="button"
              onClick={() => goTo(i, i > slide ? 1 : -1)}
              animate={{ width: i === slide ? 24 : 8 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`h-2 rounded-full transition-colors ${
                i === slide ? "bg-primary" : "bg-muted-foreground/25"
              }`}
            />
          ))}
        </div>

        {/* CTA */}
        <Button
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-[16px] rounded-2xl"
          onClick={() => (isLast ? finish() : goTo(slide + 1, 1))}
        >
          {isLast ? (
            "Get Started"
          ) : (
            <>
              Next <ChevronRight className="h-4 w-4 ml-1.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
