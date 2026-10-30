import type { Metadata } from "next";
import { PricingClient } from "@/components/pricing-client";

export const metadata: Metadata = {
  title: "Pricing — Postwave",
  description:
    "Simple Postwave plans for publishing to every social platform. Start with a free Pro trial, no card required.",
};

export default function PricingPage() {
  return <PricingClient />;
}
