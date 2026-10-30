import type { Metadata } from "next";
import { LegalLayout, supportContact } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "Terms of Service — Postwave",
  description: "The terms for using Postwave by Mazi Saint Concepts.",
};

export default function TermsPage() {
  const contact = supportContact();
  return (
    <LegalLayout title="Terms of Service">
      <p>These terms govern your use of Postwave, a service operated by Mazi Saint Concepts (&ldquo;we&rdquo;, &ldquo;us&rdquo;) that lets you connect your social accounts and publish or schedule posts to many platforms at once. By creating an account or using Postwave you agree to them.</p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least 18 and able to enter a binding agreement.</li>
        <li>Give accurate information, verify your email, and keep your password secure. You are responsible for activity on your account.</li>
        <li>You may connect only social accounts you own or are authorized to manage.</li>
      </ul>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not post unlawful, infringing, hateful, deceptive or abusive content, spam, or malware.</li>
        <li>Follow the rules and API terms of each platform you publish to. Platforms may limit, remove or suspend content and accounts, and we are not responsible for their decisions.</li>
        <li>Do not abuse free trials, for example by creating several accounts, or try to bypass plan limits, rate limits or security controls.</li>
        <li>Do not resell or reverse engineer Postwave without our written permission.</li>
      </ul>

      <h2>Plans, trials and pricing</h2>
      <ul>
        <li><strong>Free trial:</strong> new users get a Pro trial (7 days unless we state otherwise) after verifying their email, with no card required. When it ends your account moves to the Free plan. Nothing is deleted, but connected accounts and scheduled posts above the Free limits are paused until you upgrade.</li>
        <li><strong>Prices are set in US dollars.</strong> We show and charge them in your chosen currency, converted at that day&rsquo;s exchange rate plus a small buffer. The amount shown at checkout is locked for 15 minutes. The rate used is shown on your receipt.</li>
        <li><strong>Renewal:</strong> paid plans last 30 days. Where your card allows, we renew automatically at the exchange rate on the renewal day, so the local-currency amount can change between renewals. Failed renewals are retried daily up to three times, after which your account returns to the Free plan.</li>
        <li><strong>Cancellation:</strong> you can cancel automatic renewal on the Billing page at any time. Your paid access continues until the end of the period you paid for.</li>
        <li><strong>Refunds:</strong> payments are generally non-refundable, except where the law requires otherwise or we agree in writing.</li>
        <li><strong>Complimentary plans:</strong> we may grant a plan without payment for a set time or with no end date. We may end a complimentary plan at any time, and it has the same limits as the paid plan.</li>
        <li>We may change plans and prices. We will give notice before a change affects an active paid period.</li>
      </ul>

      <h2>Your content</h2>
      <p>You keep ownership of the content you post. You give us permission to store, process and send it to the platforms you choose, only so we can provide the service. You confirm you have the rights to everything you upload and publish.</p>

      <h2>Third-party services</h2>
      <p>Postwave depends on providers such as Zernio, Paystack and the social platforms. Their availability and rules are outside our control, and publishing can fail or be delayed because of them.</p>

      <h2>Availability and disclaimers</h2>
      <p>We work to keep Postwave reliable, but it is provided &ldquo;as is&rdquo; without guarantees that it will be uninterrupted, error-free, or that a post will publish at an exact time or on every platform. Check your history for the status of each post.</p>

      <h2>Limitation of liability</h2>
      <p>To the fullest extent the law allows, we are not liable for indirect or consequential losses, lost profits, or lost data, and our total liability for any claim is limited to the amount you paid us in the 3 months before the claim. Nothing here limits liability that cannot be limited by law.</p>

      <h2>Suspension and termination</h2>
      <p>You can stop using Postwave and request deletion of your account at any time. We may suspend or end accounts that break these terms, put others at risk, or are used for fraud or abuse.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the Federal Republic of Nigeria, and the courts of Nigeria have jurisdiction, unless the law of your country gives you mandatory rights.</p>

      <h2>Changes and contact</h2>
      <p>We may update these terms and will post the new version here. Continued use after a change means you accept it. Questions? Contact {contact.email ? <a className="font-semibold text-[#287c91] underline" href={`mailto:${contact.email}`}>{contact.text}</a> : contact.text}. See also our <a className="font-semibold text-[#287c91] underline" href="/privacy">Privacy Policy</a>.</p>
    </LegalLayout>
  );
}
