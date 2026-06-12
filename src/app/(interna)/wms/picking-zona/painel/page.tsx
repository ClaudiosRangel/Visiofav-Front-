'use client'

import { useEffect } from 'react'
import {
  Card, Group, Text, SimpleGrid, Progress, Badge, Stack,
  LoadingOverlay, ColorSwatch,
} from '@mantine/core'
import { IconClock, IconCheck, IconRefresh } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

interface ZonaProgresso {
  zonaId: string
  zonaNome: string
  zonaCor: string
  totalItens: number
  itensConcluidos: number
  percentualConcluido: number
  tempoMedio: number // em minutos
  tempoEstimadoRestante: number // em minutos
}

export default function PainelPickingZonaPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Painel Picking por Zona' }, [])

  const { data: progressos = [], isLoading, dataUpdatedAt } = useQuery<ZonaProgresso[]>({
    queryKey: ['picking-zona', 'painel'],
    queryFn: async () => {
      const { data } = await api.get('/picking-zona/painel')
      return Array.isArray(data) ? data : (data?.data || [])
    },
    refetchInterval: 30000,
  })

  function formatMinutes(min: number): string {
    if (!min || isNaN(min) || min <= 0) return '0 min'
    if (min < 1) return '< 1 min'
    if (min < 60) return `${Math.round(min)} min`
    const h = Math.floor(min / 60)
    const m = Math.round(min % 60)
    return `${h}h ${m}min`
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Separação / Picking por Zona / Painel</Text>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Painel de Progresso</Text>
        <Group gap="xs">
          <IconRefresh size={14} className="text-zinc-400" />
          <Text size="xs" c="dimmed">
            Atualização automática a cada 30s
            {dataUpdatedAt ? ` • Última: ${new Date(dataUpdatedAt).toLocaleTimeString('pt-BR')}` : ''}
          </Text>
        </Group>
      </Group>

      <LoadingOverlay visible={isLoading} />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {progressos.map((prog) => (
          <Card key={prog.zonaId} withBorder shadow="sm" padding="lg">
            <Group justify="space-between" mb="md">
              <Group gap="sm">
                <ColorSwatch color={prog.zonaCor} size={18} />
                <Text fw={600} size="lg">{prog.zonaNome}</Text>
              </Group>
              <Badge color={prog.zonaCor} variant="light" size="lg">
                {prog.percentualConcluido}%
              </Badge>
            </Group>

            <Progress
              value={prog.percentualConcluido}
              color={prog.zonaCor}
              size="lg"
              radius="md"
              mb="md"
              animated={prog.percentualConcluido < 100}
            />

            <Stack gap="xs">
              <Group justify="space-between">
                <Group gap={4}>
                  <IconCheck size={14} className="text-green-500" />
                  <Text size="sm" c="dimmed">Concluídos</Text>
                </Group>
                <Text size="sm" fw={500}>
                  {prog.itensConcluidos} / {prog.totalItens}
                </Text>
              </Group>

              <Group justify="space-between">
                <Group gap={4}>
                  <IconClock size={14} className="text-blue-500" />
                  <Text size="sm" c="dimmed">Tempo médio</Text>
                </Group>
                <Text size="sm" fw={500}>
                  {formatMinutes(prog.tempoMedio)}
                </Text>
              </Group>

              <Group justify="space-between">
                <Group gap={4}>
                  <IconClock size={14} className="text-orange-500" />
                  <Text size="sm" c="dimmed">Estimado restante</Text>
                </Group>
                <Text size="sm" fw={500}>
                  {prog.percentualConcluido >= 100
                    ? 'Concluído'
                    : formatMinutes(prog.tempoEstimadoRestante)}
                </Text>
              </Group>
            </Stack>
          </Card>
        ))}

        {progressos.length === 0 && !isLoading && (
          <Card withBorder>
            <Text c="dimmed" ta="center" py="xl">
              Nenhuma zona com picking ativo no momento
            </Text>
          </Card>
        )}
      </SimpleGrid>
    </div>
  )
}
