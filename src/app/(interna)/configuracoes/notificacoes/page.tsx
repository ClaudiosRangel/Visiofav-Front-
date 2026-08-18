'use client'

import { useEffect, useState } from 'react'
import { Title, Text, Card, Stack, Group, Button, Table, Badge, ActionIcon, Pagination, Select, Modal, TextInput, Textarea, MultiSelect } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconCheck, IconChecks, IconPlus, IconAlertCircle, IconInfoCircle, IconSparkles, IconMessage, IconQuestionMark } from '@tabler/icons-react'
import { useNotificacoes, type Notificacao } from '@/data/hooks/useNotificacoes'
import { NotificacaoModal } from '@/components/notificacoes/NotificacaoModal'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

function getBadgeTipo(tipo: string) {
  switch (tipo) {
    case 'ALERTA': return <Badge color="red" variant="light" size="sm" leftSection={<IconAlertCircle size={10} />}>Alerta</Badge>
    case 'INFORMACAO': return <Badge color="blue" variant="light" size="sm" leftSection={<IconInfoCircle size={10} />}>Informação</Badge>
    case 'NOVIDADE': return <Badge color="green" variant="light" size="sm" leftSection={<IconSparkles size={10} />}>Novidade</Badge>
    case 'RECADO': return <Badge color="orange" variant="light" size="sm" leftSection={<IconMessage size={10} />}>Recado</Badge>
    case 'DUVIDA': return <Badge color="violet" variant="light" size="sm" leftSection={<IconQuestionMark size={10} />}>Dúvida</Badge>
    default: return <Badge variant="light" size="sm">{tipo}</Badge>
  }
}

