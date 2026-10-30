import { jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness probe: confirms the Next.js process can answer HTTP requests. */
export async function GET() {
  return jsonResponse({ status: "alive", timestamp: new Date().toISOString() });
}
