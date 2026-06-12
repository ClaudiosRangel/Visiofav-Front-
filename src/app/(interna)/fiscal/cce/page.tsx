'use client'

import { useEffect, useState } from 'react'
import {
  Card, Text, Table, Badge, Group, ActionIcon, Tooltip, TextInput, Select, Button,
  Drawer, Stack, Divider, Timeline, CopyButton, Code, LoadingOverlay, ThemeIcon,
} from '@mantine/core'
import {
  IconSearch, IconRefresh, IconEye, IconFileText, IconCheck, IconX, IconClock,
  IconCopy, IconCheckbox, IconAlertTriangle, IconSend,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'

interface CCeItem {
  id: string
  notaEntradaId: string
  chaveNfe: string
  sequenciaEvento: number
  textoCorrecao: string
  protocolo: string | null
  status: 'PENDENTE' | 'AUTORIZADA' | 'REJEITADA'
  motivoRejeicao: string | null
  criadoEm: string
}

interface CCeDetalhe extends CCeItem {
  empresaId: string
  divergenciaId: string
  xmlEnviado: string | null
  xmlRetorno: string | null
  divergencia?: {
    id: string
    tipo: string
    quantidadeEsperada: number | null
    quantidadeConferida: number | null
    status: string
  }
}

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  AUTORIZADA: { color: 'green', icon: IconCheck, label: 'Autorizada' },
  REJEITADA: { color: 'red', icon: IconX, label: 'Rejeitada' },
  PENDENTE: { color: 'yellow', icon: IconClock, label: 'Pendente' },
}

