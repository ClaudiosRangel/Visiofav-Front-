'use client'

import { useEffect } from 'react'
import {
  Card, Group, Text, SimpleGrid, Badge, Progress, LoadingOverlay, ThemeIcon, Alert,
} from '@mantine/core'
import { IconWaveSine, IconClock, IconAlertTriangle, IconRefresh } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

export default function WaveMonitoramentoPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Wave Monitoramento' }, [])

  const { data: response, isLoading, dataUpdatedAt } = useQuery<any>({
    queryKey: ['wave-monitoramento'],
    queryFn: async () => { const { data } = await api.get('/wave/monitoramento'); return data },
    refetchInterval: 30000,
  })

  const ondas = response?.ondas || []
  const emAtraso = ondas.filter((o: any) => o.emAtraso)

  function getProgressColor(percentual: number, emAtraso: boolean) {
    if (emAtraso) return 'red'
    if (percentual >= 100) return 'green'
    if (percentual >= 50) return 'blue'
    return 'orange'
  }

  function formatTempo(minutos: number | undefined) {
    if (!minutos && minutos !== 0) return '—'
    const h = Math.floor(minutos / 60)
    const m = minutos % 60
    if (h > 0) return `${h}h ${m}min`
    return `${m}min`
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Wave Planning / Monitoramento</Text>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Monitoramento em Tempo Real</Text>
        <Group gap="sm">
          <IconRefresh size={14} className="text-gray-400" />
          <Text size="xs" c="dimmed">
            Atualizado: {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('pt-BR') : '—'}
          </Text>
          <Badge variant="light" color="blue" size="sm">Auto-refresh 30s</Badge>
        </Group>
      </Group>

      <LoadingOverlay visible={isLoading} />

      {emAtraso.length > 0 && (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light" mb="md">
          {emAtraso.length} onda(s) em atraso! Atenção para as ondas marcadas em vermelho.
        </Alert>
      )}

      {ondas.length === 0 && !isLoading && (
        <Card withBorder>
          <Text c="dimmed" ta="center" py="xl">Nenhuma onda ativa no momento</Text>
        </Card>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        {ondas.map((onda: any) => (
          <Card key={onda.id} withBorder style={{ borderColor: onda.emAtraso ? '#fa5252' : undefined }}>
            <Group justify="space-between" mb="xs">
              <Group gap="sm">
                <ThemeIcon
                  color={onda.emAtraso ? 'red' : 'blue'}
                  variant="light"
                  size={32}
                  radius="md"
                >
                  <IconWaveSine size={18} />
                </ThemeIcon>
                <div>
                  <Text fw={600}>Onda #{onda.numero}</Text>
                  <Text size="xs" c="dimmed">{onda.doca || '—'} • {onda.rota || '—'}</Text>
                </div>
              </Group>
              <div className="text-right">
                <Badge color={onda.emAtraso ? 'red' : 'blue'} variant="light">
                  {onda.status || 'EM_ANDAMENTO'}
                </Badge>
                {onda.emAtraso && (
                  <Group gap={4} mt={4} justify="flex-end">
                    <IconAlertTriangle size={12} className="text-red-500" />
                    <Text size="xs" c="red" fw={500}>EM ATRASO</Text>
                  </Group>
                )}
              </div>
            </Group>

            <Progress
              value={onda.percentual || 0}
              color={getProgressColor(onda.percentual || 0, onda.emAtraso)}
              size="xl"
              radius="md"
              mb="sm"
            />

            <Group justify="space-between">
              <Text size="sm" fw={500}>{onda.percentual || 0}% concluído</Text>
              <Text size="sm" c="dimmed">{onda.itensFeitos || 0} / {onda.itensTotal || 0} itens</Text>
            </Group>

            <Group justify="space-between" mt="xs">
              <Group gap="xs">
                <IconClock size={14} className="text-gray-400" />
                <Text size="xs" c="dimmed">Tempo: {formatTempo(onda.tempoDecorrido)}</Text>
              </Group>
              <Text size="xs" c="dimmed">
                Estimado: {onda.horaInicio || '—'} → {onda.horaFimEstimada || '—'}
              </Text>
            </Group>

            {/* Detalhes do separador */}
            {onda.separadores && onda.separadores.length > 0 && (
              <Group mt="xs" gap="xs">
                {onda.separadores.map((s: any, i: number) => (
                  <Badge key={i} variant="dot" size="sm">{s.nome || s}</Badge>
                ))}
              </Group>
            )}
          </Card>
        ))}
      </SimpleGrid>
    </div>
  )
}
