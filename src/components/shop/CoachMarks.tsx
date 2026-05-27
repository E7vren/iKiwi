"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "ikiwi-coach-marks-done";

interface Step {
  emoji: string;
  title: string;
  body: string;
  indicatorStyle: React.CSSProperties;
}

const STEPS: Step[] = [
  {
    emoji: "🔍",
    title: "Search any product",
    body: "Search in Uzbek, Russian, or English — just start typing.",
    indicatorStyle: { top: 76, left: "50%", transform: "translateX(-50%)" },
  },
  {
    emoji: "❤️",
    title: "Save your favourites",
    body: "Tap the heart on any product to save it for quick one-tap reordering.",
    indicatorStyle: { top: "38%", left: "20%" },
  },
  {
    emoji: "🔔",
    title: "Price alerts & order updates",
    body: "This tab shows when your order status changes and when prices drop.",
    indicatorStyle: { bottom: 32, left: "62.5%", transform: "translateX(-50%)" },
  },
  {
    emoji: "🛒",
    title: "Your shopping cart",
    body: "Add products to your cart and a button will appear here. Tap to place your order.",
    indicatorStyle: { bottom: 108, right: 16 },
  },
];

export function CoachMarks() {
  const [step, setStep] = useState(-1);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(() => setStep(0), 1400);
    return () => clearTimeout(t);
  }, []);

  function advance() {
    if (step >= STEPS.length - 1) {
      localStorage.setItem(STORAGE_KEY, "1");
      setStep(-1);
    } else {
      setStep((s) => s + 1);
    }
  }

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setStep(-1);
  }

  if (step < 0) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        key="coach-bg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[100]"
        style={{ background: "rgba(0,0,0,0.65)" }}
      >
        {/* Pulsing indicator */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`indicator-${step}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="absolute pointer-events-none"
            style={current.indicatorStyle}
          >
            <motion.div
              animate={{ scale: [1, 1.35, 1], opacity: [0.9, 0.4, 0.9] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="h-14 w-14 rounded-full bg-primary/25 border-2 border-primary"
            />
          </motion.div>
        </AnimatePresence>

        {/* Info card — sits just above the bottom nav */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`card-${step}`}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.06 }}
            className="absolute bottom-[88px] left-4 right-4 bg-card rounded-2xl shadow-2xl border border-border p-5"
          >
            {/* Top row */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[22px]">{current.emoji}</span>
                <h3 className="text-[15px] font-bold text-foreground leading-tight">
                  {current.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors shrink-0 -mr-1 -mt-1"
                aria-label="Skip tour"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
              {current.body}
            </p>

            {/* Progress + button */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step
                        ? "w-5 bg-primary"
                        : i < step
                        ? "w-1.5 bg-primary/40"
                        : "w-1.5 bg-muted-foreground/20"
                    }`}
                  />
                ))}
              </div>

              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-5 h-8"
                onClick={advance}
              >
                {isLast ? (
                  "Got it 👍"
                ) : (
                  <>
                    Got it <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
