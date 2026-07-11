'use client'

import { usePathname, useRouter } from 'next/navigation'
import { UnstyledButton, Text, Center, Loader } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import ModuleSidebar from '@/components/layout/ModuleSidebar'
import Header from '@/components/layout/Header'
import ChatWidget from '@/components/ai/ChatWidget'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { voltarParaModulos } from '@/lib/abasModulo'

// Páginas sem sidebar (tela limpa ou layout próprio)
const NO_SIDEBAR_PAGES = ['/selecionar-empresa', '/modulos']

// Páginas globais que não pertencem a nenhum módulo (sem ModuleSidebar)
const GLOBAL_PAGES = ['/dashboard', '/favoritos', '/relatorios', '/indicadores', '/permissoes', '/logs', '/suporte']

function isGlobalPage(pathname: string) {
  return GLOBAL_PAGES.some(p => pathname === p || pathname.startsWith(p + '/'))
    || pathname.startsWith('/configuracoes')
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
      <div className="flex-1 md:ml-[220px] flex flex-col">
        <Header />
        <main className="p-4 md:p-6 flex-1 overflow-x-hidden">{children}</main>
      </div>
      <ChatWidget />
    </div>
  )
}
