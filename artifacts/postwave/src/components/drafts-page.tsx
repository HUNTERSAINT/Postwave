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

export function DraftsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await api<{ posts: Post[] }>("/api/posts"); setPosts((result.posts || []).filter((post) => post.status.toLowerCase() === "draft")); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't load your drafts."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <>
    <PageTitle eyebrow="Your ideas, in progress" title="Drafts" description="Keep a thought here until it’s ready to meet the world." action={<a href="/compose" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#176f98] px-4 text-sm font-bold text-white hover:bg-[#125c7d]"><Plus className="h-4 w-4" />New draft</a>} />
    {error && <div className="mb-4 flex flex-wrap items-center gap-3"><Notice>{error}</Notice><Button variant="secondary" onClick={() => void refresh()}><RefreshCw className="h-4 w-4" />Retry</Button></div>}
    {loading ? <div className="grid gap-4 sm:grid-cols-2">{[1, 2, 3, 4].map((n) => <Card key={n} className="p-5"><Skeleton className="h-5 w-2/3" /><Skeleton className="mt-4 h-16 w-full" /></Card>)}</div> : posts.length ? <div className="grid gap-4 sm:grid-cols-2">{posts.map((post) => <Card key={post.id} className="flex flex-col p-5">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9f4f2] text-[#35868b]"><FileText className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-[#3f5d6e]">{post.content || "Media post"}</p><p className="mt-2 text-[11px] text-[#899aa3]">Edited {new Date(post.createdAt).toLocaleString()}</p></div><StatusPill status={post.status} /></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf2f3] pt-4"><span className="text-xs text-[#82949f]">{post.platforms?.length || 0} selected destinations</span><a href={`/compose?draft=${encodeURIComponent(post.id)}`} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#176f98] px-3 text-xs font-bold text-white hover:bg-[#125c7d]">Open in Compose <ArrowRight className="h-3.5 w-3.5" /></a></div>
    </Card>)}</div> : !error && <EmptyState icon={FileText} title="Nothing saved just yet" detail="Save a work-in-progress in Compose and it’ll be waiting here when inspiration returns." action={<a href="/compose" className="text-sm font-bold text-[#267b8c]">Start a draft <ArrowRight className="ml-1 inline h-4 w-4" /></a>} />}
  </>;
}
