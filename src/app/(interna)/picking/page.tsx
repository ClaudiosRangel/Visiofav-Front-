'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, SimpleGrid, ThemeIcon, Table, Badge, Button, Progress,
  Modal, Select, MultiSelect, LoadingOverlay, Pagination, ActionIcon, Tooltip,
} from '@mantine/core'
import { IconBarcode, IconClock, IconCheck, IconAlertTriangle, IconPlus, IconRefresh, IconPlayerPlay, IconX, IconEye, IconUsers } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter } from 'next/navigation'

const statusColors: Record<string, string> = {
  PENDENTE: 'orange', EM_SEPARACAO: 'blue', SEPARADA: 'grape',
  CONFERIDA: 'cyan', EMBALADA: 'teal', CONCLUIDA: 'green', CANCELADA: 'red',
}

const prioridadeColors: Record<string, string> = { ALTA: 'red', MEDIA: 'yellow', BAIXA: 'gray' }

export default function PickingPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Picking' }, [])
  const router = useRouter()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 20

  // State para modal de iniciar com funcionários
  const [iniciarModal, setIniciarModal] = useState<string | null>(null) // ondaId
  const [iniciarFuncs, setIniciarFuncs] = useState<string[]>([])

  // Buscar ondas
  const { data: response, isLoading, refetch } = useQuery<any>({
    queryKey: ['ondas-separacao', { page, limit }],
    queryFn: async () => { const { data } = await api.get('/ondas-separacao', { params: { page, limit } }); return data },
  })

  // Buscar pedidos EM_SEPARACAO para o modal
  const { data: pedidosData } = useQuery<any>({
    queryKey: ['pedidos-venda-separacao'],
    queryFn: async () => { const { data } = await api.get('/pedidos-venda', { params: { status: 'EM_SEPARACAO', limit: 100 } }); return data },
    enabled: modalOpen,
  })

  // Buscar docas para o modal
  const { data: docasData } = useQuery<any>({
    queryKey: ['docas-select'],
    queryFn: async () => { const { data } = await api.get('/docas', { params: { limit: 50 } }); return data },
    enabled: modalOpen,
  })

  // Buscar funcionários para o modal de iniciar
  const { data: funcsData } = useQuery<any>({
    queryKey: ['funcionarios-select'],
    queryFn: async () => { const { data } = await api.get('/funcionarios', { params: { limit: 100 } }); return data },
    enabled: !!iniciarModal,
  })

  // Form state para nova onda
  const [selectedPedidos, setSelectedPedidos] = useState<string[]>([])
  const [prioridade, setPrioridade] = useState<string | null>('MEDIA')
  const [docaId, setDocaId] = useState<string | null>(null)

  const criarOnda = useMutation({
    mutationFn: async () => {
      if (selectedPedidos.length === 0) throw new Error('Selecione ao menos um pedido')
      if (!docaId) throw new Error('Selecione uma doca')
      const { data } = await api.post('/ondas-separacao', {
        pedidoVendaIds: selectedPedidos,
        prioridade: prioridade || 'MEDIA',
        docaId,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ondas-separacao'] })
      queryClient.invalidateQueries({ queryKey: ['pedidos-venda-separacao'] })
      setModalOpen(false)
      setSelectedPedidos([])
      setPrioridade('MEDIA')
      setDocaId(null)
      notifications.show({ title: 'Sucesso', message: 'Onda de separação criada', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    },
  })

  const iniciarOnda = useMutation({
    mutationFn: async ({ ondaId, funcionarioIds }: { ondaId: string; funcionarioIds: string[] }) => {
      // 1. Iniciar a onda (gera itens de separação)
      const { data: result } = await api.patch(`/ondas-separacao/${ondaId}/iniciar`)
      // 2. Atribuir funcionários
      if (funcionarioIds.length > 0) {
        await api.patch(`/ondas-separacao/${ondaId}/funcionarios`, { funcionarioIds })
      }
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ondas-separacao'] })
      setIniciarModal(null)
      setIniciarFuncs([])
      notifications.show({ title: 'Sucesso', message: 'Onda iniciada com funcionários atribuídos', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    },
  })

  const cancelarOnda = useMutation({
    mutationFn: async (id: string) => { const { data } = await api.patch(`/ondas-separacao/${id}/cancelar`); return data },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ondas-separacao'] })
      notifications.show({ title: 'Sucesso', message: 'Onda cancelada', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  const ondas = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / limit)

  // Calcular estatísticas
  const ondasAtivas = ondas.filter((o: any) => !['CONCLUIDA', 'CANCELADA'].includes(o.status)).length
  const itensPendentes = ondas.reduce((s: number, o: any) => s + (o.progresso?.pendentes || 0), 0)
  const separadosHoje = ondas.reduce((s: number, o: any) => s + (o.progresso?.separados || 0), 0)
  const divergencias = ondas.reduce((s: number, o: any) => s + (o.progresso?.divergencias || 0), 0)

  const stats = [
    { title: 'Ondas Ativas', value: String(ondasAtivas), icon: IconBarcode, color: 'blue' },
    { title: 'Itens Pendentes', value: String(itensPendentes), icon: IconClock, color: 'orange' },
    { title: 'Separados', value: String(separadosHoje), icon: IconCheck, color: 'green' },
    { title: 'Divergências', value: String(divergencias), icon: IconAlertTriangle, color: 'red' },
  ]

  const pedidoOptions = (pedidosData?.data || []).map((p: any) => ({
    value: p.id,
    label: `#${p.numero} — ${p.cliente?.nomeFantasia || p.cliente?.razaoSocial || 'Cliente'} — ${Number(p.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
  }))

  const docaOptions = (docasData?.data || []).map((d: any) => ({
    value: d.id,
    label: d.descricao || d.nome || `Doca ${d.id.substring(0, 8)}`,
  }))

  const funcOptions = (funcsData?.data || []).map((f: any) => ({
    value: f.id,
    label: f.nome || f.matricula,
  }))

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Picking</Text>
      <Text size="xl" fw={600} mb="lg">Picking / Separação</Text>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="xl">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{stat.title}</Text>
                <Text size="xl" fw={700} mt={4}>{stat.value}</Text>
              </div>
              <ThemeIcon color={stat.color} variant="light" size={48} radius="md"><stat.icon size={24} /></ThemeIcon>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <Text fw={600}>Ondas de Separação</Text>
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={() => setModalOpen(true)}>Nova Onda</Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Onda</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>NF</Table.Th>
              <Table.Th>Valor</Table.Th>
              <Table.Th>Prioridade</Table.Th>
              <Table.Th>Itens</Table.Th>
              <Table.Th>Progresso</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th className="w-36">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ondas.map((onda: any) => (
              <Table.Tr key={onda.id}>
                <Table.Td><Text fw={600}>#{onda.numero}</Text></Table.Td>
                <Table.Td><Text size="sm">{onda.clienteNome || '—'}</Text></Table.Td>
                <Table.Td><Text size="sm">{onda.nfNumero || '—'}</Text></Table.Td>
                <Table.Td><Text size="sm">{onda.valorTotal ? Number(onda.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</Text></Table.Td>
                <Table.Td><Badge color={prioridadeColors[onda.prioridade] || 'gray'} variant="light">{onda.prioridade}</Badge></Table.Td>
                <Table.Td>{onda.progresso?.separados || 0} / {onda.progresso?.totalItens || 0}</Table.Td>
                <Table.Td className="w-40">
                  <Group gap={8}>
                    <Progress value={onda.progresso?.percentual || 0} size="lg" className="flex-1" color={onda.progresso?.percentual === 100 ? 'green' : 'primary'} />
                    <Text size="xs" fw={600}>{onda.progresso?.percentual || 0}%</Text>
                  </Group>
                </Table.Td>
                <Table.Td><Badge color={statusColors[onda.status] || 'gray'} variant="light">{onda.status.replace(/_/g, ' ')}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {onda.status === 'PENDENTE' && (
                      <Tooltip label="Iniciar separação">
                        <ActionIcon variant="subtle" color="blue" onClick={() => { setIniciarModal(onda.id); setIniciarFuncs([]) }}>
                          <IconPlayerPlay size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {onda.status === 'EM_SEPARACAO' && (
                      <Tooltip label="Acompanhar">
                        <ActionIcon variant="subtle" color="blue" onClick={() => router.push(`/picking/${onda.id}`)}>
                          <IconEye size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {['PENDENTE', 'EM_SEPARACAO'].includes(onda.status) && (
                      <Tooltip label="Cancelar">
                        <ActionIcon variant="subtle" color="red" onClick={() => { if (confirm('Cancelar onda?')) cancelarOnda.mutate(onda.id) }}>
                          <IconX size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {!['PENDENTE', 'EM_SEPARACAO', 'CANCELADA'].includes(onda.status) && (
                      <Tooltip label="Ver detalhes">
                        <ActionIcon variant="subtle" color="gray" onClick={() => router.push(`/picking/${onda.id}`)}>
                          <IconEye size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && ondas.length === 0 && (
              <Table.Tr><Table.Td colSpan={9} className="text-center py-8 text-zinc-500">Nenhuma onda de separação</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && <Group justify="center" mt="md"><Pagination total={totalPages} value={page} onChange={setPage} /></Group>}
      </Card>

      {/* Modal Nova Onda */}
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Nova Onda de Separação" size="lg" centered closeOnClickOutside={false}>
        <div className="flex flex-col gap-4">
          <MultiSelect
            label={<>Pedidos de Venda (EM_SEPARACAO) <span style={{ color: 'red' }}>*</span></>}
            placeholder="Selecione os pedidos..."
            data={pedidoOptions}
            value={selectedPedidos}
            onChange={setSelectedPedidos}
            searchable
            maxDropdownHeight={200}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Prioridade"
              data={[
                { value: 'ALTA', label: '🔴 Alta' },
                { value: 'MEDIA', label: '🟡 Média' },
                { value: 'BAIXA', label: '⚪ Baixa' },
              ]}
              value={prioridade}
              onChange={setPrioridade}
            />
            <Select
              label={<>Doca de Expedição <span style={{ color: 'red' }}>*</span></>}
              placeholder="Selecione a doca"
              data={docaOptions}
              value={docaId}
              onChange={setDocaId}
              searchable
            />
          </div>

          {selectedPedidos.length > 0 && (
            <Text size="sm" c="dimmed">{selectedPedidos.length} pedido(s) selecionado(s)</Text>
          )}
        </div>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => criarOnda.mutate()}
            loading={criarOnda.isPending}
            disabled={selectedPedidos.length === 0 || !docaId}
          >
            Criar Onda
          </Button>
        </Group>
      </Modal>

      {/* Modal Iniciar Onda com Funcionários */}
      <Modal opened={!!iniciarModal} onClose={() => { setIniciarModal(null); setIniciarFuncs([]) }} title="Iniciar Separação" centered closeOnClickOutside={false}>
        <Text size="sm" c="dimmed" mb="md">Selecione os funcionários que irão realizar a separação. Os itens serão distribuídos entre eles.</Text>
        <MultiSelect
          label={<>Funcionário(s) <span style={{ color: 'red' }}>*</span></>}
          placeholder="Selecione os funcionários..."
          data={funcOptions}
          value={iniciarFuncs}
          onChange={setIniciarFuncs}
          searchable
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => { setIniciarModal(null); setIniciarFuncs([]) }}>Cancelar</Button>
          <Button
            leftSection={<IconPlayerPlay size={16} />}
            onClick={() => iniciarOnda.mutate({ ondaId: iniciarModal!, funcionarioIds: iniciarFuncs })}
            loading={iniciarOnda.isPending}
            disabled={iniciarFuncs.length === 0}
          >
            Iniciar Separação
          </Button>
        </Group>
      </Modal>
    </div>
  )
}
