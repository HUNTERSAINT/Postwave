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

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [connectLink, setConnectLink] = useState<{ platform: string; url: string } | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await api<{ accounts: Account[] }>("/api/accounts"); setAccounts(result.accounts || []); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't load connected accounts."); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const connect = async (platform: string) => {
    setBusy(platform); setError(""); setNotice("");
    try {
      const result = await api<{ authUrl: string }>("/api/accounts/connect", json({ platform }));
      if (!result.authUrl) throw new Error("The connection link was not returned.");
      setConnectLink({ platform, url: result.authUrl });
      window.location.assign(result.authUrl);
      window.setTimeout(() => setBusy(""), 8000);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't connect ${platformNames[platform]}.`);
      setBusy("");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const disconnect = async (account: Account) => {
    if (!window.confirm(`Disconnect ${account.displayName || account.username || platformNames[account.platform] || account.platform}?`)) return;
    setBusy(account.id); setError(""); setNotice("");
    try { await api(`/api/accounts/${encodeURIComponent(account.id)}`, { method: "DELETE" }); setNotice("Account disconnected."); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't disconnect account."); } finally { setBusy(""); }
  };
  return <>
    <PageTitle eyebrow="Your channels" title="Connected accounts" description="Connect your own social identities. Every account stays yours, and only you can publish to it." />
    {error && <div className="mb-4"><Notice>{error}</Notice></div>}{notice && <div className="mb-4"><Notice tone="success">{notice}</Notice></div>}{connectLink && <div className="mb-4"><Notice tone="info">Opening {platformNames[connectLink.platform] || connectLink.platform}… if nothing happens, <a className="font-bold underline" href={connectLink.url} target="_blank" rel="noreferrer">tap here to open the connection page</a>.</Notice></div>}
    <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
      <Card>
        <div className="flex items-center justify-between border-b border-[#e7eef0] px-5 py-4"><div><h2 className="font-display font-bold text-[#29495c]">Your connected identities</h2><p className="mt-1 text-xs text-[#8798a1]">Only active accounts can receive new posts.</p></div><Button variant="secondary" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div>
        <div className="p-5">
          {loading ? <div className="grid gap-3">{[1, 2].map((n) => <Skeleton className="h-[76px] w-full" key={n} />)}</div> : accounts.length ? <div className="grid gap-3">{accounts.map((account) => <div key={account.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e4ecef] bg-[#fbfdfd] p-3.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f4f2] text-[#3c8e87]"><PlatformIcon platform={account.platform} /></span>
            <div className="min-w-0 flex-1"><div className="font-semibold text-[#355569]">{account.displayName || platformNames[account.platform] || account.platform}</div><div className="mt-0.5 truncate text-xs text-[#82949f]">{account.username ? `@${account.username.replace(/^@/, "")}` : platformNames[account.platform] || account.platform}</div></div>
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${account.isActive ? "bg-[#e7f5ed] text-[#42805d]" : "bg-[#f0f2f2] text-[#7d8d93]"}`}>{account.isActive ? "Active" : "Inactive"}</span>
            <button onClick={() => void disconnect(account)} disabled={busy === account.id} aria-label="Disconnect account" className="flex h-9 w-9 items-center justify-center rounded-lg text-[#a27978] hover:bg-[#fff0ed] disabled:opacity-50">{busy === account.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>
          </div>)}</div> : !error && <EmptyState icon={Link2} title="No accounts connected" detail="Connect a social account to choose it as a destination for your next post." />}
        </div>
      </Card>
      <Card className="p-5 sm:p-6"><div className="mb-4"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e5f3f0] text-[#348b83]"><Plus className="h-5 w-5" /></div><h2 className="font-display mt-4 text-lg font-bold text-[#29495c]">Connect a platform</h2><p className="mt-1 text-sm leading-5 text-[#82949f]">You'll be redirected to authorize Postwave. We never ask for your social password.</p></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{platforms.map((platform) => <button key={platform} onClick={() => void connect(platform)} disabled={Boolean(busy)} className="flex min-h-11 items-center gap-2.5 rounded-xl border border-[#e0eaed] bg-white px-3 text-left text-xs font-semibold text-[#476477] transition hover:border-[#a9d4d2] hover:bg-[#f6fbfa] disabled:opacity-50">
          <PlatformIcon platform={platform} /><span className="flex-1">{platformNames[platform]}</span>{busy === platform ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5 text-[#90a4ac]" />}
        </button>)}</div>
        <div className="mt-5 flex items-start gap-2 rounded-xl bg-[#f4f8f8] p-3 text-[11px] leading-5 text-[#748b96]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#45988a]" />You choose which profiles to connect, and can remove them whenever you like.</div>
      </Card>
    </div>
  </>;
}
