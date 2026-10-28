import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Postwave — One post. Every platform.",
  description: "Publish across your social platforms with Postwave by Mazi Saint Concepts.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
