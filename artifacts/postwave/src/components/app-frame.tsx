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

import { PlanBanner } from "@/components/plan-banner";
import { AiCaptionAssistant } from "@/components/ai-caption-assistant";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { platforms, platformCharacterLimits, platformRequirements, platformNames, api, json, Brand, Footer, Notice, Button, Field, PageTitle, EmptyState, StatusPill, Card, Skeleton, PlatformIcon, zonedInputToIso, type Account, type MediaAsset, type Target, type Post, type User, type ApiError } from "@/components/app-kit";

export function AppFrame({ user, onLogout, children }: { user: User; onLogout: () => void; children: ReactNode }) {
  const [mobileMenu, setMobileMenu] = useState(false);
  const items = [{ href: "/dashboard", label: "Overview", icon: Globe2 }, { href: "/compose", label: "Compose", icon: Plus }, { href: "/calendar", label: "Calendar", icon: CalendarDays }, { href: "/drafts", label: "Drafts", icon: FileText }, { href: "/accounts", label: "Accounts", icon: Link2 }, { href: "/history", label: "History", icon: Clock3 }, { href: "/analytics", label: "Analytics", icon: BarChart3 }, { href: "/billing", label: "Billing", icon: CreditCard }];
  const pathname = usePathname() ?? "/dashboard";
  return <div className="min-h-[100dvh]">
    <header className="sticky top-0 z-20 border-b border-[#e0eaed] bg-[#f9fcfc]/95 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-4 sm:px-7 lg:px-10">
        <div className="flex items-center gap-9"><Brand /><nav className="hidden items-center gap-1 md:flex">{items.map(({ href, label, icon: Icon }) => <a key={href} href={href} className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition ${pathname === href ? "bg-[#e6f3f2] text-[#216f79]" : "text-[#718695] hover:bg-[#edf5f6] hover:text-[#35576b]"}`}><Icon className="h-4 w-4" />{label}</a>)}</nav></div>
        <div className="flex items-center gap-2.5">
          <a href="/accounts" className="hidden items-center gap-2 rounded-xl border border-[#d9e7eb] bg-white px-3 py-2 text-xs font-semibold text-[#48677a] sm:flex"><Settings2 className="h-4 w-4" /> Manage accounts</a>
          <div className="hidden h-8 w-px bg-[#e2eaed] sm:block" />
          <div className="hidden text-right sm:block"><div className="max-w-40 truncate text-xs font-bold text-[#315064]">{user.name || user.email.split("@")[0]}</div><div className="max-w-40 truncate text-[10px] text-[#8b9ba5]">{user.email}</div></div>
          <button onClick={onLogout} title="Sign out" className="flex h-9 w-9 items-center justify-center rounded-xl text-[#78909c] hover:bg-[#eaf2f4] hover:text-[#31576b]"><LogOut className="h-4 w-4" /></button>
          <button onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle navigation" className="flex h-9 w-9 items-center justify-center rounded-xl text-[#64808e] hover:bg-[#eaf2f4] md:hidden">{mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
      </div>
      {mobileMenu && <nav className="grid grid-cols-2 gap-2 border-t border-[#e0eaed] p-3 md:hidden">{items.map(({ href, label, icon: Icon }) => <a key={href} href={href} className={`flex items-center gap-2 rounded-xl p-3 text-sm font-semibold ${pathname === href ? "bg-[#e6f3f2] text-[#216f79]" : "text-[#647d8a]"}`}><Icon className="h-4 w-4" />{label}</a>)}</nav>}
    </header>
    <main className="mx-auto min-h-[calc(100dvh-137px)] max-w-[1240px] px-4 pb-12 pt-8 sm:px-7 lg:px-10"><div className="page-in"><PlanBanner />{children}</div></main>
    <Footer />
  </div>;
}
