'use client'

import { useEffect } from 'react'
import {
  Card, Group, Text, SimpleGrid, Badge, Table, Button,
  LoadingOverlay, ThemeIcon, Stack,
} from '@mantine/core'
import {
  IconTrophy, IconAlertTriangle, IconChartBar,
  IconMedal, IconArrowRight,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import Link from 'next/link'

const FAIXA_COLORS: Record<string, string> = {
  EXCELENTE: 'green',
  BOM: 'blue',
  REGULAR: 'yellow',
  ABAIXO: 'orange',
  CRITICO: 'red',
}

export default function LmsDashboardPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - LMS' }, [])

  const { data: dashboard, isLoading } = useQuery<any>({
    queryKey: ['lms-dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/lms/dashboard')
      return data
    },
    refetchInterval: 30000,
  })

  const produtividadeMedia = dashboard?.produtividadeMedia ?? '—'
  const topPerformers = dashboard?.topPerformers || []
  const totalAlertas = dashboard?.totalAlertasAbertos ?? 0
  const ranking = dashboard?.rankingTop5 || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / LMS</Text>

      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Labor Management System</Text>
        <Group>
          <Button component={Link} href="/wms/lms/ranking" variant="light" size="sm">
            Ranking Completo
          </Button>
          <Button component={Link} href="/wms/lms/metas" variant="light" size="sm">
            Metas
          </Button>
        </Group>
      </Group>

      <Card pos="relative" mb="md">
        <LoadingOverlay visible={isLoading} />
        <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
          <Card withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={500}>Produtividade Média</Text>
              <ThemeIcon variant="light" color="blue" size="sm">
                <IconChartBar size={14} />
              </ThemeIcon>
            </Group>
            <Text size="xl" fw={700}>{produtividadeMedia}%</Text>
          </Card>

          <Card withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={500}>Top 3 Performers</Text>
              <ThemeIcon variant="light" color="green" size="sm">
                <IconTrophy size={14} />
              </ThemeIcon>
            </Group>
            <Stack gap={4}>
              {topPerformers.slice(0, 3).map((p: any, i: number) => (
                <Group key={i} gap="xs">
                  <IconMedal size={14} color={i === 0 ? 'gold' : i === 1 ? 'silver' : '#cd7f32'} />
                  <Text size="sm">{p.operador}</Text>
                  <Text size="xs" c="dimmed">({p.indice}%)</Text>
                </Group>
              ))}
              {topPerformers.length === 0 && (
                <Text size="sm" c="dimmed">Sem dados</Text>
              )}
            </Stack>
          </Card>

          <Card withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={500}>Total Alertas Abertos</Text>
              <ThemeIcon variant="light" color="red" size="sm">
                <IconAlertTriangle size={14} />
              </ThemeIcon>
            </Group>
            <Text size="xl" fw={700}>{totalAlertas}</Text>
          </Card>
        </SimpleGrid>
      </Card>

      {/* Mini Ranking Top 5 */}
      <Card withBorder>
        <Group justify="space-between" mb="sm">
          <Text fw={500}>Ranking Top 5</Text>
          <Button
            component={Link}
            href="/wms/lms/ranking"
            variant="subtle"
            size="xs"
            rightSection={<IconArrowRight size={14} />}
          >
            Ver completo
          </Button>
        </Group>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>Operador</Table.Th>
              <Table.Th>Tarefas</Table.Th>
              <Table.Th>Índice Médio</Table.Th>
              <Table.Th>Faixa</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ranking.map((r: any, i: number) => (
              <Table.Tr key={r.operadorId || i}>
                <Table.Td>{i + 1}</Table.Td>
                <Table.Td>{r.operador}</Table.Td>
                <Table.Td>{r.totalTarefas}</Table.Td>
                <Table.Td>{r.indiceMedio}%</Table.Td>
                <Table.Td>
                  <Badge color={FAIXA_COLORS[r.faixa] || 'gray'} variant="light">
                    {r.faixa}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
            {ranking.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text size="sm" c="dimmed" ta="center" py="sm">Sem dados de ranking</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
