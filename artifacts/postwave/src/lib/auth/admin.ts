import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { HttpError } from "@/lib/http";

function configuredAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Server-side admin check, used by every /api/admin route. The role is read
 * from the database on each request, never from the browser.
 *
 * Emails listed in ADMIN_EMAILS are promoted to the admin role the first time
 * they sign in with a verified email, which is how the first admin is created.
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role === "admin") return user;

  if (configuredAdminEmails().includes(user.email.toLowerCase())) {
    const { db } = getDatabase();
    await db
      .update(users)
      .set({ role: "admin", updatedAt: new Date() })
      .where(eq(users.id, user.id));
    return { ...user, role: "admin" as const };
  }
  throw new HttpError(403, "Admin access required.");
}
