// Web Push handler — imported into the Workbox-generated /sw.js via
// vite-plugin-pwa's `workbox.importScripts`. Runs inside the service worker
// scope, so `self` refers to the ServiceWorkerGlobalScope.

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "طلب جديد", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "طلب جديد";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: payload.data || {},
    tag: payload.tag || "fresh-new-order",
    renotify: true,
    requireInteraction: false,
    dir: "rtl",
    lang: "ar",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/admin";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const origin = self.location.origin;
      const existing = all.find((c) => c.url.startsWith(origin));
      if (existing) {
        try { await existing.focus(); } catch {}
        try { await existing.navigate(origin + targetUrl); } catch {}
        return;
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
