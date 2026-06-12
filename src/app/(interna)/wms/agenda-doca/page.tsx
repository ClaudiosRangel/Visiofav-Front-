'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Card, Group, Text, Button, Modal, TextInput, Select, Textarea,
  LoadingOverlay, Badge, Tooltip, Stack, NumberInput,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import {
  IconCalendarEvent, IconPlus, IconLock, IconSettings, IconChartBar,
} from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  AGENDADO: '#228be6',
  CONFIRMADO: '#40c057',
  NA_DOCA: '#fab005',
  ATRASADO: '#fa5252',
  CANCELADO: '#868e96',
}

const STATUS_LABELS: Record<string, string> = {
  AGENDADO: 'Agendado',
  CONFIRMADO: 'Confirmado',
  NA_DOCA: 'Na Doca',
  ATRASADO: 'Atrasado',
  CANCELADO: 'Cancelado',
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6) // 06:00 to 22:00

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function parseTime(dateStr: string): number {
  const d = new Date(dateStr)
  return d.getHours() + d.getMinutes() / 60
}

export default function AgendaDocaPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Agenda de Docas' }, [])

  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [createModal, setCreateModal] = useState(false)
  const [detailModal, setDetailModal] = useState<any>(null)
  const [newSlot, setNewSlot] = useState({ docaId: '', hora: '', duracao: 60, transportadora: '', placa: '', observacao: '' })

  const dateStr = formatDate(selectedDate)

  const { data: timelineData, isLoading } = useQuery<any>({
    queryKey: ['agenda-doca-timeline', dateStr],
    queryFn: async () => {
      const { data } = await api.get('/agenda-doca/timeline', { params: { data: dateStr } })
      return data
    },
  })

  const docas = timelineData?.docas || []
  const agendamentos = timelineData?.agendamentos || []

  const criarAgendamento = useMutation({
    mutationFn: async (payload: any) => {
      await api.post('/agenda-doca/agendar', payload)
    },
    onSuccess: () => {
      notifications.show({ title: 'Sucesso', message: 'Agendamento criado', color: 'green' })
      queryClient.invalidateQueries({ queryKey: ['agenda-doca-timeline'] })
      setCreateModal(false)
      setNewSlot({ docaId: '', hora: '', duracao: 60, transportadora: '', placa: '', observacao: '' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao criar agendamento', color: 'red' })
    },
  })

  // Group agendamentos by docaId
  const agendamentosByDoca = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const ag of agendamentos) {
      const docaId = ag.docaId || ag.doca_id
      if (!map[docaId]) map[docaId] = []
      map[docaId].push(ag)
    }
    return map
  }, [agendamentos])

  function handleSlotClick(docaId: string, hour: number) {
    setNewSlot({
      ...newSlot,
      docaId,
      hora: `${String(hour).padStart(2, '0')}:00`,
    })
    setCreateModal(true)
  }

  function handleBlockClick(agendamento: any) {
    setDetailModal(agendamento)
  }

  function handleCreate() {
    if (!newSlot.docaId || !newSlot.hora) return
    const dataHoraInicio = `${dateStr}T${newSlot.hora}:00`
    criarAgendamento.mutate({
      docaId: newSlot.docaId,
      dataHoraInicio,
      duracaoMinutos: newSlot.duracao,
      transportadora: newSlot.transportadora || undefined,
      placa: newSlot.placa || undefined,
      observacao: newSlot.observacao || undefined,
    })
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Recebimento / Agenda de Docas</Text>

      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Agenda de Docas</Text>
        <Group>
          <Button component={Link} href="/wms/agenda-doca/bloqueios" variant="light" leftSection={<IconLock size={16} />}>
            Bloqueios
          </Button>
          <Button component={Link} href="/wms/agenda-doca/config" variant="light" leftSection={<IconSettings size={16} />}>
            Configuração
          </Button>
          <Button component={Link} href="/wms/agenda-doca/estatisticas" variant="light" leftSection={<IconChartBar size={16} />}>
            Estatísticas
          </Button>
        </Group>
      </Group>

      {/* Date Picker */}
      <Card mb="md">
        <Group>
          <DatePickerInput
            label="Data"
            value={selectedDate}
            onChange={(d) => d && setSelectedDate(d)}
            valueFormat="DD/MM/YYYY"
            className="w-48"
          />
          <Button variant="light" onClick={() => setSelectedDate(new Date())}>Hoje</Button>
        </Group>
      </Card>

      {/* Legend */}
      <Group mb="md" gap="lg">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <Group key={key} gap={6}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: STATUS_COLORS[key] }} />
            <Text size="xs">{label}</Text>
          </Group>
        ))}
      </Group>

      {/* Timeline Grid */}
      <Card pos="relative" p={0} style={{ overflow: 'auto' }}>
        <LoadingOverlay visible={isLoading} />
        <div style={{ minWidth: 1200 }}>
          {/* Header - Hours */}
          <div style={{ display: 'grid', gridTemplateColumns: '120px repeat(16, 1fr)', borderBottom: '1px solid #e9ecef' }}>
            <div style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12, color: '#868e96', borderRight: '1px solid #e9ecef' }}>
              Doca
            </div>
            {HOURS.slice(0, 16).map((hour) => (
              <div key={hour} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, color: '#868e96', borderRight: '1px solid #f1f3f5' }}>
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Rows - Docas */}
          {docas.length === 0 && !isLoading && (
            <div style={{ padding: 40, textAlign: 'center', color: '#868e96' }}>
              Nenhuma doca configurada ou dados indisponíveis para esta data
            </div>
          )}
          {docas.map((doca: any) => {
            const docaAgendamentos = agendamentosByDoca[doca.id] || []
            return (
              <div
                key={doca.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr',
                  borderBottom: '1px solid #f1f3f5',
                  minHeight: 48,
                }}
              >
                {/* Doca label */}
                <div style={{
                  padding: '12px',
                  fontWeight: 500,
                  fontSize: 13,
                  borderRight: '1px solid #e9ecef',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  {doca.nome || doca.codigo || `Doca ${doca.id.slice(0, 6)}`}
                </div>

                {/* Timeline area */}
                <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)' }}>
                  {/* Hour cells (click targets) */}
                  {HOURS.slice(0, 16).map((hour) => (
                    <div
                      key={hour}
                      onClick={() => handleSlotClick(doca.id, hour)}
                      style={{
                        borderRight: '1px solid #f8f9fa',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        minHeight: 48,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f8f9fa' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    />
                  ))}

                  {/* Agendamento blocks (absolute over the grid) */}
                  {docaAgendamentos.map((ag: any) => {
                    const startHour = parseTime(ag.dataHoraInicio || ag.data_hora_inicio)
                    const endHour = ag.dataHoraFim || ag.data_hora_fim
                      ? parseTime(ag.dataHoraFim || ag.data_hora_fim)
                      : startHour + (ag.duracaoMinutos || ag.duracao_minutos || 60) / 60

                    const leftPct = ((startHour - 6) / 16) * 100
                    const widthPct = ((endHour - startHour) / 16) * 100

                    if (leftPct < 0 || leftPct >= 100) return null

                    return (
                      <Tooltip
                        key={ag.id}
                        label={`${STATUS_LABELS[ag.status] || ag.status} | ${ag.transportadora || 'S/N'} | ${ag.placa || ''}`}
                        position="top"
                      >
                        <div
                          onClick={(e) => { e.stopPropagation(); handleBlockClick(ag) }}
                          style={{
                            position: 'absolute',
                            left: `${leftPct}%`,
                            top: 4,
                            bottom: 4,
                            width: `${widthPct}%`,
                            background: STATUS_COLORS[ag.status] || '#868e96',
                            borderRadius: 4,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 500,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            padding: '0 6px',
                            zIndex: 10,
                          }}
                        >
                          {ag.transportadora || ag.placa || STATUS_LABELS[ag.status]}
                        </div>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Create Agendamento Modal */}
      <Modal opened={createModal} onClose={() => setCreateModal(false)} title="Novo Agendamento" size="md">
        <Stack gap="sm">
          <Select
            label="Doca"
            placeholder="Selecione a doca"
            value={newSlot.docaId}
            onChange={(v) => setNewSlot({ ...newSlot, docaId: v || '' })}
            data={docas.map((d: any) => ({ value: d.id, label: d.nome || d.codigo || d.id }))}
          />
          <TextInput
            label="Hora Início"
            placeholder="HH:MM"
            value={newSlot.hora}
            onChange={(e) => setNewSlot({ ...newSlot, hora: e.currentTarget.value })}
          />
          <NumberInput
            label="Duração (minutos)"
            value={newSlot.duracao}
            onChange={(v) => setNewSlot({ ...newSlot, duracao: typeof v === 'number' ? v : 60 })}
            min={15}
            max={480}
          />
          <TextInput
            label="Transportadora"
            value={newSlot.transportadora}
            onChange={(e) => setNewSlot({ ...newSlot, transportadora: e.currentTarget.value })}
          />
          <TextInput
            label="Placa"
            value={newSlot.placa}
            onChange={(e) => setNewSlot({ ...newSlot, placa: e.currentTarget.value })}
          />
          <Textarea
            label="Observação"
            value={newSlot.observacao}
            onChange={(e) => setNewSlot({ ...newSlot, observacao: e.currentTarget.value })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setCreateModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={criarAgendamento.isPending}>Criar Agendamento</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Detail Modal */}
      <Modal opened={!!detailModal} onClose={() => setDetailModal(null)} title="Detalhes do Agendamento" size="md">
        {detailModal && (
          <Stack gap="sm">
            <Group>
              <Text size="sm" fw={500}>Status:</Text>
              <Badge color={STATUS_COLORS[detailModal.status]?.replace('#', '') || 'gray'}>
                {STATUS_LABELS[detailModal.status] || detailModal.status}
              </Badge>
            </Group>
            <Group>
              <Text size="sm" fw={500}>Transportadora:</Text>
              <Text size="sm">{detailModal.transportadora || '—'}</Text>
            </Group>
            <Group>
              <Text size="sm" fw={500}>Placa:</Text>
              <Text size="sm">{detailModal.placa || '—'}</Text>
            </Group>
            <Group>
              <Text size="sm" fw={500}>Início:</Text>
              <Text size="sm">
                {detailModal.dataHoraInicio || detailModal.data_hora_inicio
                  ? new Date(detailModal.dataHoraInicio || detailModal.data_hora_inicio).toLocaleString('pt-BR')
                  : '—'}
              </Text>
            </Group>
            <Group>
              <Text size="sm" fw={500}>Duração:</Text>
              <Text size="sm">{detailModal.duracaoMinutos || detailModal.duracao_minutos || '—'} min</Text>
            </Group>
            {detailModal.observacao && (
              <Group>
                <Text size="sm" fw={500}>Observação:</Text>
                <Text size="sm">{detailModal.observacao}</Text>
              </Group>
            )}
            {detailModal.horaChegadaReal && (
              <Group>
                <Text size="sm" fw={500}>Chegada Real:</Text>
                <Text size="sm">{new Date(detailModal.horaChegadaReal).toLocaleString('pt-BR')}</Text>
              </Group>
            )}
          </Stack>
        )}
      </Modal>
    </div>
  )
}
