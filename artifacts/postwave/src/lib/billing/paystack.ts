import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "@/lib/http";

type PaystackEnvelope<T> = {
  status: boolean;
  message?: string;
  data: T;
};

export type PaystackTransaction = {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  paid_at?: string | null;
  authorization?: {
    authorization_code?: string;
    reusable?: boolean;
  };
  customer?: {
    customer_code?: string;
    email?: string;
  };
};

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new HttpError(503, "Paystack billing is not configured.");
  }
  return key;
}

async function paystackRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown } = {},
) {
  const response = await fetch(`https://api.paystack.co${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  }).catch(() => {
    throw new HttpError(503, "Paystack is temporarily unavailable.");
  });
  const payload = (await response.json().catch(() => null)) as
    | PaystackEnvelope<T>
    | null;
  if (!response.ok || !payload?.status) {
    throw new HttpError(502, "Paystack could not complete the request.");
  }
  return payload.data;
}

export function verifyPaystackSignature(rawBody: string, signature: string) {
  const expected = createHmac("sha512", secretKey())
    .update(rawBody)
    .digest("hex");
  const providedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

export function initializePaystackTransaction(input: {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}) {
  return paystackRequest<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>("/transaction/initialize", {
    method: "POST",
    body: {
      email: input.email,
      amount: String(input.amount),
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      channels: ["card"],
    },
  });
}

export function verifyPaystackTransaction(reference: string) {
  return paystackRequest<PaystackTransaction>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
}

export function chargePaystackAuthorization(input: {
  email: string;
  authorizationCode: string;
  amount: number;
  currency: string;
  reference: string;
}) {
  return paystackRequest<PaystackTransaction>(
    "/transaction/charge_authorization",
    {
      method: "POST",
      body: {
        email: input.email,
        authorization_code: input.authorizationCode,
        amount: String(input.amount),
        currency: input.currency,
        reference: input.reference,
      },
    },
  );
}
