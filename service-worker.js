const CACHE = "hanzi-hop-v3";
const FILES = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest", "./data/nuance-cards.json"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES))));
self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("api.tatoeba.org")) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
