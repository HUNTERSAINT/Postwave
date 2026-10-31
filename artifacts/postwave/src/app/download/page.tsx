import type { Metadata } from "next";
import { DownloadClient } from "@/components/download-client";

export const metadata: Metadata = {
  title: "Get the Postwave app",
  description: "Install Postwave on your phone or computer.",
};

export default function DownloadPage() {
  return <DownloadClient />;
}
