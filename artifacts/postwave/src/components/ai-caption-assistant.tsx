"use client";

import { useState } from "react";

type Mode = "write" | "shorter" | "longer" | "hashtags";
const tones = [
  { value: "friendly", label: "Friendly" },
  { value: "casual", label: "Casual" },
  { value: "professional", label: "Professional" },
  { value: "bold", label: "Bold" },
  { value: "funny", label: "Funny" },
];

export function AiCaptionAssistant({
  content,
  platforms,
  onUse,
}: {
  content: string;
  platforms: string[];
  onUse: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [tone, setTone] = useState("friendly");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<Mode | "">("");
  const [error, setError] = useState("");

  async function run(mode: Mode) {
    const source = idea.trim() || content.trim();
    if (source.length < 3) { setError("Describe your post first, or write a rough draft in the box above."); return; }
    setBusy(mode); setError("");
    try {
      const response = await fetch("/api/ai/caption", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, idea: source, current: caption || content.trim() || undefined, tone, platforms }),
      });
      const data = await response.json().catch(() => ({})) as { caption?: string; hashtags?: string[]; message?: string };
      if (!response.ok) throw new Error(data.message || "Something went wrong. Please try again.");
      if (data.caption) { setCaption(data.caption); setHashtags([]); setPicked([]); }
      if (data.hashtags) { setHashtags(data.hashtags); setPicked(data.hashtags); }
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Please try again."); }
    finally { setBusy(""); }
  }

  const togglePick = (tag: string) => setPicked((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  const finalText = [caption, picked.length ? picked.join(" ") : ""].filter(Boolean).join("\n\n");
  const btn = "rounded-lg border border-[#d8e6eb] bg-white px-3 py-1.5 text-xs font-bold text-[#48677a] hover:bg-[#f2f8f9] disabled:opacity-50";

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#cfe3e6] bg-[#f3fafa] px-3.5 py-2 text-xs font-bold text-[#2f7f87] hover:bg-[#e8f5f5]">✦ Write with AI</button>;
  }
  return (
    <div className="mt-3 rounded-2xl border border-[#d5e8ea] bg-[#f7fbfb] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#29495c]">✦ Caption assistant</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-[#7a8f9a] hover:underline">Close</button>
      </div>
      <label className="mt-3 grid gap-1 text-xs font-semibold text-[#587285]">What is this post about?
        <textarea value={idea} onChange={(event) => setIdea(event.target.value)} rows={3} maxLength={2000} placeholder="e.g. We just opened our second branch in Ikeja and the first 20 customers get free delivery" className="w-full resize-y rounded-xl border border-[#dce7eb] bg-white p-3 text-sm font-normal text-[#29495c] outline-none focus:border-[#4eabb3]" />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-[#587285]">Tone{" "}
          <select value={tone} onChange={(event) => setTone(event.target.value)} className="ml-1 h-9 rounded-lg border border-[#d8e6eb] bg-white px-2 text-xs">
            {tones.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <button type="button" disabled={Boolean(busy)} onClick={() => void run("write")} className="rounded-lg bg-[#238c8d] px-4 py-2 text-xs font-bold text-white hover:bg-[#1d7677] disabled:opacity-50">{busy === "write" ? "Writing…" : caption ? "Write another" : "Write caption"}</button>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-[#fff0ed] px-3 py-2 text-xs font-semibold text-[#a75245]">{error}</p>}
      {caption && (
        <div className="mt-4 rounded-xl border border-[#e0eaed] bg-white p-3.5">
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#29495c]">{caption}</p>
          {hashtags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Suggested hashtags">
              {hashtags.map((tag) => <button type="button" key={tag} onClick={() => togglePick(tag)} aria-pressed={picked.includes(tag)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${picked.includes(tag) ? "bg-[#dff3ef] text-[#2d7d74]" : "bg-[#eef3f5] text-[#8a9ba3] line-through"}`}>{tag}</button>)}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => onUse(finalText)} className="rounded-lg bg-[#176f98] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#125c7d]">Use this</button>
            <button type="button" disabled={Boolean(busy)} onClick={() => void run("shorter")} className={btn}>{busy === "shorter" ? "Shortening…" : "Shorter"}</button>
            <button type="button" disabled={Boolean(busy)} onClick={() => void run("longer")} className={btn}>{busy === "longer" ? "Lengthening…" : "Longer"}</button>
            <button type="button" disabled={Boolean(busy)} onClick={() => void run("hashtags")} className={btn}>{busy === "hashtags" ? "Finding…" : hashtags.length ? "More hashtags" : "Suggest hashtags"}</button>
          </div>
          {hashtags.length > 0 && <p className="mt-2 text-[10px] leading-4 text-[#92a0a7]">Hashtags are suggestions based on your post, not live trending data. Check them on the platform before using.</p>}
        </div>
      )}
      <p className="mt-3 text-[10px] leading-4 text-[#92a0a7]">Always read and edit the caption before you post. Only include facts that are true for you.</p>
    </div>
  );
}
