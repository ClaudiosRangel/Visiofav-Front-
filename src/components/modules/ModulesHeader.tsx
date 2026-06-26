'use client'

import { ActionIcon, Badge, Menu, Text, TextInput, Avatar, Group } from '@mantine/core'
import {
  IconBell,
  IconLogout,
  IconArrowsExchange,
  IconSearch,
  IconSettings,
} from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useEmpresa } from '@/providers/EmpresaProvider'

export default function ModulesHeader() {
  const router = useRouter()
  const { empresa, trocarEmpresa } = useEmpresa()
  const [userName, setUserName] = useState('')
  const [userInitials, setUserInitials] = useState('U')

  useEffect(() => {
    const user = localStorage.getItem('visiofab-wms-user')
    if (user) {
      try {
        const parsed = JSON.parse(user)
        setUserName(parsed.nome || '')
        const parts = (parsed.nome || 'U').split(' ')
        setUserInitials(
          parts.length >= 2
            ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
            : parts[0][0]?.toUpperCase() || 'U'
        )
      } catch {}
    }
  }, [])

  function handleLogout() {
    localStorage.removeItem('visiofab-wms-token')
    localStorage.removeItem('visiofab-wms-user')
    localStorage.removeItem('visiofab-wms-empresa')
    router.push('/login')
  }

  return (
    <header
      className="sticky top-0 z-50 bg-white border-b border-gray-100 px-6 lg:px-8"
      style={{ height: 72, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
    >
      <div className="flex items-center justify-between h-full max-w-[1600px] mx-auto">
        {/* Left: Logo + Name */}
        <div className="flex items-center gap-3">
          <Text
            size="xl"
            fw={800}
            className="tracking-tight"
            style={{ color: '#0ca678', fontStyle: 'italic' }}
          >
            VIZOR
          </Text>
          <Text size="xl" fw={300} c="#111827">
            ERP
          </Text>
        </div>

        {/* Center: Search */}
        <div className="hidden md:block w-full max-w-sm mx-8">
          <TextInput
            placeholder="Buscar no sistema..."
            leftSection={<IconSearch size={16} className="text-gray-400" />}
            rightSection={
              <kbd className="hidden lg:inline text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                Ctrl+K
              </kbd>
            }
            size="sm"
            radius="xl"
            variant="filled"
            styles={{
              input: {
                backgroundColor: '#F8FAFC',
                border: '1px solid #E5E7EB',
                '&:focus': { borderColor: '#0ca678' },
              },
            }}
          />
        </div>

        {/* Right: Status + Actions + Avatar */}
        <Group gap="md">
          <Badge
            color="green"
            variant="light"
            size="md"
            leftSection={<div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
            className="hidden sm:flex"
          >
            ONLINE
          </Badge>

          <ActionIcon variant="subtle" color="gray" size="lg" radius="xl" aria-label="Notificações">
            <IconBell size={20} stroke={1.5} />
          </ActionIcon>

          <ActionIcon variant="subtle" color="gray" size="lg" radius="xl" aria-label="Configurações">
            <IconSettings size={20} stroke={1.5} />
          </ActionIcon>

          <Menu shadow="lg" width={220} radius="md">
            <Menu.Target>
              <Avatar
                radius="xl"
                size="md"
                color="primary"
                className="cursor-pointer hover:ring-2 hover:ring-green-200 transition-all"
                aria-label="Menu do usuário"
              >
                {userInitials}
              </Avatar>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{userName || 'Usuário'}</Menu.Label>
              {empresa && (
                <Menu.Label className="text-xs text-gray-400">
                  {empresa.nomeFantasia || empresa.razaoSocial}
                </Menu.Label>
              )}
              <Menu.Divider />
              {empresa && (
                <Menu.Item leftSection={<IconArrowsExchange size={14} />} onClick={trocarEmpresa}>
                  Trocar Empresa
                </Menu.Item>
              )}
              <Menu.Item leftSection={<IconLogout size={14} />} color="red" onClick={handleLogout}>
                Sair
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </div>
    </header>
  )
}
