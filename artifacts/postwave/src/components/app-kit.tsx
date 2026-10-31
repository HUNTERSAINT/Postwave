"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, AtSign, Check, CheckCircle2,
  ChevronDown, CircleAlert, Clock3, ExternalLink, FileImage, Globe2, ImagePlus,
  Instagram, Link2, LoaderCircle, LogOut, Menu, MessageCircle, Music2, Plus, RefreshCw,
  Send, Settings2, ShieldCheck, Sparkles, Trash2, UploadCloud, X, CalendarDays, CreditCard, ChevronLeft,
  ChevronRight, FileText, Save, Clock, BarChart3,
  Video,
} from "lucide-react";

export type Account = { id: string; platform: string; username?: string; displayName?: string; isActive: boolean };
export type MediaAsset = { id: string; key?: string; publicUrl: string; contentType: string; size: number };
export type Target = { platform: string; accountId: string; status: string; errorMessage?: string | null; platformPostUrl?: string | null };
export type Post = { id: string; title?: string | null; content: string; status: string; createdAt: string; scheduledAt?: string | null; timezone?: string; platforms: Target[]; media?: MediaAsset[] };
export type User = { id: string; email: string; name?: string; timezone?: string };
export type ApiError = { message?: string };

export const platforms = ["instagram", "facebook", "threads", "linkedin", "twitter", "tiktok", "youtube", "pinterest", "reddit", "bluesky", "googlebusiness", "telegram", "discord", "slack", "whatsapp"];
export const platformCharacterLimits: Record<string, number> = {
  instagram: 2200, facebook: 63206, threads: 500, linkedin: 3000, twitter: 280,
  tiktok: 2200, youtube: 5000, pinterest: 500, reddit: 40000, bluesky: 300,
  googlebusiness: 1500, telegram: 4096, discord: 2000, slack: 40000, whatsapp: 4096,
};
export const platformRequirements: Record<string, { note: string; met: (hasImage: boolean, hasVideo: boolean) => boolean }> = {
  instagram: { note: "Needs at least one image or video.", met: (i, v) => i || v },
  facebook: { note: "Text, images or a video all work.", met: () => true },
  threads: { note: "Text, images or a video all work. Limit 500 characters.", met: () => true },
  linkedin: { note: "Text, images or a video all work.", met: () => true },
  twitter: { note: "Limit 280 characters. Posts with links cost more to publish.", met: () => true },
  tiktok: { note: "Needs a video or photos.", met: (i, v) => i || v },
  youtube: { note: "Needs a video. Images alone are not accepted.", met: (_i, v) => v },
  pinterest: { note: "Needs an image or video.", met: (i, v) => i || v },
  reddit: { note: "Text or media; the community's own rules apply.", met: () => true },
  bluesky: { note: "Limit 300 characters.", met: () => true },
  googlebusiness: { note: "Text with an optional image.", met: () => true },
  telegram: { note: "Text, images or a video all work.", met: () => true },
  discord: { note: "Text, images or a video all work.", met: () => true },
  slack: { note: "Text, images or a video all work.", met: () => true },
  whatsapp: { note: "Text, images or a video all work.", met: () => true },
};
export const platformNames: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", threads: "Threads", linkedin: "LinkedIn", twitter: "X", tiktok: "TikTok",
  youtube: "YouTube", pinterest: "Pinterest", reddit: "Reddit", bluesky: "Bluesky", googlebusiness: "Google Business",
  telegram: "Telegram", discord: "Discord", slack: "Slack", whatsapp: "WhatsApp",
};

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const apiPrefix = process.env.NEXT_PUBLIC_API_PREFIX || "";
  const response = await fetch(`${apiPrefix}${url}`, {
    ...init,
    credentials: "include",
    headers: { ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as ApiError).message || `Request failed (${response.status})`);
  return payload as T;
}
export function json(body: unknown): RequestInit { return { method: "POST", body: JSON.stringify(body) }; }
export function Brand({ compact = false }: { compact?: boolean }) {
  return <a href="/dashboard" className="inline-flex items-center gap-2.5" aria-label="Postwave home">
    <svg className="wave-mark h-9 w-9" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs><linearGradient id="pw-brand" x1="0" y1="0" x2="40" y2="40"><stop stopColor="#2dd4bf" /><stop offset="1" stopColor="#0284c7" /></linearGradient></defs><rect width="40" height="40" rx="12" fill="url(#pw-brand)" />
      <path d="M6 17C10.3 17 10.3 23 14.6 23C18.9 23 18.9 17 23.2 17C27.5 17 27.5 23 34 23" stroke="#f5ffff" strokeWidth="3" strokeLinecap="round" />
      <path d="M7 26C11 26 11 30 15 30C19 30 19 26 23 26C27 26 27 30 33 30" stroke="#9ce1d8" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
    {!compact && <span className="font-display text-[19px] font-extrabold tracking-[-.06em] text-[#145a7c]">postwave</span>}
  </a>;
}
export function Footer() {
  return <footer className="mt-auto border-t border-[#e2ecef] px-5 py-5 text-center text-xs text-[#8093a0]"><a className="hover:underline" href="/pricing">Pricing</a> · <a className="hover:underline" href="/privacy">Privacy</a> · <a className="hover:underline" href="/terms">Terms</a> · <a className="hover:underline" href="/data-deletion">Data deletion</a><br />Postwave by Mazi Saint Concepts</footer>;
}
export function Notice({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "success" | "info" }) {
  const colors = tone === "success" ? "border-[#b9e4d9] bg-[#effaf6] text-[#246c5b]" : tone === "info" ? "border-[#cfe3eb] bg-[#f0f8fb] text-[#346a80]" : "border-[#f0c9c1] bg-[#fff5f2] text-[#a34c3d]";
  return <div role="status" className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${colors}`}><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> <span>{children}</span></div>;
}
export function Button({ children, className = "", variant = "primary", disabled = false, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  const styles = variant === "primary" ? "bg-[#176f98] text-white hover:bg-[#125c7d] shadow-[0_4px_10px_rgba(25,104,139,.12)]" : variant === "secondary" ? "border border-[#d8e6eb] bg-white text-[#36576b] hover:bg-[#f4fafb]" : "text-[#5e7788] hover:bg-[#edf5f6]";
  return <button {...props} disabled={disabled} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}>{children}</button>;
}
export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-[#355367]">{label}<input {...props} className={`h-11 w-full rounded-xl border border-[#dce7eb] bg-white px-3.5 text-sm font-normal text-[#183348] outline-none transition focus:border-[#4eabb3] focus:ring-4 focus:ring-[#dff3ef] placeholder:text-[#9aabb4] ${props.className || ""}`} /></label>;
}
export function PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div>{eyebrow && <div className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#388b91]">{eyebrow}</div>}<h1 className="font-display text-3xl font-extrabold tracking-[-.045em] text-[#17364c] sm:text-[34px]">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#718696]">{description}</p>}</div>
    {action}
  </div>;
}
export function EmptyState({ icon: Icon, title, detail, action }: { icon: typeof ImagePlus; title: string; detail: string; action?: ReactNode }) {
  return <div className="flex min-h-[250px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#cbdde3] bg-[#f8fbfc] px-6 text-center">
    <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e6f4f2] text-[#348d8a]"><Icon className="h-5 w-5" /></span>
    <h3 className="font-display text-base font-bold text-[#234459]">{title}</h3><p className="mt-1.5 max-w-sm text-sm leading-5 text-[#7a8e9b]">{detail}</p>{action && <div className="mt-5">{action}</div>}
  </div>;
}
export function StatusPill({ status }: { status?: string }) {
  const value = (status || "unknown").toLowerCase();
  const style = value === "published" || value === "success" ? "bg-[#e5f5ef] text-[#347961]" : value === "failed" || value === "error" ? "bg-[#fff0ed] text-[#a75245]" : value === "publishing" || value === "pending" ? "bg-[#fff6df] text-[#96712a]" : "bg-[#edf2f4] text-[#657b88]";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${style}`}>{value.replaceAll("_", " ")}</span>;
}
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[#e0eaed] bg-white shadow-[0_8px_26px_rgba(30,74,92,.035)] ${className}`}>{children}</section>;
}
export function Skeleton({ className = "" }: { className?: string }) { return <div className={`animate-pulse rounded-lg bg-[#e7eff2] ${className}`} />; }

export function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "instagram") return <Instagram className="h-4 w-4" />;
  if (platform === "threads" || platform === "reddit") return <MessageCircle className="h-4 w-4" />;
  if (platform === "linkedin") return <span className="text-xs font-extrabold">in</span>;
  if (platform === "twitter" || platform === "bluesky") return <AtSign className="h-4 w-4" />;
  if (platform === "youtube") return <Video className="h-4 w-4" />;
  if (platform === "tiktok") return <Music2 className="h-4 w-4" />;
  return <Globe2 className="h-4 w-4" />;
}

export function zonedInputToIso(value: string, timezone: string) {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  const first = new Date(desired);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(first);
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  const represented = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute);
  return new Date(desired + desired - represented).toISOString();
}

