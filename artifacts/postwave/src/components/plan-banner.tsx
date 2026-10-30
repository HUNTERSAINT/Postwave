"use client";

import { useEffect, useState } from "react";

type PlanSummary = {
  plan: string;
  planSource: string;
  trialEndsAt: string | null;
  trialDaysRemaining: number;
  grantExpiresAt: string | null;
  usage: { pausedAccounts: number; pausedPosts: number };
};

const DISMISS_PREFIX = "postwave-banner-dismissed:";

function dismissed(key: string) {
  try { return window.localStorage.getItem(DISMISS_PREFIX + key) === "1"; } catch { return false; }
}
function remember(key: string) {
  try { window.localStorage.setItem(DISMISS_PREFIX + key, "1"); } catch { /* storage can be unavailable */ }
}

function Banner({ tone, children, onDismiss }: { tone: "info" | "warn" | "good"; children: React.ReactNode; onDismiss?: () => void }) {
  const colors = tone === "warn"
    ? "border-[#f0d9a8] bg-[#fff9ea] text-[#7a5a14]"
    : tone === "good"
      ? "border-[#b9e4d9] bg-[#effaf6] text-[#246c5b]"
      : "border-[#cfe3eb] bg-[#f0f8fb] text-[#346a80]";
  return (
    <div role="status" className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${colors}`}>
      <span>{children}</span>
      {onDismiss && <button onClick={onDismiss} aria-label="Dismiss" className="text-xs font-bold opacity-70 hover:opacity-100">Dismiss</button>}
    </div>
  );
}

/** Shows trial countdown, trial-ended and complimentary-plan notices, and paused items. */
export function PlanBanner() {
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    fetch("/api/plan", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => { if (live && payload?.plan) setPlan(payload.plan); })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);

  if (!plan) return null;
  const hide = (key: string) => { remember(key); setTick((value) => value + 1); };
  const upgrade = <a href="/billing" className="font-bold underline">Upgrade</a>;
  const banners: React.ReactNode[] = [];

  if (plan.planSource === "trial") {
    const days = plan.trialDaysRemaining;
    banners.push(
      <Banner key="trial" tone={days <= 2 ? "warn" : "info"}>
        Pro trial: <strong>{days} {days === 1 ? "day" : "days"} left</strong>. {upgrade} to keep scheduling and your extra accounts.
      </Banner>,
    );
  } else if (plan.planSource === "free" && plan.trialEndsAt && new Date(plan.trialEndsAt) < new Date()) {
    const key = `trial-ended:${plan.trialEndsAt}`;
    if (!dismissed(key)) {
      banners.push(
        <Banner key="ended" tone="warn" onDismiss={() => hide(key)}>
          <strong>Your trial has ended</strong> and you are on the Free plan. Nothing was deleted. {upgrade} to restore everything.
        </Banner>,
      );
    }
  } else if (plan.planSource === "admin_grant") {
    banners.push(
      <Banner key="grant" tone="good">
        <strong>Granted by Postwave</strong> · {plan.plan} plan · {plan.grantExpiresAt ? `until ${new Date(plan.grantExpiresAt).toLocaleDateString()}` : "no end date"}
      </Banner>,
    );
  }

  const pausedAccounts = plan.usage.pausedAccounts;
  const pausedPosts = plan.usage.pausedPosts;
  if (pausedAccounts > 0 || pausedPosts > 0) {
    banners.push(
      <Banner key="paused" tone="warn">
        Paused by your plan: {pausedAccounts} connected {pausedAccounts === 1 ? "account" : "accounts"} and {pausedPosts} scheduled {pausedPosts === 1 ? "post" : "posts"}. {upgrade} to resume them.
      </Banner>,
    );
  }

  return <>{banners}</>;
}
