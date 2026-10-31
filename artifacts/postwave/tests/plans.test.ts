import assert from "node:assert/strict";
import test from "node:test";
import { PLAN_LIMITS, resolveEffectivePlan } from "@/lib/plans";
import { countCharacters, platformCharacterLimit } from "@/lib/social/platform-limits";

type U = Parameters<typeof resolveEffectivePlan>[0];
const now = new Date("2026-10-31T12:00:00Z");
const hours = (n: number) => new Date(now.getTime() + n * 3_600_000);
const user = (overrides: Partial<U>): U => ({
  plan: "free", planSource: "free", paidPlan: "free", billingNextChargeAt: null, billingFailedAttempts: 0,
  trialEndsAt: null, grantedAt: null, grantExpiresAt: null, ...overrides,
} as unknown as U);

test("an active admin grant wins and an expired one does not", () => {
  const active = resolveEffectivePlan(user({ planSource: "admin_grant", plan: "business", grantedAt: now, grantExpiresAt: hours(5) }), now);
  assert.equal(active.plan, "business");
  assert.equal(active.source, "admin_grant");
  const expired = resolveEffectivePlan(user({ planSource: "admin_grant", plan: "business", grantedAt: now, grantExpiresAt: hours(-1) }), now);
  assert.equal(expired.plan, "free");
});

test("trials give Pro until they end", () => {
  assert.equal(resolveEffectivePlan(user({ planSource: "trial", trialEndsAt: hours(2) }), now).plan, "pro");
  assert.equal(resolveEffectivePlan(user({ planSource: "trial", trialEndsAt: hours(-2) }), now).plan, "free");
});

test("paid plans need a next charge date and fewer than 3 failed payments", () => {
  const paid = user({ paidPlan: "pro", billingNextChargeAt: hours(100) });
  assert.equal(resolveEffectivePlan(paid, now).plan, "pro");
  assert.equal(resolveEffectivePlan({ ...paid, billingFailedAttempts: 1 }, now).status, "past_due");
  assert.equal(resolveEffectivePlan({ ...paid, billingFailedAttempts: 3 }, now).plan, "free");
  assert.equal(resolveEffectivePlan({ ...paid, billingNextChargeAt: null }, now).plan, "free");
});

test("plan limits only grow with the plan", () => {
  assert.ok(PLAN_LIMITS.free.accounts < PLAN_LIMITS.pro.accounts);
  assert.ok(PLAN_LIMITS.pro.accounts < PLAN_LIMITS.business.accounts);
  assert.equal(PLAN_LIMITS.free.scheduling, false);
});

test("character counting uses code points, not UTF-16 units", () => {
  assert.equal(countCharacters("a😀"), 2);
  assert.equal(platformCharacterLimit("twitter"), 280);
  assert.equal(platformCharacterLimit("nope"), undefined);
});
