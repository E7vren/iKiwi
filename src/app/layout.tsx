import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";
import { ThemeController } from "@/components/shared/ThemeController";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
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
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body className={`${inter.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <ThemeController />
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: { borderRadius: "0.75rem" },
            }}
            richColors
          />
        </Providers>
      </body>
    </html>
  );
}
