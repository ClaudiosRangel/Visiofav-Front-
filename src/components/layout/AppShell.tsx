'use client'

import Sidebar from './Sidebar'
import Header from './Header'

interface AppShellProps {
  children: React.ReactNode
  breadcrumb?: string[]
}

export default function AppShell({ children, breadcrumb }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[70px]">
        <Header breadcrumb={breadcrumb} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
