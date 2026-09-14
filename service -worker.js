// ============================================================
// service-worker.js — BloxGPT
// ------------------------------------------------------------
// Tujuan: memenuhi syarat PWA (wajib ada supaya PWABuilder/
// Capacitor mengenali situs ini sebagai app yang installable),
// plus kasih dukungan dasar offline: kalau internet putus,
// user tetap lihat halaman utama yang sudah pernah dibuka,
// bukan layar error putih dari browser.
//
// SENGAJA DIBUAT MINIMAL/AMAN:
// - TIDAK meng-cache respons dari /api/* (chat, auth, dll)
//   supaya user tidak pernah lihat jawaban AI yang basi/lama.
// - Cuma cache file statis kulit luar app (HTML, manifest, ikon).
// - Pola "Network First": selalu coba ambil versi terbaru dari
//   internet dulu; baru pakai cache kalau memang lagi offline.
// ============================================================

const CACHE_NAME = 'bloxgpt-shell-v1';

const APP_SHELL_FILES = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Saat service worker pertama kali terpasang: simpan file inti di atas.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_FILES))
  );
  self.skipWaiting();
});

// Saat versi baru aktif: buang cache versi lama supaya tidak menumpuk.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Strategi fetch: Network First untuk semuanya, KECUALI /api/*
// yang memang tidak boleh sama sekali disentuh oleh service worker ini.
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Jangan pernah ikut campur permintaan ke backend/API.
  if (requestUrl.pathname.startsWith('/api/')) {
    return;
  }

  // Hanya tangani permintaan GET (POST/PUT dll dilewatkan apa adanya).
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      })
      .catch(() => {
        // Offline / gagal fetch -> coba ambil dari cache.
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || caches.match('/');
        });
      })
  );
});
