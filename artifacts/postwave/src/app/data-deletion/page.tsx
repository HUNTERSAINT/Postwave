import type { Metadata } from "next";
import { LegalLayout, supportContact } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "Data Deletion — Postwave",
  description: "How to delete your Postwave account and data, including data received through Facebook, Instagram and Threads.",
};

export default function DataDeletionPage() {
  const contact = supportContact();
  const mail = contact.email ? <a className="font-semibold text-[#287c91] underline" href={`mailto:${contact.email}?subject=Postwave%20data%20deletion%20request`}>{contact.text}</a> : contact.text;
  return (
    <LegalLayout title="Data Deletion">
      <p>You can ask us to delete your Postwave account and the personal data we hold about you at any time. This page also serves as the data deletion instructions for people who connected Facebook, Instagram or Threads accounts through Postwave.</p>

      <h2>Option 1: Disconnect accounts yourself, right now</h2>
      <ul>
        <li>Sign in and open <a className="font-semibold text-[#287c91] underline" href="/accounts">Accounts</a>, then choose <strong>Disconnect</strong> on each connected account. This revokes Postwave&rsquo;s access to that social account through our publishing provider.</li>
        <li>You can also remove Postwave from your Facebook, Instagram, Threads, LinkedIn or X settings (Apps and websites / Connected apps). That cuts off access immediately.</li>
      </ul>

      <h2>Option 2: Delete your account and data</h2>
      <p>Email {mail} from the address you registered with, with the subject &ldquo;Postwave data deletion request&rdquo;. If you cannot use that address, tell us and we will verify your identity another way.</p>
      <p>We will:</p>
      <ul>
        <li>disconnect your social accounts and remove your publishing profile;</li>
        <li>delete your account, drafts, posts, history and uploaded media;</li>
        <li>cancel any automatic renewal; and</li>
        <li>confirm by email once it is done, within 30 days of verifying your request.</li>
      </ul>

      <h2>What we may keep</h2>
      <p>We may keep payment and invoice records for as long as tax, accounting or other laws require, and one-way hashes used to stop repeated free-trial abuse. These do not let us identify you from the hash alone. Posts already published on a social platform remain there until you delete them on that platform.</p>

      <p>See our <a className="font-semibold text-[#287c91] underline" href="/privacy">Privacy Policy</a> for more on how we handle data.</p>
    </LegalLayout>
  );
}
