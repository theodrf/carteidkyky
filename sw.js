"use strict";

const CACHE_NAME = "identite-assets-v3";
const CACHE_PREFIX = "identite-assets-";
const STATIC_ASSETS = [
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/avatar.svg",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
].map((path) => new URL(path, self.location.href).href);
const STATIC_URLS = new Set(STATIC_ASSETS);

function cacheable(response) {
  return response.ok && response.type !== "opaque" && !/text\/html/i.test(response.headers.get("content-type") || "");
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(STATIC_ASSETS.map(async (url) => {
      const response = await fetch(url, { cache: "reload", credentials: "same-origin" });
      if (cacheable(response)) await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode === "navigate" || !STATIC_URLS.has(request.url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (cacheable(response)) {
        await cache.put(request, response.clone());
        return response;
      }
      const cached = await cache.match(request);
      return cached || response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});