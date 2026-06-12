'use client'

import { Group, Text, Badge, ActionIcon, Menu } from '@mantine/core'
import { IconBell, IconUser, IconLogout, IconBuildingSkyscraper, IconArrowsExchange } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useEmpresa } from '@/providers/EmpresaProvider'

export default function Header() {
  const router = useRouter()
  const { empresa, trocarEmpresa } = useEmpresa()
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const user = localStorage.getItem('visiofab-wms-user')
    if (user) {
      try { setUserName(JSON.parse(user).nome) } catch {}
    }
  }, [])

  function handleLogout() {
    localStorage.removeItem('visiofab-wms-token')
    localStorage.removeItem('visiofab-wms-user')
    localStorage.removeItem('visiofab-wms-empresa')
    router.push('/login')
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <Group gap="sm">
        <Text size="sm" c="primary" fw={600}>Vizor ERP</Text>
        {empresa && (
          <>
            <Text size="sm" c="dimmed">|</Text>
            <Group gap={4}>
              <IconBuildingSkyscraper size={14} className="text-gray-400" />
              <Text size="sm" c="dimmed">{empresa.nomeFantasia || empresa.razaoSocial}</Text>
            </Group>
          </>
        )}
      </Group>

      <Group gap="sm">
        <Badge color="primary" variant="filled" size="sm">ONLINE</Badge>
        {empresa && (
          <ActionIcon variant="subtle" color="gray" size="lg" title="Trocar empresa" onClick={trocarEmpresa}>
            <IconArrowsExchange size={18} />
          </ActionIcon>
        )}
        <ActionIcon variant="subtle" color="gray" size="lg"><IconBell size={18} /></ActionIcon>
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" size="lg"><IconUser size={18} /></ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{userName || 'Usuário'}</Menu.Label>
            {empresa && <Menu.Label>Empresa: {empresa.nomeFantasia || empresa.razaoSocial}</Menu.Label>}
            <Menu.Divider />
            {empresa && (
              <Menu.Item leftSection={<IconArrowsExchange size={14} />} onClick={trocarEmpresa}>Trocar Empresa</Menu.Item>
            )}
            <Menu.Item leftSection={<IconLogout size={14} />} color="red" onClick={handleLogout}>Sair</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </header>
  )
}
