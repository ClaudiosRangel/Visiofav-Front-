'use client'

import { useLayoutEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { UnstyledButton, Text, Center, Loader } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import ModuleSidebar, { detectModule, MODULE_LABELS } from '@/components/layout/ModuleSidebar'
import { useModuleSidebarCollapsed } from '@/lib/moduleSidebarStore'
import Header from '@/components/layout/Header'
import ChatWidget from '@/components/ai/ChatWidget'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { voltarParaModulos } from '@/lib/abasModulo'

/**
 * Define "Vizor - <Módulo>" como título padrão da aba do navegador com base
 * na rota atual, para toda página que ainda não define seu próprio
 * `document.title` mais específico (a maioria já segue o padrão "Vizor -
 * <Módulo> - <Página>" via `useEffect`, mas dezenas de telas nunca chamavam
 * `document.title`, deixando a aba só com o título genérico "Vizor").
 *
 * Usa `useLayoutEffect` (não `useEffect`) propositalmente: efeitos de layout
 * do componente pai (este) disparam antes dos efeitos passivos do componente
 * filho (a página) na mesma comutação — logo, se a página específica também
 * define `document.title` via `useEffect`, o valor dela sempre "ganha" por
 * rodar depois, sem qualquer necessidade de coordenação entre os dois.
 */
function useModuleTitleFallback(pathname: string) {
  useLayoutEffect(() => {
    const modulo = detectModule(pathname)
    document.title = modulo ? `Vizor - ${MODULE_LABELS[modulo] ?? modulo}` : 'Vizor'
  }, [pathname])
}

// Páginas sem sidebar (tela limpa ou layout próprio)
const NO_SIDEBAR_PAGES = ['/selecionar-empresa', '/modulos']

// Páginas globais que não pertencem a nenhum módulo (sem ModuleSidebar)
const GLOBAL_PAGES = ['/dashboard', '/favoritos', '/relatorios', '/indicadores', '/permissoes', '/logs', '/suporte']

// Páginas de tela cheia dentro de um módulo: mantêm o Header, mas não mostram
// o ModuleSidebar (menu lateral do módulo) — só a barra "← Módulos" — para a
// própria página ocupar todo o espaço horizontal. Ex.: PDV, que já é aberto
// em aba própria (ver abasModulo.ts) e tem sua própria UI de tela cheia.
const FULLSCREEN_PAGES = ['/vendas/pdv']

function isGlobalPage(pathname: string) {
  return GLOBAL_PAGES.some(p => pathname === p || pathname.startsWith(p + '/'))
    || pathname.startsWith('/configuracoes')
}

function isFullscreenPage(pathname: string) {
  return FULLSCREEN_PAGES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// Barra padrão "← Módulos" — mesmo padrão usado no topo dos menus de módulo (PCP, WMS, etc.)
function VoltarModulosBar() {
  const router = useRouter()
  return (
    <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1b1e] px-4 md:px-6 py-2">
      <UnstyledButton
        onClick={() => voltarParaModulos(router)}
        className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors"
      >
        <IconArrowLeft size={16} />
        <Text size="sm">Módulos</Text>
      </UnstyledButton>
    </div>
  )
}

export default function InternaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showSidebar = !NO_SIDEBAR_PAGES.includes(pathname)
  const { collapsed: sidebarCollapsed } = useModuleSidebarCollapsed()

  useModuleTitleFallback(pathname)

  // ── Segurança: bloqueia a renderização de qualquer página interna
  // (inclusive dados de listagens/telas) até confirmar que o usuário tem
  // um token válido no localStorage. Sem isso, navegar direto para uma URL
  // protegida (ou usar o botão "voltar") depois de sair do sistema exibia
  // dados mesmo sem autenticação.
  const autenticado = useRequireAuth()
  if (!autenticado) {
    return (
      <Center h="100vh">
        <Loader color="primary" />
      </Center>
    )
  }

  if (!showSidebar) {
    if (pathname === '/modulos') {
      return <>{children}<ChatWidget /></>
    }
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <ChatWidget />
      </div>
    )
  }

  // Fullscreen pages (ex.: PDV) — Header + "← Módulos" bar, sem padding/scroll
  // no <main>: a própria página controla 100% do espaço restante (a tela do
  // PDV precisa caber sem scroll, com todas as opções visíveis).
  if (isFullscreenPage(pathname)) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <Header />
        <VoltarModulosBar />
        <main className="flex-1 overflow-hidden">{children}</main>
        <ChatWidget />
      </div>
    )
  }

  // Global pages (dashboard, favoritos, etc.) — show Header + "← Módulos" bar, no module sidebar
  if (isGlobalPage(pathname)) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <VoltarModulosBar />
        <main className="p-4 md:p-6 flex-1 overflow-x-hidden">{children}</main>
        <ChatWidget />
      </div>
    )
  }

  // Module pages — show ModuleSidebar + Header
  return (
    <div className="flex min-h-screen">
      <ModuleSidebar />
      <div className={`flex-1 flex flex-col transition-[margin] duration-150 ${sidebarCollapsed ? 'md:ml-[64px]' : 'md:ml-[220px]'}`}>
        <Header />
        <main className="p-4 md:p-6 flex-1 overflow-x-hidden">{children}</main>
      </div>
      <ChatWidget />
    </div>
  )
}
