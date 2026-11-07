// ============================================================
//  SERVICE WORKER — ОФФЛАЙН-РЕЖИМ (v4)
// ============================================================

var CACHE_NAME = 'hanzi-cache-v4';
var urlsToCache = [
  '/',
  '/index.html',
  '/hanzi.html',
  '/hanmap.html',
  '/Kluch.html',        // 🧊 игра «Ключи»
  '/app.js',
  '/hanzi-game.js',
  '/hanmap.js',
  '/manifest.json'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('📦 Кэширование ресурсов...');
      return Promise.all(
        urlsToCache.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.log('⚠️ Не удалось закэшировать:', url, err);
          });
        })
      );
    })
  );
  // Активируем новый SW сразу
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Удалён старый кэш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      // Захватываем контроль над всеми вкладками
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  // Пропускаем внешние запросы
  if (event.request.url.includes('chrome-extension') || 
      event.request.url.includes('google') ||
      event.request.url.includes('yandex') ||
      event.request.url.startsWith('blob:')) {
    return;
  }

  // Пропускаем POST и другие не-GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(response) {
      if (response) {
        // Есть в кэше — отдаём, в фоне обновляем
        return response;
      }
      return fetch(event.request).then(function(networkResponse) {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        // Не кэшируем opaque-ответы
        if (networkResponse.type === 'opaque') {
          return networkResponse;
        }
        var responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          try { cache.put(event.request, responseToCache); } catch(e) {}
        });
        return networkResponse;
      }).catch(function() {
        // Если запрос — HTML, отдаём оффлайн-заглушку
        var accept = event.request.headers.get('accept') || '';
        if (accept.includes('text/html')) {
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>📴 Оффлайн</title><style>body{background:#0a0a0f;color:#eef1ff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:20px}div{max-width:400px}h1{color:#ffd700;font-size:2rem}span{font-size:4rem}</style></head><body><div><span>🀄</span><h1>Нет соединения</h1><p>Проверьте интернет-соединение</p></div></body></html>',
            { status: 503, statusText: 'Service Unavailable', headers: new Headers({ 'Content-Type': 'text/html;charset=UTF-8' }) }
          );
        }
        return new Response('', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});

// Обработка сообщений от страниц (например, "обнови кэш")
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(function() {
      console.log('🗑️ Кэш очищен вручную');
    });
  }
});
