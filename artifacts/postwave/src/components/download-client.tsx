"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, Share, MoreVertical, CheckCircle2 } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function DownloadClient() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [apkReady, setApkReady] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    if (window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || document.referrer.startsWith("android-app://")) { window.location.replace("/dashboard"); return; }
    const onPrompt = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    fetch("/downloads/postwave.apk", { method: "HEAD" }).then((response) => setApkReady(response.ok)).catch(() => undefined);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallEvent(null);
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10 sm:px-7">
      <a href="/" className="text-sm font-semibold text-[#287c91] hover:underline">← Postwave</a>
      <div className="mt-6">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#0b8a86]">Get the app</div>
        <h1 className="font-display text-3xl font-extrabold tracking-[-.045em] text-[#0f3b42] sm:text-4xl">Postwave on your phone</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[#4f7377]">Publish, schedule and check your analytics from your home screen, with the same account you use on the web.</p>
      </div>

      <div className="mt-8 grid gap-5">
        <section className="pw-card p-6">
          <div className="flex items-start gap-4">
            <span className="pw-chip-icon h-11 w-11 shrink-0"><Download className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-bold text-[#0f3b42]">Install from this site</h2>
              <p className="mt-1 text-sm leading-6 text-[#4f7377]">Works on Android, Windows, Mac and Chromebooks. It installs in seconds and updates itself.</p>
              {installed ? (
                <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#0b6f6c]"><CheckCircle2 className="h-4 w-4" /> Postwave is installed on this device.</p>
              ) : installEvent ? (
                <button type="button" onClick={() => void install()} className="pw-btn-primary mt-4"><Download className="h-4 w-4" /> Install Postwave</button>
              ) : isIos ? (
                <p className="mt-4 flex flex-wrap items-center gap-1.5 text-sm text-[#17464c]">On iPhone: tap <Share className="inline h-4 w-4" /> Share in Safari, then <strong>Add to Home Screen</strong>.</p>
              ) : (
                <p className="mt-4 flex flex-wrap items-center gap-1.5 text-sm text-[#17464c]">Open this page in Chrome, tap <MoreVertical className="inline h-4 w-4" />, then <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</p>
              )}
            </div>
          </div>
        </section>

        <section className="pw-card p-6">
          <div className="flex items-start gap-4">
            <span className="pw-chip-icon h-11 w-11 shrink-0"><Smartphone className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-bold text-[#0f3b42]">Android APK</h2>
              {apkReady ? (
                <>
                  <p className="mt-1 text-sm leading-6 text-[#4f7377]">Download the installer, open it, and allow installs from your browser if Android asks. Only install the file from this website.</p>
                  <a href="/downloads/postwave.apk" download className="pw-btn-primary mt-4"><Download className="h-4 w-4" /> Download APK</a>
                </>
              ) : (
                <p className="mt-1 text-sm leading-6 text-[#4f7377]">The Android installer file isn&apos;t published yet. Use the install option above in the meantime. It gives you the same app.</p>
              )}
            </div>
          </div>
        </section>
      </div>
      <p className="mt-8 text-center text-xs text-[#55777c]">Postwave by Mazi Saint Concepts · <a className="underline" href="/privacy">Privacy</a> · <a className="underline" href="/terms">Terms</a></p>
    </main>
  );
}
