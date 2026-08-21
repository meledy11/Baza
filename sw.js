// ============================================================
//  SERVICE WORKER — ОФФЛАЙН-РЕЖИМ
// ============================================================

var CACHE_NAME = 'hanzi-cache-v2';
var urlsToCache = [
  '/',
  '/index.html',
  '/hanzi.html',
  '/hanmap.html',
  '/app.js',
  '/hanzi-game.js',
  '/hanmap.js',
  '/manifest.json'
];

// Устанавливаем кэш
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('📦 Кэширование ресурсов...');
        return cache.addAll(urlsToCache);
      })
      .catch(function(err) {
        console.log('⚠️ Ошибка кэширования:', err);
      })
  );
});

// Активируем и удаляем старые кэши
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
    })
  );
});

// Перехватываем запросы
self.addEventListener('fetch', function(event) {
  // Пропускаем запросы к API и внешним ресурсам
  if (event.request.url.includes('chrome-extension') || 
      event.request.url.includes('google') ||
      event.request.url.includes('yandex')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Если есть в кэше — возвращаем
        if (response) {
          return response;
        }

        // Иначе — запрос в сеть
        return fetch(event.request)
          .then(function(response) {
            // Кэшируем только успешные ответы
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            var responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(function(cache) {
                try {
                  cache.put(event.request, responseToCache);
                } catch(e) {
                  // Игнорируем ошибки
                }
              });

            return response;
          })
          .catch(function() {
            // Если нет сети — показываем оффлайн-страницу
            return new Response(
              '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>📴 Оффлайн</title><style>body{background:#0a0a0f;color:#eef1ff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:20px}div{max-width:400px}h1{color:#ffd700;font-size:2rem}span{font-size:4rem}</style></head><body><div><span>🀄</span><h1>Нет соединения</h1><p>Проверьте интернет-соединение</p></div></body></html>',
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'text/html;charset=UTF-8'
                })
              }
            );
          });
      })
  );
});
