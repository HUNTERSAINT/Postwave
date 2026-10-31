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

export function CalendarPage({ savedTimezone = "Africa/Lagos" }: { savedTimezone?: string }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timezone, setTimezone] = useState(savedTimezone);
  const [selectedDay, setSelectedDay] = useState("");
  const start = new Date(Date.UTC(month.getFullYear(), month.getMonth(), 1) - 86_400_000);
  const end = new Date(Date.UTC(month.getFullYear(), month.getMonth() + 1, 1) + 86_400_000);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await api<{ posts: Post[] }>(`/api/posts?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`);
      setPosts((result.posts || []).filter((post) => post.scheduledAt));
      const zone = result.posts?.find((post) => post.timezone)?.timezone;
      if (zone) setTimezone(zone);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load your calendar."); }
    finally { setLoading(false); }
  }, [start.toISOString(), end.toISOString()]);
  useEffect(() => { void load(); }, [load]);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const scheduledForDay = (day: number) => posts.filter((post) => {
    if (!post.scheduledAt) return false;
    return new Intl.DateTimeFormat("en-CA", { timeZone: post.timezone || timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(post.scheduledAt)) === `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  });
  const selectedPosts = selectedDay ? scheduledForDay(Number(selectedDay.split("-")[2])) : [];
  const setMonthBy = (delta: number) => { setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1)); setSelectedDay(""); };
  const monthLabel = month.toLocaleDateString("en", { month: "long", year: "numeric" });
  return <>
    <PageTitle eyebrow="Plan ahead" title="Publishing calendar" description="A clear view of what’s scheduled, shown in your publishing timezone." action={<Button variant="secondary" disabled={loading} onClick={() => void load()}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>} />
    {error && <div className="mb-4 flex flex-wrap items-center gap-3"><Notice>{error}</Notice><Button variant="secondary" onClick={() => void load()}>Try again</Button></div>}
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7eef0] px-4 py-4 sm:px-6">
        <div><h2 className="font-display text-lg font-extrabold text-[#29495c]">{monthLabel}</h2><p className="mt-1 text-xs text-[#82949f]">Times shown in {timezone}</p></div>
        <div className="flex items-center gap-2"><Button aria-label="Previous month" variant="secondary" className="min-h-9 w-9 px-0" onClick={() => setMonthBy(-1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={() => { setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelectedDay(""); }}>Today</Button><Button aria-label="Next month" variant="secondary" className="min-h-9 w-9 px-0" onClick={() => setMonthBy(1)}><ChevronRight className="h-4 w-4" /></Button></div>
      </div>
      {loading ? <div className="grid grid-cols-7 gap-px bg-[#e7eef0] p-px">{Array.from({ length: 35 }, (_, i) => <Skeleton key={i} className="h-20 rounded-none sm:h-28" />)}</div> : <div className="grid grid-cols-7 gap-px bg-[#e7eef0] p-px">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="bg-[#f5f9fa] px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-[#82949f] sm:px-3 sm:text-xs">{day}</div>)}
        {Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => {
          const day = index - offset + 1;
          if (day < 1 || day > days) return <div key={index} className="min-h-[72px] bg-[#fafcfc] sm:min-h-[116px]" />;
          const dayPosts = scheduledForDay(day);
          const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          return <button key={key} onClick={() => setSelectedDay(selectedDay === key ? "" : key)} className={`min-h-[72px] overflow-hidden bg-white p-1.5 text-left transition hover:bg-[#f2faf9] sm:min-h-[116px] sm:p-3 ${selectedDay === key ? "ring-2 ring-inset ring-[#3a9b9c]" : ""}`} aria-label={`${monthLabel} ${day}, ${dayPosts.length} scheduled posts`}>
            <span className={`text-xs font-semibold ${selectedDay === key ? "text-[#176f98]" : "text-[#597687]"}`}>{day}</span>
            <div className="mt-1 grid gap-1">{dayPosts.slice(0, 2).map((post) => <span key={post.id} className="truncate rounded-md bg-[#e8f5f3] px-1.5 py-1 text-[9px] font-semibold text-[#286f75] sm:text-[11px]">{new Date(post.scheduledAt!).toLocaleTimeString([], { timeZone: post.timezone || timezone, hour: "numeric", minute: "2-digit" })} · {post.content || "Media post"}</span>)}{dayPosts.length > 2 && <span className="text-[9px] text-[#748b96]">+{dayPosts.length - 2} more</span>}</div>
          </button>;
        })}
      </div>}
    </Card>
    {selectedDay && <Card className="mt-5 p-5"><h3 className="font-display font-bold text-[#29495c]">{new Date(`${selectedDay}T12:00:00`).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric", timeZone: timezone })}</h3>
      {selectedPosts.length ? <div className="mt-3 grid gap-3">{selectedPosts.map((post) => <div key={post.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e3ecee] p-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e9f4f2] text-[#398b8b]"><Clock className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#38596a]">{post.content || "Media post"}</span><span className="text-xs text-[#82949f]">{new Date(post.scheduledAt!).toLocaleString([], { timeZone: post.timezone || timezone })} · {post.timezone || timezone}</span></span><StatusPill status={post.status} /></div>)}</div> : <p className="mt-2 text-sm text-[#82949f]">Nothing scheduled for this day.</p>}
    </Card>}
    {!loading && !error && posts.length === 0 && <div className="mt-5"><EmptyState icon={CalendarDays} title="A little breathing room" detail="Your scheduled posts will appear here as you plan ahead." action={<a href="/compose" className="text-sm font-bold text-[#267b8c]">Schedule a post <ArrowRight className="ml-1 inline h-4 w-4" /></a>} /></div>}
  </>;
}
