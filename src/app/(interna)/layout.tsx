'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import ModuleSidebar from '@/components/layout/ModuleSidebar'
import Header from '@/components/layout/Header'
import { api } from '@/lib/api'

// Páginas sem sidebar (tela limpa)
const NO_SIDEBAR_PAGES = ['/selecionar-empresa', '/modulos']

export default function InternaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showSidebar = !NO_SIDEBAR_PAGES.includes(pathname)
  const [backBuild, setBackBuild] = useState<string | null>(null)

  useEffect(() => {
    api.get('/health').then(({ data }) => {
      if (data?.buildDate) {
        setBackBuild(new Date(data.buildDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
      }
    }).catch(() => {})
  }, [])

  const buildDate = (() => {
    try {
      const d = process.env.NEXT_PUBLIC_BUILD_DATE
      if (!d) return '—'
      return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch { return '—' }
  })()

  const footerText = `Front: ${buildDate}${backBuild ? ` | Back: ${backBuild}` : ''}`

  if (!showSidebar) {
    // /modulos page manages its own full layout (header, sidebar, footer)
    if (pathname === '/modulos') {
      return <>{children}</>
    }
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="text-right text-xs text-zinc-400 px-4 py-2">
          {footerText}
        </footer>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <ModuleSidebar />
      <div className="flex-1 md:ml-[220px] flex flex-col">
        <Header />
        <main className="p-4 md:p-6 flex-1 overflow-x-hidden">{children}</main>
        <footer className="text-right text-xs text-zinc-400 px-4 py-2">
          {footerText}
        </footer>
      </div>
    </div>
  )
}