export default function CcePage() {
  const [items, setItems] = useState<CCeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [detalhe, setDetalhe] = useState<CCeDetalhe | null>(null)
  const [detalheLoading, setDetalheLoading] = useState(false)

  useEffect(() => {
    document.title = 'Vizor - Cartas de Correção (CC-e)'
    loadData()
  }, [statusFilter])

  async function loadData() {
    setLoading(true)
    try {
      const params: any = { limit: 100 }
      if (statusFilter) params.status = statusFilter
      const { data } = await api.get('/cce', { params })
      setItems(data.data || [])
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao carregar CC-e', color: 'red' })
    } finally {
      setLoading(false)
    }
  }

  async function openDetalhe(id: string) {
    setDrawerOpen(true)
    setDetalheLoading(true)
    try {
      const { data } = await api.get(`/cce/${id}`)
      setDetalhe(data)
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao carregar detalhe', color: 'red' })
    } finally {
      setDetalheLoading(false)
    }
  }

  const filtered = items.filter((item) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      item.chaveNfe.includes(q) ||
      item.textoCorrecao.toLowerCase().includes(q) ||
      (item.protocolo && item.protocolo.includes(q))
    )
  })

  // Estatísticas
  const stats = {
    total: items.length,
    autorizadas: items.filter((i) => i.status === 'AUTORIZADA').length,
    rejeitadas: items.filter((i) => i.status === 'REJEITADA').length,
    pendentes: items.filter((i) => i.status === 'PENDENTE').length,
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Fiscal / Cartas de Correção</Text>
      <Text size="xl" fw={600} mb="lg">Cartas de Correção Eletrônica (CC-e)</Text>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">Total Emitidas</Text>
          <Text size="xl" fw={700}>{stats.total}</Text>
        </Card>
        <Card withBorder padding="sm">
          <Group gap={4}>
            <ThemeIcon size="xs" color="green" variant="light"><IconCheck size={10} /></ThemeIcon>
            <Text size="xs" c="dimmed">Autorizadas</Text>
          </Group>
          <Text size="xl" fw={700} c="green">{stats.autorizadas}</Text>
        </Card>
        <Card withBorder padding="sm">
          <Group gap={4}>
            <ThemeIcon size="xs" color="red" variant="light"><IconX size={10} /></ThemeIcon>
            <Text size="xs" c="dimmed">Rejeitadas</Text>
          </Group>
          <Text size="xl" fw={700} c="red">{stats.rejeitadas}</Text>
        </Card>
        <Card withBorder padding="sm">
          <Group gap={4}>
            <ThemeIcon size="xs" color="yellow" variant="light"><IconClock size={10} /></ThemeIcon>
            <Text size="xs" c="dimmed">Pendentes</Text>
          </Group>
          <Text size="xl" fw={700} c="yellow.7">{stats.pendentes}</Text>
        </Card>
      </div>

      {/* Tabela principal */}
      <Card pos="relative">
        <LoadingOverlay visible={loading} />
        <Group justify="space-between" mb="md">
          <Group>
            <TextInput placeholder="Buscar por chave, protocolo ou texto..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} className="w-80" />
            <Select placeholder="Status" data={[
              { value: '', label: 'Todos' },
              { value: 'AUTORIZADA', label: '✓ Autorizadas' },
              { value: 'REJEITADA', label: '✗ Rejeitadas' },
              { value: 'PENDENTE', label: '◷ Pendentes' },
            ]} value={statusFilter || ''} onChange={(v) => setStatusFilter(v || null)} clearable className="w-44" />
          </Group>
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={loadData}>Atualizar</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Seq.</Table.Th>
              <Table.Th>Chave NF-e</Table.Th>
              <Table.Th>Texto de Correção</Table.Th>
              <Table.Th>Protocolo</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Data</Table.Th>
              <Table.Th className="w-16">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.map((item) => {
              const cfg = statusConfig[item.status] || statusConfig.PENDENTE
              return (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Badge variant="light" color="blue" size="sm">{item.sequenciaEvento}/20</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace" lineClamp={1} className="max-w-[180px]">
                      {item.chaveNfe.slice(0, 11)}...{item.chaveNfe.slice(-4)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={1} className="max-w-[300px]">{item.textoCorrecao}</Text>
                  </Table.Td>
                  <Table.Td>
                    {item.protocolo ? (
                      <Code>{item.protocolo}</Code>
                    ) : (
                      <Text size="xs" c="dimmed">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={cfg.color} variant="light" leftSection={<cfg.icon size={12} />}>
                      {cfg.label}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">{new Date(item.criadoEm).toLocaleString('pt-BR')}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label="Ver detalhes">
                      <ActionIcon variant="subtle" color="blue" onClick={() => openDetalhe(item.id)}>
                        <IconEye size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              )
            })}
            {!loading && filtered.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={7} className="text-center py-8 text-zinc-500">
                  {items.length === 0 ? 'Nenhuma CC-e emitida ainda' : 'Nenhum resultado para o filtro'}
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Drawer de detalhe */}
      <Drawer opened={drawerOpen} onClose={() => { setDrawerOpen(false); setDetalhe(null) }} title="Detalhe da CC-e" position="right" size="lg">
        {detalheLoading && <LoadingOverlay visible />}
        {detalhe && (
          <Stack gap="md">
            {/* Status header */}
            <Card withBorder bg={detalhe.status === 'AUTORIZADA' ? 'green.0' : detalhe.status === 'REJEITADA' ? 'red.0' : 'yellow.0'}>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed">Status</Text>
                  <Badge size="lg" color={statusConfig[detalhe.status]?.color || 'gray'} variant="filled">
                    {statusConfig[detalhe.status]?.label || detalhe.status}
                  </Badge>
                </div>
                <div className="text-right">
                  <Text size="xs" c="dimmed">Sequência</Text>
                  <Text fw={700}>{detalhe.sequenciaEvento}/20</Text>
                </div>
              </Group>
            </Card>

            {/* Informações principais */}
            <div>
              <Text size="sm" fw={600} mb={4}>Chave NF-e</Text>
              <Group gap={4}>
                <Code className="text-xs break-all">{detalhe.chaveNfe}</Code>
                <CopyButton value={detalhe.chaveNfe}>
                  {({ copied, copy }) => (
                    <ActionIcon size="xs" variant="subtle" onClick={copy} color={copied ? 'green' : 'gray'}>
                      {copied ? <IconCheckbox size={14} /> : <IconCopy size={14} />}
                    </ActionIcon>
                  )}
                </CopyButton>
              </Group>
            </div>

            {detalhe.protocolo && (
              <div>
                <Text size="sm" fw={600} mb={4}>Protocolo SEFAZ</Text>
                <Group gap={4}>
                  <Code>{detalhe.protocolo}</Code>
                  <CopyButton value={detalhe.protocolo}>
                    {({ copied, copy }) => (
                      <ActionIcon size="xs" variant="subtle" onClick={copy} color={copied ? 'green' : 'gray'}>
                        {copied ? <IconCheckbox size={14} /> : <IconCopy size={14} />}
                      </ActionIcon>
                    )}
                  </CopyButton>
                </Group>
              </div>
            )}

            <div>
              <Text size="sm" fw={600} mb={4}>Texto de Correção</Text>
              <Card withBorder bg="gray.0" p="sm">
                <Text size="sm">{detalhe.textoCorrecao}</Text>
              </Card>
            </div>

            {detalhe.motivoRejeicao && (
              <div>
                <Text size="sm" fw={600} mb={4} c="red">Motivo da Rejeição</Text>
                <Card withBorder bg="red.0" p="sm">
                  <Group gap={4}>
                    <IconAlertTriangle size={16} className="text-red-500" />
                    <Text size="sm" c="red">{detalhe.motivoRejeicao}</Text>
                  </Group>
                </Card>
              </div>
            )}

            <Divider label="Divergência Associada" labelPosition="left" />

            {detalhe.divergencia && (
              <Card withBorder p="sm">
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed">Tipo</Text>
                    <Badge variant="light">{detalhe.divergencia.tipo.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="text-right">
                    <Text size="xs" c="dimmed">Quantidade</Text>
                    <Text size="sm">
                      <Text component="span" c="red" td="line-through">{Number(detalhe.divergencia.quantidadeEsperada)}</Text>
                      {' → '}
                      <Text component="span" fw={600} c="green">{Number(detalhe.divergencia.quantidadeConferida)}</Text>
                    </Text>
                  </div>
                </Group>
              </Card>
            )}

            <Divider label="Timeline do Evento" labelPosition="left" />

            <Timeline active={detalhe.status === 'AUTORIZADA' ? 3 : detalhe.status === 'REJEITADA' ? 2 : 1} bulletSize={24} lineWidth={2}>
              <Timeline.Item bullet={<IconFileText size={12} />} title="XML Gerado">
                <Text size="xs" c="dimmed">Evento 110110 montado</Text>
              </Timeline.Item>
              <Timeline.Item bullet={<IconSend size={12} />} title="Transmitido à SEFAZ">
                <Text size="xs" c="dimmed">{new Date(detalhe.criadoEm).toLocaleString('pt-BR')}</Text>
              </Timeline.Item>
              {detalhe.status === 'AUTORIZADA' && (
                <Timeline.Item bullet={<IconCheck size={12} />} title="Autorizada" color="green">
                  <Text size="xs" c="dimmed">Protocolo: {detalhe.protocolo}</Text>
                </Timeline.Item>
              )}
              {detalhe.status === 'REJEITADA' && (
                <Timeline.Item bullet={<IconX size={12} />} title="Rejeitada" color="red">
                  <Text size="xs" c="red">{detalhe.motivoRejeicao}</Text>
                </Timeline.Item>
              )}
            </Timeline>

            <Divider />
            <Text size="xs" c="dimmed">Emitida em {new Date(detalhe.criadoEm).toLocaleString('pt-BR')}</Text>
          </Stack>
        )}
      </Drawer>
    </div>
  )
}
