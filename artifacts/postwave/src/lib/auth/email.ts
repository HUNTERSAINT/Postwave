import { HttpError } from "@/lib/http";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export function appUrl(path: string, request?: Request) {
  const apiPrefix = process.env.NEXT_PUBLIC_API_PREFIX ?? "";
  const resolvedPath =
    apiPrefix && path.startsWith("/api/")
      ? `${apiPrefix}${path}`
      : path;
  const configured = process.env.APP_URL;
  if (configured) {
    const base = new URL(configured);
    return new URL(resolvedPath, base).toString();
  }
  if (process.env.NODE_ENV === "production") {
    throw new HttpError(503, "APP_URL is not configured.");
  }
  return new URL(resolvedPath, request?.url ?? "http://localhost:3000").toString();
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[character] ?? character;
  });
}

export async function sendTransactionalEmail(message: EmailMessage) {
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new HttpError(
      503,
      "Transactional email is not configured. Add EMAIL_API_KEY and EMAIL_FROM.",
    );
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, ...message }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new HttpError(503, "Email delivery is temporarily unavailable.");
  }

  if (!response.ok) {
    throw new HttpError(503, "Email delivery is temporarily unavailable.");
  }
}
