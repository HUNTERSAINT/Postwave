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

export function ComposePage({ savedTimezone = "Africa/Lagos" }: { savedTimezone?: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
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
      setTitle(post.title || "");
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
      const payload: Record<string, unknown> = { intent, title, content, accountIds: selected, mediaAssetIds: assets.map((asset) => asset.id), timezone };
      if (draftId) payload.draftId = draftId;
      if (intent === "schedule") payload.scheduledFor = zonedInputToIso(scheduledFor, timezone);
      const saved = await api<{ postId: string; status: string }>("/api/posts", json(payload));
      if (intent === "draft") setDraftId(saved.postId);
      setNotice(intent === "draft" ? "Draft saved. Find it anytime in Drafts." : intent === "schedule" ? "Your post is scheduled." : "Your post was sent. Check History for the result on each platform.");
      if (intent !== "draft") { setTitle(""); setContent(""); setSelected([]); setFiles([]); setAssets([]); setDraftId(""); setScheduledFor(""); }
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
          <div className="mb-4"><label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[#5b7482]" htmlFor="post-title"><span>Title (optional)</span><span className="font-normal text-[#8798a1]">{title.length}/90</span></label><input id="post-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={90} placeholder="A short headline for platforms that have a title" className="h-11 w-full rounded-xl border border-[#dce7eb] bg-[#fbfdfd] px-4 text-sm text-[#29495c] outline-none placeholder:text-[#a0afb6] focus:border-[#4eabb3] focus:ring-4 focus:ring-[#dff3ef]" /><p className="mt-1.5 text-[11px] leading-4 text-[#8798a1]">Used as the title on TikTok photo posts, YouTube and Pinterest. The caption below is used as the description there, so the same text isn&apos;t posted twice. Other platforms only use the caption.</p></div>
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
