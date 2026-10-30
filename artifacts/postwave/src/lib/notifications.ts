import { and, eq } from "drizzle-orm";
import { notificationEvents } from "@/db/schema";
import { appUrl, escapeHtml, sendTransactionalEmail } from "@/lib/auth/email";
import type { getDatabase } from "@/lib/db";

type Database = ReturnType<typeof getDatabase>["db"];

type EmailContent = {
  subject: string;
  /** Plain-text paragraphs. Each entry becomes one paragraph. */
  paragraphs: string[];
  action?: { label: string; path: string };
};

function render(name: string, content: EmailContent) {
  const url = content.action ? appUrl(content.action.path) : null;
  const text = [
    `Hi ${name},`,
    ...content.paragraphs,
    ...(content.action && url ? [`${content.action.label}: ${url}`] : []),
    "Postwave by Mazi Saint Concepts",
  ].join("\n\n");
  const html = [
    `<p>Hi ${escapeHtml(name)},</p>`,
    ...content.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    ...(content.action && url
      ? [
          `<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#176f98;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none">${escapeHtml(content.action.label)}</a></p>`,
        ]
      : []),
    `<p style="color:#718796;font-size:12px">Postwave by Mazi Saint Concepts</p>`,
  ].join("");
  return { text, html };
}

/**
 * Sends one email per (user, key). The key is claimed before sending so two
 * workers never send the same email, and released again if delivery fails so
 * the next run can retry.
 */
export async function sendEmailOnce(
  db: Database,
  user: { id: string; email: string; name: string },
  eventKey: string,
  content: EmailContent,
) {
  const [claimed] = await db
    .insert(notificationEvents)
    .values({ userId: user.id, eventKey })
    .onConflictDoNothing()
    .returning({ id: notificationEvents.id });
  if (!claimed) return false;

  try {
    const { text, html } = render(user.name, content);
    await sendTransactionalEmail({
      to: user.email,
      subject: content.subject,
      text,
      html,
    });
    return true;
  } catch (error) {
    await db
      .delete(notificationEvents)
      .where(
        and(
          eq(notificationEvents.userId, user.id),
          eq(notificationEvents.eventKey, eventKey),
        ),
      );
    throw error;
  }
}

/** Sends an email that is not de-duplicated (receipts, admin notices). */
export async function sendEmail(
  user: { email: string; name: string },
  content: EmailContent,
) {
  const { text, html } = render(user.name, content);
  await sendTransactionalEmail({
    to: user.email,
    subject: content.subject,
    text,
    html,
  });
}
