// Barbie AI — Service Worker v1
// Cloudflare Pages: URLs have no .html extension
const CACHE_NAME    = 'barbie-ai-v1-static';
const RUNTIME_CACHE = 'barbie-ai-v1-runtime';

const PRECACHE = [
  '/dashboard',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(PRECACHE.map(url => cache.add(url).catch(() => {})))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('barbie-ai-') && k !== CACHE_NAME && k !== RUNTIME_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // NEVER cache: Supabase, Gemini, Workers, live APIs
  if (
    url.hostname.includes('supabase.co')       ||
    url.hostname.includes('workers.dev')        ||
    url.hostname.includes('generativelanguage') ||
    url.hostname.includes('remove.bg')          ||
    url.pathname.includes('/rest/')             ||
    url.pathname.includes('/storage/')          ||
    url.pathname.includes('/auth/')             ||
    url.pathname.includes('/realtime/')
  ) { return; }

  // Cache-first: CDN (fonts, js libraries)
  if (
    url.hostname.includes('cdn.jsdelivr.net')     ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Stale-while-revalidate: app pages & assets on same origin
  if (url.hostname === self.location.hostname) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(RUNTIME_CACHE)).put(req, res.clone());
    return res;
  } catch { return new Response('', { status: 503 }); }
}

async function staleWhileRevalidate(req) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  const fresh  = fetch(req)
    .then(r => { if (r && r.ok) cache.put(req, r.clone()); return r; })
    .catch(() => null);
  return cached || await fresh || offlinePage();
}

function offlinePage() {
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Barbie AI · Offline</title>
<style>
  body{margin:0;font-family:sans-serif;background:#b3536a;color:#fdf7f3;
       display:flex;flex-direction:column;align-items:center;justify-content:center;
       min-height:100vh;text-align:center;padding:2rem}
  h1{color:#f5d7c3;font-size:1.8rem;margin:.5rem 0}
  p{color:rgba(253,247,243,.85);max-width:300px;line-height:1.6;margin:.5rem 0}
  button{margin-top:1.5rem;padding:.8rem 2rem;background:#f5d7c3;color:#7a2e42;
         border:none;border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer}
</style>
</head>
<body>
  <div style="font-size:3rem">💄</div>
  <h1>You're Offline</h1>
  <p>Barbie AI needs an internet connection to run style analysis and generate looks.</p>
  <button onclick="location.reload()">Try Again</button>
</body>
</html>`, { status: 200, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
}
