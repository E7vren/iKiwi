import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Locale = "uz" | "en" | "ru";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "uz",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "ikiwi-locale" }
  )
);
