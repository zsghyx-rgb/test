/**
 * Service Worker — 记一笔 PWA
 *
 * 策略：
 *  - 第三方 CDN 库（Bootstrap / Chart.js / CryptoJS）：Cache First（缓存优先）
 *  - HTML 主文件：Network Only（永远从网络取最新，不缓存）
 *  - 其他同源资源（icon / manifest）：Cache First
 */

const CACHE_NAME = 'app-libs-v1';

// 需要预缓存的第三方库
const PRECACHE_URLS = [
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/crypto-js@4.2.0/crypto-js.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
];

// ==================== Install：预缓存第三方库 ====================
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(PRECACHE_URLS);
        }).then(() => self.skipWaiting())
    );
});

// ==================== Activate：清理旧缓存 ====================
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// ==================== Fetch：请求拦截策略 ====================
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // HTML 文件：永远从网络获取（Network Only），保证总是最新版本
    if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                // 离线时 HTML 无法获取，返回简单提示（不做离线缓存）
                return new Response('<h2 style="font-family:sans-serif;text-align:center;margin-top:40vh">请连接网络后重试</h2>',
                    { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
            })
        );
        return;
    }

    // CDN 资源 和 本地静态资源：Cache First
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            // 不在缓存中则从网络获取并缓存
            return fetch(event.request).then(response => {
                // 只缓存成功的 GET 请求
                if (response && response.status === 200 && event.request.method === 'GET') {
                    const toCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
                }
                return response;
            });
        })
    );
});
