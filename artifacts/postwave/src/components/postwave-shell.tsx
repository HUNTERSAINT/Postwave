"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, AtSign, Check, CheckCircle2,
  ChevronDown, CircleAlert, Clock3, ExternalLink, FileImage, Globe2, ImagePlus,
  Instagram, Link2, LoaderCircle, LogOut, Menu, MessageCircle, Music2, Plus, RefreshCw,
  Send, Settings2, ShieldCheck, Sparkles, Trash2, UploadCloud, X, CalendarDays, CreditCard, ChevronLeft,
  ChevronRight, FileText, Save, Clock,
  Video,
} from "lucide-react";

import { PlanBanner } from "@/components/plan-banner";
import { AiCaptionAssistant } from "@/components/ai-caption-assistant";

type Account = { id: string; platform: string; username?: string; displayName?: string; isActive: boolean };
type MediaAsset = { id: string; key?: string; publicUrl: string; contentType: string; size: number };
type Target = { platform: string; accountId: string; status: string; errorMessage?: string | null; platformPostUrl?: string | null };
type Post = { id: string; content: string; status: string; createdAt: string; scheduledAt?: string | null; timezone?: string; platforms: Target[]; media?: MediaAsset[] };
type User = { id: string; email: string; name?: string; timezone?: string };
type ApiError = { message?: string };

