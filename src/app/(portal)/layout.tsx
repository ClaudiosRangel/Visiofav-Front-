'use client'

import { usePathname } from 'next/navigation'
import { AppShell, Group, Text, ThemeIcon } from '@mantine/core'
import { IconBuildingWarehouse } from '@tabler/icons-react'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === '/login'

  if (isLogin) {
    return <>{children}</>
  }

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <ThemeIcon size={36} radius="md" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
              <IconBuildingWarehouse size={20} />
            </ThemeIcon>
            <Text size="lg" fw={700}>Portal 3PL</Text>
          </Group>
          <Group gap="md">
            <Text
              size="sm"
              className="cursor-pointer hover:underline"
              onClick={() => { window.location.href = '/dashboard' }}
              fw={pathname === '/dashboard' ? 600 : 400}
            >
              Dashboard
            </Text>
            <Text
              size="sm"
              className="cursor-pointer hover:underline"
              onClick={() => { window.location.href = '/estoque' }}
              fw={pathname === '/estoque' ? 600 : 400}
            >
              Estoque
            </Text>
            <Text
              size="sm"
              className="cursor-pointer hover:underline"
              onClick={() => { window.location.href = '/solicitacoes' }}
              fw={pathname === '/solicitacoes' ? 600 : 400}
            >
              Solicitações
            </Text>
            <Text
              size="sm"
              c="red"
              className="cursor-pointer hover:underline"
              onClick={() => {
                localStorage.removeItem('visiofab-portal-token')
                window.location.href = '/login'
              }}
            >
              Sair
            </Text>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
