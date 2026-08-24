'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Alert, Button, Center, CloseButton, Group, Loader, MantineProvider, Text } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { IconWifiOff, IconDownload } from '@tabler/icons-react'
import { portalRepTheme } from '@/lib/portal-rep-theme'
import { BottomNav } from '@/components/portal-rep/BottomNav'
import SidebarDesktop from '@/components/portal-rep/SidebarDesktop'
import '@/components/portal-rep/portal-rep-touch.css'

const STORAGE_KEY_TOKEN = 'portal-rep-token'
const AUTH_FREE_PAGES = ['/portal-rep/login', '/portal-rep/trocar-senha']

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 30_000,
    },
  },
})

/**
 * Decodifica o payload de um JWT (base64url) sem validar a assinatura.
 * Usado apenas para verificar flags como `senhaTemporaria` client-side.
 */
function decodeTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64)
    return JSON.parse(json)
  } catch {
    return null
  }
}

function PortalRepLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const queryClientInner = useQueryClient()

  const [isChecking, setIsChecking] = useState(true)
  const [representanteNome, setRepresentanteNome] = useState('')
  const [notificationCount, setNotificationCount] = useState(0)
  const [isOffline, setIsOffline] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installDismissed, setInstallDismissed] = useState(false)

  const isAuthFreePage = AUTH_FREE_PAGES.some(
    (page) => pathname === page || pathname.startsWith(page + '/')
  )

  // Auth guard: verifica token no localStorage
  useEffect(() => {
    if (isAuthFreePage) {
      setIsChecking(false)
      return
    }

    const token = localStorage.getItem(STORAGE_KEY_TOKEN)

    if (!token) {
      router.replace('/portal-rep/login')
      return
    }

    // Verificar senhaTemporaria no payload do token
    const payload = decodeTokenPayload(token)
    if (payload?.senhaTemporaria === true) {
      router.replace('/portal-rep/trocar-senha')
      return
    }

    setRepresentanteNome((payload?.nome as string) || '')
    setIsChecking(false)
  }, [pathname, isAuthFreePage, router])

  // Polling de notificações não-lidas a cada 60s
  // (será conectado ao usePortalRepNotificacoes depois — por agora usa state com 0)
  useEffect(() => {
    if (isAuthFreePage) return

    const interval = setInterval(() => {
      // TODO: substituir por chamada real ao hook usePortalRepNotificacoes
      setNotificationCount((prev) => prev)
    }, 60_000)

    return () => clearInterval(interval)
  }, [isAuthFreePage])

  // Listener para evento online — invalida queries ao reconectar
  useEffect(() => {
    const handleOnline = () => {
      queryClientInner.invalidateQueries()
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [queryClientInner])

  // Detectar estado offline/online para exibir banner
  useEffect(() => {
    setIsOffline(!navigator.onLine)

    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Listener para beforeinstallprompt — captura o evento para mostrar banner de instalação
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  // Registrar manifesto PWA e service worker
  useEffect(() => {
    // Manifesto PWA — adiciona <link rel="manifest"> ao <head>
    const manifestLink = document.createElement('link')
    manifestLink.rel = 'manifest'
    manifestLink.href = '/manifest-portal-rep.json'
    document.head.appendChild(manifestLink)

    // Service Worker — registra para cache do shell e suporte offline
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/portal-rep-sw.js', { scope: '/portal-rep/' })
        .catch((err) => {
          console.warn('[portal-rep] Falha ao registrar service worker:', err)
        })
    }

    return () => {
      document.head.removeChild(manifestLink)
    }
  }, [])

  // Logout handler para a sidebar
  const handleLogout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_TOKEN)
    localStorage.removeItem('portal-rep-refresh-token')
    router.replace('/portal-rep/login')
  }, [router])

  // Handler para instalar o PWA via prompt nativo
  const handleInstallClick = useCallback(async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setInstallPrompt(null)
    }
    setInstallDismissed(true)
  }, [installPrompt])

  // Páginas de auth não exibem navegação
  if (isAuthFreePage) {
    return <>{children}</>
  }

  // Loading enquanto verifica autenticação
  if (isChecking) {
    return (
      <Center h="100vh">
        <Loader color="green" size="lg" />
      </Center>
    )
  }

  return (
    <>
      {/* Banner offline */}
      {isOffline && (
        <Alert
          icon={<IconWifiOff size={18} />}
          color="orange"
          variant="filled"
          radius={0}
          py="xs"
          styles={{ root: { position: 'sticky', top: 0, zIndex: 1000 } }}
        >
          <Text size="sm">Sem conexão com a internet. Os dados exibidos podem estar desatualizados.</Text>
        </Alert>
      )}

      {/* Banner de instalação PWA */}
      {installPrompt && !installDismissed && (
        <Alert
          icon={<IconDownload size={18} />}
          color="green"
          variant="light"
          radius={0}
          py="xs"
          styles={{ root: { position: 'sticky', top: isOffline ? undefined : 0, zIndex: 999 } }}
        >
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">Instale o app para acesso rápido na tela inicial.</Text>
            <Group gap="xs" wrap="nowrap">
              <Button size="xs" variant="filled" color="green" onClick={handleInstallClick}>
                Instalar
              </Button>
              <CloseButton size="sm" onClick={() => setInstallDismissed(true)} aria-label="Fechar" />
            </Group>
          </Group>
        </Alert>
      )}

      {/* Sidebar desktop — visível apenas em md+ (via className interno) */}
      <SidebarDesktop
        notificationCount={notificationCount}
        onLogout={handleLogout}
        representanteNome={representanteNome}
      />

      {/* Conteúdo principal */}
      <main className="md:ml-[220px] pb-[70px] md:pb-0 min-h-screen">
        {children}
      </main>

      {/* Bottom nav mobile — visível apenas em < md (via className interno) */}
      <BottomNav notificationCount={notificationCount} />
    </>
  )
}

export default function PortalRepLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={portalRepTheme}>
        <Notifications position="top-right" autoClose={4000} />
        <PortalRepLayoutInner>{children}</PortalRepLayoutInner>
      </MantineProvider>
    </QueryClientProvider>
  )
}
