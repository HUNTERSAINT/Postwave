import type { ReactNode } from "react";

export const LEGAL_UPDATED = "October 30, 2026";

export function supportContact() {
  const email = process.env.SUPPORT_EMAIL;
  return email
    ? { email, text: email }
    : { email: null, text: "the support email address shown in your Postwave account emails" };
}

export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f5f9fa] px-4 py-10 text-[#17364c] sm:px-7">
      <article className="mx-auto max-w-3xl rounded-2xl border border-[#dce8eb] bg-white p-6 shadow-sm sm:p-10">
        <a href="/" className="text-sm font-semibold text-[#287c91] hover:underline">← Postwave</a>
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 text-xs text-[#8397a2]">Last updated {LEGAL_UPDATED}</p>
        <div className="mt-6 space-y-4 text-sm leading-6 text-[#33556a] [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:text-[#17364c] [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
          {children}
        </div>
        <p className="mt-10 border-t border-[#e2edf0] pt-5 text-center text-xs text-[#8397a2]">
          <a className="hover:underline" href="/pricing">Pricing</a> · <a className="hover:underline" href="/privacy">Privacy</a> · <a className="hover:underline" href="/terms">Terms</a> · <a className="hover:underline" href="/data-deletion">Data deletion</a>
          <br />Postwave by Mazi Saint Concepts
        </p>
      </article>
    </main>
  );
}
