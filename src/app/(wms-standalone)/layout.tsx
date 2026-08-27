'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { UnstyledButton, Text, Stack, Collapse, Center, Loader } from '@mantine/core'
import {
  IconHome, IconTruckDelivery, IconBuildingWarehouse, IconPackage,
  IconClipboardCheck, IconChartBar, IconSettings, IconLogout,
  IconChevronDown, IconChevronRight, IconLock, IconArrowsExchange,
  IconBarcode,
} from '@tabler/icons-react'
import Link from 'next/link'

// ── Tipos ──────────────────────────────────────────────────────────────

interface MenuItem {
  icon: React.ElementType
  label: string
  href: string
}

interface MenuGroup {
  icon: React.ElementType
  label: string
  items: MenuItem[]
}

type MenuEntry = MenuItem | MenuGroup

function isGroup(entry: MenuEntry): entry is MenuGroup {
  return 'items' in entry
}

// ── Menu WMS Standalone (SEM módulos ERP) ─────────────────────────────

const WMS_MENU: MenuEntry[] = [
  { icon: IconHome, label: 'Dashboard', href: '/wms-app/dashboard' },
  {
    icon: IconTruckDelivery, label: 'Recebimento', items: [
      { icon: IconTruckDelivery, label: 'Notas de Entrada', href: '/wms-app/recebimento' },
      { icon: IconClipboardCheck, label: 'Conferência', href: '/wms-app/conferencia' },
      { icon: IconBuildingWarehouse, label: 'Endereçamento', href: '/wms-app/enderecamento' },
    ],
  },
  {
    icon: IconBuildingWarehouse, label: 'Estoque', items: [
      { icon: IconBuildingWarehouse, label: 'Consulta de Saldos', href: '/wms-app/estoque' },
      { icon: IconArrowsExchange, label: 'Transferência', href: '/wms-app/transferencia' },
      { icon: IconPackage, label: 'Ressuprimento', href: '/wms-app/ressuprimento' },
      { icon: IconClipboardCheck, label: 'Inventário', href: '/wms-app/inventario' },
      { icon: IconChartBar, label: 'Classificação ABC', href: '/wms-app/abc' },
      { icon: IconLock, label: 'Bloqueios', href: '/wms-app/bloqueios' },
    ],
  },
  {
    icon: IconPackage, label: 'Expedição', items: [
      { icon: IconBarcode, label: 'Separação', href: '/wms-app/separacao' },
      { icon: IconClipboardCheck, label: 'Conferência Saída', href: '/wms-app/conferencia-saida' },
      { icon: IconTruckDelivery, label: 'Carregamento', href: '/wms-app/carregamento' },
    ],
  },
  {
    icon: IconChartBar, label: 'Relatórios', items: [
      { icon: IconChartBar, label: 'KPIs', href: '/wms-app/kpis' },
      { icon: IconChartBar, label: 'Movimentações', href: '/wms-app/movimentacoes' },
    ],
  },
  { icon: IconSettings, label: 'Configurações', href: '/wms-app/configuracoes' },
]

// ── Componentes ────────────────────────────────────────────────────────

function SidebarItem({ item, pathname }: { item: MenuItem; pathname: string }) {
  const active = pathname === item.href || pathname.startsWith(item.href + '/')
  return (
    <UnstyledButton component={Link} href={item.href}
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
        active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
      }`}>
      <item.icon size={16} stroke={1.5} />
      <Text size="sm">{item.label}</Text>
    </UnstyledButton>
  )
}

function SidebarGroup({ group, pathname }: { group: MenuGroup; pathname: string }) {
  const hasActive = group.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))
  const [open, setOpen] = useState(hasActive)

  return (
    <div>
      <UnstyledButton onClick={() => setOpen(!open)}
        className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-sm transition-colors ${
          hasActive ? 'text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-50'
        }`}>
        <div className="flex items-center gap-3">
          <group.icon size={16} stroke={1.5} />
          <Text size="sm" fw={500}>{group.label}</Text>
        </div>
        {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
      </UnstyledButton>
      <Collapse in={open}>
        <Stack gap={1} className="pl-4 mt-1">
          {group.items.map(item => <SidebarItem key={item.href} item={item} pathname={pathname} />)}
        </Stack>
      </Collapse>
    </div>
  )
}

// ── Layout ─────────────────────────────────────────────────────────────

export default function WmsStandaloneLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [autenticado, setAutenticado] = useState(false)
  const [nomeOperador, setNomeOperador] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('wms-token')
    if (!token) {
      router.replace('/wms-app/login')
      return
    }
    // Decodificar nome do token (payload base64)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setNomeOperador(payload.nome || 'Operador')
      setAutenticado(true)
    } catch {
      localStorage.removeItem('wms-token')
      router.replace('/wms-app/login')
    }
  }, [router])

  if (!autenticado && pathname !== '/wms-app/login') {
    return <Center h="100vh"><Loader color="blue" /></Center>
  }

  // Login page — sem sidebar
  if (pathname === '/wms-app/login') {
    return <>{children}</>
  }

  function handleLogout() {
    localStorage.removeItem('wms-token')
    router.replace('/wms-app/login')
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-screen w-[220px] bg-white border-r border-gray-200 flex-col z-50">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-200">
          <Text size="lg" fw={700} c="blue">Vizor WMS</Text>
          <Text size="xs" c="dimmed">{nomeOperador}</Text>
        </div>

        {/* Menu */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <Stack gap={2}>
            {WMS_MENU.map((entry, i) =>
              isGroup(entry)
                ? <SidebarGroup key={i} group={entry} pathname={pathname} />
                : <SidebarItem key={entry.href} item={entry} pathname={pathname} />
            )}
          </Stack>
        </div>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-gray-200">
          <UnstyledButton onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50 w-full">
            <IconLogout size={16} />
            <Text size="sm">Sair</Text>
          </UnstyledButton>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 md:ml-[220px]">
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
