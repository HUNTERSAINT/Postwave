"use client";

import { useEffect, useState } from "react";

type Limits = { accounts: number; postsPerMonth: number | null; scheduling: boolean };
type Pricing = {
  currency: string;
  rateFetchedAt: string;
  prices: { free: number; pro: number; business: number };
  usdPrices: { free: number; pro: number; business: number };
  limits: { free: Limits; pro: Limits; business: Limits };
  trialDays: number;
  supportedCurrencies: string[];
};

const STORAGE_KEY = "postwave-currency";

function money(value: number, currency: string) {
  if (value === 0) return "Free";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: currency === "NGN" ? 0 : 2 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function features(limits: Limits) {
  return [
    `${limits.accounts} connected accounts`,
    limits.postsPerMonth === null ? "Unlimited posts" : `${limits.postsPerMonth} posts per month`,
    limits.scheduling ? "Post scheduling and calendar" : "Publish now",
    "Facebook, Instagram, Threads, LinkedIn, X and more",
  ];
}

export function PricingClient() {
  const [currency, setCurrency] = useState("NGN");
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setCurrency(saved);
    } catch { /* storage can be unavailable */ }
  }, []);

  useEffect(() => {
    let live = true;
    setError("");
    fetch(`/api/pricing?currency=${encodeURIComponent(currency)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Could not load prices.");
        if (live) setPricing(payload);
      })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : "Could not load prices."); });
    return () => { live = false; };
  }, [currency]);

  const plans = pricing ? [
    { key: "free" as const, name: "Free", blurb: "Try Postwave with the essentials." },
    { key: "pro" as const, name: "Pro", blurb: "For creators who post every week.", highlight: true },
    { key: "business" as const, name: "Business", blurb: "For growing brands and small teams." },
  ] : [];

  return (
    <main className="min-h-screen bg-[#f5f9fa] px-4 py-10 text-[#17364c] sm:px-7">
      <div className="mx-auto max-w-5xl">
        <a href="/" className="text-sm font-semibold text-[#287c91] hover:underline">← Postwave</a>
        <div className="mt-6 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight">One post. Every platform.</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[#718696]">
            Start with a {pricing?.trialDays ?? 7}-day Pro trial. No card required. Move to the Free plan any time and nothing is deleted.
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <label className="grid gap-1 text-xs font-semibold text-[#587285]">Show prices in
            <select
              value={currency}
              onChange={(event) => {
                setCurrency(event.target.value);
                try { window.localStorage.setItem(STORAGE_KEY, event.target.value); } catch { /* ignore */ }
              }}
              className="h-10 rounded-xl border border-[#d8e6eb] bg-white px-3 text-sm"
            >
              {(pricing?.supportedCurrencies ?? ["NGN", "USD", "GBP", "EUR", "GHS", "KES", "ZAR"]).map((code) => <option key={code}>{code}</option>)}
            </select>
          </label>
        </div>

        {error && <div role="alert" className="mt-5 rounded-xl border border-[#f0c9c1] bg-[#fff5f2] p-3 text-center text-sm text-[#a34c3d]">{error}</div>}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {plans.map((plan) => pricing && (
            <article key={plan.key} className={`rounded-2xl border bg-white p-6 shadow-sm ${plan.highlight ? "border-[#176f98] ring-2 ring-[#176f98]/15" : "border-[#dce8eb]"}`}>
              <p className="text-sm font-bold text-[#388b91]">{plan.name}{plan.highlight ? " · Most popular" : ""}</p>
              <p className="mt-3 text-3xl font-extrabold">{money(pricing.prices[plan.key], currency)}{pricing.prices[plan.key] > 0 && <span className="text-sm font-medium text-[#8397a2]"> / 30 days</span>}</p>
              <p className="mt-1 text-xs text-[#8397a2]">{pricing.usdPrices[plan.key] > 0 ? `$${pricing.usdPrices[plan.key]} USD base price` : "Always free"}</p>
              <p className="mt-3 text-sm text-[#557184]">{plan.blurb}</p>
              <ul className="mt-5 grid gap-2 text-sm text-[#557184]">{features(pricing.limits[plan.key]).map((item) => <li key={item}>✓ {item}</li>)}</ul>
              <a href="/signup" className={`mt-6 block rounded-xl px-4 py-3 text-center text-sm font-bold ${plan.highlight ? "bg-[#176f98] text-white hover:bg-[#125c7d]" : "border border-[#d8e6eb] text-[#315064]"}`}>
                {plan.key === "free" ? "Start free" : `Try ${plan.name} free for ${pricing.trialDays} days`}
              </a>
            </article>
          ))}
        </div>

        {pricing && (
          <p className="mt-6 text-center text-xs leading-5 text-[#8397a2]">
            Prices converted at today&apos;s rate. Rate as of {new Date(pricing.rateFetchedAt).toLocaleDateString()}.
            Plans are priced in USD; the amount you pay is shown in your currency at checkout and locked for 15 minutes.
          </p>
        )}
        <p className="mt-10 text-center text-xs text-[#8397a2]">
          <a className="hover:underline" href="/privacy">Privacy</a> · <a className="hover:underline" href="/terms">Terms</a> · <a className="hover:underline" href="/data-deletion">Data deletion</a>
        </p>
        <p className="mt-3 text-center text-xs text-[#8397a2]">Postwave by Mazi Saint Concepts</p>
      </div>
    </main>
  );
}
