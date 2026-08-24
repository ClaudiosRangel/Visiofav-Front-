// Service Worker — Portal do Representante Externo
// Cache do app shell no install, serve do cache quando offline (cache-first para shell, network-first para API)

const CACHE_NAME = 'portal-rep-shell-v1'

const APP_SHELL_URLS = [
  '/portal-rep/dashboard',
  '/portal-rep/login',
  '/manifest-portal-rep.json',
  '/icons/portal-rep-192.png',
  '/icons/portal-rep-512.png',
]

// Install: faz cache do app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_URLS).catch((err) => {
        // Não bloqueia install se algum recurso falhar (ícones placeholder podem não existir ainda)
        console.warn('[portal-rep-sw] Falha ao cachear alguns recursos do shell:', err)
      })
    })
  )
  // Ativa imediatamente sem esperar outras tabs fecharem
  self.skipWaiting()
})

// Activate: limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('portal-rep-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  // Toma controle de todas as tabs imediatamente
  self.clients.claim()
})

// Fetch: network-first para API, cache-first para shell/assets
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignora requisições não-GET
  if (request.method !== 'GET') return

  // Requisições para API: network-first (tenta rede, fallback para cache)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cacheia respostas válidas da API para uso offline
          if (response.ok) {
            const cloned = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned))
          }
          return response
        })
        .catch(() => {
          return caches.match(request)
        })
    )
    return
  }

  // Requisições de navegação (páginas do portal): network-first com fallback para shell
  if (request.mode === 'navigate' && url.pathname.startsWith('/portal-rep')) {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/portal-rep/dashboard').then((cached) => {
          if (cached) return cached
          // Fallback final: resposta offline simples
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vizor Rep - Offline</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff;color:#333"><div style="text-align:center"><h2>Sem conexão</h2><p>Verifique sua internet e tente novamente.</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        })
      })
    )
    return
  }

  // Assets estáticos (JS, CSS, fontes, ícones): cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        // Cacheia assets estáticos válidos
        if (response.ok && (url.pathname.match(/\.(js|css|woff2?|ttf|png|svg|ico)$/))) {
          const cloned = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned))
        }
        return response
      })
    })
  )
})
