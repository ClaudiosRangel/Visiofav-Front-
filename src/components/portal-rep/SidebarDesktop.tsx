'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UnstyledButton, Text, Stack, Badge } from '@mantine/core'
import {
  IconHome,
  IconUsers,
  IconFileInvoice,
  IconTimeline,
  IconCash,
  IconBell,
  IconUser,
  IconLogout,
} from '@tabler/icons-react'

interface SidebarDesktopProps {
  notificationCount: number
  onLogout: () => void
}

interface NavItem {
  icon: React.ElementType
  label: string
  href: string
  badge?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { icon: IconHome, label: 'Dashboard', href: '/portal-rep/dashboard' },
  { icon: IconUsers, label: 'Clientes', href: '/portal-rep/clientes' },
  { icon: IconFileInvoice, label: 'Orçamentos', href: '/portal-rep/orcamentos' },
  { icon: IconTimeline, label: 'Pipeline', href: '/portal-rep/pipeline' },
  { icon: IconCash, label: 'Comissões', href: '/portal-rep/comissoes' },
  { icon: IconBell, label: 'Notificações', href: '/portal-rep/notificacoes', badge: true },
  { icon: IconUser, label: 'Perfil', href: '/portal-rep/perfil' },
]

export default function SidebarDesktop({ notificationCount, onLogout }: SidebarDesktopProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  function renderBadge() {
    if (notificationCount <= 0) return null
    const label = notificationCount > 99 ? '99+' : String(notificationCount)
    return (
      <Badge size="sm" variant="filled" color="red" circle={notificationCount <= 9}>
        {label}
      </Badge>
    )
  }

  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        height: '100vh',
        width: 220,
        backgroundColor: '#ffffff',
        borderRight: '1px solid var(--mantine-color-gray-2)',
        display: 'flex',
        flexDirection: 'column',
      }}
      className="hidden md:flex"
    >
      {/* Logo */}
      <div style={{ padding: '20px 16px 12px' }}>
        <Text fw={700} size="lg" c="green">
          Vizor Rep
        </Text>
      </div>

      {/* Navigation items */}
      <Stack gap={2} style={{ flex: 1, padding: '8px 8px 0' }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <UnstyledButton
              key={item.href}
              component={Link}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 'var(--mantine-radius-md)',
                backgroundColor: active ? 'var(--mantine-color-green-0)' : 'transparent',
                color: active ? 'var(--mantine-color-green-7)' : 'var(--mantine-color-gray-7)',
                fontWeight: active ? 600 : 400,
                fontSize: 14,
                transition: 'background-color 150ms ease',
              }}
            >
              <item.icon size={20} stroke={1.5} />
              <Text size="sm" fw={active ? 600 : 400} style={{ flex: 1 }}>
                {item.label}
              </Text>
              {item.badge && renderBadge()}
            </UnstyledButton>
          )
        })}
      </Stack>

      {/* Footer — Sair */}
      <div style={{ padding: '12px 8px 16px' }}>
        <UnstyledButton
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            borderRadius: 'var(--mantine-radius-md)',
            color: 'var(--mantine-color-red-6)',
            fontSize: 14,
            width: '100%',
            transition: 'background-color 150ms ease',
          }}
        >
          <IconLogout size={20} stroke={1.5} />
          <Text size="sm" c="red">
            Sair
          </Text>
        </UnstyledButton>
      </div>
    </nav>
  )
}
