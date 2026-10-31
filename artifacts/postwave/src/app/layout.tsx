import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import { LaunchSplash } from "@/components/launch-splash";
import { DM_Sans, Manrope } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-dm-sans", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "Postwave — One post. Every platform.",
  description: "Publish across your social platforms with Postwave by Mazi Saint Concepts.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Postwave", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#0d9b98" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${manrope.variable}`}>
      <body><LaunchSplash />{children}<PwaRegister /></body>
    </html>
  );
}
