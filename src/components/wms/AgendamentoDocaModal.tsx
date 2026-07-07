'use client'

import { useState, useEffect } from 'react'
import { Modal, Group, Text, Button, Card, Badge, Tooltip, Select, SimpleGrid, Alert, ScrollArea } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconCalendar, IconCheck, IconAlertCircle, IconClock } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

const statusColors: Record<string, string> = {
  AGENDADO: '#228be6', ESPERA: '#fd7e14', CONFIRMADO: '#15aabf',
  NA_DOCA: '#be4bdb', CONFERINDO: '#fab005', CONFERIDO: '#20c997',
  RECEBIDO: '#40c057',
}

interface Props {
  opened: boolean
  onClose: () => void
  onAgendado: (agendaId: string) => void
  pedidoCompraId?: string
  fornecedorId?: string
  fornecedorCnpj?: string
  defaultDate?: Date
  /** Se informado, cancela este agendamento anterior ao confirmar o novo (fluxo "Alterar Agendamento") */
  agendamentoAtualId?: string
}

export default function AgendamentoDocaModal({ opened, onClose, onAgendado, pedidoCompraId, fornecedorId, fornecedorCnpj, defaultDate, agendamentoAtualId }: Props) {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState<Date>(defaultDate || new Date())
  const [selectedDoca, setSelectedDoca] = useState<string | null>(null)
  const [selectedSlotStart, setSelectedSlotStart] = useState<string | null>(null)
  const [selectedSlotEnd, setSelectedSlotEnd] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)

  const dataStr = selectedDate.toISOString().split('T')[0]

  // Grade de horários
  const { data: gradeResp, isLoading } = useQuery<any>({
    queryKey: ['agenda-grade', dataStr],
    queryFn: async () => { const { data } = await api.get(`/agenda-wms/grade/${dataStr}`); return data },
    enabled: opened,
  })

  // Criar agendamento (e cancelar o anterior, se estiver alterando um existente)
  const criarAgenda = useMutation({
    mutationFn: async () => {
      if (!selectedDoca || !selectedSlotStart || !selectedSlotEnd) throw new Error('Selecione doca e horário')
      const { data } = await api.post('/agenda-wms', {
        docaId: selectedDoca,
        dataPrevista: dataStr,
        horaInicio: selectedSlotStart,
        horaFim: selectedSlotEnd,
        pedidoCompraId: pedidoCompraId || undefined,
        fornecedorId: fornecedorId || undefined,
        fornecedorCnpj: fornecedorCnpj || undefined,
      })
      // Ao alterar um agendamento existente, cancela o anterior para não
      // deixar duplicado (um na data antiga e outro na nova)
      if (agendamentoAtualId) {
        await api.patch(`/agenda-wms/${agendamentoAtualId}/status`, { status: 'CANCELADO' })
      }
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agenda-grade'] })
      queryClient.invalidateQueries({ queryKey: ['agenda-wms'] })
      queryClient.invalidateQueries({ queryKey: ['compra-detalhe'] })
      queryClient.invalidateQueries({ queryKey: ['pedido-compra'] })
      notifications.show({ title: '✅ Agendado', message: `Doca reservada ${selectedSlotStart} - ${selectedSlotEnd}`, color: 'green' })
      onAgendado(data.id)
      resetSelection()
      onClose()
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  function resetSelection() {
    setSelectedDoca(null); setSelectedSlotStart(null); setSelectedSlotEnd(null); setSelecting(false)
  }

  function handleSlotClick(docaId: string, horario: string, ocupado: boolean) {
    if (ocupado) return

    if (!selecting || selectedDoca !== docaId) {
      // Primeiro clique: seleciona 1 slot (30 min) imediatamente
      setSelectedDoca(docaId)
      setSelectedSlotStart(horario)
      const [h, m] = horario.split(':').map(Number)
      const totalMin = h * 60 + m + 30
      const fimH = String(Math.floor(totalMin / 60)).padStart(2, '0')
      const fimM = String(totalMin % 60).padStart(2, '0')
      setSelectedSlotEnd(`${fimH}:${fimM}`)
      setSelecting(true)
    } else {
      // Segundo clique: expande ou reduz a seleção
      const slots = gradeResp?.slots || []
      const startIdx = slots.indexOf(selectedSlotStart!)
      const endIdx = slots.indexOf(horario)

      if (endIdx >= startIdx) {
        // Horário fim = horário do último slot clicado + 30 min
        const lastSlot = slots[endIdx]
        const [h, m] = lastSlot.split(':').map(Number)
        const totalMin = h * 60 + m + 30
        const fimH = String(Math.floor(totalMin / 60)).padStart(2, '0')
        const fimM = String(totalMin % 60).padStart(2, '0')
        setSelectedSlotEnd(`${fimH}:${fimM}`)
        setSelecting(false)
      } else {
        // Clicou antes do início — reiniciar com novo slot
        setSelectedSlotStart(horario)
        const [h, m] = horario.split(':').map(Number)
        const totalMin = h * 60 + m + 30
        const fimH = String(Math.floor(totalMin / 60)).padStart(2, '0')
        const fimM = String(totalMin % 60).padStart(2, '0')
        setSelectedSlotEnd(`${fimH}:${fimM}`)
      }
    }
  }

  function isSlotSelected(docaId: string, horario: string): boolean {
    if (docaId !== selectedDoca || !selectedSlotStart) return false
    const slots = gradeResp?.slots || []
    const startIdx = slots.indexOf(selectedSlotStart)
    const currentIdx = slots.indexOf(horario)

    if (selectedSlotEnd) {
      // Calcular o índice do último slot incluído (selectedSlotEnd - 30min)
      const [h, m] = selectedSlotEnd.split(':').map(Number)
      const lastSlotMin = h * 60 + m - 30
      const lastSlotH = String(Math.floor(lastSlotMin / 60)).padStart(2, '0')
      const lastSlotM = String(lastSlotMin % 60).padStart(2, '0')
      const lastSlotStr = `${lastSlotH}:${lastSlotM}`
      const endIdx = slots.indexOf(lastSlotStr)
      return currentIdx >= startIdx && currentIdx <= endIdx
    }
    // Durante seleção, marcar apenas o slot inicial
    return currentIdx === startIdx
  }

  const grade = gradeResp?.grade || []
  const slots = gradeResp?.slots || []

  return (
    <Modal opened={opened} onClose={() => { resetSelection(); onClose() }}
      title="Agendar Recebimento na Doca" size="95%" centered closeOnClickOutside={false}>

      <Group mb="md" justify="space-between">
        <Group>
          <DateInput label="Data" value={selectedDate} onChange={(d) => d && setSelectedDate(d)}
            valueFormat="DD/MM/YYYY" className="w-40" leftSection={<IconCalendar size={16} />} />
        </Group>
        <Group>
          {selectedSlotStart && selectedSlotEnd && (
            <Alert icon={<IconCheck size={16} />} color="green" variant="light" py={4}>
              <Text size="sm">
                Selecionado: <strong>{grade.find((d: any) => d.docaId === selectedDoca)?.descricao}</strong> — {selectedSlotStart} a {selectedSlotEnd}
              </Text>
            </Alert>
          )}
          <Button leftSection={<IconCheck size={16} />} onClick={() => criarAgenda.mutate()}
            loading={criarAgenda.isPending} disabled={!selectedSlotStart || !selectedSlotEnd}>
            Confirmar Agendamento
          </Button>
        </Group>
      </Group>

      {/* Legenda */}
      <Group gap="md" mb="sm">
        <Group gap={4}><div style={{ width: 16, height: 16, borderRadius: 2, background: '#e9ecef', border: '1px solid #dee2e6' }} /><Text size="xs">Livre</Text></Group>
        <Group gap={4}><div style={{ width: 16, height: 16, borderRadius: 2, background: '#228be6' }} /><Text size="xs">Agendado</Text></Group>
        <Group gap={4}><div style={{ width: 16, height: 16, borderRadius: 2, background: '#fd7e14' }} /><Text size="xs">Espera</Text></Group>
        <Group gap={4}><div style={{ width: 16, height: 16, borderRadius: 2, background: '#be4bdb' }} /><Text size="xs">Na Doca</Text></Group>
        <Group gap={4}><div style={{ width: 16, height: 16, borderRadius: 2, background: '#40c057' }} /><Text size="xs">Recebido</Text></Group>
        <Group gap={4}><div style={{ width: 16, height: 16, borderRadius: 2, background: '#339af0', border: '2px solid #1971c2' }} /><Text size="xs">Selecionado</Text></Group>
      </Group>

      {/* Grade de horários */}
      <ScrollArea>
        <div style={{ minWidth: grade.length * 90 + 70, overflowX: 'auto' }}>
          {/* Header: horários */}
          <div style={{ display: 'flex', borderBottom: '2px solid #dee2e6', paddingBottom: 4, marginBottom: 4 }}>
            <div style={{ width: 120, minWidth: 120, fontWeight: 600, fontSize: 11, padding: '4px 8px' }}>Doca</div>
            {slots.map((slot: string) => (
              <div key={slot} style={{ width: 46, minWidth: 46, textAlign: 'center', fontSize: 9, fontWeight: 500, color: '#868e96' }}>
                {slot}
              </div>
            ))}
          </div>

          {/* Rows: docas */}
          {grade.map((doca: any) => (
            <div key={doca.docaId} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #f1f3f5', paddingBottom: 2, marginBottom: 2 }}>
              <div style={{ width: 120, minWidth: 120, fontSize: 11, fontWeight: 600, padding: '4px 8px' }}>
                {doca.descricao}
                <Text size="xs" c="dimmed">{doca.tipo}</Text>
              </div>
              {doca.slots.map((slot: any) => {
                const selected = isSlotSelected(doca.docaId, slot.horario)
                const bgColor = selected ? '#339af0' :
                  slot.ocupado ? (statusColors[slot.status] || '#868e96') : '#e9ecef'
                const border = selected ? '2px solid #1971c2' : slot.ocupado ? 'none' : '1px solid #dee2e6'

                return (
                  <Tooltip key={slot.horario} label={
                    slot.ocupado
                      ? `${slot.horario} — ${slot.status} | ${slot.fornecedor || ''} ${slot.placa ? `(${slot.placa})` : ''}`
                      : `${slot.horario} — Livre (clique para selecionar)`
                  } withArrow>
                    <div
                      onClick={() => handleSlotClick(doca.docaId, slot.horario, slot.ocupado)}
                      style={{
                        width: 44, minWidth: 44, height: 32,
                        background: bgColor, border,
                        borderRadius: 2, cursor: slot.ocupado ? 'not-allowed' : 'pointer',
                        margin: '0 1px',
                        transition: 'all 0.1s',
                      }}
                      onMouseEnter={(e) => { if (!slot.ocupado) e.currentTarget.style.opacity = '0.7' }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                    />
                  </Tooltip>
                )
              })}
            </div>
          ))}
        </div>
      </ScrollArea>

      {grade.length === 0 && !isLoading && (
        <Text c="dimmed" className="text-center py-8">Nenhuma doca cadastrada</Text>
      )}

      <Text size="xs" c="dimmed" mt="md">
        Clique em um slot livre para iniciar a seleção, depois clique no slot final para definir o intervalo.
        Slots de 30 minutos, das 06:00 às 22:00.
      </Text>
    </Modal>
  )
}
