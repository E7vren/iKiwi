import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme        = "light" | "dark" | "system";
export type TextSize     = "small" | "medium" | "large";
export type ImageQuality = "high" | "medium" | "low";

export interface NotifSettings {
  push:         boolean;
  email:        boolean;
  sms:          boolean;
  orderUpdates: boolean;
  priceChanges: boolean;
  promotions:   boolean;
}

interface SettingsState {
  theme:        Theme;
  textSize:     TextSize;
  imageQuality: ImageQuality;
  notifications: NotifSettings;
}

interface SettingsActions {
  setTheme:        (v: Theme) => void;
  setTextSize:     (v: TextSize) => void;
  setImageQuality: (v: ImageQuality) => void;
  setNotif:        (key: keyof NotifSettings, value: boolean) => void;
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      theme:        "system",
      textSize:     "medium",
      imageQuality: "high",
      notifications: {
        push:         true,
        email:        true,
        sms:          false,
        orderUpdates: true,
        priceChanges: true,
        promotions:   false,
      },
      setTheme:        (theme)        => set({ theme }),
      setTextSize:     (textSize)     => set({ textSize }),
      setImageQuality: (imageQuality) => set({ imageQuality }),
      setNotif: (key, value) =>
        set((s) => ({ notifications: { ...s.notifications, [key]: value } })),
    }),
    { name: "ikiwi-settings" }
  )
);
