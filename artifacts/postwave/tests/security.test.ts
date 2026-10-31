import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { verifyPaystackSignature } from "@/lib/billing/paystack";
import { isDisposableEmail, normalizeEmailForTrial, requestFingerprint, trialDays } from "@/lib/trial";

test("passwords verify only with the right password and are salted", async () => {
  const first = await hashPassword("correct horse battery");
  const second = await hashPassword("correct horse battery");
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("correct horse battery", first), true);
  assert.equal(await verifyPassword("wrong password", first), false);
});

test("malformed password hashes are rejected, not thrown", async () => {
  assert.equal(await verifyPassword("x", ""), false);
  assert.equal(await verifyPassword("x", "salt:abcd"), false);
  assert.equal(await verifyPassword("x", "a:b:c"), false);
});

test("paystack signature must match the raw body", () => {
  process.env.PAYSTACK_SECRET_KEY = "sk_test_unit";
  const body = JSON.stringify({ event: "charge.success" });
  const good = createHmac("sha512", "sk_test_unit").update(body).digest("hex");
  assert.equal(verifyPaystackSignature(body, good), true);
  assert.equal(verifyPaystackSignature(`${body} `, good), false);
  assert.equal(verifyPaystackSignature(body, "00"), false);
});

test("trial abuse helpers collapse aliases and flag disposable inboxes", () => {
  assert.equal(normalizeEmailForTrial("A.B.C+promo@Gmail.com"), "abc@gmail.com");
  assert.equal(normalizeEmailForTrial("abc@googlemail.com"), "abc@gmail.com");
  assert.equal(isDisposableEmail("x@mailcatch.com"), true);
  assert.equal(isDisposableEmail("x@sub.mailcatch.com"), true);
  assert.equal(isDisposableEmail("x@example.com"), false);
});

test("trial length is bounded and falls back to 7 days", () => {
  const original = process.env.TRIAL_LENGTH_DAYS;
  process.env.TRIAL_LENGTH_DAYS = "14";
  assert.equal(trialDays(), 14);
  process.env.TRIAL_LENGTH_DAYS = "9999";
  assert.equal(trialDays(), 7);
  process.env.TRIAL_LENGTH_DAYS = "abc";
  assert.equal(trialDays(), 7);
  if (original === undefined) delete process.env.TRIAL_LENGTH_DAYS; else process.env.TRIAL_LENGTH_DAYS = original;
});

test("request fingerprints never contain the raw IP and need AUTH_SECRET", () => {
  process.env.AUTH_SECRET = "x".repeat(40);
  const request = new Request("https://example.com", { headers: { "x-forwarded-for": "203.0.113.9" } });
  const fingerprint = requestFingerprint(request);
  assert.doesNotMatch(JSON.stringify(fingerprint), /203\.0\.113\.9/);
  assert.match(fingerprint.ipHash, /^[a-f0-9]{64}$/);
  delete process.env.AUTH_SECRET;
  assert.throws(() => requestFingerprint(request));
});
