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
    return (
      <div className="min-h-screen">
        <Header />
        <main className="p-6 max-w-5xl mx-auto">{children}</main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <ModuleSidebar />
      <div className="flex-1 ml-[220px]">
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
