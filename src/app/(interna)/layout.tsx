'use client'

import { usePathname } from 'next/navigation'
import ModuleSidebar from '@/components/layout/ModuleSidebar'
import Header from '@/components/layout/Header'
import ChatWidget from '@/components/ai/ChatWidget'

// Páginas sem sidebar (tela limpa ou layout próprio)
const NO_SIDEBAR_PAGES = ['/selecionar-empresa', '/modulos']

// Páginas globais que não pertencem a nenhum módulo (sem ModuleSidebar)
const GLOBAL_PAGES = ['/dashboard', '/favoritos', '/relatorios', '/indicadores', '/permissoes', '/logs', '/suporte']

function isGlobalPage(pathname: string) {
  return GLOBAL_PAGES.some(p => pathname === p || pathname.startsWith(p + '/'))
    || pathname.startsWith('/configuracoes')
}

export default function InternaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showSidebar = !NO_SIDEBAR_PAGES.includes(pathname)

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

  // Global pages (dashboard, favoritos, etc.) — show Header, no module sidebar
  if (isGlobalPage(pathname)) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
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
