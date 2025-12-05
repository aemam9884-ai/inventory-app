const CACHE_NAME = 'inventory-app-v1';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

// تثبيت Service Worker وتخزين الملفات
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// حذف الكاش القديم
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// الاستجابة للطلبات
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // لو موجود في الكاش، رجعه
                if (response) {
                    return response;
                }
                // لو مش موجود، اطلبه من النت
                return fetch(event.request);
            })
    );
});