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

export function HistoryPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await api<{ posts: Post[] }>("/api/posts"); setPosts((result.posts || []).filter((post) => post.status.toLowerCase() !== "draft")); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't load post history."); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const retry = async (postId: string, accountId: string) => {
    const key = `${postId}:${accountId}`; setBusy(key); setError(""); setNotice("");
    try { await api(`/api/posts/${encodeURIComponent(postId)}/retry`, json({ accountId })); setNotice("Retry requested. The platform status will update when publishing completes."); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't retry this platform."); } finally { setBusy(""); }
  };
  return <>
    <PageTitle eyebrow="Publishing activity" title="Post history" description="See how each post performed on every connected platform. Failed destinations can be retried here." action={<Button variant="secondary" disabled={loading} onClick={() => void refresh()}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>} />
    {error && <div className="mb-4"><Notice>{error}</Notice></div>}{notice && <div className="mb-4"><Notice tone="success">{notice}</Notice></div>}
    {loading ? <div className="grid gap-4">{[1, 2, 3].map((n) => <Card key={n} className="p-5"><Skeleton className="h-6 w-1/3" /><Skeleton className="mt-4 h-14 w-full" /></Card>)}</div> : posts.length ? <div className="grid gap-4">{posts.map((post) => <Card key={post.id} className="overflow-hidden">
      <div className="flex flex-wrap items-start gap-3 border-b border-[#edf1f2] px-5 py-4"><div className="min-w-0 flex-1"><p className="line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-[#3f5d6e]">{post.content || "Media post"}</p><div className="mt-2 text-[11px] text-[#899aa3]">{new Date(post.createdAt).toLocaleString()}</div></div><StatusPill status={post.status} /></div>
      <div className="divide-y divide-[#edf2f3] px-5">{post.platforms?.length ? post.platforms.map((target, index) => <div key={`${target.accountId}-${index}`} className="flex flex-wrap items-center gap-3 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf5f5] text-[#568994]"><PlatformIcon platform={target.platform} /></span>
        <span className="text-xs font-bold text-[#4b687a]">{platformNames[target.platform] || target.platform}</span><StatusPill status={target.status} />
        {target.errorMessage && <p className="order-last w-full pl-11 text-xs leading-5 text-[#a35b4e] sm:order-none sm:w-auto sm:flex-1">{target.errorMessage}</p>}
        {target.platformPostUrl && <a target="_blank" rel="noreferrer" href={target.platformPostUrl} aria-label="Open published post" className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-[#6e91a0] hover:bg-[#eff6f7]"><ExternalLink className="h-4 w-4" /></a>}
        {["failed", "error"].includes((target.status || "").toLowerCase()) && <Button variant="secondary" disabled={busy === `${post.id}:${target.accountId}`} onClick={() => void retry(post.id, target.accountId)} className="ml-auto min-h-8 px-3 text-xs">{busy === `${post.id}:${target.accountId}` ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Retry</Button>}
      </div>) : <p className="py-4 text-xs text-[#8a9aa3]">No per-platform results are available for this post.</p>}</div>
    </Card>)}</div> : !error && <EmptyState icon={Clock3} title="Nothing published yet" detail="Once you publish a post, its delivery status for each platform will show up here." action={<a href="/compose" className="text-sm font-bold text-[#267b8c]">Compose a post <ArrowRight className="ml-1 inline h-4 w-4" /></a>} />}
  </>;
}
