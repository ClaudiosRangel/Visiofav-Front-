'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, ActionIcon, Tooltip,
  LoadingOverlay, Select, Modal, TextInput, NumberInput, SimpleGrid, ThemeIcon,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import {
  IconRefresh, IconCheck, IconPlus, IconCalendar, IconTruck,
  IconClock, IconArrowRight, IconX, IconEdit, IconPrinter, IconAlertTriangle,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { deveExibirAlertaDivergencia } from '@/utils/transporteWms'

const statusColors: Record<string, string> = {
  AGENDADO: 'blue', CONFIRMADO: 'cyan', ESPERA: 'orange',
  NA_DOCA: 'grape', CONFERINDO: 'yellow', CONFERIDO: 'teal',
  RECEBIDO: 'green', CANCELADO: 'red',
}

const statusFlow = ['AGENDADO', 'ESPERA', 'CONFIRMADO', 'NA_DOCA', 'CONFERINDO', 'CONFERIDO', 'RECEBIDO']

export default function AgendaWmsPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Agenda de Recebimento' }, [])
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  // Form state
  const [docaId, setDocaId] = useState<string | null>(null)
  const [horaInicio, setHoraInicio] = useState('08:00')
  const [horaFim, setHoraFim] = useState('10:00')
  const [motorista, setMotorista] = useState('')
  const [placa, setPlaca] = useState('')
  const [qtdCaixas, setQtdCaixas] = useState<number | undefined>()
  const [qtdPaletes, setQtdPaletes] = useState<number | undefined>()
  const [fornecedorId, setFornecedorId] = useState<string | null>(null)
  const [observacao, setObservacao] = useState('')

  const dataStr = selectedDate.toISOString().split('T')[0]

  const { data: response, isLoading, refetch } = useQuery<any>({
    queryKey: ['agenda-wms', { data: dataStr, status: statusFilter }],
    queryFn: async () => {
      const params: Record<string, unknown> = { data: dataStr, limit: 50 }
      if (statusFilter) params.status = statusFilter
      const { data } = await api.get('/agenda-wms', { params })
      return data
    },
  })

  const { data: docasData } = useQuery<any[]>({
    queryKey: ['agenda-docas'],
    queryFn: async () => { const { data } = await api.get('/agenda-wms/docas'); return data },
  })

  const { data: fornecedoresData } = useQuery<any>({
    queryKey: ['fornecedores-select'],
    queryFn: async () => { const { data } = await api.get('/fornecedores', { params: { limit: 100, status: 'true' } }); return data },
    enabled: modalOpen,
  })

  const criarAgenda = useMutation({
    mutationFn: async () => {
      if (!docaId) throw new Error('Selecione uma doca')
      const { data } = await api.post('/agenda-wms', {
        docaId, dataPrevista: dataStr, horaInicio, horaFim,
        motorista: motorista || undefined, placa: placa || undefined,
        fornecedorId: fornecedorId || undefined,
        qtdCaixas: qtdCaixas || undefined, qtdPaletes: qtdPaletes || undefined,
        observacao: observacao || undefined,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-wms'] })
      setModalOpen(false)
      resetForm()
      notifications.show({ title: 'Sucesso', message: 'Agendamento criado', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  const avancarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.patch(`/agenda-wms/${id}/status`, { status })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-wms'] })
      notifications.show({ title: 'Sucesso', message: 'Status atualizado', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  const editarAgenda = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error('Nenhum agendamento selecionado')
      const { data } = await api.patch(`/agenda-wms/${editingId}`, {
        motorista: motorista || undefined,
        placa: placa || undefined,
        qtdCaixas: qtdCaixas ?? null,
        qtdPaletes: qtdPaletes ?? null,
        observacao: observacao || undefined,
        horaInicio, horaFim,
        docaId: docaId || undefined,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-wms'] })
      setEditModalOpen(false)
      setEditingId(null)
      resetForm()
      notifications.show({ title: 'Sucesso', message: 'Agendamento atualizado', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  function openEdit(ag: any) {
    setEditingId(ag.id)
    setDocaId(ag.docaId || null)
    setHoraInicio(ag.horaInicio || '08:00')
    setHoraFim(ag.horaFim || '10:00')
    setMotorista(ag.motorista || '')
    setPlaca(ag.placa || '')
    setQtdCaixas(ag.qtdCaixas ?? undefined)
    setQtdPaletes(ag.qtdPaletes ?? undefined)
    setFornecedorId(ag.fornecedorId || null)
    setObservacao(ag.observacao || '')
    setEditModalOpen(true)
  }

  function resetForm() {
    setDocaId(null); setHoraInicio('08:00'); setHoraFim('10:00')
    setMotorista(''); setPlaca(''); setQtdCaixas(undefined); setQtdPaletes(undefined)
    setFornecedorId(null); setObservacao('')
  }

  function getNextStatus(current: string): string | null {
    const idx = statusFlow.indexOf(current)
    return idx >= 0 && idx < statusFlow.length - 1 ? statusFlow[idx + 1] : null
  }

  const items = response?.data || []
  const docas = docasData || []
  const docaOptions = docas.map((d: any) => ({ value: d.id, label: d.descricao }))
  const fornecedorOptions = (fornecedoresData?.data || []).map((f: any) => ({ value: f.id, label: f.razaoSocial }))

  // Agrupar por doca
  const porDoca: Record<string, any[]> = {}
  for (const item of items) {
    const docaNome = item.doca?.descricao || 'Sem doca'
    if (!porDoca[docaNome]) porDoca[docaNome] = []
    porDoca[docaNome].push(item)
  }

  // Stats
  const agendados = items.filter((i: any) => i.status === 'AGENDADO').length
  const emAndamento = items.filter((i: any) => ['CONFIRMADO', 'ESPERA', 'NA_DOCA', 'CONFERINDO'].includes(i.status)).length
  const concluidos = items.filter((i: any) => i.status === 'RECEBIDO').length

  function handlePrint() {
    const dateFormatted = selectedDate.toLocaleDateString('pt-BR')
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Agenda de Recebimento - ${dateFormatted}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; color: #333; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          .subtitle { color: #666; font-size: 12px; margin-bottom: 16px; }
          .stats { display: flex; gap: 24px; margin-bottom: 16px; padding: 8px 0; border-bottom: 1px solid #ccc; }
          .stat { font-weight: bold; }
          .stat-label { font-weight: normal; color: #666; }
          .doca-section { margin-bottom: 16px; page-break-inside: avoid; }
          .doca-header { font-weight: bold; font-size: 14px; padding: 6px 0; border-bottom: 2px solid #333; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { text-align: left; padding: 4px 8px; background: #f0f0f0; border: 1px solid #ddd; font-weight: 600; }
          td { padding: 4px 8px; border: 1px solid #ddd; }
          .status { font-weight: bold; text-transform: uppercase; font-size: 10px; }
          .footer { margin-top: 24px; text-align: right; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
          @media print {
            body { padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>Agenda de Recebimento</h1>
        <div class="subtitle">Data: ${dateFormatted} | Total: ${items.length} agendamento(s)</div>
        <div class="stats">
          <span><span class="stat-label">Agendados:</span> <span class="stat">${agendados}</span></span>
          <span><span class="stat-label">Em Andamento:</span> <span class="stat">${emAndamento}</span></span>
          <span><span class="stat-label">Concluídos:</span> <span class="stat">${concluidos}</span></span>
        </div>
        ${Object.entries(porDoca).map(([docaNome, agendamentos]) => `
          <div class="doca-section">
            <div class="doca-header">${docaNome} — ${agendamentos.length} agendamento(s)</div>
            <table>
              <thead>
                <tr>
                  <th>Horário</th>
                  <th>Fornecedor</th>
                  <th>NF</th>
                  <th>Motorista/Placa</th>
                  <th>Caixas/Paletes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${agendamentos.sort((a: any, b: any) => (a.horaInicio || '').localeCompare(b.horaInicio || '')).map((ag: any) => `
                  <tr>
                    <td>${ag.horaInicio || '—'} - ${ag.horaFim || '—'}</td>
                    <td>${ag.fornecedor?.nomeFantasia || ag.fornecedor?.razaoSocial || '—'}</td>
                    <td>${ag.notaEntrada?.numero ? `NF ${ag.notaEntrada.numero}${ag.notaEntrada.serie ? '/' + ag.notaEntrada.serie : ''}` : '—'}</td>
                    <td>${ag.motorista || '—'}${ag.placa ? ' (' + ag.placa + ')' : ''}</td>
                    <td>${ag.qtdCaixas ? ag.qtdCaixas + ' cx' : ''}${ag.qtdCaixas && ag.qtdPaletes ? ' / ' : ''}${ag.qtdPaletes ? ag.qtdPaletes + ' pl' : ''}${!ag.qtdCaixas && !ag.qtdPaletes ? '—' : ''}</td>
                    <td class="status">${ag.status}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}
        ${Object.keys(porDoca).length === 0 ? '<p style="text-align:center;color:#999;padding:40px 0;">Nenhum agendamento para esta data.</p>' : ''}
        <div class="footer">Impresso em ${new Date().toLocaleString('pt-BR')} | Vizor ERP - Agenda de Recebimento</div>
      </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.onload = () => { printWindow.print() }
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Agenda de Recebimento</Text>
      <Text size="xl" fw={600} mb="lg">Agenda de Recebimento</Text>

      {/* Stats */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
        <Card><Group justify="space-between"><div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Agendados</Text><Text size="xl" fw={700} c="blue">{agendados}</Text></div><ThemeIcon color="blue" variant="light" size={48} radius="md"><IconCalendar size={24} /></ThemeIcon></Group></Card>
        <Card><Group justify="space-between"><div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Em Andamento</Text><Text size="xl" fw={700} c="orange">{emAndamento}</Text></div><ThemeIcon color="orange" variant="light" size={48} radius="md"><IconTruck size={24} /></ThemeIcon></Group></Card>
        <Card><Group justify="space-between"><div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Concluídos</Text><Text size="xl" fw={700} c="green">{concluidos}</Text></div><ThemeIcon color="green" variant="light" size={48} radius="md"><IconCheck size={24} /></ThemeIcon></Group></Card>
      </SimpleGrid>

      {/* Filtros */}
      <Card mb="md">
        <Group justify="space-between">
          <Group>
            <DateInput label="Data" value={selectedDate} onChange={(d) => d && setSelectedDate(d)} valueFormat="DD/MM/YYYY" className="w-40" />
            <Select label="Status" data={[
              { value: 'AGENDADO', label: 'Agendado' }, { value: 'CONFIRMADO', label: 'Confirmado' },
              { value: 'ESPERA', label: 'Espera' }, { value: 'NA_DOCA', label: 'Na Doca' },
              { value: 'CONFERINDO', label: 'Conferindo' }, { value: 'RECEBIDO', label: 'Recebido' },
              { value: 'CANCELADO', label: 'Cancelado' },
            ]} value={statusFilter} onChange={setStatusFilter} clearable className="w-40" />
          </Group>
          <Group>
            <Button variant="default" leftSection={<IconPrinter size={16} />} onClick={handlePrint} disabled={items.length === 0}>Imprimir</Button>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={() => { resetForm(); setModalOpen(true) }}>Novo Agendamento</Button>
          </Group>
        </Group>
      </Card>

      {/* Legenda */}
      <Card mb="md">
        <Group gap="md">
          <Text size="sm" fw={500}>Legenda:</Text>
          {Object.entries(statusColors).map(([s, c]) => (
            <Group key={s} gap={4}><Badge color={c} size="xs" variant="filled" /><Text size="xs">{s}</Text></Group>
          ))}
        </Group>
      </Card>

      {/* Agendamentos por Doca */}
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        {Object.keys(porDoca).length === 0 && !isLoading && (
          <Text c="dimmed" className="text-center py-12">Nenhum agendamento para {selectedDate.toLocaleDateString('pt-BR')}</Text>
        )}

        {Object.entries(porDoca).map(([docaNome, agendamentos]) => (
          <div key={docaNome} className="mb-6">
            <Group mb="sm">
              <ThemeIcon color="primary" variant="light" size="sm"><IconTruck size={14} /></ThemeIcon>
              <Text fw={600}>{docaNome}</Text>
              <Badge variant="light">{agendamentos.length} agendamento(s)</Badge>
            </Group>

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Horário</Table.Th><Table.Th>Fornecedor</Table.Th><Table.Th>NF</Table.Th><Table.Th>Pedido</Table.Th>
                  <Table.Th>Motorista/Placa</Table.Th><Table.Th>Caixas/Paletes</Table.Th>
                  <Table.Th>Status</Table.Th><Table.Th className="w-32">Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {agendamentos.sort((a: any, b: any) => (a.horaInicio || '').localeCompare(b.horaInicio || '')).map((ag: any) => {
                  const nextStatus = getNextStatus(ag.status)
                  return (
                    <Table.Tr key={ag.id}>
                      <Table.Td fw={500}>
                        <Group gap={4}>
                          <IconClock size={14} className="text-gray-400" />
                          {ag.horaInicio || '—'} - {ag.horaFim || '—'}
                        </Group>
                      </Table.Td>
                      <Table.Td>{ag.fornecedor?.nomeFantasia || ag.fornecedor?.razaoSocial || '—'}</Table.Td>
                      <Table.Td>{ag.notaEntrada?.numero ? <Text size="sm" fw={500} className="font-mono">NF {ag.notaEntrada.numero}{ag.notaEntrada.serie ? `/${ag.notaEntrada.serie}` : ''}</Text> : <Text size="sm" c="dimmed">—</Text>}</Table.Td>
                      <Table.Td>{ag.pedido ? `#${ag.pedido.numero}` : '—'}</Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <div>
                            {ag.motorista && <Text size="sm">{ag.motorista}</Text>}
                            {ag.placa && <Text size="xs" c="dimmed" className="font-mono">{ag.placa}</Text>}
                            {!ag.motorista && !ag.placa && <Text size="sm" c="dimmed">—</Text>}
                          </div>
                          {deveExibirAlertaDivergencia(ag.divergenciaTransporte) && (
                            <Tooltip label={ag.divergenciaTransporte} multiline w={280}>
                              <ThemeIcon color="orange" variant="light" size="sm" ml={4}>
                                <IconAlertTriangle size={12} />
                              </ThemeIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        {ag.qtdCaixas ? `${ag.qtdCaixas} cx` : ''}
                        {ag.qtdCaixas && ag.qtdPaletes ? ' / ' : ''}
                        {ag.qtdPaletes ? `${ag.qtdPaletes} pl` : ''}
                        {!ag.qtdCaixas && !ag.qtdPaletes && '—'}
                      </Table.Td>
                      <Table.Td><Badge color={statusColors[ag.status] || 'gray'} variant="light">{ag.status}</Badge></Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {ag.status !== 'RECEBIDO' && ag.status !== 'CANCELADO' && (
                            <Tooltip label="Editar">
                              <ActionIcon variant="subtle" color="gray" onClick={() => openEdit(ag)}>
                                <IconEdit size={18} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {nextStatus && ag.status !== 'CANCELADO' && (
                            <Tooltip label={`Avançar para ${nextStatus}`}>
                              <ActionIcon variant="subtle" color="blue" onClick={() => avancarStatus.mutate({ id: ag.id, status: nextStatus })}>
                                <IconArrowRight size={18} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {ag.status !== 'RECEBIDO' && ag.status !== 'CANCELADO' && (
                            <Tooltip label="Cancelar">
                              <ActionIcon variant="subtle" color="red" onClick={() => { if (confirm('Cancelar agendamento?')) avancarStatus.mutate({ id: ag.id, status: 'CANCELADO' }) }}>
                                <IconX size={18} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {ag.status === 'CONFERIDO' && (
                            <Tooltip label="Concluir recebimento">
                              <ActionIcon variant="subtle" color="green" onClick={() => avancarStatus.mutate({ id: ag.id, status: 'RECEBIDO' })}>
                                <IconCheck size={18} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </div>
        ))}
      </Card>

      {/* Modal Novo Agendamento */}
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Novo Agendamento" size="lg" centered closeOnClickOutside={false}>
        <div className="flex flex-col gap-4">
          <Select label="Doca *" data={docaOptions} value={docaId} onChange={setDocaId} searchable />
          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Hora Início *" placeholder="08:00" value={horaInicio} onChange={(e) => setHoraInicio(e.currentTarget.value)} />
            <TextInput label="Hora Fim *" placeholder="10:00" value={horaFim} onChange={(e) => setHoraFim(e.currentTarget.value)} />
          </div>
          <Select label="Fornecedor" data={fornecedorOptions} value={fornecedorId} onChange={setFornecedorId} searchable clearable />
          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Motorista" value={motorista} onChange={(e) => setMotorista(e.currentTarget.value)} />
            <TextInput label="Placa" placeholder="ABC1D23" value={placa} onChange={(e) => setPlaca(e.currentTarget.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumberInput label="Qtd Caixas" min={0} value={qtdCaixas} onChange={(v) => setQtdCaixas(typeof v === 'number' ? v : undefined)} />
            <NumberInput label="Qtd Paletes" min={0} value={qtdPaletes} onChange={(v) => setQtdPaletes(typeof v === 'number' ? v : undefined)} />
          </div>
          <TextInput label="Observação" value={observacao} onChange={(e) => setObservacao(e.currentTarget.value)} />
        </div>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={() => criarAgenda.mutate()} loading={criarAgenda.isPending} disabled={!docaId}>Agendar</Button>
        </Group>
      </Modal>

      {/* Modal Editar Agendamento */}
      <Modal opened={editModalOpen} onClose={() => { setEditModalOpen(false); setEditingId(null) }} title="Editar Agendamento" size="lg" centered closeOnClickOutside={false}>
        <div className="flex flex-col gap-4">
          <Select label="Doca" data={docaOptions} value={docaId} onChange={setDocaId} searchable />
          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Hora Início" placeholder="08:00" value={horaInicio} onChange={(e) => setHoraInicio(e.currentTarget.value)} />
            <TextInput label="Hora Fim" placeholder="10:00" value={horaFim} onChange={(e) => setHoraFim(e.currentTarget.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Motorista" placeholder="Nome do motorista" value={motorista} onChange={(e) => setMotorista(e.currentTarget.value)} />
            <TextInput label="Placa" placeholder="ABC1D23" value={placa} onChange={(e) => setPlaca(e.currentTarget.value.toUpperCase())} maxLength={7} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumberInput label="Qtd Caixas" min={0} value={qtdCaixas} onChange={(v) => setQtdCaixas(typeof v === 'number' ? v : undefined)} />
            <NumberInput label="Qtd Paletes" min={0} value={qtdPaletes} onChange={(v) => setQtdPaletes(typeof v === 'number' ? v : undefined)} />
          </div>
          <TextInput label="Observação" value={observacao} onChange={(e) => setObservacao(e.currentTarget.value)} />
        </div>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => { setEditModalOpen(false); setEditingId(null) }}>Cancelar</Button>
          <Button onClick={() => editarAgenda.mutate()} loading={editarAgenda.isPending}>Salvar</Button>
        </Group>
      </Modal>
    </div>
  )
}
