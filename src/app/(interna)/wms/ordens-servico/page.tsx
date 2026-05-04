'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Select, LoadingOverlay,
  SimpleGrid, ThemeIcon, ActionIcon, Tooltip, Modal, MultiSelect,
} from '@mantine/core'
import {
  IconClipboardList, IconCheck, IconPlayerPlay, IconPlayerStop,
  IconRefresh, IconClock, IconUser, IconArrowsExchange, IconHistory,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const statusColors: Record<string, string> = {
  ABERTO: 'blue', EXECUTANDO: 'orange', PARCIAL: 'yellow', CONCLUIDO: 'green', REJEITADO: 'red',
}

const operacaoLabels: Record<string, string> = {
  CONFERENCIA: 'Conferência', ENDERECAMENTO: 'Endereçamento', SEPARACAO: 'Separação',
  REPOSICAO: 'Reposição', MUDANCA_ENDERECO: 'Mudança Endereço', INVENTARIO: 'Inventário',
}

export default function OrdensServicoWmsPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Ordens de Serviço' }, [])
  const queryClient = useQueryClient()
  const [statusFiltro, setStatusFiltro] = useState<string | null>(null)
  const [operacaoFiltro, setOperacaoFiltro] = useState<string | null>(null)
  const [iniciarModal, setIniciarModal] = useState(false)
  const [osParaIniciar, setOsParaIniciar] = useState<any>(null)
  const [funcIds, setFuncIds] = useState<string[]>([])

  // Trocar funcionário
  const [trocarModal, setTrocarModal] = useState(false)
  const [osParaTrocar, setOsParaTrocar] = useState<any>(null)
  const [novoFuncId, setNovoFuncId] = useState<string | null>(null)

  // Histórico
  const [historicoModal, setHistoricoModal] = useState(false)
  const [historicoData, setHistoricoData] = useState<any[]>([])
  const [historicoOsNumero, setHistoricoOsNumero] = useState<number | null>(null)
  const { data: response, isLoading, refetch } = useQuery<any>({
    queryKey: ['os-wms', statusFiltro, operacaoFiltro],
    queryFn: async () => {
      const params: Record<string, string> = { limit: '50' }
      if (statusFiltro) params.status = statusFiltro
      if (operacaoFiltro) params.operacao = operacaoFiltro
      const { data } = await api.get('/os-wms', { params })
      return data
    },
  })

  const { data: funcionariosResp } = useQuery<any>({
    queryKey: ['funcionarios-os'],
    queryFn: async () => { const { data } = await api.get('/funcionarios', { params: { limit: 50 } }); return data },
    enabled: iniciarModal || trocarModal,
  })

  const iniciarOs = useMutation({
    mutationFn: async () => {
      if (!osParaIniciar || funcIds.length === 0) throw new Error('Selecione ao menos um funcionário')
      const { data } = await api.patch(`/os-wms/${osParaIniciar.id}/iniciar`, { funcionarioIds: funcIds })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['os-wms'] })
      setIniciarModal(false); setOsParaIniciar(null); setFuncIds([])
      notifications.show({ title: '✅ OS Iniciada', message: 'Funcionário(s) alocado(s)', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  const concluirOs = useMutation({
    mutationFn: async (osId: string) => {
      const { data } = await api.patch(`/os-wms/${osId}/concluir`)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['os-wms'] })
      notifications.show({ title: '✅ OS Concluída', message: `Tempo: ${data.tempoExecucaoMinutos} minutos`, color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  const trocarFunc = useMutation({
    mutationFn: async () => {
      if (!osParaTrocar || !novoFuncId) throw new Error('Selecione o novo funcionário')
      const { data } = await api.patch(`/os-wms/${osParaTrocar.id}/trocar-funcionario`, { novoFuncionarioId: novoFuncId })
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['os-wms'] })
      setTrocarModal(false); setOsParaTrocar(null); setNovoFuncId(null)
      notifications.show({ title: '✅ Funcionário trocado', message: data.message, color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  async function abrirHistorico(os: any) {
    try {
      const { data } = await api.get(`/os-wms/${os.id}/historico-funcionarios`)
      setHistoricoData(data.historico || [])
      setHistoricoOsNumero(os.numero)
      setHistoricoModal(true)
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao buscar histórico', color: 'red' })
    }
  }

  const items = response?.data || []
  const abertas = items.filter((i: any) => i.status === 'ABERTO').length
  const executando = items.filter((i: any) => i.status === 'EXECUTANDO').length
  const concluidas = items.filter((i: any) => i.status === 'CONCLUIDO').length

  const funcOptions = (funcionariosResp?.data || []).map((f: any) => ({ value: f.id, label: `${f.matricula} — ${f.nome}` }))

  function formatTempo(inicio: string, fim: string | null) {
    if (!inicio) return '—'
    if (!fim) return 'Em andamento...'
    const ms = new Date(fim).getTime() - new Date(inicio).getTime()
    const min = Math.round(ms / 60000)
    return `${min} min`
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Ordens de Serviço</Text>
      <Text size="xl" fw={600} mb="lg">Ordens de Serviço Operacionais</Text>

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
        <Card><Group justify="space-between"><div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Abertas</Text><Text size="xl" fw={700} c="blue">{abertas}</Text></div><ThemeIcon color="blue" variant="light" size={48} radius="md"><IconClipboardList size={24} /></ThemeIcon></Group></Card>
        <Card><Group justify="space-between"><div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Em Execução</Text><Text size="xl" fw={700} c="orange">{executando}</Text></div><ThemeIcon color="orange" variant="light" size={48} radius="md"><IconPlayerPlay size={24} /></ThemeIcon></Group></Card>
        <Card><Group justify="space-between"><div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Concluídas</Text><Text size="xl" fw={700} c="green">{concluidas}</Text></div><ThemeIcon color="green" variant="light" size={48} radius="md"><IconCheck size={24} /></ThemeIcon></Group></Card>
      </SimpleGrid>

      <Card mb="md">
        <Group>
          <Select label="Status" data={[
            { value: 'ABERTO', label: 'Aberto' }, { value: 'EXECUTANDO', label: 'Executando' },
            { value: 'CONCLUIDO', label: 'Concluído' }, { value: 'REJEITADO', label: 'Rejeitado' },
          ]} value={statusFiltro} onChange={setStatusFiltro} clearable className="w-40" />
          <Select label="Operação" data={[
            { value: 'CONFERENCIA', label: 'Conferência' }, { value: 'ENDERECAMENTO', label: 'Endereçamento' },
            { value: 'SEPARACAO', label: 'Separação' }, { value: 'INVENTARIO', label: 'Inventário' },
          ]} value={operacaoFiltro} onChange={setOperacaoFiltro} clearable className="w-40" />
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()} mt={24}>Atualizar</Button>
        </Group>
      </Card>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>OS #</Table.Th><Table.Th>NF</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Operação</Table.Th>
              <Table.Th>Funcionário(s)</Table.Th><Table.Th>Início</Table.Th><Table.Th>Tempo</Table.Th>
              <Table.Th>Status</Table.Th><Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((os: any) => (
              <Table.Tr key={os.id}>
                <Table.Td fw={600}>{os.numero}</Table.Td>
                <Table.Td>
                  {os.notaEntrada ? (
                    <div>
                      <Text size="sm" fw={500}>NF {os.notaEntrada.numero}</Text>
                      <Text size="xs" c="dimmed">{os.notaEntrada.fornecedor}</Text>
                    </div>
                  ) : '—'}
                </Table.Td>
                <Table.Td>{os.tipo}</Table.Td>
                <Table.Td><Badge variant="light">{operacaoLabels[os.operacao] || os.operacao}</Badge></Table.Td>
                <Table.Td>
                  {os.funcionarios?.length > 0
                    ? os.funcionarios.map((f: any) => f.funcionario?.nome).filter(Boolean).join(', ')
                    : os.funcionario?.nome || '—'}
                </Table.Td>
                <Table.Td>{os.horaInicio ? new Date(os.horaInicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}</Table.Td>
                <Table.Td>{formatTempo(os.horaInicio, os.horaFim)}</Table.Td>
                <Table.Td><Badge color={statusColors[os.status] || 'gray'}>{os.status}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {os.status === 'ABERTO' && (
                      <Tooltip label="Iniciar (atribuir funcionários)">
                        <ActionIcon variant="light" color="blue" onClick={() => { setOsParaIniciar(os); setFuncIds([]); setIniciarModal(true) }}>
                          <IconPlayerPlay size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {os.status === 'EXECUTANDO' && (
                      <>
                        <Tooltip label="Trocar funcionário">
                          <ActionIcon variant="light" color="grape" onClick={() => { setOsParaTrocar(os); setNovoFuncId(null); setTrocarModal(true) }}>
                            <IconArrowsExchange size={18} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Adicionar funcionário">
                          <ActionIcon variant="light" color="blue" onClick={() => { setOsParaIniciar(os); setFuncIds([]); setIniciarModal(true) }}>
                            <IconUser size={18} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Concluir">
                          <ActionIcon variant="light" color="green" onClick={() => concluirOs.mutate(os.id)}>
                            <IconPlayerStop size={18} />
                          </ActionIcon>
                        </Tooltip>
                      </>
                    )}
                    {['EXECUTANDO', 'CONCLUIDO'].includes(os.status) && (
                      <Tooltip label="Histórico funcionários">
                        <ActionIcon variant="light" color="gray" onClick={() => abrirHistorico(os)}>
                          <IconHistory size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {items.length === 0 && <Table.Tr><Table.Td colSpan={9} className="text-center py-8 text-zinc-500">Nenhuma OS encontrada</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal Iniciar OS */}
      <Modal opened={iniciarModal} onClose={() => { setIniciarModal(false); setOsParaIniciar(null); setFuncIds([]) }}
        title={`Iniciar OS #${osParaIniciar?.numero}`} centered>
        <Text size="sm" mb="md">
          Operação: <strong>{operacaoLabels[osParaIniciar?.operacao] || osParaIniciar?.operacao}</strong>
        </Text>
        <MultiSelect label="Funcionário(s) *" data={funcOptions} value={funcIds} onChange={setFuncIds}
          searchable placeholder="Selecione os funcionários..." mb="md" />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setIniciarModal(false)}>Cancelar</Button>
          <Button onClick={() => iniciarOs.mutate()} loading={iniciarOs.isPending} disabled={funcIds.length === 0}
            leftSection={<IconPlayerPlay size={16} />}>
            Iniciar
          </Button>
        </Group>
      </Modal>

      {/* Modal Trocar Funcionário */}
      <Modal opened={trocarModal} onClose={() => { setTrocarModal(false); setOsParaTrocar(null); setNovoFuncId(null) }}
        title={`Trocar Funcionário — OS #${osParaTrocar?.numero}`} centered>
        <Text size="sm" mb="xs">Funcionário atual: <strong>{osParaTrocar?.funcionario?.nome || osParaTrocar?.funcionarios?.find((f: any) => !f.horaFim)?.funcionario?.nome || '—'}</strong></Text>
        <Text size="sm" c="dimmed" mb="md">O funcionário atual será finalizado e o novo assumirá a OS. O histórico é mantido.</Text>
        <Select label="Novo Funcionário *" data={funcOptions} value={novoFuncId} onChange={setNovoFuncId}
          searchable placeholder="Selecione..." mb="md" />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setTrocarModal(false)}>Cancelar</Button>
          <Button color="grape" onClick={() => trocarFunc.mutate()} loading={trocarFunc.isPending} disabled={!novoFuncId}
            leftSection={<IconArrowsExchange size={16} />}>
            Trocar
          </Button>
        </Group>
      </Modal>

      {/* Modal Histórico de Funcionários */}
      <Modal opened={historicoModal} onClose={() => setHistoricoModal(false)}
        title={`Histórico — OS #${historicoOsNumero}`} size="lg" centered>
        {historicoData.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">Nenhum registro de funcionário</Text>
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Funcionário</Table.Th>
                <Table.Th>Matrícula</Table.Th>
                <Table.Th>Início</Table.Th>
                <Table.Th>Fim</Table.Th>
                <Table.Th>Tempo</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {historicoData.map((h: any) => (
                <Table.Tr key={h.id} bg={h.ativo ? 'green.0' : undefined}>
                  <Table.Td fw={500}>{h.nome}</Table.Td>
                  <Table.Td>{h.matricula}</Table.Td>
                  <Table.Td>{h.horaInicio ? new Date(h.horaInicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}</Table.Td>
                  <Table.Td>{h.horaFim ? new Date(h.horaFim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}</Table.Td>
                  <Table.Td>{h.tempoMinutos} min</Table.Td>
                  <Table.Td><Badge color={h.ativo ? 'green' : 'gray'} variant="light">{h.ativo ? 'Ativo' : 'Finalizado'}</Badge></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Modal>
    </div>
  )
}
