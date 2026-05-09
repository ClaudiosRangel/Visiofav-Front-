'use client'

import { useState, useMemo } from 'react'
import {
  Card, Table, Badge, Button, Modal, TextInput, Select, Group, Text,
  LoadingOverlay, Checkbox, Tabs, Stack, SimpleGrid,
} from '@mantine/core'
import {
  IconTruck, IconList, IconCheck, IconX, IconRefresh,
} from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

export default function MontagemCargaPage() {
  useModuloGuard('WMS')

  const [activeTab, setActiveTab] = useState<string | null>('montagem')

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / WMS / Montagem de Carga</Text>
      <Text size="xl" fw={600} mb="lg">Montagem de Carga</Text>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="montagem" leftSection={<IconTruck size={16} />}>
            Montagem
          </Tabs.Tab>
          <Tabs.Tab value="mapas" leftSection={<IconList size={16} />}>
            Mapas
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="montagem">
          <TabMontagem />
        </Tabs.Panel>

        <Tabs.Panel value="mapas">
          <TabMapas />
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}


// ─── Tab Montagem ────────────────────────────────────────────────────────────

function TabMontagem() {
  const queryClient = useQueryClient()

  // Filters
  const [rotaId, setRotaId] = useState<string | null>(null)
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  // Selection
  const [selectedNfs, setSelectedNfs] = useState<Set<string>>(new Set())

  // Modal Gerar Mapa
  const [gerarMapaOpen, setGerarMapaOpen] = useState(false)
  const [placa, setPlaca] = useState('')
  const [motorista, setMotorista] = useState('')
  const [motoristaCpf, setMotoristaCpf] = useState('')
  const [observacoes, setObservacoes] = useState('')

  // Queries
  const { data: rotas } = useQuery<any>({
    queryKey: ['rotas', { status: 'true' }],
    queryFn: async () => {
      const { data } = await api.get('/rotas', { params: { status: 'true' } })
      return data
    },
  })

  const { data: clientes } = useQuery<any>({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data } = await api.get('/clientes')
      return data
    },
  })

  const filterParams = useMemo(() => {
    const params: Record<string, any> = {}
    if (rotaId) params.rotaId = rotaId
    if (clienteId) params.clienteId = clienteId
    if (dataInicio) params.dataInicio = dataInicio
    if (dataFim) params.dataFim = dataFim
    return params
  }, [rotaId, clienteId, dataInicio, dataFim])

  const { data: nfsResponse, isLoading: nfsLoading } = useQuery<any>({
    queryKey: ['nfs-disponiveis', filterParams],
    queryFn: async () => {
      const { data } = await api.get('/mapas-carregamento/nfs-disponiveis', { params: filterParams })
      return data
    },
  })

  const { data: totalizacao, isLoading: totLoading } = useQuery<any>({
    queryKey: ['totalizacao', filterParams],
    queryFn: async () => {
      const { data } = await api.get('/mapas-carregamento/totalizacao', { params: filterParams })
      return data
    },
  })

  // Mutations
  const marcar = useMutation({
    mutationFn: async (nfeIds: string[]) => {
      await api.post('/mapas-carregamento/nfs/marcar', { nfeIds })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nfs-disponiveis'] })
      queryClient.invalidateQueries({ queryKey: ['totalizacao'] })
      setSelectedNfs(new Set())
    },
  })

  const desmarcar = useMutation({
    mutationFn: async (nfeIds: string[]) => {
      await api.post('/mapas-carregamento/nfs/desmarcar', { nfeIds })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nfs-disponiveis'] })
      queryClient.invalidateQueries({ queryKey: ['totalizacao'] })
      setSelectedNfs(new Set())
    },
  })

  const marcarRota = useMutation({
    mutationFn: async (rotaIdParam: string) => {
      await api.post('/mapas-carregamento/nfs/marcar-rota', { rotaId: rotaIdParam })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nfs-disponiveis'] })
      queryClient.invalidateQueries({ queryKey: ['totalizacao'] })
    },
  })

  const gerarMapa = useMutation({
    mutationFn: async (body: any) => {
      const { data } = await api.post('/mapas-carregamento', body)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['nfs-disponiveis'] })
      queryClient.invalidateQueries({ queryKey: ['totalizacao'] })
      queryClient.invalidateQueries({ queryKey: ['mapas-carregamento'] })
      notifications.show({
        title: 'Mapa Gerado',
        message: `Mapa nº ${data.numero} criado com sucesso`,
        color: 'green',
      })
      setGerarMapaOpen(false)
      setPlaca('')
      setMotorista('')
      setMotoristaCpf('')
      setObservacoes('')
    },
  })

  const nfs = nfsResponse?.data || nfsResponse || []
  const rotaOptions = (rotas?.data || []).map((r: any) => ({ value: r.id, label: `${r.codigo} - ${r.descricao}` }))
  const clienteOptions = (clientes?.data || []).map((c: any) => ({ value: c.id, label: c.razaoSocial || c.nome || c.codigo }))

  function toggleNf(id: string) {
    setSelectedNfs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedNfs.size === nfs.length) {
      setSelectedNfs(new Set())
    } else {
      setSelectedNfs(new Set(nfs.map((n: any) => n.id)))
    }
  }

  async function handleMarcar() {
    if (selectedNfs.size === 0) return
    try {
      await marcar.mutateAsync(Array.from(selectedNfs))
      notifications.show({ title: 'Sucesso', message: 'NFs marcadas', color: 'green' })
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao marcar NFs', color: 'red' })
    }
  }

  async function handleDesmarcar() {
    if (selectedNfs.size === 0) return
    try {
      await desmarcar.mutateAsync(Array.from(selectedNfs))
      notifications.show({ title: 'Sucesso', message: 'NFs desmarcadas', color: 'green' })
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao desmarcar NFs', color: 'red' })
    }
  }

  async function handleMarcarRota() {
    if (!rotaId) {
      notifications.show({ title: 'Atenção', message: 'Selecione uma rota primeiro', color: 'yellow' })
      return
    }
    try {
      await marcarRota.mutateAsync(rotaId)
      notifications.show({ title: 'Sucesso', message: 'Toda a rota marcada', color: 'green' })
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao marcar rota', color: 'red' })
    }
  }

  async function handleGerarMapa() {
    if (!placa.trim()) {
      notifications.show({ title: 'Atenção', message: 'Placa é obrigatória', color: 'yellow' })
      return
    }
    try {
      // Auto-marcar NFs selecionadas antes de gerar (se houver seleção)
      if (selectedNfs.size > 0) {
        await api.post('/mapas-carregamento/nfs/marcar', { nfeIds: Array.from(selectedNfs) })
      }

      await gerarMapa.mutateAsync({
        veiculoPlaca: placa,
        motorista: motorista || undefined,
        motoristaCpf: motoristaCpf || undefined,
        observacoes: observacoes || undefined,
      })
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Falha ao gerar mapa'
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    }
  }

  // Totalization
  const totPorRota = totalizacao?.porRota || []
  const totGeral = totalizacao?.geral || { quantidadeNfs: 0, valorTotal: 0, pesoTotalKg: 0, totalVolumes: 0 }

  return (
    <Stack gap="md">
      {/* Filter Panel */}
      <Card withBorder>
        <Text size="sm" fw={500} mb="sm">Filtros</Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
          <Select
            label="Rota"
            placeholder="Todas"
            clearable
            searchable
            data={rotaOptions}
            value={rotaId}
            onChange={setRotaId}
          />
          <Select
            label="Cliente"
            placeholder="Todos"
            clearable
            searchable
            data={clienteOptions}
            value={clienteId}
            onChange={setClienteId}
          />
          <TextInput
            label="Data Início"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.currentTarget.value)}
          />
          <TextInput
            label="Data Fim"
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.currentTarget.value)}
          />
        </SimpleGrid>
      </Card>

      {/* Totalization Panel */}
      <Card withBorder pos="relative">
        <LoadingOverlay visible={totLoading} />
        <Text size="sm" fw={500} mb="sm">Totalização por Rota</Text>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Rota</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Qtd NFs</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Valor (R$)</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Peso (kg)</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Volumes</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {totPorRota.map((r: any) => (
              <Table.Tr key={r.rotaId || 'sem-rota'}>
                <Table.Td>{r.rotaCodigo ? `${r.rotaCodigo} - ${r.rotaDescricao}` : 'Sem Rota'}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{r.quantidadeNfs}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{Number(r.valorTotal).toFixed(2)}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{Number(r.pesoTotalKg).toFixed(3)}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{r.totalVolumes}</Table.Td>
              </Table.Tr>
            ))}
            {totPorRota.length > 0 && (
              <Table.Tr style={{ fontWeight: 700 }}>
                <Table.Td>TOTAL GERAL</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{totGeral.quantidadeNfs}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{Number(totGeral.valorTotal).toFixed(2)}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{Number(totGeral.pesoTotalKg).toFixed(3)}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{totGeral.totalVolumes}</Table.Td>
              </Table.Tr>
            )}
            {totPorRota.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5} className="text-center py-4 text-zinc-500">
                  Nenhum dado de totalização
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Action Buttons */}
      <Group>
        <Button
          variant="light"
          leftSection={<IconCheck size={16} />}
          onClick={handleMarcar}
          disabled={selectedNfs.size === 0}
          loading={marcar.isPending}
        >
          Marcar Selecionados
        </Button>
        <Button
          variant="light"
          color="gray"
          leftSection={<IconX size={16} />}
          onClick={handleDesmarcar}
          disabled={selectedNfs.size === 0}
          loading={desmarcar.isPending}
        >
          Desmarcar Selecionados
        </Button>
        <Button
          variant="light"
          color="teal"
          leftSection={<IconCheck size={16} />}
          onClick={handleMarcarRota}
          disabled={!rotaId}
          loading={marcarRota.isPending}
        >
          Marcar Toda Rota
        </Button>
        <Button
          leftSection={<IconTruck size={16} />}
          onClick={() => setGerarMapaOpen(true)}
        >
          Gerar Mapa
        </Button>
      </Group>

      {/* NFs Table */}
      <Card withBorder pos="relative">
        <LoadingOverlay visible={nfsLoading} />
        <Text size="sm" fw={500} mb="sm">NFs Disponíveis</Text>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40 }}>
                <Checkbox
                  checked={nfs.length > 0 && selectedNfs.size === nfs.length}
                  indeterminate={selectedNfs.size > 0 && selectedNfs.size < nfs.length}
                  onChange={toggleAll}
                />
              </Table.Th>
              <Table.Th>NF</Table.Th>
              <Table.Th>Série</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Rota</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Valor (R$)</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Peso (kg)</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>Mapa OK</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(Array.isArray(nfs) ? nfs : []).map((nf: any) => (
              <Table.Tr key={nf.id}>
                <Table.Td>
                  <Checkbox
                    checked={selectedNfs.has(nf.id)}
                    onChange={() => toggleNf(nf.id)}
                  />
                </Table.Td>
                <Table.Td>{nf.numero || nf.nNF}</Table.Td>
                <Table.Td>{nf.serie}</Table.Td>
                <Table.Td>{nf.cliente?.razaoSocial || nf.clienteNome || '-'}</Table.Td>
                <Table.Td>{nf.rota?.codigo || nf.rotaCodigo || '-'}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{Number(nf.valorTotal || 0).toFixed(2)}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{Number(nf.pesoKg || nf.pesoTotal || 0).toFixed(3)}</Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  <Badge color={nf.mapaOk ? 'green' : 'gray'} variant="light">
                    {nf.mapaOk ? 'Sim' : 'Não'}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
            {!nfsLoading && nfs.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8} className="text-center py-8 text-zinc-500">
                  Nenhuma NF disponível
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal Gerar Mapa */}
      <Modal
        opened={gerarMapaOpen}
        onClose={() => setGerarMapaOpen(false)}
        title="Gerar Mapa de Carregamento"
        centered
        closeOnClickOutside={false}
      >
        <Stack gap="md">
          <TextInput
            label={<>Placa do Veículo <span style={{ color: 'red' }}>*</span></>}
            value={placa}
            onChange={(e) => setPlaca(e.currentTarget.value)}
          />
          <TextInput
            label="Motorista"
            value={motorista}
            onChange={(e) => setMotorista(e.currentTarget.value)}
          />
          <TextInput
            label="CPF Motorista"
            value={motoristaCpf}
            onChange={(e) => setMotoristaCpf(e.currentTarget.value)}
          />
          <TextInput
            label="Observações"
            value={observacoes}
            onChange={(e) => setObservacoes(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setGerarMapaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGerarMapa} loading={gerarMapa.isPending}>
              Gerar Mapa
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}


// ─── Tab Mapas ───────────────────────────────────────────────────────────────

function TabMapas() {
  const queryClient = useQueryClient()

  // Filters
  const [numero, setNumero] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')

  // Modals
  const [cancelarModal, setCancelarModal] = useState<any>(null)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [fecharModal, setFecharModal] = useState<any>(null)
  const [nfsEntrega, setNfsEntrega] = useState<any[]>([])
  const [detalheModal, setDetalheModal] = useState<any>(null)

  const filterParams = useMemo(() => {
    const params: Record<string, any> = {}
    if (numero) params.numero = numero
    if (status) params.status = status
    if (periodoInicio) params.dataInicio = periodoInicio
    if (periodoFim) params.dataFim = periodoFim
    return params
  }, [numero, status, periodoInicio, periodoFim])

  const { data: mapasResponse, isLoading } = useQuery<any>({
    queryKey: ['mapas-carregamento', filterParams],
    queryFn: async () => {
      const { data } = await api.get('/mapas-carregamento', { params: filterParams })
      return data
    },
  })

  const cancelar = useMutation({
    mutationFn: async ({ id, motivoCancelamento }: { id: string; motivoCancelamento: string }) => {
      await api.post(`/mapas-carregamento/${id}/cancelar`, { motivoCancelamento })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mapas-carregamento'] })
      notifications.show({ title: 'Sucesso', message: 'Mapa cancelado', color: 'green' })
      setCancelarModal(null)
      setMotivoCancelamento('')
    },
  })

  const fechar = useMutation({
    mutationFn: async ({ id, nfs }: { id: string; nfs: any[] }) => {
      await api.post(`/mapas-carregamento/${id}/fechar`, { nfs })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mapas-carregamento'] })
      notifications.show({ title: 'Sucesso', message: 'Mapa fechado', color: 'green' })
      setFecharModal(null)
      setNfsEntrega([])
    },
  })

  const mapas = mapasResponse?.data || mapasResponse || []

  const statusColors: Record<string, string> = {
    AGUARDANDO_SEPARACAO: 'orange',
    EM_CARREGAMENTO: 'blue',
    FINALIZADO: 'green',
    CANCELADO: 'red',
  }

  const statusLabels: Record<string, string> = {
    AGUARDANDO_SEPARACAO: 'Aguardando Separação',
    EM_CARREGAMENTO: 'Em Carregamento',
    FINALIZADO: 'Finalizado',
    CANCELADO: 'Cancelado',
  }

  async function handleCancelar() {
    if (!motivoCancelamento.trim()) {
      notifications.show({ title: 'Atenção', message: 'Motivo é obrigatório', color: 'yellow' })
      return
    }
    try {
      await cancelar.mutateAsync({ id: cancelarModal.id, motivoCancelamento })
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Falha ao cancelar'
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    }
  }

  async function handleFechar() {
    const nfsPayload = nfsEntrega.map((nf: any) => ({
      nfeId: nf.nfeId,
      statusEntrega: nf.statusEntrega,
      motivoDevolucao: nf.motivoDevolucao || undefined,
    }))

    // Validate: devolvidos need motivo
    const invalid = nfsPayload.find(
      (n: any) => n.statusEntrega === 'DEVOLVIDO' && !n.motivoDevolucao
    )
    if (invalid) {
      notifications.show({
        title: 'Atenção',
        message: 'Informe o motivo para todas as NFs devolvidas',
        color: 'yellow',
      })
      return
    }

    try {
      await fechar.mutateAsync({ id: fecharModal.id, nfs: nfsPayload })
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Falha ao fechar mapa'
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    }
  }

  async function openDetalhe(mapa: any) {
    try {
      const { data } = await api.get(`/mapas-carregamento/${mapa.id}`)
      setDetalheModal(data)
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao carregar detalhes', color: 'red' })
    }
  }

  async function openFechar(mapa: any) {
    try {
      const { data } = await api.get(`/mapas-carregamento/${mapa.id}`)
      setFecharModal(data)
      setNfsEntrega(
        (data.nfs || []).map((nf: any) => ({
          nfeId: nf.nfeId || nf.id,
          nfNumero: nf.nfe?.numero || nf.nfe?.nNF || nf.numero || '-',
          clienteNome: nf.nfe?.cliente?.razaoSocial || nf.clienteNome || '-',
          statusEntrega: nf.statusEntrega || 'ENTREGUE',
          motivoDevolucao: nf.motivoDevolucao || '',
        }))
      )
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao carregar mapa', color: 'red' })
    }
  }

  function updateNfEntrega(index: number, field: string, value: string) {
    setNfsEntrega((prev) =>
      prev.map((nf, i) => (i === index ? { ...nf, [field]: value } : nf))
    )
  }

  return (
    <Stack gap="md">
      {/* Filters */}
      <Card withBorder>
        <Text size="sm" fw={500} mb="sm">Filtros</Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
          <TextInput
            label="Número"
            placeholder="Nº do mapa"
            value={numero}
            onChange={(e) => setNumero(e.currentTarget.value)}
          />
          <Select
            label="Status"
            placeholder="Todos"
            clearable
            data={[
              { value: 'AGUARDANDO_SEPARACAO', label: 'Aguardando Separação' },
              { value: 'EM_CARREGAMENTO', label: 'Em Carregamento' },
              { value: 'FINALIZADO', label: 'Finalizado' },
              { value: 'CANCELADO', label: 'Cancelado' },
            ]}
            value={status}
            onChange={setStatus}
          />
          <TextInput
            label="Período Início"
            type="date"
            value={periodoInicio}
            onChange={(e) => setPeriodoInicio(e.currentTarget.value)}
          />
          <TextInput
            label="Período Fim"
            type="date"
            value={periodoFim}
            onChange={(e) => setPeriodoFim(e.currentTarget.value)}
          />
        </SimpleGrid>
      </Card>

      {/* Mapas Table */}
      <Card withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Número</Table.Th>
              <Table.Th>Placa</Table.Th>
              <Table.Th>Motorista</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Emissão</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(Array.isArray(mapas) ? mapas : []).map((mapa: any) => (
              <Table.Tr key={mapa.id}>
                <Table.Td>{mapa.numero}</Table.Td>
                <Table.Td>{mapa.veiculoPlaca}</Table.Td>
                <Table.Td>{mapa.motorista || '-'}</Table.Td>
                <Table.Td>
                  <Badge color={statusColors[mapa.status] || 'gray'} variant="light">
                    {statusLabels[mapa.status] || mapa.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {mapa.emissaoEm ? new Date(mapa.emissaoEm).toLocaleDateString('pt-BR') : '-'}
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Button size="xs" variant="subtle" onClick={() => openDetalhe(mapa)}>
                      Ver
                    </Button>
                    {mapa.status !== 'FINALIZADO' && mapa.status !== 'CANCELADO' && (
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        onClick={() => setCancelarModal(mapa)}
                      >
                        Cancelar
                      </Button>
                    )}
                    {mapa.status === 'EM_CARREGAMENTO' && (
                      <Button
                        size="xs"
                        variant="subtle"
                        color="green"
                        onClick={() => openFechar(mapa)}
                      >
                        Fechar
                      </Button>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && mapas.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6} className="text-center py-8 text-zinc-500">
                  Nenhum mapa encontrado
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal Cancelar */}
      <Modal
        opened={!!cancelarModal}
        onClose={() => { setCancelarModal(null); setMotivoCancelamento('') }}
        title={`Cancelar Mapa nº ${cancelarModal?.numero || ''}`}
        centered
      >
        <Stack gap="md">
          <TextInput
            label={<>Motivo do Cancelamento <span style={{ color: 'red' }}>*</span></>}
            value={motivoCancelamento}
            onChange={(e) => setMotivoCancelamento(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => { setCancelarModal(null); setMotivoCancelamento('') }}>
              Voltar
            </Button>
            <Button color="red" onClick={handleCancelar} loading={cancelar.isPending}>
              Confirmar Cancelamento
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal Fechar */}
      <Modal
        opened={!!fecharModal}
        onClose={() => { setFecharModal(null); setNfsEntrega([]) }}
        title={`Fechar Mapa nº ${fecharModal?.numero || ''}`}
        centered
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Informe o status de entrega para cada NF:
          </Text>
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>NF</Table.Th>
                <Table.Th>Cliente</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Motivo Devolução</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {nfsEntrega.map((nf: any, idx: number) => (
                <Table.Tr key={idx}>
                  <Table.Td>{nf.nfNumero}</Table.Td>
                  <Table.Td>{nf.clienteNome}</Table.Td>
                  <Table.Td>
                    <Select
                      size="xs"
                      data={[
                        { value: 'ENTREGUE', label: 'Entregue' },
                        { value: 'DEVOLVIDO', label: 'Devolvido' },
                      ]}
                      value={nf.statusEntrega}
                      onChange={(val) => updateNfEntrega(idx, 'statusEntrega', val || 'ENTREGUE')}
                    />
                  </Table.Td>
                  <Table.Td>
                    {nf.statusEntrega === 'DEVOLVIDO' && (
                      <TextInput
                        size="xs"
                        placeholder="Motivo..."
                        value={nf.motivoDevolucao}
                        onChange={(e) => updateNfEntrega(idx, 'motivoDevolucao', e.currentTarget.value)}
                      />
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => { setFecharModal(null); setNfsEntrega([]) }}>
              Voltar
            </Button>
            <Button color="green" onClick={handleFechar} loading={fechar.isPending}>
              Confirmar Fechamento
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal Detalhe */}
      <Modal
        opened={!!detalheModal}
        onClose={() => setDetalheModal(null)}
        title={`Mapa de Carregamento nº ${detalheModal?.numero || ''}`}
        centered
        size="lg"
      >
        {detalheModal && (
          <Stack gap="md">
            <SimpleGrid cols={2}>
              <div>
                <Text size="xs" c="dimmed">Placa</Text>
                <Text size="sm" fw={500}>{detalheModal.veiculoPlaca}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Motorista</Text>
                <Text size="sm" fw={500}>{detalheModal.motorista || '-'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">CPF</Text>
                <Text size="sm" fw={500}>{detalheModal.motoristaCpf || '-'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Status</Text>
                <Badge color={statusColors[detalheModal.status] || 'gray'} variant="light">
                  {statusLabels[detalheModal.status] || detalheModal.status}
                </Badge>
              </div>
              <div>
                <Text size="xs" c="dimmed">Emissão</Text>
                <Text size="sm">{detalheModal.emissaoEm ? new Date(detalheModal.emissaoEm).toLocaleDateString('pt-BR') : '-'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Observações</Text>
                <Text size="sm">{detalheModal.observacoes || '-'}</Text>
              </div>
            </SimpleGrid>

            <Text size="sm" fw={500}>NFs do Mapa</Text>
            <Table withTableBorder striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>NF</Table.Th>
                  <Table.Th>Cliente</Table.Th>
                  <Table.Th>Status Entrega</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(detalheModal.nfs || []).map((nf: any, idx: number) => (
                  <Table.Tr key={idx}>
                    <Table.Td>{nf.nfe?.numero || nf.nfe?.nNF || '-'}</Table.Td>
                    <Table.Td>{nf.nfe?.cliente?.razaoSocial || '-'}</Table.Td>
                    <Table.Td>
                      {nf.statusEntrega ? (
                        <Badge
                          color={nf.statusEntrega === 'ENTREGUE' ? 'green' : 'red'}
                          variant="light"
                        >
                          {nf.statusEntrega}
                        </Badge>
                      ) : (
                        <Text size="sm" c="dimmed">Pendente</Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
                {(detalheModal.nfs || []).length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={3} className="text-center py-4 text-zinc-500">
                      Nenhuma NF associada
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>

            <Group justify="flex-end">
              <Button variant="default" onClick={() => setDetalheModal(null)}>
                Fechar
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
