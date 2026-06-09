'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card, Group, Text, Button, Select, Table, Badge,
  LoadingOverlay, Stack, ThemeIcon, Paper,
} from '@mantine/core'
import {
  IconPlayerPlay, IconPlayerStop, IconClock,
  IconCoffee, IconHistory,
} from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { notifications } from '@mantine/notifications'

const TIPOS_PAUSA = [
  { value: 'BANHEIRO', label: 'Banheiro' },
  { value: 'CAFE', label: 'Café' },
  { value: 'ALMOCO', label: 'Almoço' },
  { value: 'REUNIAO', label: 'Reunião' },
  { value: 'DESCANSO', label: 'Descanso' },
  { value: 'OUTRO', label: 'Outro' },
]

function formatDuration(startTime: string): string {
  const start = new Date(startTime).getTime()
  const now = Date.now()
  const diff = Math.floor((now - start) / 1000)
  const mins = Math.floor(diff / 60)
  const secs = diff % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export default function LmsPausasPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - LMS - Pausas' }, [])

  const queryClient = useQueryClient()
  const [tipoPausa, setTipoPausa] = useState('CAFE')
  const [timer, setTimer] = useState<string>('00:00')

  const { data: pausaAtivaResp, isLoading: loadingAtiva } = useQuery<any>({
    queryKey: ['lms-pausa-ativa'],
    queryFn: async () => {
      const { data } = await api.get('/lms/pausas/ativa')
      return data
    },
    refetchInterval: 5000,
  })

  const { data: historicoResp, isLoading: loadingHistorico } = useQuery<any>({
    queryKey: ['lms-pausas-historico'],
    queryFn: async () => {
      const { data } = await api.get('/lms/pausas', { params: { limit: 10 } })
      return data
    },
  })

  const pausaAtiva = pausaAtivaResp?.data || pausaAtivaResp
  const historico = historicoResp?.data || historicoResp || []
  const temPausaAtiva = pausaAtiva && pausaAtiva.id && !pausaAtiva.fimPausa

  // Timer update
  useEffect(() => {
    if (!temPausaAtiva) {
      setTimer('00:00')
      return
    }
    const interval = setInterval(() => {
      setTimer(formatDuration(pausaAtiva.inicioPausa))
    }, 1000)
    return () => clearInterval(interval)
  }, [temPausaAtiva, pausaAtiva?.inicioPausa])

  const iniciarMutation = useMutation({
    mutationFn: async () => {
      await api.post('/lms/pausas/iniciar', { tipoPausa })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lms-pausa-ativa'] })
      queryClient.invalidateQueries({ queryKey: ['lms-pausas-historico'] })
      notifications.show({ title: 'Pausa iniciada', message: `Tipo: ${tipoPausa}`, color: 'blue' })
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Não foi possível iniciar a pausa', color: 'red' })
    },
  })

  const encerrarMutation = useMutation({
    mutationFn: async () => {
      await api.post('/lms/pausas/encerrar')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lms-pausa-ativa'] })
      queryClient.invalidateQueries({ queryKey: ['lms-pausas-historico'] })
      notifications.show({ title: 'Pausa encerrada', message: 'Pausa finalizada com sucesso', color: 'green' })
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Não foi possível encerrar a pausa', color: 'red' })
    },
  })

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / LMS / Pausas</Text>

      <Text size="xl" fw={600} mb="lg">Controle de Pausas</Text>

      {/* Active pause or start button */}
      <Card withBorder mb="lg" pos="relative">
        <LoadingOverlay visible={loadingAtiva} />

        {temPausaAtiva ? (
          <Stack align="center" gap="md" py="xl">
            <ThemeIcon size={60} radius="xl" color="orange" variant="light">
              <IconCoffee size={32} />
            </ThemeIcon>
            <div style={{ textAlign: 'center' }}>
              <Text size="lg" fw={600} c="orange">Pausa em Andamento</Text>
              <Badge variant="light" size="lg" mt="xs">
                {pausaAtiva.tipoPausa}
              </Badge>
            </div>
            <Paper bg="dark.6" px="xl" py="md" radius="md">
              <Text size="2rem" fw={700} ff="monospace" ta="center">
                {timer}
              </Text>
            </Paper>
            <Button
              size="lg"
              color="red"
              leftSection={<IconPlayerStop size={20} />}
              onClick={() => encerrarMutation.mutate()}
              loading={encerrarMutation.isPending}
              fullWidth
              maw={300}
            >
              Encerrar Pausa
            </Button>
          </Stack>
        ) : (
          <Stack align="center" gap="md" py="xl">
            <ThemeIcon size={60} radius="xl" color="blue" variant="light">
              <IconClock size={32} />
            </ThemeIcon>
            <Text size="lg" c="dimmed">Nenhuma pausa ativa</Text>
            <Select
              data={TIPOS_PAUSA}
              value={tipoPausa}
              onChange={(v) => setTipoPausa(v || 'CAFE')}
              w={200}
              label="Tipo de Pausa"
            />
            <Button
              size="lg"
              color="blue"
              leftSection={<IconPlayerPlay size={20} />}
              onClick={() => iniciarMutation.mutate()}
              loading={iniciarMutation.isPending}
              fullWidth
              maw={300}
            >
              Iniciar Pausa
            </Button>
          </Stack>
        )}
      </Card>

      {/* History */}
      <Card withBorder pos="relative">
        <Group gap="xs" mb="sm">
          <IconHistory size={18} />
          <Text fw={500}>Pausas Recentes</Text>
        </Group>
        <LoadingOverlay visible={loadingHistorico} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Início</Table.Th>
              <Table.Th>Fim</Table.Th>
              <Table.Th>Duração (min)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(Array.isArray(historico) ? historico : []).map((p: any, i: number) => (
              <Table.Tr key={p.id || i}>
                <Table.Td>
                  <Badge variant="light">{p.tipoPausa}</Badge>
                </Table.Td>
                <Table.Td>
                  {p.inicioPausa
                    ? new Date(p.inicioPausa).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })
                    : '—'}
                </Table.Td>
                <Table.Td>
                  {p.fimPausa
                    ? new Date(p.fimPausa).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })
                    : <Badge color="orange" size="xs">Em andamento</Badge>}
                </Table.Td>
                <Table.Td>{p.duracaoMinutos ?? '—'}</Table.Td>
              </Table.Tr>
            ))}
            {historico.length === 0 && !loadingHistorico && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text size="sm" c="dimmed" ta="center" py="sm">Nenhuma pausa registrada</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
