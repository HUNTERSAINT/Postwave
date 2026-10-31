"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight, BarChart3, Bookmark, Eye, Heart, LoaderCircle, MessageCircle, RefreshCw, Send, Share2, Trophy, TrendingUp,
} from "lucide-react";

type Totals = {
  views: number; likes: number; comments: number; shares: number; saves: number; reach: number; clicks: number;
  published: number; engagement: number; engagementRate: number; withData: number;
};
type PlatformRow = { platform: string; published: number; views: number; likes: number; comments: number; shares: number; saves: number; engagement: number; engagementRate: number };
type TimelineRow = { date: string; published: number; views: number; engagement: number };
type TopPost = { id: string; content: string; publishedAt: string | null; platforms: string[]; url: string | null; views: number; likes: number; comments: number; shares: number; saves: number; engagement: number };
type Analytics = { days: number; generatedAt: string; providerAvailable: boolean; totals: Totals; platforms: PlatformRow[]; timeline: TimelineRow[]; topPosts: TopPost[] };

const PLATFORM_NAMES: Record<string, string> = {
  facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn",
  twitter: "X", threads: "Threads", pinterest: "Pinterest", bluesky: "Bluesky", reddit: "Reddit", googlebusiness: "Google Business",
};
const PLATFORM_HUES: Record<string, string> = {
  facebook: "#3b82f6", instagram: "#ec4899", tiktok: "#14b8a6", youtube: "#ef4444", linkedin: "#0ea5e9",
  twitter: "#64748b", threads: "#8b5cf6", pinterest: "#f43f5e", bluesky: "#38bdf8", reddit: "#f97316", googlebusiness: "#22c55e",
};
const nameOf = (platform: string) => PLATFORM_NAMES[platform] ?? platform.charAt(0).toUpperCase() + platform.slice(1);

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const points = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * 100},${28 - (v / max) * 24}`);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full" aria-hidden="true">
      <polyline points={points.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity=".75" />
    </svg>
  );
}

function Kpi({ icon, label, value, hint, series }: { icon: ReactNode; label: string; value: string; hint?: string; series: number[] }) {
  return (
    <div className="pw-card pw-kpi">
      <div className="flex items-center justify-between">
        <span className="pw-chip-icon">{icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-[.14em] text-[#4f7d80]">{label}</span>
      </div>
      <div className="mt-4 font-display text-[32px] font-extrabold leading-none tracking-[-.04em] text-[#0f3b42]">{value}</div>
      <div className="mt-1.5 min-h-4 text-[11px] text-[#55777c]">{hint}</div>
      <div className="mt-2 text-[#0da9a2]"><Sparkline values={series} /></div>
    </div>
  );
}

type Metric = "views" | "engagement" | "published";
const METRIC_LABEL: Record<Metric, string> = { views: "Views", engagement: "Engagement", published: "Posts" };

function Chart({ data, metric }: { data: TimelineRow[]; metric: Metric }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 240, PAD = { l: 8, r: 8, t: 16, b: 26 };
  const values = data.map((row) => row[metric]);
  const max = Math.max(...values, 1);
  const x = (i: number) => PAD.l + (i / Math.max(data.length - 1, 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const smooth = values.reduce((path, v, i) => {
    if (i === 0) return `M${x(0).toFixed(1)},${y(v).toFixed(1)}`;
    const cx = (x(i - 1) + x(i)) / 2;
    return `${path} C${cx.toFixed(1)},${y(values[i - 1]).toFixed(1)} ${cx.toFixed(1)},${y(v).toFixed(1)} ${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  }, "");
  const area = `${smooth} L${x(values.length - 1).toFixed(1)},${H - PAD.b} L${x(0).toFixed(1)},${H - PAD.b} Z`;
  const labelEvery = data.length > 40 ? 14 : data.length > 10 ? 5 : 1;
  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    setHover(Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1)))));
  };
  const active = hover === null ? null : data[hover];
  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-[240px] w-full touch-none" role="img" aria-label={`${METRIC_LABEL[metric]} over time`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="pw-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity=".42" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pw-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + t * (H - PAD.t - PAD.b)} y2={PAD.t + t * (H - PAD.t - PAD.b)} stroke="rgba(15,100,104,.12)" strokeDasharray="3 5" />
        ))}
        <path d={area} fill="url(#pw-area)" />
        <path d={smooth || line} fill="none" stroke="url(#pw-line)" strokeWidth="2.6" strokeLinecap="round" />
        {data.map((row, i) => (i % labelEvery === 0 || i === data.length - 1) && (
          <text key={row.date} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#55777c">{row.date.slice(5).replace("-", "/")}</text>
        ))}
        {hover !== null && active && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(13,155,152,.35)" />
            <circle cx={x(hover)} cy={y(active[metric])} r="5" fill="#fff" stroke="#0d9b98" strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {hover !== null && active && (
        <div className="pw-tip pointer-events-none absolute top-2 text-xs" style={{ left: `clamp(8px, calc(${(hover / Math.max(data.length - 1, 1)) * 100}% - 60px), calc(100% - 128px))` }}>
          <div className="font-bold text-[#0f3b42]">{new Date(active.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
          <div className="text-[#2c6a70]">{compact(active[metric])} {METRIC_LABEL[metric].toLowerCase()}</div>
        </div>
      )}
    </div>
  );
}

export function AnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState<Metric>("views");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (range: number, refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/analytics?days=${range}${refresh ? "&refresh=1" : ""}`, { credentials: "same-origin" });
      const payload = (await response.json().catch(() => ({}))) as { analytics?: Analytics; message?: string };
      if (!response.ok || !payload.analytics) throw new Error(payload.message || "Couldn't load your analytics.");
      setData(payload.analytics);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't load your analytics.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(days); }, [days, load]);

  const series = useMemo(() => ({
    views: data?.timeline.map((row) => row.views) ?? [],
    engagement: data?.timeline.map((row) => row.engagement) ?? [],
    published: data?.timeline.map((row) => row.published) ?? [],
  }), [data]);

  const best = data?.platforms.find((row) => row.engagement > 0 || row.views > 0) ?? null;
  const maxEngagement = Math.max(...(data?.platforms.map((row) => row.engagement + row.views / 10) ?? [1]), 1);
  const t = data?.totals;
  const noPosts = !!data && data.totals.published === 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#0b8a86]">Performance</div>
          <h1 className="font-display text-3xl font-extrabold tracking-[-.045em] text-[#0f3b42] sm:text-[36px]">Analytics</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#4f7377]">See how your posts are doing and which platform brings the most engagement.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="pw-seg" role="group" aria-label="Date range">
            {[7, 30, 90].map((range) => (
              <button key={range} type="button" aria-pressed={days === range} onClick={() => setDays(range)} className={days === range ? "is-on" : ""}>{range}d</button>
            ))}
          </div>
          <button type="button" onClick={() => void load(days, true)} disabled={loading || refreshing} className="pw-btn-glass" aria-label="Refresh analytics">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {error && <div role="alert" className="pw-notice">{error}</div>}
      {data && !data.providerAvailable && !noPosts && (
        <div className="pw-notice">Your publishing counts are up to date, but platform numbers (views, likes, comments) are temporarily unavailable. Try refreshing in a few minutes.</div>
      )}
      {data && data.providerAvailable && t && t.published > 0 && t.withData === 0 && (
        <div className="pw-notice">Platforms can take a few hours to report views and likes on new posts. Your numbers will appear here as soon as they&apos;re available.</div>
      )}

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="pw-card h-[150px] animate-pulse" />)}</div>
      ) : noPosts ? (
        <div className="pw-card flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
          <span className="pw-chip-icon mb-4 h-14 w-14"><BarChart3 className="h-6 w-6" /></span>
          <h2 className="font-display text-xl font-bold text-[#0f3b42]">No published posts in the last {days} days</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-[#4f7377]">Publish a post and its views, likes and comments will show up here.</p>
          <a href="/compose" className="pw-btn-primary mt-5"><Send className="h-4 w-4" /> Create a post</a>
        </div>
      ) : data && t ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi icon={<Send className="h-4 w-4" />} label="Published" value={compact(t.published)} hint={`posts in the last ${days} days`} series={series.published} />
            <Kpi icon={<Eye className="h-4 w-4" />} label="Views" value={compact(t.views)} hint={t.reach ? `${compact(t.reach)} people reached` : "across all platforms"} series={series.views} />
            <Kpi icon={<Heart className="h-4 w-4" />} label="Likes" value={compact(t.likes)} hint={t.published ? `${(t.likes / t.published).toFixed(1)} per post` : undefined} series={series.engagement} />
            <Kpi icon={<MessageCircle className="h-4 w-4" />} label="Comments" value={compact(t.comments)} hint={t.published ? `${(t.comments / t.published).toFixed(1)} per post` : undefined} series={series.engagement} />
            <Kpi icon={<Share2 className="h-4 w-4" />} label="Shares & saves" value={compact(t.shares + t.saves)} hint={`${compact(t.shares)} shares · ${compact(t.saves)} saves`} series={series.engagement} />
            <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Engagement rate" value={`${t.engagementRate}%`} hint={`${compact(t.engagement)} total reactions`} series={series.engagement} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <section className="pw-card p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#0f3b42]">Performance over time</h2>
                  <p className="mt-0.5 text-xs text-[#55777c]">Grouped by the day each post was published.</p>
                </div>
                <div className="pw-seg" role="group" aria-label="Chart metric">
                  {(Object.keys(METRIC_LABEL) as Metric[]).map((key) => (
                    <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)} className={metric === key ? "is-on" : ""}>{METRIC_LABEL[key]}</button>
                  ))}
                </div>
              </div>
              <Chart data={data.timeline} metric={metric} />
            </section>

            <section className="pw-card p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold text-[#0f3b42]">Top platforms</h2>
                {best && <span className="pw-pill"><Trophy className="h-3.5 w-3.5" /> {nameOf(best.platform)}</span>}
              </div>
              {data.platforms.length ? (
                <ul className="grid gap-4">
                  {data.platforms.map((row) => (
                    <li key={row.platform}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-semibold text-[#17464c]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PLATFORM_HUES[row.platform] ?? "#14b8a6" }} />{nameOf(row.platform)}</span>
                        <span className="text-xs text-[#55777c]">{row.published} post{row.published === 1 ? "" : "s"}</span>
                      </div>
                      <div className="pw-bar"><span style={{ width: `${Math.max(4, ((row.engagement + row.views / 10) / maxEngagement) * 100)}%`, background: `linear-gradient(90deg, ${PLATFORM_HUES[row.platform] ?? "#14b8a6"}, #14b8a6)` }} /></div>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-[#55777c]">
                        <span>{compact(row.views)} views</span><span>{compact(row.likes)} likes</span><span>{compact(row.comments)} comments</span><span>{row.engagementRate}% rate</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-[#55777c]">No platform data yet.</p>}
            </section>
          </div>

          <section className="pw-card p-5 sm:p-6">
            <div className="mb-4">
              <h2 className="font-display text-lg font-bold text-[#0f3b42]">Best performing posts</h2>
              <p className="mt-0.5 text-xs text-[#55777c]">Ranked by likes, comments, shares and saves.</p>
            </div>
            <ul className="grid gap-3">
              {data.topPosts.map((post, index) => (
                <li key={post.id} className="pw-row">
                  <span className="pw-rank">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-5 text-[#17464c]">{post.content || "Media post"}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#55777c]">
                      {post.platforms.map((platform) => <span key={platform} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: PLATFORM_HUES[platform] ?? "#14b8a6" }} />{nameOf(platform)}</span>)}
                      {post.publishedAt && <span>{new Date(post.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
                    </div>
                  </div>
                  <div className="hidden shrink-0 gap-4 text-xs text-[#2c6a70] sm:flex">
                    <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{compact(post.views)}</span>
                    <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{compact(post.likes)}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{compact(post.comments)}</span>
                    <span className="flex items-center gap-1"><Bookmark className="h-3.5 w-3.5" />{compact(post.saves + post.shares)}</span>
                  </div>
                  {post.url && <a href={post.url} target="_blank" rel="noreferrer" aria-label="Open post" className="pw-btn-icon"><ArrowUpRight className="h-4 w-4" /></a>}
                </li>
              ))}
            </ul>
          </section>
          <p className="text-center text-[11px] text-[#55777c]">Updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · numbers come from each platform and can lag by a few hours.</p>
        </>
      ) : loading ? <div className="flex justify-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-[#0d9b98]" /></div> : null}
    </div>
  );
}
