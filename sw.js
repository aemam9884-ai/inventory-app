const CACHE_NAME = 'inventory-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/app.js',
    'https://unpkg.com/@zxing/library@latest/umd/index.min.js'
];

// تثبيت Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// جلب الملفات من الكاش
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});
