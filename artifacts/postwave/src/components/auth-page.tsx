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

export function AuthPage({ path, onAuth }: { path: string; onAuth: () => void }) {
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
