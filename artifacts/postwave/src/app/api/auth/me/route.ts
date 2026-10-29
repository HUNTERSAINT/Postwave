import { errorResponse, jsonResponse } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.emailVerifiedAt) return jsonResponse({ user: null });
    return jsonResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        timezone: user.timezone,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
