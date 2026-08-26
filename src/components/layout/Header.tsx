'use client'

import { Group, Text, Badge, ActionIcon, Menu, Indicator, Popover, Stack, Box, Button, Divider, ScrollArea } from '@mantine/core'
import { IconBell, IconUser, IconLogout, IconBuildingSkyscraper, IconArrowsExchange, IconMenu2, IconCheck, IconAlertCircle, IconInfoCircle, IconSparkles, IconMessage, IconQuestionMark } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { useEmpresa } from '@/providers/EmpresaProvider'
import { formatarCnpj } from '@/app/(interna)/selecionar-empresa/selecaoEmpresa.utils'
import { usePathname } from 'next/navigation'
import { voltarParaModulos } from '@/lib/abasModulo'
import { detectModule } from '@/components/layout/ModuleSidebar'
import { useMobileMenuStore } from '@/lib/moduleSidebarStore'
import { useNotificacoes, type Notificacao } from '@/data/hooks/useNotificacoes'
import { NotificacaoModal } from '@/components/notificacoes/NotificacaoModal'

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

export default function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { open: abrirMenuMobile } = useMobileMenuStore()
  const { empresa, trocarEmpresa, podeTrocarEmpresa, logout } = useEmpresa()
  const [userName, setUserName] = useState('')
  const [popoverOpened, { toggle: togglePopover, close: closePopover }] = useDisclosure(false)
  const [notificacaoSelecionada, setNotificacaoSelecionada] = useState<Notificacao | null>(null)
  const [modalAberta, { open: abrirModal, close: fecharModal }] = useDisclosure(false)

  const { useContagem, useListar, useMarcarLida, useMarcarTodasLidas } = useNotificacoes()
  const { data: contagem } = useContagem()
  const { data: listaNotificacoes } = useListar({ page: 1, limit: 10 })
  const marcarLida = useMarcarLida()
  const marcarTodasLidas = useMarcarTodasLidas()

  useEffect(() => {
    const user = localStorage.getItem('visiofab-wms-user')
    if (user) {
      try { setUserName(JSON.parse(user).nome) } catch {}
    }
  }, [])

  const handleClickNotificacao = (notif: Notificacao) => {
    setNotificacaoSelecionada(notif)
    abrirModal()
    closePopover()
    if (!notif.lida) {
      marcarLida.mutate(notif.id)
    }
  }

  const handleMarcarTodasLidas = () => {
    marcarTodasLidas.mutate()
  }

  const naoLidas = contagem?.naoLidas || 0

  return (
    <>
      <header className="h-14 bg-white dark:bg-[#1a1b1e] border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-3 md:px-6">
        <Group gap="sm">
          {/* Hambúrguer (mobile/tablet): dentro de um módulo abre o drawer do
              menu do módulo; fora de qualquer módulo, volta para a tela de
              Módulos (comportamento anterior). */}
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            className="md:hidden"
            onClick={() => {
              if (detectModule(pathname)) abrirMenuMobile()
              else voltarParaModulos(router)
            }}
          >
            <IconMenu2 size={20} />
          </ActionIcon>
          <Text
            size="sm"
            c="primary"
            fw={600}
            className="cursor-pointer hover:underline"
            onClick={() => voltarParaModulos(router)}
            title="Voltar para Módulos"
          >
            Vizor ERP
          </Text>
          {empresa && (
            <>
              <Text size="sm" c="dimmed" className="hidden sm:block">|</Text>
              <Group gap={4} className="hidden sm:flex">
                <IconBuildingSkyscraper size={14} className="text-gray-400" />
                <Text size="sm" c="dimmed">
                  {empresa.nomeFantasia || empresa.razaoSocial}
                  {empresa.cnpj && <Text component="span" c="dimmed" ml={4}>({formatarCnpj(empresa.cnpj)})</Text>}
                </Text>
              </Group>
            </>
          )}
        </Group>

        <Group gap="sm">
          <Badge color="primary" variant="filled" size="sm">ONLINE</Badge>
          {empresa && podeTrocarEmpresa && (
            <ActionIcon variant="subtle" color="gray" size="lg" title="Trocar empresa" onClick={trocarEmpresa}>
              <IconArrowsExchange size={18} />
            </ActionIcon>
          )}

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
                <ActionIcon variant="subtle" color="gray" size="lg" onClick={togglePopover}>
                  <IconBell size={18} />
                </ActionIcon>
              </Indicator>
            </Popover.Target>
            <Popover.Dropdown p={0}>
              <Box p="sm" pb={4}>
                <Group justify="space-between">
                  <Text fw={600} size="sm">Notificações</Text>
                  {naoLidas > 0 && (
                    <Button
                      variant="subtle"
                      size="compact-xs"
                      leftSection={<IconCheck size={12} />}
                      onClick={handleMarcarTodasLidas}
                      loading={marcarTodasLidas.isPending}
                    >
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
                        className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                          !notif.lida ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                        }`}
                        p="sm"
                        onClick={() => handleClickNotificacao(notif)}
                      >
                        <Group gap="xs" wrap="nowrap" align="flex-start">
                          <Box mt={2}>{getIconeTipo(notif.tipo)}</Box>
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Group gap={4} justify="space-between" wrap="nowrap">
                              <Text size="sm" fw={notif.lida ? 400 : 600} truncate>
                                {notif.titulo}
                              </Text>
                              <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                                {tempoRelativo(notif.criadoEm)}
                              </Text>
                            </Group>
                            <Text size="xs" c="dimmed" lineClamp={1}>{notif.preview}</Text>
                            <Text size="xs" c="dimmed" mt={2}>De: {notif.remetente}</Text>
                          </Box>
                          {!notif.lida && (
                            <Box mt={6}>
                              <Box w={8} h={8} style={{ borderRadius: '50%', backgroundColor: 'var(--mantine-color-blue-5)' }} />
                            </Box>
                          )}
                        </Group>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Box p="xl" ta="center">
                    <Text size="sm" c="dimmed">Nenhuma notificação</Text>
                  </Box>
                )}
              </ScrollArea.Autosize>
              <Divider />
              <Box p="xs" ta="center">
                <Button
                  variant="subtle"
                  size="compact-sm"
                  fullWidth
                  onClick={() => {
                    closePopover()
                    router.push('/configuracoes/notificacoes')
                  }}
                >
                  Ver todas
                </Button>
              </Box>
            </Popover.Dropdown>
          </Popover>

          <Menu shadow="md" width={200}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="lg"><IconUser size={18} /></ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{userName || 'Usuário'}</Menu.Label>
              {empresa && <Menu.Label>Empresa: {empresa.nomeFantasia || empresa.razaoSocial}</Menu.Label>}
              <Menu.Divider />
              {empresa && podeTrocarEmpresa && (
                <Menu.Item leftSection={<IconArrowsExchange size={14} />} onClick={trocarEmpresa}>Trocar Empresa</Menu.Item>
              )}
              <Menu.Item leftSection={<IconLogout size={14} />} color="red" onClick={logout}>Sair</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </header>

      {/* Modal de visualização completa */}
      <NotificacaoModal
        notificacao={notificacaoSelecionada}
        opened={modalAberta}
        onClose={fecharModal}
      />
    </>
  )
}
