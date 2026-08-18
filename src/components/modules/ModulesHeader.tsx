'use client'

import { ActionIcon, Badge, Menu, Text, TextInput, Avatar, Group, Indicator, Popover, Box, Stack, Button, Divider, ScrollArea } from '@mantine/core'
import {
  IconBell,
  IconLogout,
  IconArrowsExchange,
  IconSearch,
  IconSettings,
  IconCheck,
  IconAlertCircle,
  IconInfoCircle,
  IconSparkles,
  IconMessage,
  IconQuestionMark,
} from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { useRouter } from 'next/navigation'
import { useEmpresa } from '@/providers/EmpresaProvider'
import PreferencesDrawer from '@/components/preferences/PreferencesDrawer'
import { useNotificacoes, type Notificacao } from '@/data/hooks/useNotificacoes'
import { NotificacaoModal } from '@/components/notificacoes/NotificacaoModal'
import { api } from '@/lib/api'

function getIconeTipo(tipo: string) {
  switch (tipo) {
    case 'ALERTA': return <IconAlertCircle size={14} className="text-red-500" />
    case 'INFORMACAO': return <IconInfoCircle size={14} className="text-blue-500" />
    case 'NOVIDADE': return <IconSparkles size={14} className="text-green-500" />
    case 'RECADO': return <IconMessage size={14} className="text-orange-500" />
    case 'DUVIDA': return <IconQuestionMark size={14} className="text-purple-500" />
    default: return <IconInfoCircle size={14} />
  }
}