const platforms = ["instagram", "facebook", "threads", "linkedin", "twitter", "tiktok", "youtube", "pinterest", "reddit", "bluesky", "googlebusiness", "telegram", "discord", "slack", "whatsapp"];
const platformCharacterLimits: Record<string, number> = {
  instagram: 2200, facebook: 63206, threads: 500, linkedin: 3000, twitter: 280,
  tiktok: 2200, youtube: 5000, pinterest: 500, reddit: 40000, bluesky: 300,
  googlebusiness: 1500, telegram: 4096, discord: 2000, slack: 40000, whatsapp: 4096,
};
const platformRequirements: Record<string, { note: string; met: (hasImage: boolean, hasVideo: boolean) => boolean }> = {
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
const platformNames: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", threads: "Threads", linkedin: "LinkedIn", twitter: "X", tiktok: "TikTok",
  youtube: "YouTube", pinterest: "Pinterest", reddit: "Reddit", bluesky: "Bluesky", googlebusiness: "Google Business",
  telegram: "Telegram", discord: "Discord", slack: "Slack", whatsapp: "WhatsApp",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
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
function json(body: unknown): RequestInit { return { method: "POST", body: JSON.stringify(body) }; }
function Brand({ compact = false }: { compact?: boolean }) {
  return <a href="/dashboard" className="inline-flex items-center gap-2.5" aria-label="Postwave home">
    <svg className="wave-mark h-9 w-9" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="#176f98" />
      <path d="M6 17C10.3 17 10.3 23 14.6 23C18.9 23 18.9 17 23.2 17C27.5 17 27.5 23 34 23" stroke="#f5ffff" strokeWidth="3" strokeLinecap="round" />
      <path d="M7 26C11 26 11 30 15 30C19 30 19 26 23 26C27 26 27 30 33 30" stroke="#9ce1d8" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
    {!compact && <span className="font-display text-[19px] font-extrabold tracking-[-.06em] text-[#145a7c]">postwave</span>}
  </a>;
}
function Footer() {
  return <footer className="mt-auto border-t border-[#e2ecef] px-5 py-5 text-center text-xs text-[#8093a0]"><a className="hover:underline" href="/pricing">Pricing</a> · <a className="hover:underline" href="/privacy">Privacy</a> · <a className="hover:underline" href="/terms">Terms</a> · <a className="hover:underline" href="/data-deletion">Data deletion</a><br />Postwave by Mazi Saint Concepts</footer>;
}
function Notice({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "success" | "info" }) {
  const colors = tone === "success" ? "border-[#b9e4d9] bg-[#effaf6] text-[#246c5b]" : tone === "info" ? "border-[#cfe3eb] bg-[#f0f8fb] text-[#346a80]" : "border-[#f0c9c1] bg-[#fff5f2] text-[#a34c3d]";
  return <div role="status" className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${colors}`}><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> <span>{children}</span></div>;
}
function Button({ children, className = "", variant = "primary", disabled = false, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  const styles = variant === "primary" ? "bg-[#176f98] text-white hover:bg-[#125c7d] shadow-[0_4px_10px_rgba(25,104,139,.12)]" : variant === "secondary" ? "border border-[#d8e6eb] bg-white text-[#36576b] hover:bg-[#f4fafb]" : "text-[#5e7788] hover:bg-[#edf5f6]";
  return <button {...props} disabled={disabled} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}>{children}</button>;
}
function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-[#355367]">{label}<input {...props} className={`h-11 w-full rounded-xl border border-[#dce7eb] bg-white px-3.5 text-sm font-normal text-[#183348] outline-none transition focus:border-[#4eabb3] focus:ring-4 focus:ring-[#dff3ef] placeholder:text-[#9aabb4] ${props.className || ""}`} /></label>;
}
function PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div>{eyebrow && <div className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#388b91]">{eyebrow}</div>}<h1 className="font-display text-3xl font-extrabold tracking-[-.045em] text-[#17364c] sm:text-[34px]">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#718696]">{description}</p>}</div>
    {action}
  </div>;
}
function EmptyState({ icon: Icon, title, detail, action }: { icon: typeof ImagePlus; title: string; detail: string; action?: ReactNode }) {
  return <div className="flex min-h-[250px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#cbdde3] bg-[#f8fbfc] px-6 text-center">
    <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e6f4f2] text-[#348d8a]"><Icon className="h-5 w-5" /></span>
    <h3 className="font-display text-base font-bold text-[#234459]">{title}</h3><p className="mt-1.5 max-w-sm text-sm leading-5 text-[#7a8e9b]">{detail}</p>{action && <div className="mt-5">{action}</div>}
  </div>;
}
function StatusPill({ status }: { status?: string }) {
  const value = (status || "unknown").toLowerCase();
  const style = value === "published" || value === "success" ? "bg-[#e5f5ef] text-[#347961]" : value === "failed" || value === "error" ? "bg-[#fff0ed] text-[#a75245]" : value === "publishing" || value === "pending" ? "bg-[#fff6df] text-[#96712a]" : "bg-[#edf2f4] text-[#657b88]";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${style}`}>{value.replaceAll("_", " ")}</span>;
}
function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[#e0eaed] bg-white shadow-[0_8px_26px_rgba(30,74,92,.035)] ${className}`}>{children}</section>;
}
function Skeleton({ className = "" }: { className?: string }) { return <div className={`animate-pulse rounded-lg bg-[#e7eff2] ${className}`} />; }

function AuthPage({ path, onAuth }: { path: string; onAuth: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [token, setToken] = useState("");
  const [fromLink, setFromLink] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const autoVerifyStarted = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkToken = params.get("token") || "";
    if (linkToken) {
      setToken(linkToken);
      setFromLink(true);
      // Keep the token out of the address bar, history and screenshots.
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (path === "/login" && params.get("verified") === "1") {
      setSuccess("Email confirmed. Sign in to continue.");
    }
    if (path === "/verify-email" && linkToken && !autoVerifyStarted.current) {
      autoVerifyStarted.current = true;
      setVerifying(true);
      api("/api/auth/verify-email", json({ token: linkToken }))
        .then(() => { window.location.replace("/login?verified=1"); })
        .catch((error) => {
          setVerifying(false);
          setFromLink(false);
          setMessage(error instanceof Error ? error.message : "This verification link is invalid or has expired.");
        });
    }
  }, [path]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage(""); setSuccess("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "");
    try {
      if (path === "/login") {
        await api("/api/auth/login", json({ email, password: String(data.get("password") || "") }));
        onAuth(); window.location.href = "/dashboard";
      } else if (path === "/signup") {
        const response = await api<{ message?: string }>("/api/auth/signup", json({ email, password: String(data.get("password") || ""), name: String(data.get("name") || "") }));
        setSuccess(response.message || "Your account is ready. Check your inbox for a verification link.");
      } else if (path === "/verify-email") {
        const confirmationToken = String(data.get("token") || token);
        await api("/api/auth/verify-email", json({ token: confirmationToken }));
        window.location.replace("/login?verified=1");
        return;
      } else if (path === "/forgot-password") {
        const response = await api<{ message?: string }>("/api/auth/forgot-password", json({ email }));
        setSuccess(response.message || "If an account exists for that email, reset instructions are on their way.");
      } else {
        const confirmationToken = String(data.get("token") || token);
        await api("/api/auth/reset-password", json({ token: confirmationToken, password: String(data.get("password") || "") }));
        setSuccess("Your password has been updated. Sign in with your new password.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };
  const details: Record<string, { overline: string; title: string; copy: string; submit: string }> = {
    "/login": { overline: "Welcome back", title: "Your next post starts here.", copy: "Sign in to pick up right where your audience is.", submit: "Sign in" },
    "/signup": { overline: "A better way to publish", title: "Make every post go further.", copy: "Create your Postwave workspace and bring your channels together.", submit: "Create account" },
    "/verify-email": { overline: "One last step", title: "Confirm your email.", copy: "Open the link in your verification email to activate your account.", submit: "Verify email" },
    "/forgot-password": { overline: "Account recovery", title: "Reset your password.", copy: "Enter your email and we'll send reset instructions if an account matches.", submit: "Send reset link" },
    "/reset-password": { overline: "Account recovery", title: "Choose a new password.", copy: "Set a secure password to get back to publishing.", submit: "Update password" },
  };
  const d = details[path] || details["/login"];
  const isToken = path === "/verify-email" || path === "/reset-password";
  return <div className="flex min-h-[100dvh] flex-col bg-[#f5f9fa]">
    <header className="flex h-[76px] items-center px-5 sm:px-10"><Brand /></header>
    <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-5 pb-12 pt-4 md:grid-cols-[1fr_450px] md:px-10">
      <div className="hidden max-w-xl md:block">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d8ebe9] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#428982]"><span className="h-1.5 w-1.5 rounded-full bg-[#3bb7a3]" /> Your channels, in sync</div>
        <h1 aria-label="One post. Every platform." className="font-display text-[54px] font-extrabold leading-[1.08] tracking-[-.055em] text-[#193a50]">One post.<br /><span className="text-[#176f98]">Every platform.</span></h1>
        <p className="mt-5 max-w-md text-base leading-7 text-[#718696]">A quieter, clearer way to publish across the social accounts you own.</p>
        <div className="relative mt-12 max-w-md overflow-hidden rounded-[28px] border border-[#d8e8eb] bg-[#eaf5f5] p-6">
          <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full border-[32px] border-white/50" /><div className="absolute -bottom-16 left-24 h-44 w-44 rounded-full border-[25px] border-[#cce9e6]/70" />
          <div className="relative rounded-2xl border border-white bg-white/90 p-4 shadow-[0_18px_40px_rgba(36,91,108,.09)]">
            <div className="flex items-center gap-2 text-xs font-bold text-[#35596d]"><Brand compact /> <span>Compose once</span><ArrowRight className="ml-auto h-4 w-4 text-[#7a9da9]" /></div>
            <div className="mt-4 h-2 w-4/5 rounded-full bg-[#e5eef1]" /><div className="mt-2 h-2 w-3/5 rounded-full bg-[#e5eef1]" />
            <div className="mt-5 flex gap-2">{["IG", "in", "X"].map((item) => <span key={item} className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#edf7f5] text-[10px] font-bold text-[#358a83]">{item}</span>)}<span className="ml-auto flex items-center gap-1 text-[11px] font-bold text-[#39877f]"><Check className="h-3.5 w-3.5" /> Ready to publish</span></div>
          </div>
        </div>
      </div>
      <Card className="mx-auto w-full max-w-[450px] p-6 sm:p-9">
        <div className="mb-7 md:hidden"><Brand /></div>
        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#378c8a]">{d.overline}</p>
        <h2 className="font-display mt-2 text-[27px] font-extrabold leading-tight tracking-[-.04em] text-[#1b3b50]">{d.title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#778b98]">{d.copy}</p>
        <form onSubmit={submit} className="mt-7 grid gap-4">
          {path === "/signup" && <Field label="Your name" name="name" placeholder="Name as your audience knows you" autoComplete="name" required />}
          {(path === "/login" || path === "/signup" || path === "/forgot-password") && <Field label="Email address" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />}
          {isToken && !fromLink && <Field label="Email token" name="token" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste the token from your email" required />}
          {(path === "/login" || path === "/signup" || path === "/reset-password") && <Field label="Password" name="password" type="password" placeholder={path === "/login" ? "Your password" : "At least 8 characters"} autoComplete={path === "/login" ? "current-password" : "new-password"} minLength={8} required />}
          {verifying && <Notice tone="success">Confirming your email…</Notice>}
          {message && <Notice>{message}</Notice>}{success && <Notice tone="success">{success}</Notice>}
          <Button type="submit" disabled={busy || verifying} className="mt-1 w-full">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{d.submit}<ArrowRight className="h-4 w-4" /></Button>
        </form>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-[#758a97]">
          {path === "/login" && <><a className="font-semibold text-[#227a91] hover:underline" href="/forgot-password">Forgot password?</a><span>New to Postwave? <a className="font-bold text-[#227a91] hover:underline" href="/signup">Create account</a></span></>}
          {path === "/signup" && <span>Already have an account? <a className="font-bold text-[#227a91] hover:underline" href="/login">Sign in</a></span>}
          {path === "/verify-email" && <span>Need a new account? <a className="font-bold text-[#227a91] hover:underline" href="/signup">Sign up</a></span>}
          {(path === "/forgot-password" || path === "/reset-password") && <a className="inline-flex items-center gap-1 font-semibold text-[#227a91] hover:underline" href="/login"><ArrowLeft className="h-3.5 w-3.5" /> Back to sign in</a>}
        </div>
      </Card>
    </main><Footer />
  </div>;
}

function AppFrame({ user, onLogout, children }: { user: User; onLogout: () => void; children: ReactNode }) {
  const [mobileMenu, setMobileMenu] = useState(false);
  const items = [{ href: "/dashboard", label: "Overview", icon: Globe2 }, { href: "/compose", label: "Compose", icon: Plus }, { href: "/calendar", label: "Calendar", icon: CalendarDays }, { href: "/drafts", label: "Drafts", icon: FileText }, { href: "/accounts", label: "Accounts", icon: Link2 }, { href: "/history", label: "History", icon: Clock3 }, { href: "/billing", label: "Billing", icon: CreditCard }];
  const pathname = usePathname() ?? "/dashboard";
  return <div className="min-h-[100dvh] bg-[#f5f9fa]">
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

function Dashboard() {
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

function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
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
      window.location.assign(result.authUrl);
    } catch (e) { setError(e instanceof Error ? e.message : `Couldn't connect ${platformNames[platform]}.`); setBusy(""); }
  };
  const disconnect = async (account: Account) => {
    if (!window.confirm(`Disconnect ${account.displayName || account.username || platformNames[account.platform] || account.platform}?`)) return;
    setBusy(account.id); setError(""); setNotice("");
    try { await api(`/api/accounts/${encodeURIComponent(account.id)}`, { method: "DELETE" }); setNotice("Account disconnected."); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't disconnect account."); } finally { setBusy(""); }
  };
  return <>
    <PageTitle eyebrow="Your channels" title="Connected accounts" description="Connect your own social identities. Every account stays yours, and only you can publish to it." />
    {error && <div className="mb-4"><Notice>{error}</Notice></div>}{notice && <div className="mb-4"><Notice tone="success">{notice}</Notice></div>}
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
function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "instagram") return <Instagram className="h-4 w-4" />;
  if (platform === "threads" || platform === "reddit") return <MessageCircle className="h-4 w-4" />;
  if (platform === "linkedin") return <span className="text-xs font-extrabold">in</span>;
  if (platform === "twitter" || platform === "bluesky") return <AtSign className="h-4 w-4" />;
  if (platform === "youtube") return <Video className="h-4 w-4" />;
  if (platform === "tiktok") return <Music2 className="h-4 w-4" />;
  return <Globe2 className="h-4 w-4" />;
}

function zonedInputToIso(value: string, timezone: string) {
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

function CalendarPage({ savedTimezone = "Africa/Lagos" }: { savedTimezone?: string }) {
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

function DraftsPage() {
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

function ComposePage({ savedTimezone = "Africa/Lagos" }: { savedTimezone?: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draftId, setDraftId] = useState("");
  const [timezone, setTimezone] = useState(savedTimezone);
  const [scheduledFor, setScheduledFor] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const activeAccounts = useMemo(() => accounts.filter((account) => account.isActive), [accounts]);
  const selectedAccounts = useMemo(() => activeAccounts.filter((account) => selected.includes(account.id)), [activeAccounts, selected]);
  const refreshAccounts = useCallback(async () => {
    setAccountsLoading(true); setAccountsError("");
    try { const result = await api<{ accounts: Account[] }>("/api/accounts"); const list = result.accounts || []; setAccounts(list); }
    catch (e) { setAccountsError(e instanceof Error ? e.message : "Couldn't load your accounts."); } finally { setAccountsLoading(false); }
  }, []);
  useEffect(() => { void refreshAccounts(); }, [refreshAccounts]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("draft");
    if (!id) return;
    setDraftId(id); setDraftLoading(true); setError("");
    api<{ post: Post }>(`/api/posts/${encodeURIComponent(id)}`).then(({ post }) => {
      setContent(post.content || "");
      setSelected(post.platforms?.map((target) => target.accountId) || []);
      const media = post.media || [];
      setAssets(media.map((item) => ({ ...item, key: item.key || "" })));
      setFiles([]);
      setTimezone(post.timezone || "Africa/Lagos");
      if (post.scheduledAt) {
        const date = new Date(post.scheduledAt);
        setScheduledFor(new Intl.DateTimeFormat("sv-SE", { timeZone: post.timezone || "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date).replace(" ", "T"));
      }
    }).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load this draft.")).finally(() => setDraftLoading(false));
  }, []);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const uploadFiles = async (fileList: FileList | null) => {
    // Copy the files first: the file input is cleared right after this is called.
    const picked = fileList ? Array.from(fileList) : [];
    if (!picked.length) return;
    setUploading(true); setError(""); setNotice("");
    const uploaded: MediaAsset[] = [];
    const uploadedFiles: File[] = [];
    const failures: string[] = [];
    for (const file of picked) {
      try {
        let response: Response;
        try { response = await fetch("/api/media/upload", { method: "POST", credentials: "include", headers: { "Content-Type": file.type }, body: file }); }
        catch { throw new Error(`Couldn't upload ${file.name}. Check your connection and try again.`); }
        const completed = await response.json().catch(() => ({})) as { media?: MediaAsset; message?: string };
        if (!response.ok || !completed.media) throw new Error(completed.message || `Upload failed for ${file.name} (error ${response.status}).`);
        uploaded.push(completed.media); uploadedFiles.push(file);
      } catch (e) { failures.push(e instanceof Error ? e.message : `Couldn't upload ${file.name}.`); }
    }
    if (uploaded.length) {
      setAssets((current) => [...current, ...uploaded]);
      setFiles((current) => [...current, ...uploadedFiles]);
      setNotice(failures.length ? `${uploaded.length} of ${picked.length} files uploaded.` : uploaded.length > 1 ? `${uploaded.length} files uploaded and ready to publish.` : "Media uploaded and ready to publish.");
    }
    if (failures.length) setError(failures.join(" "));
    setUploading(false);
  };

  const removeFile = (index: number) => { setFiles((current) => current.filter((_, i) => i !== index)); setAssets((current) => current.filter((_, i) => i !== index)); };
  const submitPost = async (intent: "draft" | "schedule" | "publish_now") => {
    setBusy(true); setError(""); setNotice("");
    try {
      if (intent === "schedule" && !scheduledFor) throw new Error("Choose a date and time before scheduling.");
      const payload: Record<string, unknown> = { intent, content, accountIds: selected, mediaAssetIds: assets.map((asset) => asset.id), timezone };
      if (draftId) payload.draftId = draftId;
      if (intent === "schedule") payload.scheduledFor = zonedInputToIso(scheduledFor, timezone);
      const saved = await api<{ postId: string; status: string }>("/api/posts", json(payload));
      if (intent === "draft") setDraftId(saved.postId);
      setNotice(intent === "draft" ? "Draft saved. Find it anytime in Drafts." : intent === "schedule" ? "Your post is scheduled." : "Your post was sent. Check History for the result on each platform.");
      if (intent !== "draft") { setContent(""); setSelected([]); setFiles([]); setAssets([]); setDraftId(""); setScheduledFor(""); }
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't publish your post."); }
    finally { setBusy(false); }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void submitPost("publish_now"); };
  const chooseFiles = (event: ChangeEvent<HTMLInputElement>) => { void uploadFiles(event.target.files); event.target.value = ""; };
  return <>
    <PageTitle eyebrow={draftId ? "Draft in progress" : "Make it yours"} title={draftId ? "Edit your draft" : "Compose a post"} description="One post. Every platform. Shape it here, then choose when it goes live." />
    {draftLoading && <div className="mb-4"><Skeleton className="h-12 w-full" /></div>}
    <form onSubmit={submit} className="grid items-start gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <div className="grid gap-5">
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-display font-bold text-[#29495c]">Your message</h2><p className="mt-1 text-xs text-[#8798a1]">A shared post caption for selected platforms.</p></div><span className="text-xs font-semibold text-[#80939c]">{content.length} characters</span></div>
          <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={5000} rows={7} placeholder="What would you like to share?" className="w-full resize-y rounded-xl border border-[#dce7eb] bg-[#fbfdfd] p-4 text-sm leading-6 text-[#29495c] outline-none placeholder:text-[#a0afb6] focus:border-[#4eabb3] focus:ring-4 focus:ring-[#dff3ef]" />
          <AiCaptionAssistant content={content} platforms={Array.from(new Set(selectedAccounts.map((account) => String(account.platform))))} onUse={(text) => setContent(text.slice(0, 5000))} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8798a1]"><span>Keep your copy clear across every channel.</span><span>Up to 5,000 characters</span></div>
        </Card>
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-display font-bold text-[#29495c]">Media</h2><p className="mt-1 text-xs text-[#8798a1]">Attach images or video to your post.</p></div><span className="text-[11px] text-[#8b9ba3]">{assets.length} attached</span></div>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="sr-only" onChange={chooseFiles} id="post-media" />
          <label htmlFor="post-media" className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#bfd5db] bg-[#f8fbfc] px-5 py-7 text-center transition hover:border-[#77b8b7] hover:bg-[#f2faf8]">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e5f3f0] text-[#3d9288]">{uploading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}</span><span className="text-sm font-bold text-[#456477]">{uploading ? "Uploading media…" : "Choose images or videos"}</span><span className="mt-1 text-xs text-[#899aa3]">Select files from your device</span>
          </label>
          {assets.length > 0 && <div className="mt-3 grid gap-2">{assets.map((asset, index) => <div key={asset.id} className="flex items-center gap-3 rounded-xl border border-[#e4ecef] px-3 py-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#edf5f6] text-[#5b8996]">{asset.contentType.startsWith("image/") ? <FileImage className="h-4 w-4" /> : <ArrowDownToLine className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold text-[#466476]">{files[index]?.name || `Attached ${asset.contentType.startsWith("image/") ? "image" : "video"}`}</div><div className="mt-0.5 text-[10px] text-[#8a9ba3]">{(asset.size / 1024 / 1024).toFixed(1)} MB · uploaded</div></div><button type="button" onClick={() => { setAssets((current) => current.filter((_, i) => i !== index)); setFiles((current) => current.filter((_, i) => i !== index)); }} aria-label={`Remove media ${index + 1}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8799a1] hover:bg-[#fff0ed] hover:text-[#a75245]"><X className="h-4 w-4" /></button>
          </div>)}</div>}
        </Card>
      </div>
      <div className="grid gap-5">
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between"><div><h2 className="font-display font-bold text-[#29495c]">Publish to</h2><p className="mt-1 text-xs text-[#8798a1]">Select one or more active accounts.</p></div><span className="rounded-full bg-[#e7f4f1] px-2.5 py-1 text-[11px] font-bold text-[#448a80]">{selected.length} selected</span></div>
          {accountsLoading ? <div className="grid gap-2">{[1, 2, 3].map((n) => <Skeleton key={n} className="h-12 w-full" />)}</div> : accountsError ? <div className="grid gap-3"><Notice>{accountsError}</Notice><Button type="button" variant="secondary" onClick={() => void refreshAccounts()}><RefreshCw className="h-4 w-4" />Retry</Button></div> : activeAccounts.length ? <div className="grid max-h-[290px] gap-2 overflow-auto pr-1 scrollbar-thin">{activeAccounts.map((account) => <label key={account.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${selected.includes(account.id) ? "border-[#9ed0c8] bg-[#f1faf7]" : "border-[#e5edef] hover:bg-[#fafcfc]"}`}>
            <input type="checkbox" checked={selected.includes(account.id)} onChange={() => toggle(account.id)} className="h-4 w-4 accent-[#238c8d]" /><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf5f5] text-[#578993]"><PlatformIcon platform={account.platform} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-[#486779]">{account.displayName || platformNames[account.platform] || account.platform}</span><span className="mt-0.5 block truncate text-[10px] text-[#8a9aa3]">{account.username ? `@${account.username.replace(/^@/, "")}` : platformNames[account.platform] || account.platform}</span></span>{selected.includes(account.id) && <CheckCircle2 className="h-4 w-4 text-[#3d9b8c]" />}
          </label>)}</div> : <EmptyState icon={Link2} title="Connect an account first" detail="Your connected accounts will appear here as publishing destinations." action={<a href="/accounts" className="text-sm font-bold text-[#267b8c]">Go to accounts <ArrowRight className="ml-1 inline h-4 w-4" /></a>} />}
        </Card>
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-display font-bold text-[#29495c]">Platform preview</h2><p className="mt-1 text-xs text-[#8798a1]">Preview is based on the selected accounts.</p></div><ChevronDown className="h-4 w-4 text-[#8a9ba3]" /></div>
          {selectedAccounts.length ? <div className="grid gap-3">{selectedAccounts.map((account) => {
            const characters = Array.from(content).length;
            const limit = platformCharacterLimits[account.platform];
            const overLimit = Boolean(limit && characters > limit);
            return <div key={account.id} className="rounded-xl border border-[#e5edef] bg-[#fbfdfd] p-3.5">
              <div className="mb-2 flex items-center gap-2"><span className="text-[#568994]"><PlatformIcon platform={account.platform} /></span><span className="text-xs font-bold text-[#4b687a]">{platformNames[account.platform] || account.platform}</span><span className={`ml-auto text-[10px] ${overLimit ? "font-bold text-[#a75245]" : "text-[#8999a2]"}`}>{characters}{limit ? ` / ${limit}` : ""} characters</span></div>
              <p className="whitespace-pre-wrap break-words text-xs leading-5 text-[#6d8390]">{content || "Your post text will appear here."}</p>
              {assets.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2">{assets.map((asset, mediaIndex) => {
                const mediaName = files[mediaIndex]?.name || "Post media";
                return asset.contentType.startsWith("image/")
                  ? <img key={asset.id} src={asset.publicUrl} alt={`${mediaName} preview`} loading="lazy" className="aspect-video w-full rounded-lg border border-white/70 object-cover shadow-sm" />
                  : <video key={asset.id} src={asset.publicUrl} controls preload="metadata" aria-label={`${mediaName} preview`} className="aspect-video w-full rounded-lg border border-white/70 bg-black/5 object-cover shadow-sm" />;
              })}</div>}
              {overLimit && <p className="mt-2 text-[11px] font-semibold text-[#a75245]" role="alert">This post is over the {platformNames[account.platform]} character limit.</p>}
              {(() => {
                const rule = platformRequirements[account.platform];
                if (!rule) return null;
                const met = rule.met(assets.some((asset) => asset.contentType.startsWith("image/")), assets.some((asset) => asset.contentType.startsWith("video/")));
                return <p className={`mt-2 text-[11px] font-semibold ${met ? "text-[#6d8390]" : "text-[#a75245]"}`} role={met ? undefined : "alert"}>{met ? "" : "Required: "}{rule.note}</p>;
              })()}
              {content.length === 0 && <p className="mt-2 text-[10px] text-[#a0afb5]">Write a caption to preview the post.</p>}
            </div>;
          })}</div> : <div className="rounded-xl border border-dashed border-[#d5e3e6] bg-[#f9fbfb] px-4 py-6 text-center text-xs text-[#8798a1]">Select accounts to see a preview and character count.</div>}
          <p className="mt-3 text-[10px] leading-4 text-[#92a0a7]">Counts are estimates; platform rules and URL or emoji weighting can vary.</p>
        </Card>
        {error && <Notice>{error}</Notice>}{notice && <Notice tone="success">{notice}</Notice>}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="secondary" disabled={busy || uploading || (!content.trim() && !assets.length)} onClick={() => void submitPost("draft")}><Save className="h-4 w-4" />Save draft</Button>
          <Button type="button" variant="secondary" disabled={busy || uploading || (!content.trim() && !assets.length) || !selected.length} onClick={() => setScheduleOpen((open) => !open)}><CalendarDays className="h-4 w-4" />Schedule</Button>
        </div>
        {scheduleOpen && <Card className="grid gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-[#29495c]"><Clock className="h-4 w-4 text-[#318b91]" />Choose a publishing time</div>
          <Field label="Date and time" type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
          <Field label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} list="postwave-timezones" />
          <datalist id="postwave-timezones"><option value="Africa/Lagos" /><option value="Europe/London" /><option value="America/New_York" /><option value="America/Los_Angeles" /><option value="Asia/Tokyo" /></datalist>
          <p className="text-[11px] text-[#7e929d]">Scheduled using {timezone}.</p>
          <Button type="button" disabled={busy || !scheduledFor || !selected.length} onClick={() => void submitPost("schedule")}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}Confirm schedule</Button>
        </Card>}
        <Button type="submit" disabled={busy || uploading || accountsLoading || !content.trim() || !selected.length || Boolean(accountsError)} className="h-12 w-full text-sm">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{busy ? "Publishing…" : "Publish now"}<ArrowRight className="ml-auto h-4 w-4" /></Button>
        <p className="text-center text-[11px] text-[#8b9ba3]">Your post will be sent to the selected accounts right away.</p>
      </div>
    </form>
  </>;
}

function HistoryPage() {
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

export function PostwaveShell() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const pathname = usePathname() ?? "/";
  const path = pathname.replace(/\/$/, "") || "/";
  const authRoutes = ["/login", "/signup", "/verify-email", "/forgot-password", "/reset-password"];
  const protectedRoutes = ["/dashboard", "/accounts", "/compose", "/history", "/calendar", "/drafts", "/"];
  useEffect(() => {
    let live = true;
    api<{ user: User | null }>("/api/auth/me").then((result) => { if (live) setUser(result.user); }).catch(() => { if (live) setUser(null); }).finally(() => { if (live) setAuthLoading(false); });
    return () => { live = false; };
  }, []);
  const logout = async () => {
    try { await api("/api/auth/logout", { method: "POST" }); } finally { setUser(null); window.location.href = "/login"; }
  };
  const refreshUser = () => { api<{ user: User | null }>("/api/auth/me").then((result) => setUser(result.user)).catch(() => setUser(null)); };
  if (authRoutes.includes(path)) return <><style>{`
    :root{--paper:#f2f8fa;--surface:rgba(255,255,255,.9);--burgundy:#176f98;--burgundy-deep:#125c7d;--burgundy-soft:#e5f3f3;--ink:#18384d;--muted:#718796;--line:#dce9ed}
    body{background:radial-gradient(ellipse at 5% 0%,rgba(158,220,218,.22),transparent 36rem),#f2f8fa!important;color:#18384d!important}
    [class*="bg-[#f5f9fa]"]{background-color:#f2f8fa!important}[class*="bg-[#f9fcfc]"]{background-color:rgba(249,253,253,.95)!important}
    [class*="bg-[#751f3b]"],[class*="bg-[#641d36]"]{background-color:#176f98!important}
    [class*="bg-[#176f98]"]{background-color:#176f98!important}[class*="bg-[#176f98]"]:hover{background-color:#125c7d!important}
    [class*="bg-[#eaf5f4]"],[class*="bg-[#e6f3f2]"],[class*="bg-[#f1faf7]"],[class*="bg-[#e7f4f1]"],[class*="bg-[#edf5f6]"],[class*="bg-[#edf5f5]"],[class*="bg-[#e8f4f2]"],[class*="bg-[#e5f3f0]"],[class*="bg-[#e6f4f1]"],[class*="bg-[#e3f5f1]"]{background-color:#e7f4f3!important}
    [class*="text-[#641d36]"],[class*="text-[#751f3b]"],[class*="text-[#19799a]"],[class*="text-[#176f98]"],[class*="text-[#216f79]"],[class*="text-[#227a91]"],[class*="text-[#267b8c]"],[class*="text-[#287c91]"],[class*="text-[#388b91]"],[class*="text-[#378c8a]"],[class*="text-[#348d8a]"],[class*="text-[#398b81]"],[class*="text-[#3c8e87]"],[class*="text-[#3d9288]"],[class*="text-[#3d9b8c]"],[class*="text-[#428982]"],[class*="text-[#438e8b]"],[class*="text-[#448a80]"],[class*="text-[#45988a]"],[class*="text-[#478f8a]"],[class*="text-[#528491]"],[class*="text-[#568994]"],[class*="text-[#578993]"],[class*="text-[#5b8996]"]{color:#176f98!important}
    section.rounded-2xl{border-color:rgba(48,105,126,.14)!important;box-shadow:0 12px 34px rgba(32,78,95,.06),0 2px 7px rgba(32,78,95,.03)!important}
    header.sticky{background:rgba(248,252,252,.88)!important;border-color:#dce9ed!important}
    input:not([type=checkbox]),textarea{border-color:#dce9ed!important;color:#18384d!important}input:not([type=checkbox]):focus,textarea:focus{border-color:#4eabb3!important;--tw-ring-color:rgba(78,171,179,.16)!important}
    input[type=checkbox]{accent-color:#187c91!important}button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible{outline-color:rgba(23,111,152,.42)!important}
    ::selection{color:#125c7d;background:#cfeae8}
[class*="text-[#145a7c]"]{color:#e7f3fc!important}

/* Postwave glass system — midnight navy, cool cyan and restrained electric blue. */
:root{color-scheme:dark;--ink:#edf7ff;--muted:#91a8bb;--line:rgba(164,203,226,.15);--paper:#07111f;--surface:rgba(15,31,49,.76);--burgundy:#59d9f2;--burgundy-deep:#35b8df;--burgundy-soft:rgba(76,190,221,.12);--rose:#648dff}
html,body{background:#07111f!important;color:#edf7ff!important}
body{background:radial-gradient(ellipse at 12% -10%,rgba(42,126,180,.25),transparent 38rem),radial-gradient(ellipse at 95% 20%,rgba(55,87,190,.18),transparent 34rem),radial-gradient(ellipse at 55% 110%,rgba(27,139,159,.12),transparent 38rem),#07111f!important}
[class*="bg-[#f5f9fa]"],[class*="bg-[#f2f8fa]"]{background-color:#07111f!important}
[class*="bg-[#f9fcfc]"],[class*="bg-[#fbfdfd]"],[class*="bg-[#f8fbfc]"],[class*="bg-[#fafcfc]"],[class*="bg-white"]{background-color:rgba(17,35,54,.72)!important}
[class*="bg-[#eaf5f4]"],[class*="bg-[#e6f3f2]"],[class*="bg-[#f1faf7]"],[class*="bg-[#e7f4f1]"],[class*="bg-[#edf5f6]"],[class*="bg-[#edf5f5]"],[class*="bg-[#e8f4f2]"],[class*="bg-[#e5f3f0]"],[class*="bg-[#e6f4f1]"],[class*="bg-[#e3f5f1]"],[class*="bg-[#e9f1f9]"],[class*="bg-[#eff5e9]"],[class*="bg-[#f4f8f8]"]{background-color:rgba(72,164,194,.13)!important}
[class*="bg-[#176f98]"]{background:linear-gradient(135deg,#2bbbdc,#477bff)!important;box-shadow:0 8px 26px rgba(48,163,224,.22)!important}
[class*="bg-[#176f98]"]:hover{filter:brightness(1.12)}
[class*="border-[#e0eaed]"],[class*="border-[#e2ecef]"],[class*="border-[#e7eef0]"],[class*="border-[#e4ecef]"],[class*="border-[#e5edef]"],[class*="border-[#dce8ed]"],[class*="border-[#dce7eb]"],[class*="border-[#d9e7eb]"],[class*="border-[#edf1f2]"],[class*="border-[#edf2f3]"],[class*="border-[#e3ecee]"],[class*="border-[#e2ebed]"]{border-color:rgba(164,203,226,.15)!important}
[class*="text-[#17364c]"],[class*="text-[#193a50]"],[class*="text-[#1b3b50]"],[class*="text-[#183348]"],[class*="text-[#234459]"],[class*="text-[#29495c]"],[class*="text-[#315064]"],[class*="text-[#355367]"],[class*="text-[#35596d]"],[class*="text-[#1e4657]"],[class*="text-[#3f5d6e]"],[class*="text-[#3a586a]"],[class*="text-[#38596a]"],[class*="text-[#36576b]"],[class*="text-[#456477]"],[class*="text-[#486779]"],[class*="text-[#476477]"],[class*="text-[#4b687a]"],[class*="text-[#4b687a]"],[class*="text-[#466476]"],[class*="text-[#486779]"],[class*="text-[#547082]"],[class*="text-[#57767f]"],[class*="text-[#597687]"],[class*="text-[#3f5d6e]"],[class*="text-[#3a586a]"]{color:#e7f3fc!important}
[class*="text-[#718696]"],[class*="text-[#758a97]"],[class*="text-[#778b98]"],[class*="text-[#7a8e9b]"],[class*="text-[#8093a0]"],[class*="text-[#82949f]"],[class*="text-[#8496a0]"],[class*="text-[#8798a1]"],[class*="text-[#8a9aa3]"],[class*="text-[#8b9ba3]"],[class*="text-[#8b9ba5]"],[class*="text-[#899aa3]"],[class*="text-[#8a9aa4]"],[class*="text-[#8699a3]"],[class*="text-[#92a0a7]"],[class*="text-[#a0afb6]"]{color:#91a8bb!important}
[class*="text-[#19799a]"],[class*="text-[#176f98]"],[class*="text-[#216f79]"],[class*="text-[#227a91]"],[class*="text-[#267b8c]"],[class*="text-[#287c91]"],[class*="text-[#388b91]"],[class*="text-[#378c8a]"],[class*="text-[#348d8a]"],[class*="text-[#398b81]"],[class*="text-[#3c8e87]"],[class*="text-[#3d9288]"],[class*="text-[#3d9b8c]"],[class*="text-[#428982]"],[class*="text-[#438e8b]"],[class*="text-[#448a80]"],[class*="text-[#45988a]"],[class*="text-[#478f8a]"],[class*="text-[#528491]"],[class*="text-[#568994]"],[class*="text-[#578993]"],[class*="text-[#5b8996]"]{color:#69d9ef!important}
section.rounded-2xl{background:linear-gradient(145deg,rgba(19,39,60,.84),rgba(10,24,40,.76))!important;border:1px solid rgba(151,205,231,.16)!important;box-shadow:0 18px 55px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.045)!important;-webkit-backdrop-filter:blur(22px);backdrop-filter:blur(22px)}
header.sticky{background:rgba(7,17,31,.78)!important;border-color:rgba(164,203,226,.13)!important;-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px)}
input:not([type="checkbox"]),textarea,select{background:rgba(5,16,29,.62)!important;border-color:rgba(164,203,226,.18)!important;color:#edf7ff!important}
input::placeholder,textarea::placeholder{color:#718ba1!important}
input:not([type="checkbox"]):focus,textarea:focus{border-color:#59d9f2!important;--tw-ring-color:rgba(89,217,242,.15)!important}
input[type="checkbox"]{accent-color:#59d9f2!important}
button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid rgba(89,217,242,.52)!important;outline-offset:2px}
[class*="border-dashed"]{border-color:rgba(117,187,214,.28)!important}
[class*="divide-[#edf2f3]"]>*+*,[class*="divide-[#edf1f2]"]>*+*{border-color:rgba(164,203,226,.12)!important}
[class*="shadow-"]{--tw-shadow-color:rgba(0,0,0,.18)}
.scrollbar-thin::-webkit-scrollbar-thumb{background:rgba(111,177,205,.28)}
::selection{color:#06121e;background:rgba(89,217,242,.7)}
@media(prefers-reduced-motion:no-preference){section.rounded-2xl{transition:border-color .22s ease,transform .22s ease,box-shadow .22s ease}section.rounded-2xl:hover{border-color:rgba(89,217,242,.25)!important;box-shadow:0 22px 60px rgba(0,0,0,.26),0 0 28px rgba(55,174,218,.055)!important}}

  `}</style><AuthPage path={path} onAuth={refreshUser} /></>;
  if (!protectedRoutes.includes(path)) return <AuthPage path="/login" onAuth={refreshUser} />;
  if (authLoading) return <div className="flex min-h-[100dvh] flex-col bg-[#f5f9fa]"><header className="h-[68px] px-5 py-4"><Brand /></header><main className="mx-auto w-full max-w-5xl flex-1 px-5 pt-10"><Skeleton className="h-9 w-64" /><Skeleton className="mt-3 h-4 w-80" /><div className="mt-8 grid gap-4 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div><Skeleton className="mt-6 h-64" /></main><Footer /></div>;
  if (!user) return <AuthPage path="/login" onAuth={refreshUser} />;
  const view = path === "/accounts" ? <AccountsPage /> : path === "/compose" ? <ComposePage savedTimezone={user.timezone} /> : path === "/history" ? <HistoryPage /> : path === "/calendar" ? <CalendarPage savedTimezone={user.timezone} /> : path === "/drafts" ? <DraftsPage /> : <Dashboard />;
  return <><style>{`
    :root{--paper:#f2f8fa;--surface:rgba(255,255,255,.9);--burgundy:#176f98;--burgundy-deep:#125c7d;--burgundy-soft:#e5f3f3;--ink:#18384d;--muted:#718796;--line:#dce9ed}
    body{background:radial-gradient(ellipse at 5% 0%,rgba(158,220,218,.22),transparent 36rem),#f2f8fa!important;color:#18384d!important}
    [class*="bg-[#f5f9fa]"]{background-color:#f2f8fa!important}[class*="bg-[#f9fcfc]"]{background-color:rgba(249,253,253,.95)!important}
    [class*="bg-[#176f98]"]{background-color:#176f98!important}[class*="bg-[#176f98]"]:hover{background-color:#125c7d!important}
    [class*="bg-[#eaf5f4]"],[class*="bg-[#e6f3f2]"],[class*="bg-[#f1faf7]"],[class*="bg-[#e7f4f1]"],[class*="bg-[#edf5f6]"],[class*="bg-[#edf5f5]"],[class*="bg-[#e8f4f2]"],[class*="bg-[#e5f3f0]"],[class*="bg-[#e6f4f1]"],[class*="bg-[#e3f5f1]"]{background-color:#e7f4f3!important}
    [class*="text-[#641d36]"],[class*="text-[#751f3b]"],[class*="text-[#19799a]"],[class*="text-[#176f98]"],[class*="text-[#216f79]"],[class*="text-[#227a91]"],[class*="text-[#267b8c]"],[class*="text-[#287c91]"],[class*="text-[#388b91]"],[class*="text-[#378c8a]"],[class*="text-[#348d8a]"],[class*="text-[#398b81]"],[class*="text-[#3c8e87]"],[class*="text-[#3d9288]"],[class*="text-[#3d9b8c]"],[class*="text-[#428982]"],[class*="text-[#438e8b]"],[class*="text-[#448a80]"],[class*="text-[#45988a]"],[class*="text-[#478f8a]"],[class*="text-[#528491]"],[class*="text-[#568994]"],[class*="text-[#578993]"],[class*="text-[#5b8996]"]{color:#176f98!important}
    section.rounded-2xl{border-color:rgba(48,105,126,.14)!important;box-shadow:0 12px 34px rgba(32,78,95,.06),0 2px 7px rgba(32,78,95,.03)!important}
    header.sticky{background:rgba(248,252,252,.88)!important;border-color:#dce9ed!important}
    input:not([type=checkbox]),textarea{border-color:#dce9ed!important;color:#18384d!important}input:not([type=checkbox]):focus,textarea:focus{border-color:#4eabb3!important;--tw-ring-color:rgba(78,171,179,.16)!important}
    input[type=checkbox]{accent-color:#187c91!important}button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible{outline-color:rgba(23,111,152,.42)!important}::selection{color:#125c7d;background:#cfeae8}
[class*="text-[#145a7c]"]{color:#e7f3fc!important}

/* Postwave glass system — midnight navy, cool cyan and restrained electric blue. */
:root{color-scheme:dark;--ink:#edf7ff;--muted:#91a8bb;--line:rgba(164,203,226,.15);--paper:#07111f;--surface:rgba(15,31,49,.76);--burgundy:#59d9f2;--burgundy-deep:#35b8df;--burgundy-soft:rgba(76,190,221,.12);--rose:#648dff}
html,body{background:#07111f!important;color:#edf7ff!important}
body{background:radial-gradient(ellipse at 12% -10%,rgba(42,126,180,.25),transparent 38rem),radial-gradient(ellipse at 95% 20%,rgba(55,87,190,.18),transparent 34rem),radial-gradient(ellipse at 55% 110%,rgba(27,139,159,.12),transparent 38rem),#07111f!important}
[class*="bg-[#f5f9fa]"],[class*="bg-[#f2f8fa]"]{background-color:#07111f!important}
[class*="bg-[#f9fcfc]"],[class*="bg-[#fbfdfd]"],[class*="bg-[#f8fbfc]"],[class*="bg-[#fafcfc]"],[class*="bg-white"]{background-color:rgba(17,35,54,.72)!important}
[class*="bg-[#eaf5f4]"],[class*="bg-[#e6f3f2]"],[class*="bg-[#f1faf7]"],[class*="bg-[#e7f4f1]"],[class*="bg-[#edf5f6]"],[class*="bg-[#edf5f5]"],[class*="bg-[#e8f4f2]"],[class*="bg-[#e5f3f0]"],[class*="bg-[#e6f4f1]"],[class*="bg-[#e3f5f1]"],[class*="bg-[#e9f1f9]"],[class*="bg-[#eff5e9]"],[class*="bg-[#f4f8f8]"]{background-color:rgba(72,164,194,.13)!important}
[class*="bg-[#176f98]"]{background:linear-gradient(135deg,#2bbbdc,#477bff)!important;box-shadow:0 8px 26px rgba(48,163,224,.22)!important}
[class*="bg-[#176f98]"]:hover{filter:brightness(1.12)}
[class*="border-[#e0eaed]"],[class*="border-[#e2ecef]"],[class*="border-[#e7eef0]"],[class*="border-[#e4ecef]"],[class*="border-[#e5edef]"],[class*="border-[#dce8ed]"],[class*="border-[#dce7eb]"],[class*="border-[#d9e7eb]"],[class*="border-[#edf1f2]"],[class*="border-[#edf2f3]"],[class*="border-[#e3ecee]"],[class*="border-[#e2ebed]"]{border-color:rgba(164,203,226,.15)!important}
[class*="text-[#17364c]"],[class*="text-[#193a50]"],[class*="text-[#1b3b50]"],[class*="text-[#183348]"],[class*="text-[#234459]"],[class*="text-[#29495c]"],[class*="text-[#315064]"],[class*="text-[#355367]"],[class*="text-[#35596d]"],[class*="text-[#1e4657]"],[class*="text-[#3f5d6e]"],[class*="text-[#3a586a]"],[class*="text-[#38596a]"],[class*="text-[#36576b]"],[class*="text-[#456477]"],[class*="text-[#486779]"],[class*="text-[#476477]"],[class*="text-[#4b687a]"],[class*="text-[#4b687a]"],[class*="text-[#466476]"],[class*="text-[#486779]"],[class*="text-[#547082]"],[class*="text-[#57767f]"],[class*="text-[#597687]"],[class*="text-[#3f5d6e]"],[class*="text-[#3a586a]"]{color:#e7f3fc!important}
[class*="text-[#718696]"],[class*="text-[#758a97]"],[class*="text-[#778b98]"],[class*="text-[#7a8e9b]"],[class*="text-[#8093a0]"],[class*="text-[#82949f]"],[class*="text-[#8496a0]"],[class*="text-[#8798a1]"],[class*="text-[#8a9aa3]"],[class*="text-[#8b9ba3]"],[class*="text-[#8b9ba5]"],[class*="text-[#899aa3]"],[class*="text-[#8a9aa4]"],[class*="text-[#8699a3]"],[class*="text-[#92a0a7]"],[class*="text-[#a0afb6]"]{color:#91a8bb!important}
[class*="text-[#19799a]"],[class*="text-[#176f98]"],[class*="text-[#216f79]"],[class*="text-[#227a91]"],[class*="text-[#267b8c]"],[class*="text-[#287c91]"],[class*="text-[#388b91]"],[class*="text-[#378c8a]"],[class*="text-[#348d8a]"],[class*="text-[#398b81]"],[class*="text-[#3c8e87]"],[class*="text-[#3d9288]"],[class*="text-[#3d9b8c]"],[class*="text-[#428982]"],[class*="text-[#438e8b]"],[class*="text-[#448a80]"],[class*="text-[#45988a]"],[class*="text-[#478f8a]"],[class*="text-[#528491]"],[class*="text-[#568994]"],[class*="text-[#578993]"],[class*="text-[#5b8996]"]{color:#69d9ef!important}
section.rounded-2xl{background:linear-gradient(145deg,rgba(19,39,60,.84),rgba(10,24,40,.76))!important;border:1px solid rgba(151,205,231,.16)!important;box-shadow:0 18px 55px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.045)!important;-webkit-backdrop-filter:blur(22px);backdrop-filter:blur(22px)}
header.sticky{background:rgba(7,17,31,.78)!important;border-color:rgba(164,203,226,.13)!important;-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px)}
input:not([type="checkbox"]),textarea,select{background:rgba(5,16,29,.62)!important;border-color:rgba(164,203,226,.18)!important;color:#edf7ff!important}
input::placeholder,textarea::placeholder{color:#718ba1!important}
input:not([type="checkbox"]):focus,textarea:focus{border-color:#59d9f2!important;--tw-ring-color:rgba(89,217,242,.15)!important}
input[type="checkbox"]{accent-color:#59d9f2!important}
button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid rgba(89,217,242,.52)!important;outline-offset:2px}
[class*="border-dashed"]{border-color:rgba(117,187,214,.28)!important}
[class*="divide-[#edf2f3]"]>*+*,[class*="divide-[#edf1f2]"]>*+*{border-color:rgba(164,203,226,.12)!important}
[class*="shadow-"]{--tw-shadow-color:rgba(0,0,0,.18)}
.scrollbar-thin::-webkit-scrollbar-thumb{background:rgba(111,177,205,.28)}
::selection{color:#06121e;background:rgba(89,217,242,.7)}
@media(prefers-reduced-motion:no-preference){section.rounded-2xl{transition:border-color .22s ease,transform .22s ease,box-shadow .22s ease}section.rounded-2xl:hover{border-color:rgba(89,217,242,.25)!important;box-shadow:0 22px 60px rgba(0,0,0,.26),0 0 28px rgba(55,174,218,.055)!important}}

  `}</style><AppFrame user={user} onLogout={() => void logout()}>{view}</AppFrame></>;
}
