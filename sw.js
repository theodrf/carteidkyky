"use strict";

const CACHE_NAME = "identite-assets-v4";
const CACHE_PREFIX = "identite-assets-";

// Ajout de l'index et correction des chemins selon votre manifest et index.html
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./avatar.jpeg",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./qr-code.jpg"
].map((path) => new URL(path, self.location.href).href);

function cacheable(response) {
  // Suppression de la règle qui empêchait de mettre le HTML en cache
  return response.ok && response.type !== "opaque";
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

  // On traite uniquement les requêtes GET (on retire la restriction sur le mode 'navigate')
  if (request.method !== "GET") return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // On tente d'abord de récupérer via le réseau (utile si vous mettez à jour votre code)
      const response = await fetch(request);
      if (cacheable(response)) {
        await cache.put(request, response.clone());
        return response;
      }
      const cached = await cache.match(request);
      return cached || response;
    } catch (error) {
      // Si on n'a plus de réseau (hors-ligne), on renvoie ce qui est en cache
      const cached = await cache.match(request);
      if (cached) return cached;

      // Sécurité supplémentaire : si c'est une requête de page et qu'on ne la trouve pas, on renvoie l'index
      if (request.mode === "navigate") {
        return await cache.match("./index.html");
      }

      throw error;
    }
  })());
});