function tempoRelativo(data: string): string {
  const agora = new Date()
  const d = new Date(data)
  const diffMs = agora.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin} min`
  const diffHoras = Math.floor(diffMin / 60)
  if (diffHoras < 24) return `há ${diffHoras}h`
  const diffDias = Math.floor(diffHoras / 24)
  if (diffDias < 7) return `há ${diffDias}d`
  return d.toLocaleDateString('pt-BR')
}

export default function ModulesHeader() {
  const router = useRouter()
  const { empresa, trocarEmpresa, podeTrocarEmpresa, logout } = useEmpresa()
  const [userName, setUserName] = useState('')
  const [userInitials, setUserInitials] = useState('U')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [popoverOpened, { toggle: togglePopover, close: closePopover }] = useDisclosure(false)
  const [notificacaoSelecionada, setNotificacaoSelecionada] = useState<Notificacao | null>(null)
  const [modalAberta, { open: abrirModal, close: fecharModal }] = useDisclosure(false)

  const { useContagem, useListar, useMarcarLida, useMarcarTodasLidas } = useNotificacoes()
  const { data: contagem } = useContagem()
  const { data: listaNotificacoes } = useListar({ page: 1, limit: 10 })
  const marcarLida = useMarcarLida()
  const marcarTodasLidas = useMarcarTodasLidas()

  const naoLidas = contagem?.naoLidas || 0

  useEffect(() => {
    const user = localStorage.getItem('visiofab-wms-user')
    if (user) {
      try {
        const parsed = JSON.parse(user)
        setUserName(parsed.nome || '')
        const parts = (parsed.nome || 'U').split(' ')
        const initials = parts.length >= 2
            ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
            : parts[0]?.substring(0, 2).toUpperCase() || 'U'
        setUserInitials(initials.substring(0, 2))
      } catch {}
    }
    // Buscar avatar do perfil
    api.get('/notificacoes/meu-perfil').then(({ data }) => {
      if (data?.avatarUrl) setAvatarUrl(data.avatarUrl)
    }).catch(() => {})
  }, [])

  const handleClickNotificacao = (notif: Notificacao) => {
    setNotificacaoSelecionada(notif)
    abrirModal()
    closePopover()
    if (!notif.lida) {
      marcarLida.mutate(notif.id)
    }
  }

  return (
    <>
    <header
      className="sticky top-0 z-50 bg-white dark:bg-[#1a1b1e] border-b border-gray-100 dark:border-gray-800 px-6 lg:px-8"
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

          {/* Sininho de Notificações */}
          <Popover opened={popoverOpened} onChange={togglePopover} position="bottom-end" width={380} shadow="lg">
            <Popover.Target>
              <Indicator
                color="red"
                size={16}
                label={naoLidas > 99 ? '99+' : naoLidas}
                disabled={naoLidas === 0}
                offset={4}
              >
                <ActionIcon variant="subtle" color="gray" size="lg" radius="xl" aria-label="Notificações" onClick={togglePopover}>
                  <IconBell size={20} stroke={1.5} />
                </ActionIcon>
              </Indicator>
            </Popover.Target>
            <Popover.Dropdown p={0}>
              <Box p="sm" pb={4}>
                <Group justify="space-between">
                  <Text fw={600} size="sm">Notificações</Text>
                  {naoLidas > 0 && (
                    <Button variant="subtle" size="compact-xs" leftSection={<IconCheck size={12} />}
                      onClick={() => marcarTodasLidas.mutate()} loading={marcarTodasLidas.isPending}>
                      Marcar todas como lidas
                    </Button>
                  )}
                </Group>
              </Box>
              <Divider />
              <ScrollArea.Autosize mah={400}>
                {listaNotificacoes?.data && listaNotificacoes.data.length > 0 ? (
                  <Stack gap={0}>
                    {listaNotificacoes.data.map((notif) => (
                      <Box
                        key={notif.id}
                        className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${!notif.lida ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                        p="sm"
                        onClick={() => handleClickNotificacao(notif)}
                      >
                        <Group gap="xs" wrap="nowrap" align="flex-start">
                          <Box mt={2}>{getIconeTipo(notif.tipo)}</Box>
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Group gap={4} justify="space-between" wrap="nowrap">
                              <Text size="sm" fw={notif.lida ? 400 : 600} truncate>{notif.titulo}</Text>
                              <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{tempoRelativo(notif.criadoEm)}</Text>
                            </Group>
                            <Text size="xs" c="dimmed" lineClamp={1}>{notif.preview}</Text>
                          </Box>
                          {!notif.lida && <Box mt={6}><Box w={8} h={8} style={{ borderRadius: '50%', backgroundColor: 'var(--mantine-color-blue-5)' }} /></Box>}
                        </Group>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Box p="xl" ta="center"><Text size="sm" c="dimmed">Nenhuma notificação</Text></Box>
                )}
              </ScrollArea.Autosize>
              <Divider />
              <Box p="xs" ta="center">
                <Button variant="subtle" size="compact-sm" fullWidth onClick={() => { closePopover(); router.push('/configuracoes/notificacoes') }}>
                  Ver todas
                </Button>
              </Box>
            </Popover.Dropdown>
          </Popover>

          <ActionIcon variant="subtle" color="gray" size="lg" radius="xl" aria-label="Configurações" onClick={() => setPrefsOpen(true)}>
            <IconSettings size={20} stroke={1.5} />
          </ActionIcon>

          <Menu shadow="lg" width={220} radius="md">
            <Menu.Target>
              <Avatar
                radius="xl"
                size="md"
                color="primary"
                src={avatarUrl || undefined}
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
              {empresa && podeTrocarEmpresa && (
                <Menu.Item leftSection={<IconArrowsExchange size={14} />} onClick={trocarEmpresa}>
                  Trocar Empresa
                </Menu.Item>
              )}
              <Menu.Item leftSection={<IconLogout size={14} />} color="red" onClick={logout}>
                Sair
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </div>
    </header>
    <PreferencesDrawer opened={prefsOpen} onClose={() => setPrefsOpen(false)} />
    <NotificacaoModal notificacao={notificacaoSelecionada} opened={modalAberta} onClose={fecharModal} />
    </>
  )
}
