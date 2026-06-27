'use client'

import { usePathname } from 'next/navigation'
import ModuleSidebar from '@/components/layout/ModuleSidebar'
import Header from '@/components/layout/Header'

// Páginas sem sidebar (tela limpa)
const NO_SIDEBAR_PAGES = ['/selecionar-empresa', '/modulos']

export default function InternaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showSidebar = !NO_SIDEBAR_PAGES.includes(pathname)

  if (!showSidebar) {
    // /modulos page manages its own full layout (header, sidebar, footer)
    if (pathname === '/modulos') {
      return <>{children}</>
    }
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <ModuleSidebar />
      <div className="flex-1 md:ml-[220px] flex flex-col">
        <Header />
        <main className="p-4 md:p-6 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  )
}
