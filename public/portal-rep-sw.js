// Service Worker — Portal do Representante Externo
// Cache do app shell no install, serve do cache quando offline (cache-first para shell, network-first para API)

const CACHE_NAME = 'portal-rep-shell-v3'

const APP_SHELL_URLS = [
  '/portal-rep/dashboard',
  '/portal-rep/login',
  '/manifest-portal-rep.json',
  '/icons/portal-rep-192.png',
  '/icons/portal-rep-512.png',
]

// Install: faz cache do app shell.
// Cacheia recurso a recurso e IGNORA os que falharem (um 404 em um ícone não
// pode derrubar o cache inteiro — `cache.addAll` é atômico e falharia tudo).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL_URLS.map((u) =>
          cache.add(u).catch((err) => {
            console.warn('[portal-rep-sw] Falha ao cachear recurso do shell:', u, err)
          })
        )
      )
    )
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

  // Requisições de navegação (páginas do portal): network-first com fallback para shell.
  // IMPORTANTE: a cadeia do fallback NUNCA pode rejeitar — uma promise rejeitada
  // em respondWith vira "FetchEvent resulted in a network error" e deixa a tela
  // em branco. Por isso o fallback é totalmente blindado e sempre resolve numa
  // Response válida.
  if (request.mode === 'navigate' && url.pathname.startsWith('/portal-rep')) {
    const respostaOffline = () =>
      new Response(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vizor Rep - Offline</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff;color:#333"><div style="text-align:center"><h2>Sem conexão</h2><p>Verifique sua internet e tente novamente.</p></div></body></html>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match('/portal-rep/dashboard')
          .then((cached) => cached || respostaOffline())
          .catch(() => respostaOffline())
      )
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
