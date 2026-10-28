import { sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { errorResponse, jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { db } = getDatabase();
    await db.execute(sql`select 1`);
    return jsonResponse({ status: "ok" });
  } catch (error) {
    const response = errorResponse(error);
    return Response.json(
      { status: "unavailable" },
      { status: response.status },
    );
  }
}
