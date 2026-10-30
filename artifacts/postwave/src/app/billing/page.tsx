"use client";

import { useEffect, useState } from "react";

type Plan = {
  plan: string;
  planStatus: string;
  planSource: string;
  billingCurrency?: string | null;
  billingNextChargeAt?: string | null;
  billingPaused?: boolean;
  grantExpiresAt?: string | null;
  trialDaysRemaining?: number;
};

type CurrencyPayload = {
  currency: string;
  rate: number;
  rateFetchedAt: string;
  prices: { free: number; pro: number; business: number };
  supportedCurrencies: string[];
};

const checkoutCurrencies = ["NGN", "USD", "GHS", "ZAR", "KES"];

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: currency === "NGN" ? 0 : 2 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

export default function BillingPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [currency, setCurrency] = useState("NGN");
  const [prices, setPrices] = useState<CurrencyPayload | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [planResponse, currencyResponse] = await Promise.all([
        fetch("/api/plan", { credentials: "include" }),
        fetch("/api/currency", { credentials: "include" }),
      ]);
      const planData = await planResponse.json();
      const currencyData = await currencyResponse.json();
      if (!planResponse.ok) throw new Error(planData.message || "Could not load your plan.");
      if (!currencyResponse.ok) throw new Error(currencyData.message || "Could not load pricing.");
      setPlan(planData.plan);
      const initial = checkoutCurrencies.includes(currencyData.currency) ? currencyData.currency : "NGN";
      setCurrency(initial);
      if (initial === currencyData.currency) setPrices(currencyData);
      else await loadPrices(initial);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load billing details.");
    }
  }

  async function loadPrices(value: string) {
    const response = await fetch("/api/currency", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency: value }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Could not update currency.");
    setPrices(payload);
  }

  useEffect(() => { void load(); }, []);

  async function checkout(targetPlan: "pro" | "business") {
    setBusy(targetPlan);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan, currency }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Could not start checkout.");
      window.location.assign(payload.authorizationUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
      setBusy("");
    }
  }

  async function cancelRenewal() {
    if (!window.confirm("Cancel automatic renewal? Your paid access will remain until the current billing period ends.")) return;
    setBusy("cancel");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/billing/cancel", { method: "POST", credentials: "include" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Could not cancel renewal.");
      setMessage(payload.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel renewal.");
    } finally {
      setBusy("");
    }
  }

  const isPaid = Boolean(plan?.planSource === "paid" && plan.plan !== "free");
  return (
    <main className="min-h-screen bg-[#f5f9fa] px-4 py-10 text-[#17364c] sm:px-7">
      <div className="mx-auto max-w-4xl">
        <a href="/dashboard" className="text-sm font-semibold text-[#287c91] hover:underline">← Back to Postwave</a>
        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#388b91]">Account</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Plans & billing</h1>
          <p className="mt-2 text-sm text-[#718696]">Choose the plan that fits your publishing workflow.</p>
        </div>

        {error && <div role="alert" className="mt-5 rounded-xl border border-[#f0c9c1] bg-[#fff5f2] p-3 text-sm text-[#a34c3d]">{error}</div>}
        {message && <div role="status" className="mt-5 rounded-xl border border-[#b9e4d9] bg-[#effaf6] p-3 text-sm text-[#246c5b]">{message}</div>}

        <section className="mt-7 rounded-2xl border border-[#dce8eb] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#8397a2]">Your current plan</p>
              <p className="mt-1 text-xl font-extrabold capitalize">{plan?.plan ?? "Loading…"}</p>
              <p className="mt-1 text-xs text-[#718696]">{plan?.planStatus ?? ""} · {plan?.planSource === "admin_grant" ? "Complimentary access" : plan?.planSource ?? ""}</p>
              {plan?.planSource === "admin_grant" && <p className="mt-2 inline-block rounded-full bg-[#effaf6] px-3 py-1 text-xs font-bold text-[#246c5b]">Granted by Postwave · {plan.grantExpiresAt ? `until ${new Date(plan.grantExpiresAt).toLocaleDateString()}` : "no end date"}</p>}
              {plan?.planSource === "trial" && <p className="mt-2 inline-block rounded-full bg-[#f0f8fb] px-3 py-1 text-xs font-bold text-[#346a80]">Free Pro trial · {plan.trialDaysRemaining ?? 0} days left</p>}
            </div>
            {isPaid && <button disabled={busy !== ""} onClick={() => void cancelRenewal()} className="rounded-xl border border-[#d8e6eb] px-4 py-2.5 text-sm font-semibold text-[#48677a] disabled:opacity-50">{busy === "cancel" ? "Cancelling…" : "Cancel renewal"}</button>}
          </div>
          {isPaid && plan?.billingNextChargeAt && <p className="mt-3 text-xs text-[#718696]">Next renewal: {new Date(plan.billingNextChargeAt).toLocaleString()}</p>}
        </section>

        <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold">Available plans</h2>
            <p className="mt-1 text-sm text-[#718696]">Prices are converted from USD with the current exchange-rate buffer.</p>
          </div>
          <label className="grid gap-1 text-xs font-semibold text-[#587285]">Payment currency
            <select value={currency} onChange={(event) => {
              const value = event.target.value;
              setCurrency(value);
              setBusy("currency");
              void loadPrices(value).catch((e) => setError(e instanceof Error ? e.message : "Currency update failed.")).finally(() => setBusy(""));
            }} className="h-10 rounded-xl border border-[#d8e6eb] bg-white px-3 text-sm">
              {checkoutCurrencies.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {([
            { key: "pro" as const, name: "Pro", usd: "$10", features: ["Up to 5 connected accounts", "Unlimited posts", "Post scheduling", "Publishing calendar"] },
            { key: "business" as const, name: "Business", usd: "$25", features: ["Up to 15 connected accounts", "Unlimited posts", "Post scheduling", "Built for growing teams"] },
          ]).map((item) => (
            <article key={item.key} className="rounded-2xl border border-[#dce8eb] bg-white p-6 shadow-sm">
              <p className="text-sm font-bold text-[#388b91]">{item.name}</p>
              <p className="mt-3 text-3xl font-extrabold">{prices ? money(prices.prices[item.key], currency) : "—"}<span className="text-sm font-medium text-[#8397a2]"> / 30 days</span></p>
              <p className="mt-1 text-xs text-[#8397a2]">{item.usd} USD base price · exchange-rate buffer included</p>
              <ul className="mt-5 grid gap-2 text-sm text-[#557184]">{item.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
              <button disabled={busy !== "" || isPaid} onClick={() => void checkout(item.key)} className="mt-6 w-full rounded-xl bg-[#176f98] px-4 py-3 text-sm font-bold text-white hover:bg-[#125c7d] disabled:cursor-not-allowed disabled:opacity-50">{busy === item.key ? "Opening secure checkout…" : isPaid ? "Current subscription active" : `Choose ${item.name}`}</button>
            </article>
          ))}
        </div>
        <p className="mt-6 text-xs leading-5 text-[#8397a2]">Payments are processed securely by Paystack. Card checkout is used for automatic monthly renewal. If your card does not support reusable authorization, your plan will remain active for the paid period and then return to Free. You can cancel renewal at any time.</p>
        <p className="mt-8 text-center text-xs text-[#8397a2]">Postwave by Mazi Saint Concepts</p>
      </div>
    </main>
  );
}
