import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { auditLog, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin";
import { getDatabase } from "@/lib/db";
import { errorResponse, jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const { db } = getDatabase();
    const admins = alias(users, "admins");
    const rows = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        plan: auditLog.plan,
        duration: auditLog.duration,
        note: auditLog.note,
        createdAt: auditLog.createdAt,
        adminEmail: admins.email,
        userEmail: users.email,
      })
      .from(auditLog)
      .innerJoin(admins, eq(auditLog.adminId, admins.id))
      .innerJoin(users, eq(auditLog.userId, users.id))
      .orderBy(desc(auditLog.createdAt))
      .limit(100);
    return jsonResponse({ entries: rows });
  } catch (error) {
    return errorResponse(error);
  }
}
