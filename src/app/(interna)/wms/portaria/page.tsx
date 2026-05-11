'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, SimpleGrid, ThemeIcon, Table, Badge, Button,
  Modal, TextInput, NumberInput, LoadingOverlay, ActionIcon, Tooltip, Alert, Divider, Select, Tabs,
} from '@mantine/core'
import {
  IconTruck, IconClock, IconCheck, IconRefresh, IconSearch,
  IconDoorEnter, IconDoorExit, IconPlus, IconAlertCircle,
  IconClipboardCheck, IconArrowRight,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import PendenciasLogisticasButton from '@/components/wms/PendenciasLogisticasButton'

const statusColors: Record<string, string> = {
  AGENDADO: 'blue', ESPERA: 'orange', CONFIRMADO: 'cyan',
  NA_DOCA: 'grape', CONFERINDO: 'yellow', CONFERIDO: 'teal', RECEBIDO: 'green',
}

const statusLabels: Record<string, string> = {
  AGENDADO: 'Agendado', ESPERA: 'Aguardando Confirmação', CONFIRMADO: 'Confirmado',
  NA_DOCA: 'Na Doca', CONFERINDO: 'Conferindo', CONFERIDO: 'Conferido', RECEBIDO: 'Recebido',
}

export default function PortariaPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Portaria' }, [])
  const queryClient = useQueryClient()

  // Conferência modal state
  const [conferirModal, setConferirModal] = useState(false)
  const [conferirAgendamento, setConferirAgendamento] = useState<any>(null)
  const [placa, setPlaca] = useState('')
  const [motorista, setMotorista] = useState('')
  const [qtdCaixas, setQtdCaixas] = useState<number | undefined>()
  const [qtdPaletes, setQtdPaletes] = useState<number | undefined>()
  const [observacao, setObservacao] = useState('')

  // Busca placa
  const [placaBusca, setPlacaBusca] = useState('')
  const [validacao, setValidacao] = useState<any>(null)

  // Avulso modal
  const [avulsoModal, setAvulsoModal] = useState(false)
  const [avulsoPlaca, setAvulsoPlaca] = useState('')
  const [avulsoMotorista, setAvulsoMotorista] = useState('')
  const [avulsoDocumento, setAvulsoDocumento] = useState('')
  const [avulsoMotivo, setAvulsoMotivo] = useState<string | null>('AVULSO')

  // Agendamentos do dia
  const { data: response, isLoading, refetch } = useQuery<any>({
    queryKey: ['portaria-agendamentos'],
    queryFn: async () => { const { data } = await api.get('/portaria/agendamentos-hoje'); return data },
    refetchInterval: 15000,
  })

  // Conferir na portaria (AGENDADO → ESPERA)
  const conferir = useMutation({
    mutationFn: async () => {
      if (!conferirAgendamento) throw new Error('Nenhum agendamento')
      const { data } = await api.post(`/portaria/conferir/${conferirAgendamento.id}`, {
        placa: placa.toUpperCase(), motorista, qtdCaixas, qtdPaletes, observacao: observacao || undefined,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portaria-agendamentos'] })
      setConferirModal(false); resetConferir()
      notifications.show({ title: '✅ Conferência concluída', message: 'Aguardando confirmação na agenda de recebimento', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  // Autorizar entrada (CONFIRMADO → NA_DOCA)
  const autorizarEntrada = useMutation({
    mutationFn: async (agId: string) => {
      const { data } = await api.post(`/portaria/autorizar-entrada/${agId}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portaria-agendamentos'] })
      setValidacao(null); setPlacaBusca('')
      notifications.show({ title: '✅ Entrada autorizada', message: 'Veículo encaminhado para a doca', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  // Registrar saída
  const registrarSaida = useMutation({
    mutationFn: async (agId: string) => {
      const { data } = await api.post(`/portaria/registrar-saida/${agId}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portaria-agendamentos'] })
      setValidacao(null); setPlacaBusca('')
      notifications.show({ title: '✅ Saída registrada', message: 'Recebimento concluído', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  // Validar placa
  const validarPlaca = useMutation({
    mutationFn: async () => {
      if (!placaBusca) throw new Error('Informe a placa')
      const { data } = await api.get(`/portaria/validar-placa/${placaBusca.toUpperCase()}`)
      return data
    },
    onSuccess: (data) => setValidacao(data),
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  // Entrada avulsa
  const entradaAvulsa = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/portaria/entrada-avulsa', {
        placa: avulsoPlaca, motorista: avulsoMotorista, documento: avulsoDocumento, motivo: avulsoMotivo,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portaria-agendamentos'] })
      setAvulsoModal(false); setAvulsoPlaca(''); setAvulsoMotorista(''); setAvulsoDocumento('')
      notifications.show({ title: 'Sucesso', message: 'Entrada avulsa registrada', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  function resetConferir() {
    setConferirAgendamento(null); setPlaca(''); setMotorista('')
    setQtdCaixas(undefined); setQtdPaletes(undefined); setObservacao('')
  }

  function openConferir(ag: any) {
    setConferirAgendamento(ag)
    setPlaca(ag.placa || '')
    setMotorista(ag.motorista || '')
    setQtdCaixas(ag.qtdCaixas ?? undefined)
    setQtdPaletes(ag.qtdPaletes ?? undefined)
    setObservacao('')
    setConferirModal(true)
  }

  const items = response?.data || []
  const agendados = items.filter((i: any) => i.status === 'AGENDADO')
  const emProcesso = items.filter((i: any) => ['ESPERA', 'CONFIRMADO', 'NA_DOCA', 'CONFERINDO', 'CONFERIDO'].includes(i.status))
  const recebidos = items.filter((i: any) => i.status === 'RECEBIDO')

  function renderAgendamentoRow(ag: any) {
    return (
      <Table.Tr key={ag.id}>
        <Table.Td>
          <Group gap={4}>
            <IconClock size={14} className="text-gray-400" />
            <Text size="sm" fw={500}>{ag.horaInicio || '—'} - {ag.horaFim || '—'}</Text>
          </Group>
        </Table.Td>
        <Table.Td>{ag.fornecedor?.nomeFantasia || ag.fornecedor?.razaoSocial || '—'}</Table.Td>
        <Table.Td>{ag.pedido ? `#${ag.pedido.numero}` : '—'}</Table.Td>
        <Table.Td>
          {ag.motorista && <Text size="sm">{ag.motorista}</Text>}
          {ag.placa && <Text size="xs" c="dimmed" className="font-mono">{ag.placa}</Text>}
          {!ag.motorista && !ag.placa && <Text size="sm" c="dimmed">—</Text>}
        </Table.Td>
        <Table.Td>{ag.doca?.descricao || '—'}</Table.Td>
        <Table.Td>
          <Badge color={statusColors[ag.status] || 'gray'} variant="light">
            {statusLabels[ag.status] || ag.status}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Group gap={4}>
            {ag.status === 'AGENDADO' && (
              <Tooltip label="Conferir nota (caminhão chegou)">
                <ActionIcon variant="light" color="blue" onClick={() => openConferir(ag)}>
                  <IconClipboardCheck size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            {ag.status === 'CONFIRMADO' && (
              <Tooltip label="Autorizar entrada">
                <ActionIcon variant="light" color="green" onClick={() => autorizarEntrada.mutate(ag.id)}>
                  <IconDoorEnter size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            {['NA_DOCA', 'CONFERIDO'].includes(ag.status) && (
              <Tooltip label="Registrar saída">
                <ActionIcon variant="light" color="orange" onClick={() => {
                  if (confirm('Registrar saída do veículo?')) registrarSaida.mutate(ag.id)
                }}>
                  <IconDoorExit size={18} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Table.Td>
      </Table.Tr>
    )
  }

  return (
    <div>
      <PendenciasLogisticasButton />
      <Text size="xs" c="dimmed" mb={4}>WMS / Portaria</Text>
      <Text size="xl" fw={600} mb="lg">Controle de Portaria</Text>

      {/* Stats */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="xl">
        <Card><Group justify="space-between"><div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Agendados</Text><Text size="xl" fw={700} c="blue">{response?.agendados || 0}</Text></div><ThemeIcon color="blue" variant="light" size={48} radius="md"><IconClock size={24} /></ThemeIcon></Group></Card>
        <Card><Group justify="space-between"><div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Aguardando</Text><Text size="xl" fw={700} c="orange">{response?.espera || 0}</Text></div><ThemeIcon color="orange" variant="light" size={48} radius="md"><IconAlertCircle size={24} /></ThemeIcon></Group></Card>
        <Card><Group justify="space-between"><div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Na Doca</Text><Text size="xl" fw={700} c="grape">{response?.naDoca || 0}</Text></div><ThemeIcon color="grape" variant="light" size={48} radius="md"><IconTruck size={24} /></ThemeIcon></Group></Card>
        <Card><Group justify="space-between"><div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Recebidos</Text><Text size="xl" fw={700} c="green">{response?.recebidos || 0}</Text></div><ThemeIcon color="green" variant="light" size={48} radius="md"><IconCheck size={24} /></ThemeIcon></Group></Card>
      </SimpleGrid>

      {/* Busca por placa + ações rápidas */}
      <Card mb="md">
        <Group justify="space-between">
          <Group>
            <TextInput
              placeholder="Buscar por placa..."
              value={placaBusca}
              onChange={(e) => { setPlacaBusca(e.currentTarget.value.toUpperCase()); setValidacao(null) }}
              onKeyDown={(e) => e.key === 'Enter' && validarPlaca.mutate()}
              className="w-48 font-mono"
            />
            <Button leftSection={<IconSearch size={16} />} onClick={() => validarPlaca.mutate()} loading={validarPlaca.isPending}>
              Buscar
            </Button>
          </Group>
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => setAvulsoModal(true)}>Entrada Avulsa</Button>
          </Group>
        </Group>

        {/* Resultado busca placa */}
        {validacao && (
          <div className="mt-4">
            {!validacao.encontrado && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">{validacao.mensagem}</Alert>
            )}
            {validacao.encontrado && (
              <Card withBorder mt="sm">
                <Group justify="space-between" mb="sm">
                  <div>
                    <Text fw={600}>{validacao.fornecedor?.nomeFantasia || validacao.fornecedor?.razaoSocial || 'Veículo'}</Text>
                    <Text size="sm" c="dimmed">Motorista: {validacao.motorista || '—'} | Horário: {validacao.horaInicio}-{validacao.horaFim}</Text>
                  </div>
                  <Badge color={statusColors[validacao.status] || 'gray'} size="lg">{statusLabels[validacao.status] || validacao.status}</Badge>
                </Group>
                <Alert icon={<IconAlertCircle size={16} />} color={validacao.liberado ? 'green' : 'orange'} variant="light" mb="sm">
                  {validacao.mensagem}
                </Alert>
                <Group>
                  {validacao.podeEntrar && (
                    <Button color="green" leftSection={<IconDoorEnter size={18} />}
                      onClick={() => autorizarEntrada.mutate(validacao.agendamentoId)}
                      loading={autorizarEntrada.isPending}>
                      Autorizar Entrada
                    </Button>
                  )}
                  {validacao.podeSair && (
                    <Button color="blue" leftSection={<IconDoorExit size={18} />}
                      onClick={() => registrarSaida.mutate(validacao.agendamentoId)}
                      loading={registrarSaida.isPending}>
                      Registrar Saída
                    </Button>
                  )}
                </Group>
              </Card>
            )}
          </div>
        )}
      </Card>

      {/* Tabs: Aguardando Chegada | Em Processo | Concluídos */}
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Tabs defaultValue="agendados">
          <Tabs.List mb="md">
            <Tabs.Tab value="agendados" leftSection={<IconClock size={16} />}>
              Aguardando Chegada ({agendados.length})
            </Tabs.Tab>
            <Tabs.Tab value="processo" leftSection={<IconTruck size={16} />}>
              Em Processo ({emProcesso.length})
            </Tabs.Tab>
            <Tabs.Tab value="concluidos" leftSection={<IconCheck size={16} />}>
              Concluídos ({recebidos.length})
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="agendados">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Horário</Table.Th><Table.Th>Fornecedor</Table.Th><Table.Th>Pedido</Table.Th>
                  <Table.Th>Motorista/Placa</Table.Th><Table.Th>Doca</Table.Th><Table.Th>Status</Table.Th><Table.Th>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {agendados.map(renderAgendamentoRow)}
                {agendados.length === 0 && <Table.Tr><Table.Td colSpan={7} className="text-center py-8 text-zinc-500">Nenhum agendamento aguardando chegada</Table.Td></Table.Tr>}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          <Tabs.Panel value="processo">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Horário</Table.Th><Table.Th>Fornecedor</Table.Th><Table.Th>Pedido</Table.Th>
                  <Table.Th>Motorista/Placa</Table.Th><Table.Th>Doca</Table.Th><Table.Th>Status</Table.Th><Table.Th>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {emProcesso.map(renderAgendamentoRow)}
                {emProcesso.length === 0 && <Table.Tr><Table.Td colSpan={7} className="text-center py-8 text-zinc-500">Nenhum veículo em processo</Table.Td></Table.Tr>}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          <Tabs.Panel value="concluidos">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Horário</Table.Th><Table.Th>Fornecedor</Table.Th><Table.Th>Pedido</Table.Th>
                  <Table.Th>Motorista/Placa</Table.Th><Table.Th>Doca</Table.Th><Table.Th>Status</Table.Th><Table.Th>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {recebidos.map(renderAgendamentoRow)}
                {recebidos.length === 0 && <Table.Tr><Table.Td colSpan={7} className="text-center py-8 text-zinc-500">Nenhum recebimento concluído hoje</Table.Td></Table.Tr>}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* Modal Conferir na Portaria */}
      <Modal opened={conferirModal} onClose={() => { setConferirModal(false); resetConferir() }}
        title="Conferência na Portaria" size="lg" centered closeOnClickOutside={false}>
        {conferirAgendamento && (
          <>
            <Card withBorder mb="md" bg="gray.0">
              <Text size="sm" fw={600} mb="xs">Dados do Agendamento</Text>
              <SimpleGrid cols={2}>
                <div><Text size="xs" c="dimmed">Fornecedor</Text><Text size="sm" fw={500}>{conferirAgendamento.fornecedor?.razaoSocial || '—'}</Text></div>
                <div><Text size="xs" c="dimmed">Pedido</Text><Text size="sm" fw={500}>{conferirAgendamento.pedido ? `#${conferirAgendamento.pedido.numero}` : '—'}</Text></div>
                <div><Text size="xs" c="dimmed">Horário</Text><Text size="sm">{conferirAgendamento.horaInicio} - {conferirAgendamento.horaFim}</Text></div>
                <div><Text size="xs" c="dimmed">Doca</Text><Text size="sm">{conferirAgendamento.doca?.descricao || '—'}</Text></div>
              </SimpleGrid>

              {conferirAgendamento.pedido?.itens?.length > 0 && (
                <>
                  <Divider my="sm" />
                  <Text size="sm" fw={600} mb="xs">Itens do Pedido</Text>
                  <Table striped withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Código</Table.Th><Table.Th>Produto</Table.Th><Table.Th>Qtd</Table.Th><Table.Th>Unidade</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {conferirAgendamento.pedido.itens.map((item: any, idx: number) => (
                        <Table.Tr key={idx}>
                          <Table.Td className="font-mono">{item.produto?.codigo}</Table.Td>
                          <Table.Td>{item.produto?.nome}</Table.Td>
                          <Table.Td fw={500}>{Number(item.quantidade)}</Table.Td>
                          <Table.Td>{item.unidade || item.produto?.unidade}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </>
              )}
            </Card>

            <Divider my="md" label="Dados do Veículo / Motorista" labelPosition="center" />

            <div className="grid grid-cols-2 gap-4 mb-4">
              <TextInput label="Placa *" placeholder="ABC1D23" value={placa}
                onChange={(e) => setPlaca(e.currentTarget.value.toUpperCase())} maxLength={7} className="font-mono" />
              <TextInput label="Motorista *" placeholder="Nome do motorista" value={motorista}
                onChange={(e) => setMotorista(e.currentTarget.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <NumberInput label="Qtd Caixas" min={0} value={qtdCaixas}
                onChange={(v) => setQtdCaixas(typeof v === 'number' ? v : undefined)} />
              <NumberInput label="Qtd Paletes" min={0} value={qtdPaletes}
                onChange={(v) => setQtdPaletes(typeof v === 'number' ? v : undefined)} />
            </div>
            <TextInput label="Observação" value={observacao} onChange={(e) => setObservacao(e.currentTarget.value)} mb="md" />
          </>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={() => { setConferirModal(false); resetConferir() }}>Cancelar</Button>
          <Button onClick={() => conferir.mutate()} loading={conferir.isPending}
            disabled={!placa || !motorista} color="green" leftSection={<IconCheck size={16} />}>
            Confirmar Conferência
          </Button>
        </Group>
      </Modal>

      {/* Modal Entrada Avulsa */}
      <Modal opened={avulsoModal} onClose={() => setAvulsoModal(false)} title="Entrada Avulsa (sem agendamento)" centered>
        <TextInput label="Placa *" placeholder="ABC1D23" value={avulsoPlaca} onChange={(e) => setAvulsoPlaca(e.currentTarget.value.toUpperCase())} mb="sm" className="font-mono" />
        <TextInput label="Motorista *" value={avulsoMotorista} onChange={(e) => setAvulsoMotorista(e.currentTarget.value)} mb="sm" />
        <TextInput label="Documento" value={avulsoDocumento} onChange={(e) => setAvulsoDocumento(e.currentTarget.value)} mb="sm" />
        <Select label="Motivo" data={[
          { value: 'CARGA', label: 'Carga' }, { value: 'DESCARGA', label: 'Descarga' },
          { value: 'COLETA', label: 'Coleta' }, { value: 'ENTREGA', label: 'Entrega' },
          { value: 'AVULSO', label: 'Avulso' },
        ]} value={avulsoMotivo} onChange={setAvulsoMotivo} mb="sm" />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setAvulsoModal(false)}>Cancelar</Button>
          <Button onClick={() => entradaAvulsa.mutate()} loading={entradaAvulsa.isPending} disabled={!avulsoPlaca || !avulsoMotorista}>Registrar</Button>
        </Group>
      </Modal>
    </div>
  )
}
