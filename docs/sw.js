/* Service worker: makes the dashboard installable and usable offline on a phone.
   Shell files are cached ahead of time; data.json is network-first so an
   installed copy still picks up the 8am export when there is a connection. */

const VERSION = "td-v2";
const SHELL = [
  "./", "./index.html", "./styles.css", "./app.js",
  "./standards.json", "./manifest.webmanifest",
  "./icon.svg", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache the Chart.js CDN or the iTunes art lookup.
  if (url.origin !== self.location.origin) return;

  // data.json: always try the network first, fall back to the last good copy.
  if (url.pathname.endsWith("data.json")) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || Response.error()))
    );
    return;
  }

  // Shell: cache first.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
