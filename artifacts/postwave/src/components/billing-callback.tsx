"use client";

import { useEffect, useState } from "react";

type State =
  | { status: "checking" }
  | { status: "success" }
  | { status: "pending"; message: string }
  | { status: "error"; message: string };

export function BillingCallback({ reference }: { reference: string }) {
  const [state, setState] = useState<State>({ status: "checking" });

  useEffect(() => {
    let active = true;
    if (!reference) {
      setState({ status: "error", message: "The payment reference is missing." });
      return;
    }
    fetch("/api/billing/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 202) {
          return { status: "pending" as const, message: payload.message || "Your payment is still processing. Refresh this page in a moment." };
        }
        if (!response.ok) throw new Error(payload.message || "We could not verify your payment.");
        if (!payload.paid) throw new Error("Payment has not been confirmed. Please try again shortly.");
        return { status: "success" as const };
      })
      .then((result) => {
        if (active) setState(result);
      })
      .catch((error: unknown) => {
        if (active) setState({ status: "error", message: error instanceof Error ? error.message : "Payment verification failed." });
      });
    return () => { active = false; };
  }, [reference]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f8f9] px-5 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-[#e0eaed] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f5f2] text-2xl text-[#287c72]">
          {state.status === "checking" ? "…" : state.status === "success" ? "✓" : "!"}
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-[#388b91]">Postwave billing</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#17364c]">
          {state.status === "checking" ? "Verifying your payment" : state.status === "success" ? "Payment confirmed" : state.status === "pending" ? "Payment processing" : "Payment not confirmed"}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#718696]">
          {state.status === "checking" ? "Please wait while we confirm your transaction securely with Paystack. Do not close this page." : state.status === "success" ? "Your Postwave plan has been activated. You can return to your dashboard." : state.message}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {state.status === "pending" && <button onClick={() => window.location.reload()} className="rounded-xl border border-[#d8e6eb] px-4 py-2.5 text-sm font-semibold text-[#36576b]">Check again</button>}
          <a href="/dashboard" className="rounded-xl bg-[#176f98] px-5 py-2.5 text-sm font-semibold text-white">Go to Postwave</a>
        </div>
        <p className="mt-8 text-xs text-[#8093a0]">Postwave by Mazi Saint Concepts</p>
      </section>
    </main>
  );
}
