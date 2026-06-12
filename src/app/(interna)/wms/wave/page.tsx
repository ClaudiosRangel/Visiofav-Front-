'use client'

import { useEffect } from 'react'
import {
  Card, Group, Text, SimpleGrid, Badge, Progress, LoadingOverlay, ThemeIcon,
} from '@mantine/core'
import { IconWaveSine, IconClock, IconCheck, IconTruck } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

export default function WaveDashboardPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Wave Planning' }, [])

  const { data: response, isLoading } = useQuery<any>({
    queryKey: ['wave-dashboard'],
    queryFn: async () => { const { data } = await api.get('/wave/dashboard'); return data },
    refetchInterval: 30000,
  })

  const stats = response || {}
  const ondas = stats.ondasHoje || []

  function getProgressColor(percentual: number) {
    if (percentual >= 100) return 'green'
    if (percentual >= 50) return 'blue'
    if (percentual >= 25) return 'orange'
    return 'gray'
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'CONCLUIDA': return 'green'
      case 'EM_ANDAMENTO': return 'blue'
      case 'PENDENTE': return 'orange'
      case 'CANCELADA': return 'red'
      default: return 'gray'
    }
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Wave Planning</Text>
      <Text size="xl" fw={600} mb="lg">Wave Planning - Hoje</Text>

      <LoadingOverlay visible={isLoading} />

      {/* Resumo */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="xl">
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total Ondas</Text>
              <Text size="xl" fw={700}>{stats.totalOndas || 0}</Text>
            </div>
            <ThemeIcon color="blue" variant="light" size={48} radius="md"><IconWaveSine size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Em Andamento</Text>
              <Text size="xl" fw={700} c="orange">{stats.emAndamento || 0}</Text>
            </div>
            <ThemeIcon color="orange" variant="light" size={48} radius="md"><IconClock size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Concluídas</Text>
              <Text size="xl" fw={700} c="green">{stats.concluidas || 0}</Text>
            </div>
            <ThemeIcon color="green" variant="light" size={48} radius="md"><IconCheck size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Pedidos</Text>
              <Text size="xl" fw={700}>{stats.totalPedidos || 0}</Text>
            </div>
            <ThemeIcon color="grape" variant="light" size={48} radius="md"><IconTruck size={24} /></ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Ondas com Progress */}
      <Text fw={600} mb="sm">Ondas de Hoje</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} mb="xl">
        {ondas.map((onda: any) => (
          <Card key={onda.id} withBorder>
            <Group justify="space-between" mb="xs">
              <Group gap="sm">
                <Text fw={600}>Onda #{onda.numero}</Text>
                <Badge color={getStatusColor(onda.status)} variant="light" size="sm">{onda.status}</Badge>
              </Group>
              <Text size="xs" c="dimmed">{onda.pedidos || 0} pedidos</Text>
            </Group>
            <Progress
              value={onda.percentual || 0}
              color={getProgressColor(onda.percentual || 0)}
              size="lg"
              radius="md"
              mb="xs"
            />
            <Group justify="space-between">
              <Text size="xs" c="dimmed">{onda.percentual || 0}% concluído</Text>
              <Text size="xs" c="dimmed">{onda.itens || 0} itens</Text>
            </Group>
          </Card>
        ))}
        {ondas.length === 0 && (
          <Card withBorder><Text c="dimmed" ta="center" py="lg">Nenhuma onda planejada para hoje</Text></Card>
        )}
      </SimpleGrid>

      {/* Timeline Visual */}
      <Text fw={600} mb="sm">Timeline</Text>
      <Card>
        {ondas.length === 0 && (
          <Text c="dimmed" ta="center" py="lg">Sem ondas para exibir timeline</Text>
        )}
        <div className="space-y-3">
          {ondas.map((onda: any) => {
            const inicio = onda.horaInicio || '00:00'
            const fim = onda.horaFimEstimada || '23:59'
            // Parse times for visual positioning (0-24h range)
            const [hI, mI] = inicio.split(':').map(Number)
            const [hF, mF] = fim.split(':').map(Number)
            const startMin = hI * 60 + (mI || 0)
            const endMin = hF * 60 + (mF || 0)
            const dayMin = 24 * 60
            const leftPct = Math.max(0, (startMin / dayMin) * 100)
            const widthPct = Math.max(5, ((endMin - startMin) / dayMin) * 100)

            return (
              <div key={onda.id} className="flex items-center gap-3">
                <Text size="xs" fw={500} className="w-20 text-right shrink-0">Onda #{onda.numero}</Text>
                <div className="flex-1 relative h-7 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="absolute top-0 h-full rounded flex items-center justify-center"
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      backgroundColor: onda.status === 'CONCLUIDA' ? '#40c057' : onda.status === 'EM_ANDAMENTO' ? '#228be6' : '#fab005',
                    }}
                  >
                    <Text size="xs" fw={500} c="white">{inicio} → {fim}</Text>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {ondas.length > 0 && (
          <Group justify="space-between" mt="xs">
            <Text size="xs" c="dimmed">06:00</Text>
            <Text size="xs" c="dimmed">12:00</Text>
            <Text size="xs" c="dimmed">18:00</Text>
            <Text size="xs" c="dimmed">23:59</Text>
          </Group>
        )}
      </Card>
    </div>
  )
}
