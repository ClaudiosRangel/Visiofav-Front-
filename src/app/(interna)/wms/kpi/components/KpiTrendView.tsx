'use client'

import { Table, Text, Progress, Stack, LoadingOverlay, Group } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface KpiTrendViewProps {
  indicador: string
  dias?: number
}

export default function KpiTrendView({ indicador, dias = 7 }: KpiTrendViewProps) {
  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['kpi-historico', indicador, dias],
    queryFn: async () => {
      const { data } = await api.get('/kpi/historico', {
        params: { indicador, dias },
      })
      return data
    },
  })

  const snapshots = resp?.data || resp || []

  // Calculate max for bar scale
  const maxValor = snapshots.length > 0
    ? Math.max(...snapshots.map((s: any) => Number(s.valor) || 0), 1)
    : 1

  if (isLoading) {
    return (
      <div style={{ position: 'relative', minHeight: 100 }}>
        <LoadingOverlay visible />
      </div>
    )
  }

  if (snapshots.length === 0) {
    return (
      <Text size="sm" c="dimmed" py="md" ta="center">
        Nenhum dado histórico disponível para este indicador.
      </Text>
    )
  }

  return (
    <Stack gap="xs">
      {/* Visual bar chart using Mantine Progress */}
      <Stack gap={4}>
        {snapshots.map((snapshot: any, idx: number) => {
          const valor = Number(snapshot.valor) || 0
          const pct = (valor / maxValor) * 100
          return (
            <Group key={snapshot.id || idx} gap="xs" wrap="nowrap">
              <Text size="xs" c="dimmed" w={120} style={{ flexShrink: 0 }}>
                {snapshot.criadoEm
                  ? new Date(snapshot.criadoEm).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })
                  : '—'}
              </Text>
              <Progress
                value={pct}
                color="teal"
                size="lg"
                style={{ flex: 1 }}
                radius="xs"
              />
              <Text size="xs" fw={500} w={60} ta="right" style={{ flexShrink: 0 }}>
                {valor}
              </Text>
            </Group>
          )
        })}
      </Stack>

      {/* Table view of historical snapshots */}
      <Table striped highlightOnHover mt="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Timestamp</Table.Th>
            <Table.Th>Valor</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {snapshots.map((snapshot: any, idx: number) => (
            <Table.Tr key={snapshot.id || idx}>
              <Table.Td>
                {snapshot.criadoEm
                  ? new Date(snapshot.criadoEm).toLocaleString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })
                  : '—'}
              </Table.Td>
              <Table.Td fw={500}>{snapshot.valor}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}
