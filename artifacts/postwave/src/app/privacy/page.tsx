import type { Metadata } from "next";
import { LegalLayout, supportContact } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "Privacy Policy — Postwave",
  description: "How Postwave by Mazi Saint Concepts collects, uses and protects your data.",
};

export default function PrivacyPage() {
  const contact = supportContact();
  return (
    <LegalLayout title="Privacy Policy">
      <p>Postwave is operated by Mazi Saint Concepts (&ldquo;we&rdquo;, &ldquo;us&rdquo;). This policy explains what personal data Postwave collects, why, who we share it with, and the choices you have. We handle personal data in line with the Nigeria Data Protection Act 2023 and similar laws that apply to you.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> your name, email address and a securely hashed password. We never store your password in readable form.</li>
        <li><strong>Connected social accounts:</strong> the platform, username, display name and profile link of accounts you connect. Login tokens for those platforms are held by our publishing provider (Zernio, formerly Late), not by Postwave.</li>
        <li><strong>Your content:</strong> post text, images and videos you upload, schedules, drafts, and the publishing status and any error for each platform.</li>
        <li><strong>Billing data:</strong> your plan, payment references, amounts, currency, exchange rate used and a reusable payment authorization reference from Paystack. Card numbers are entered on Paystack&rsquo;s pages and never reach our servers.</li>
        <li><strong>Security and abuse-prevention data:</strong> one-way hashes of your email, IP address and device details, used only to stop repeated free-trial abuse. We also keep short-term request counters for rate limiting.</li>
        <li><strong>Operational data:</strong> sign-in sessions and the emails we send you (verification, trial and billing notices).</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run Postwave: sign you in, publish and schedule your posts, and show your history and analytics.</li>
        <li>To bill you, apply your plan&rsquo;s limits and send receipts and plan notices.</li>
        <li>To protect the service from abuse, fraud and unauthorized access.</li>
        <li>To respond to support requests and meet legal obligations.</li>
      </ul>
      <p>We do not sell your personal data and we do not use your posts to train AI models.</p>

      <h2>Who we share it with</h2>
      <p>We use trusted providers to deliver the service. They process data only for that purpose:</p>
      <ul>
        <li><strong>Zernio (Late):</strong> connects to your social accounts and publishes your posts.</li>
        <li><strong>The social platforms you choose</strong> (such as Facebook, Instagram, Threads, LinkedIn and X): they receive the posts you publish and are governed by their own policies.</li>
        <li><strong>Paystack:</strong> processes card payments.</li>
        <li><strong>Resend:</strong> sends our emails.</li>
        <li><strong>Railway and an S3-compatible storage provider:</strong> host our application, database and uploaded media.</li>
        <li><strong>An exchange-rate provider:</strong> receives no personal data; we only fetch public rates.</li>
      </ul>
      <p>We may also disclose data when the law requires it or to protect our rights and users.</p>

      <h2>How long we keep it</h2>
      <p>We keep your data while your account is active. When you ask us to delete your account we remove your personal data within 30 days, except records we must keep for tax, accounting or legal reasons, such as payment records. Posts already published on social platforms stay there until you remove them on those platforms.</p>

      <h2>Security</h2>
      <p>We use encrypted connections, hashed passwords, single-use verification links, per-user data separation and access controls. No system is perfectly secure, so please use a strong, unique password.</p>

      <h2>Your rights</h2>
      <p>You can ask us to access, correct, export or delete your personal data, to restrict or object to certain processing, and to withdraw consent where we rely on it. You can also complain to the Nigeria Data Protection Commission. To delete your data, see our <a className="font-semibold text-[#287c91] underline" href="/data-deletion">data deletion page</a>.</p>

      <h2>Children</h2>
      <p>Postwave is not meant for anyone under 18. If you believe a child has given us personal data, contact us and we will delete it.</p>

      <h2>Changes</h2>
      <p>We may update this policy. We will post the new version here with a new date, and tell you by email if the changes are significant.</p>

      <h2>Contact</h2>
      <p>Questions about privacy? Contact us at {contact.email ? <a className="font-semibold text-[#287c91] underline" href={`mailto:${contact.email}`}>{contact.text}</a> : contact.text}.</p>
    </LegalLayout>
  );
}