export default function NotificacoesPage() {
  useEffect(() => { document.title = 'Vizor - Notificações' }, [])

  const [page, setPage] = useState(1)
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null)
  const [filtroLida, setFiltroLida] = useState<string | null>(null)
  const [notifSelecionada, setNotifSelecionada] = useState<Notificacao | null>(null)
  const [modalDetalhe, { open: abrirDetalhe, close: fecharDetalhe }] = useDisclosure(false)
  const [modalEnviar, { open: abrirEnviar, close: fecharEnviar }] = useDisclosure(false)

  const { useListar, useMarcarLida, useMarcarTodasLidas } = useNotificacoes()

  const params: any = { page, limit: 20 }
  if (filtroTipo) params.tipo = filtroTipo
  if (filtroLida) params.lida = filtroLida

  const { data: lista, isLoading } = useListar(params)
  const marcarLida = useMarcarLida()
  const marcarTodasLidas = useMarcarTodasLidas()

  const handleClick = (notif: Notificacao) => {
    setNotifSelecionada(notif)
    abrirDetalhe()
    if (!notif.lida) {
      marcarLida.mutate(notif.id)
    }
  }

  return (
    <div className="max-w-[1000px] mx-auto">
      <div className="mb-6">
        <Group justify="space-between">
          <div>
            <Title order={2} fw={700}>Notificações</Title>
            <Text size="sm" c="dimmed">Todas as suas notificações</Text>
          </div>
          <Group>
            <Button
              variant="light"
              leftSection={<IconChecks size={16} />}
              onClick={() => marcarTodasLidas.mutate()}
              loading={marcarTodasLidas.isPending}
            >
              Marcar todas como lidas
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={abrirEnviar}
            >
              Nova mensagem
            </Button>
          </Group>
        </Group>
      </div>

      <Card shadow="xs" radius="md" p="md" mb="md">
        <Group>
          <Select
            placeholder="Tipo"
            data={[
              { value: 'ALERTA', label: 'Alerta' },
              { value: 'INFORMACAO', label: 'Informação' },
              { value: 'NOVIDADE', label: 'Novidade' },
              { value: 'RECADO', label: 'Recado' },
              { value: 'DUVIDA', label: 'Dúvida' },
            ]}
            value={filtroTipo}
            onChange={setFiltroTipo}
            clearable
            size="sm"
            w={150}
          />
          <Select
            placeholder="Status"
            data={[
              { value: 'false', label: 'Não lidas' },
              { value: 'true', label: 'Lidas' },
            ]}
            value={filtroLida}
            onChange={setFiltroLida}
            clearable
            size="sm"
            w={150}
          />
        </Group>
      </Card>

      <Card shadow="xs" radius="md" p={0}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40}></Table.Th>
              <Table.Th>Título</Table.Th>
              <Table.Th w={120}>Tipo</Table.Th>
              <Table.Th w={150}>Remetente</Table.Th>
              <Table.Th w={150}>Data</Table.Th>
              <Table.Th w={60}></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading ? (
              <Table.Tr>
                <Table.Td colSpan={6} ta="center" py="xl">
                  <Text c="dimmed" size="sm">Carregando...</Text>
                </Table.Td>
              </Table.Tr>
            ) : lista?.data && lista.data.length > 0 ? (
              lista.data.map((notif) => (
                <Table.Tr
                  key={notif.id}
                  className="cursor-pointer"
                  style={{ fontWeight: notif.lida ? 400 : 600 }}
                  onClick={() => handleClick(notif)}
                >
                  <Table.Td>
                    {!notif.lida && (
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={notif.lida ? 400 : 600} truncate maw={300}>
                      {notif.titulo}
                    </Text>
                    <Text size="xs" c="dimmed" truncate maw={300}>{notif.preview}</Text>
                  </Table.Td>
                  <Table.Td>{getBadgeTipo(notif.tipo)}</Table.Td>
                  <Table.Td>
                    <Text size="sm" truncate>{notif.remetente}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {new Date(notif.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {!notif.lida && (
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        title="Marcar como lida"
                        onClick={(e) => {
                          e.stopPropagation()
                          marcarLida.mutate(notif.id)
                        }}
                      >
                        <IconCheck size={14} />
                      </ActionIcon>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))
            ) : (
              <Table.Tr>
                <Table.Td colSpan={6} ta="center" py="xl">
                  <Text c="dimmed" size="sm">Nenhuma notificação encontrada</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {lista && lista.totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination
            total={lista.totalPages}
            value={page}
            onChange={setPage}
          />
        </Group>
      )}

      {/* Modal de detalhes */}
      <NotificacaoModal
        notificacao={notifSelecionada}
        opened={modalDetalhe}
        onClose={fecharDetalhe}
      />

      {/* Modal de envio */}
      <EnviarNotificacaoModal opened={modalEnviar} onClose={fecharEnviar} />
    </div>
  )
}

// ─── Modal de Envio de Notificação (Usuário) ───
function EnviarNotificacaoModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [tipo, setTipo] = useState<string>('RECADO')
  const [titulo, setTitulo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [destinatarioIds, setDestinatarioIds] = useState<string[]>([])
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<{ value: string; label: string }[]>([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(false)

  const { useEnviar } = useNotificacoes()
  const enviar = useEnviar()

  useEffect(() => {
    if (opened) {
      setLoadingUsuarios(true)
      api.get('/notificacoes/usuarios').then(({ data }) => {
        const usuarios = (data || []).map((u: any) => ({
          value: u.id,
          label: u.perfil === 'SUPER_ADMIN' ? `⭐ ${u.nome} (Admin Vizor)` : u.nome || u.email,
        }))
        setUsuariosDisponiveis(usuarios)
      }).catch(() => {}).finally(() => setLoadingUsuarios(false))
    }
  }, [opened])

  const handleEnviar = () => {
    if (!titulo.trim() || !mensagem.trim() || destinatarioIds.length === 0) {
      notifications.show({ title: 'Campos obrigatórios', message: 'Preencha título, mensagem e selecione ao menos um destinatário', color: 'red' })
      return
    }
    enviar.mutate(
      { tipo: tipo as 'RECADO' | 'INFORMACAO' | 'DUVIDA', titulo, mensagem, destinatarioIds },
      {
        onSuccess: () => {
          notifications.show({ title: 'Enviada', message: 'Notificação enviada com sucesso', color: 'green' })
          setTitulo('')
          setMensagem('')
          setDestinatarioIds([])
          onClose()
        },
        onError: (err: any) => {
          notifications.show({ title: 'Erro', message: err?.response?.data?.error || 'Erro ao enviar', color: 'red' })
        },
      }
    )
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Nova Notificação" size="md">
      <Stack gap="sm">
        <Select
          label="Tipo"
          data={[
            { value: 'RECADO', label: 'Recado' },
            { value: 'INFORMACAO', label: 'Informação' },
            { value: 'DUVIDA', label: 'Dúvida' },
          ]}
          value={tipo}
          onChange={(v) => v && setTipo(v)}
          required
        />
        <TextInput
          label="Título"
          placeholder="Assunto da notificação"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={200}
          required
        />
        <Textarea
          label="Mensagem"
          placeholder="Conteúdo da notificação"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          minRows={4}
          required
        />
        <MultiSelect
          label="Destinatários"
          placeholder={loadingUsuarios ? 'Carregando...' : 'Selecione os destinatários'}
          data={usuariosDisponiveis}
          value={destinatarioIds}
          onChange={setDestinatarioIds}
          searchable
          required
        />
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleEnviar} loading={enviar.isPending}>Enviar</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
