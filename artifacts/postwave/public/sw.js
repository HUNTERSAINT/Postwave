// Minimal service worker: makes Postwave installable and shows a friendly page when offline.
// It never caches API responses or signed-in pages.
const OFFLINE_HTML = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#effaf8;color:#0f3b42;text-align:center"><div><h1>You\'re offline</h1><p>Postwave needs a connection. Check your internet and try again.</p><button onclick="location.reload()" style="padding:10px 18px;border:0;border-radius:12px;background:#0d9b98;color:#fff;font-weight:700">Retry</button></div>';
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
