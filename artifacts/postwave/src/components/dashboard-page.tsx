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

export function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [postResult, accountResult] = await Promise.all([api<{ posts: Post[] }>("/api/posts"), api<{ accounts: Account[] }>("/api/accounts")]);
      setPosts(postResult.posts || []); setAccounts(accountResult.accounts || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load your overview."); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const publishedCount = posts.filter((post) => post.status === "published").length;
  const activityPosts = posts.filter((post) => post.status.toLowerCase() !== "draft");
  return <>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><p className="mb-2 text-xs font-bold uppercase tracking-[.15em] text-[#438e8b]">Your workspace</p><h1 className="font-display text-3xl font-extrabold tracking-[-.05em] text-[#193a50] sm:text-[36px]">Good to see you.</h1><p className="mt-2 text-sm text-[#778b98]">One clear place to publish across your channels.</p></div>
      <a href="/compose" className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#176f98] px-4 text-sm font-bold text-white shadow-[0_4px_10px_rgba(25,104,139,.12)] hover:bg-[#125c7d]"><Plus className="h-4 w-4" /> Create a post</a>
    </div>
    {error && <div className="mb-5 flex items-center justify-between gap-3"><Notice>{error}</Notice><Button variant="secondary" onClick={() => void refresh()}><RefreshCw className="h-4 w-4" />Retry</Button></div>}
    <div className="grid gap-4 sm:grid-cols-3">
      {[{ label: "Connected accounts", value: accounts.length, icon: Link2, tint: "bg-[#e6f4f1] text-[#398b81]" }, { label: "Posts created", value: posts.length, icon: Send, tint: "bg-[#e9f1f9] text-[#467aa2]" }, { label: "Published", value: publishedCount, icon: CheckCircle2, tint: "bg-[#eff5e9] text-[#6f8f4b]" }].map((stat) => <Card key={stat.label} className="flex items-center gap-4 p-5">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${stat.tint}`}><stat.icon className="h-5 w-5" /></span><div><div className="text-[11px] font-bold uppercase tracking-[.1em] text-[#8699a3]">{stat.label}</div>{loading ? <Skeleton className="mt-2 h-6 w-12" /> : <div className="font-display mt-1 text-2xl font-extrabold tracking-[-.04em] text-[#29495c]">{stat.value}</div>}</div>
      </Card>)}
    </div>
    <div className="mt-6 grid gap-5 lg:grid-cols-[1.55fr_.85fr]">
      <Card>
        <div className="flex items-center justify-between border-b border-[#e7eef0] px-5 py-4"><div><h2 className="font-display font-bold text-[#29495c]">Recent posts</h2><p className="mt-0.5 text-xs text-[#8496a0]">Your latest publishing activity</p></div><a href="/history" className="text-xs font-bold text-[#287c91] hover:underline">View history <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></a></div>
        <div className="divide-y divide-[#edf2f3] px-5">
          {loading ? <div className="grid gap-4 py-5">{[1, 2, 3].map((n) => <Skeleton key={n} className="h-12 w-full" />)}</div> : activityPosts.length ? activityPosts.slice(0, 5).map((post) => <a href="/history" key={post.id} className="flex items-start gap-3 py-4 hover:bg-[#fbfdfd]">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf5f6] text-[#528491]"><Send className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm leading-5 text-[#3a586a]">{post.content || "Media post"}</p><div className="mt-1.5 text-[11px] text-[#8a9aa4]">{new Date(post.createdAt).toLocaleString()}</div></div><StatusPill status={post.status} />
          </a>) : !error && <div className="py-4"><EmptyState icon={Send} title="Your first post starts here" detail="Write once, choose your connected accounts, and publish." action={<a href="/compose" className="text-sm font-bold text-[#267b8c]">Start composing <ArrowRight className="ml-1 inline h-4 w-4" /></a>} /></div>}
        </div>
      </Card>
      <div className="grid content-start gap-5">
        <Card className="overflow-hidden bg-[#eaf5f4] p-5">
          <div className="mb-5 flex items-start justify-between"><div><span className="text-[11px] font-bold uppercase tracking-[.15em] text-[#478f8a]">Your workflow</span><h2 className="font-display mt-2 text-xl font-extrabold tracking-[-.03em] text-[#1e4657]">From draft to<br />everywhere.</h2></div><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#398f8a]"><Sparkles className="h-5 w-5" /></span></div>
          <div className="grid gap-2 text-xs font-semibold text-[#57767f]"><div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#3c958c]"><Check className="h-3 w-3" /></span> Connect the accounts you own</div><div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#3c958c]">2</span> Write your post once</div><div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#3c958c]">3</span> Publish to your channels</div></div>
          <a href="/accounts" className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[#267b83] hover:underline">Set up accounts <ArrowRight className="h-3.5 w-3.5" /></a>
        </Card>
        <Card className="p-5"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-display font-bold text-[#29495c]">Connected accounts</h2><p className="mt-1 text-xs text-[#8798a1]">Ready when you are</p></div><a href="/accounts" className="text-xs font-bold text-[#287c91]">Manage</a></div>
          {loading ? <Skeleton className="h-10 w-full" /> : accounts.length ? <div className="flex flex-wrap gap-2">{accounts.slice(0, 6).map((account) => <span key={account.id} title={account.username || platformNames[account.platform] || account.platform} className="inline-flex items-center gap-1.5 rounded-full border border-[#e2ebed] bg-[#f9fcfc] px-2.5 py-1.5 text-[11px] font-semibold text-[#547082]"><span className="h-1.5 w-1.5 rounded-full bg-[#43b49e]" />{platformNames[account.platform] || account.platform}</span>)}{accounts.length > 6 && <span className="px-1 py-1.5 text-[11px] text-[#8496a0]">+{accounts.length - 6} more</span>}</div> : <p className="text-sm text-[#8798a1]">No accounts connected yet.</p>}
        </Card>
      </div>
    </div>
  </>;
}
