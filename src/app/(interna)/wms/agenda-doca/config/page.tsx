'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Button, TextInput, NumberInput, Stack, LoadingOverlay,
} from '@mantine/core'
import { IconSettings, IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import Link from 'next/link'

export default function ConfigDocaPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Configuração de Docas' }, [])

  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    horaAberturaOp: '06:00',
    horaFechamentoOp: '22:00',
    bufferMinutos: 15,
    toleranciaAtraso: 30,
  })

  const { data: config, isLoading } = useQuery<any>({
    queryKey: ['config-doca'],
    queryFn: async () => {
      const { data } = await api.get('/agenda-doca/config')
      return data
    },
  })

  useEffect(() => {
    if (config) {
      setForm({
        horaAberturaOp: config.horaAberturaOp || '06:00',
        horaFechamentoOp: config.horaFechamentoOp || '22:00',
        bufferMinutos: config.bufferMinutos ?? 15,
        toleranciaAtraso: config.toleranciaAtraso ?? 30,
      })
    }
  }, [config])

  const salvar = useMutation({
    mutationFn: async () => {
      await api.put('/agenda-doca/config', form)
    },
    onSuccess: () => {
      notifications.show({ title: 'Sucesso', message: 'Configuração salva', color: 'green' })
      queryClient.invalidateQueries({ queryKey: ['config-doca'] })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    },
  })

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Recebimento / Agenda de Docas / Configuração</Text>

      <Group mb="lg">
        <Button component={Link} href="/wms/agenda-doca" variant="subtle" leftSection={<IconArrowLeft size={16} />}>
          Voltar
        </Button>
        <Text size="xl" fw={600}>Configuração de Docas</Text>
      </Group>

      <Card pos="relative" maw={500}>
        <LoadingOverlay visible={isLoading} />
        <Stack gap="md">
          <TextInput
            label="Hora de Abertura da Operação"
            placeholder="HH:MM"
            value={form.horaAberturaOp}
            onChange={(e) => setForm({ ...form, horaAberturaOp: e.currentTarget.value })}
            description="Horário de início das operações nas docas"
          />
          <TextInput
            label="Hora de Fechamento da Operação"
            placeholder="HH:MM"
            value={form.horaFechamentoOp}
            onChange={(e) => setForm({ ...form, horaFechamentoOp: e.currentTarget.value })}
            description="Horário de encerramento das operações nas docas"
          />
          <NumberInput
            label="Buffer entre agendamentos (minutos)"
            value={form.bufferMinutos}
            onChange={(v) => setForm({ ...form, bufferMinutos: typeof v === 'number' ? v : 15 })}
            min={0}
            max={120}
            description="Tempo mínimo entre o fim de um agendamento e o início do próximo"
          />
          <NumberInput
            label="Tolerância de atraso (minutos)"
            value={form.toleranciaAtraso}
            onChange={(v) => setForm({ ...form, toleranciaAtraso: typeof v === 'number' ? v : 30 })}
            min={0}
            max={120}
            description="Tempo antes de marcar o agendamento como atrasado"
          />
          <Group justify="flex-end" mt="md">
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={() => salvar.mutate()}
              loading={salvar.isPending}
            >
              Salvar Configuração
            </Button>
          </Group>
        </Stack>
      </Card>
    </div>
  )
}
