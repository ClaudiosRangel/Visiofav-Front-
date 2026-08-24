'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { UnstyledButton, Text, Drawer, Stack, Group } from '@mantine/core'
import {
  IconHome,
  IconUsers,
  IconFileInvoice,
  IconTimeline,
  IconDotsVertical,
  IconCash,
  IconBell,
  IconUser,
} from '@tabler/icons-react'
import Link from 'next/link'
import { NotificationBadge } from './NotificationBadge'

interface BottomNavProps {
  notificationCount: number
}

interface NavItem {
  icon: React.ElementType
  label: string
  href: string
}

const NAV_ITEMS: NavItem[] = [
  { icon: IconHome, label: 'Dashboard', href: '/portal-rep/dashboard' },
  { icon: IconUsers, label: 'Clientes', href: '/portal-rep/clientes' },
  { icon: IconFileInvoice, label: 'Orçamentos', href: '/portal-rep/orcamentos' },
  { icon: IconTimeline, label: 'Pipeline', href: '/portal-rep/pipeline' },
]

const SECONDARY_ITEMS: NavItem[] = [
  { icon: IconCash, label: 'Comissões', href: '/portal-rep/comissoes' },
  { icon: IconBell, label: 'Notificações', href: '/portal-rep/notificacoes' },
  { icon: IconUser, label: 'Perfil', href: '/portal-rep/perfil' },
]

export function BottomNav({ notificationCount }: BottomNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const isMoreActive = SECONDARY_ITEMS.some((item) => isActive(item.href))

  return (
    <>
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          zIndex: 100,
          backgroundColor: '#ffffff',
          borderTop: '1px solid var(--mantine-color-gray-3)',
        }}
        className="md:hidden"
      >
        <Group
          gap={0}
          justify="space-around"
          align="center"
          style={{ height: 60, padding: '0 4px' }}
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href)
            return (
              <UnstyledButton
                key={item.href}
                component={Link}
                href={item.href}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 44,
                  minHeight: 44,
                  padding: '4px 8px',
                  borderRadius: 8,
                  gap: 2,
                  transition: 'background-color 150ms ease',
                }}
              >
                <item.icon
                  size={22}
                  stroke={1.5}
                  color={active ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-gray-6)'}
                />
                <Text
                  size="xs"
                  fw={active ? 600 : 400}
                  c={active ? 'green.6' : 'gray.6'}
                  style={{ fontSize: 11, lineHeight: 1.2 }}
                >
                  {item.label}
                </Text>
              </UnstyledButton>
            )
          })}

          {/* Item "Mais" */}
          <UnstyledButton
            onClick={() => setMoreOpen(true)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 44,
              minHeight: 44,
              padding: '4px 8px',
              borderRadius: 8,
              gap: 2,
              position: 'relative',
              transition: 'background-color 150ms ease',
            }}
          >
            <div style={{ position: 'relative' }}>
              <IconDotsVertical
                size={22}
                stroke={1.5}
                color={isMoreActive ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-gray-6)'}
              />
              <NotificationBadge count={notificationCount} />
            </div>
            <Text
              size="xs"
              fw={isMoreActive ? 600 : 400}
              c={isMoreActive ? 'green.6' : 'gray.6'}
              style={{ fontSize: 11, lineHeight: 1.2 }}
            >
              Mais
            </Text>
          </UnstyledButton>
        </Group>
      </nav>

      {/* Drawer "Mais" — seções secundárias */}
      <Drawer
        opened={moreOpen}
        onClose={() => setMoreOpen(false)}
        position="bottom"
        size="auto"
        title="Mais opções"
        padding="md"
        radius="md"
        classNames={{ header: 'pb-0' }}
      >
        <Stack gap={8} mt="sm">
          {SECONDARY_ITEMS.map((item) => {
            const active = isActive(item.href)
            return (
              <UnstyledButton
                key={item.href}
                onClick={() => {
                  setMoreOpen(false)
                  router.push(item.href)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 8,
                  minHeight: 44,
                  backgroundColor: active ? 'var(--mantine-color-green-0)' : 'transparent',
                  transition: 'background-color 150ms ease',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <item.icon
                    size={22}
                    stroke={1.5}
                    color={active ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-gray-7)'}
                  />
                  {item.href === '/portal-rep/notificacoes' && (
                    <NotificationBadge count={notificationCount} />
                  )}
                </div>
                <Text
                  size="sm"
                  fw={active ? 600 : 400}
                  c={active ? 'green.6' : 'dark'}
                >
                  {item.label}
                </Text>
              </UnstyledButton>
            )
          })}
        </Stack>
      </Drawer>
    </>
  )
}
