'use client'

import { useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, SimpleGrid, ThemeIcon,
  LoadingOverlay, Pagination,
} from '@mantine/core'
import {
  IconTruckDelivery, IconAlertTriangle, IconPackage, IconClock,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useState } from 'react'

export default function TransitoPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Estoque em Trânsito' }, [])

  const [page, setPage] = useState(1)
  const limit = 20

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['multi-cd-transito', page],
    queryFn: async () => {
      const { data } = await api.get('/multi-cd/transito', { params: { page, limit } })
      return data
    },
  })

  const items = resp?.data || []
  const total = resp?.total || 0
  const totalPages = Math.ceil(total / limit)
  const resumo = resp?.resumo || {}
  const totalEmTransito = resumo.totalItens ?? 0
  const atrasados = resumo.atrasados ?? 0

  const isOverdue = (dataSaida: string) => {
    if (!dataSaida) return false
    const saida = new Date(dataSaida)
    const agora = new Date()
    const diffHours = (agora.getTime() - saida.getTime()) / (1000 * 60 * 60)
    return diffHours > 48
  }

  const formatDate = (date: string | null) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Multi-CD / Estoque em Trânsito</Text>
      <Text size="xl" fw={600} mb="lg">Estoque em Trânsito</Text>

      {/* Totalizadores */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} mb="md">
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="orange">
              <IconTruckDelivery size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Total em Trânsito</Text>
              <Text size="xl" fw={700}>{totalEmTransito}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="red">
              <IconAlertTriangle size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Atrasados (&gt;48h)</Text>
              <Text size="xl" fw={700} c="red">{atrasados}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="blue">
              <IconPackage size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Solicitações em Trânsito</Text>
              <Text size="xl" fw={700}>{total}</Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Table */}
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Quantidade</Table.Th>
              <Table.Th>Rota</Table.Th>
              <Table.Th>Data Saída</Table.Th>
              <Table.Th>Previsão Chegada</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any, idx: number) => {
              const overdue = isOverdue(item.dataSaida)
              return (
                <Table.Tr key={item.id || idx}>
                  <Table.Td>{item.produto?.nome || item.produtoId}</Table.Td>
                  <Table.Td>{item.quantidade}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Text size="sm">{item.cdOrigem?.nome || item.cdOrigemId}</Text>
                      <Text size="sm" c="dimmed">→</Text>
                      <Text size="sm">{item.cdDestino?.nome || item.cdDestinoId}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>{formatDate(item.dataSaida)}</Table.Td>
                  <Table.Td>{formatDate(item.previsaoChegada)}</Table.Td>
                  <Table.Td>
                    {overdue ? (
                      <Badge variant="filled" color="red" leftSection={<IconAlertTriangle size={12} />}>
                        Atrasado
                      </Badge>
                    ) : (
                      <Badge variant="light" color="orange" leftSection={<IconClock size={12} />}>
                        Em Trânsito
                      </Badge>
                    )}
                  </Table.Td>
                </Table.Tr>
              )
            })}
            {items.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={6} className="text-center py-8 text-zinc-500">
                  Nenhum item em trânsito no momento
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination value={page} onChange={setPage} total={totalPages} />
          </Group>
        )}
      </Card>
    </div>
  )
}
