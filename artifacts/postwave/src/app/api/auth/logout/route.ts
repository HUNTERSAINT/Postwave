import { destroySession } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await destroySession();
    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
