// MWDTS wrapper site — Service Worker
//
// Deliberately minimal, same reasoning as the in-app service worker:
// this only caches the wrapper page's own static shell (icon,
// manifest) for fast repeat loads and PWA installability. It never
// caches the actual app content — which lives in a cross-origin
// iframe this service worker cannot reach anyway, by the browser's
// own same-origin policy, even if it tried.

const SHELL_CACHE = "mwdts-wrapper-shell-v1";
const SHELL_ASSETS = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== SHELL_CACHE).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isShellAsset = SHELL_ASSETS.some((a) => url.pathname.endsWith(a.replace("./", "")));
  if (!isShellAsset) return; // let the browser handle everything else normally,
                              // including the cross-origin iframe request

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Without this listener, an incoming push is delivered to the service
// worker but nothing displays it — the browser just silently drops it.
// This was missing entirely, so no push has ever produced a visible
// notification even on a successful subscription.
self.addEventListener("push", (event) => {
  let data = { title: "MWDTS", body: "You have a new notification." };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    // Fall back to the default above if the payload isn't valid JSON.
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "MWDTS", {
      body: data.body || "",
      icon: "./icon-192.png",
      badge: "./icon-192.png",
    })
  );
});

// Clicking the notification should bring the app to the front rather
// than leave it sitting in the notification tray with no action.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./index.html");
    })
  );
});
