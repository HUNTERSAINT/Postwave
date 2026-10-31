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
import { AuthPage } from "@/components/auth-page";
import { AppFrame } from "@/components/app-frame";
import { Dashboard } from "@/components/dashboard-page";
import { AccountsPage } from "@/components/accounts-page";
import { CalendarPage } from "@/components/calendar-page";
import { DraftsPage } from "@/components/drafts-page";
import { ComposePage } from "@/components/compose-page";
import { HistoryPage } from "@/components/history-page";

export function PostwaveShell() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const pathname = usePathname() ?? "/";
  const path = pathname.replace(/\/$/, "") || "/";
  const authRoutes = ["/login", "/signup", "/verify-email", "/forgot-password", "/reset-password"];
  const protectedRoutes = ["/dashboard", "/accounts", "/compose", "/history", "/calendar", "/drafts", "/analytics", "/"];

  useEffect(() => {
    let live = true;
    api<{ user: User | null }>("/api/auth/me")
      .then((result) => { if (live) setUser(result.user); })
      .catch(() => { if (live) setUser(null); })
      .finally(() => { if (live) setAuthLoading(false); });
    return () => { live = false; };
  }, []);

  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      window.location.href = "/login";
    }
  };

  const refreshUser = () => {
    void api<{ user: User | null }>("/api/auth/me")
      .then((result) => setUser(result.user))
      .catch(() => setUser(null));
  };

  if (authRoutes.includes(path)) {
    return <AuthPage path={path} onAuth={refreshUser} />;
  }

  if (!protectedRoutes.includes(path)) {
    return <AuthPage path="/login" onAuth={refreshUser} />;
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[#f5f9fa]">
        <header className="h-[68px] px-5 py-4"><Brand /></header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 pt-10">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-3 h-4 w-80" />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="mt-6 h-64" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return <AuthPage path="/login" onAuth={refreshUser} />;
  }

  const view = path === "/analytics"
    ? <AnalyticsDashboard />
    : path === "/accounts"
    ? <AccountsPage />
    : path === "/compose"
      ? <ComposePage savedTimezone={user.timezone} />
      : path === "/history"
        ? <HistoryPage />
        : path === "/calendar"
          ? <CalendarPage savedTimezone={user.timezone} />
          : path === "/drafts"
            ? <DraftsPage />
            : <Dashboard />;

  return <AppFrame user={user} onLogout={() => void logout()}>{view}</AppFrame>;
}
