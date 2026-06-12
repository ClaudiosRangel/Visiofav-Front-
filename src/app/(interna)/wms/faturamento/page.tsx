'use client'

import { useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, SimpleGrid, ThemeIcon, Stack,
  LoadingOverlay,
} from '@mantine/core'
import {
  IconFileInvoice, IconCash, IconAlertTriangle, IconFileText,
  IconContract, IconChartBar,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  RASCUNHO: 'gray',
  ENVIADA: 'blue',
  PAGA: 'green',
  CANCELADA: 'red',
  ATRASADA: 'orange',
}

export default function FaturamentoDashboardPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Faturamento' }, [])

  const { data: resumo, isLoading } = useQuery<any>({
    queryKey: ['faturamento', 'resumo'],
    queryFn: async () => {
      const { data } = await api.get('/faturamento/resumo')
      return data
    },
  })

  const { data: ultimasFaturas } = useQuery<any>({
    queryKey: ['faturamento', 'faturas', 'ultimas'],
    queryFn: async () => {
      const { data } = await api.get('/faturamento/faturas', { params: { page: 1, limit: 5 } })
      return data
    },
  })

  const totalFaturado = resumo?.totalFaturado ?? 0
  const aReceber = resumo?.aReceber ?? 0
  const inadimplente = resumo?.inadimplente ?? 0
  const faturas = ultimasFaturas?.data || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Faturamento</Text>
      <Text size="xl" fw={600} mb="lg">Faturamento</Text>

      {/* Metric Cards */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="green">
              <IconCash size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Total Faturado</Text>
              <Text size="xl" fw={700}>
                {totalFaturado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            </div>
          </Group>
        </Card>
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="blue">
              <IconFileInvoice size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">A Receber (Enviadas)</Text>
              <Text size="xl" fw={700}>
                {aReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            </div>
          </Group>
        </Card>
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="orange">
              <IconAlertTriangle size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Inadimplente</Text>
              <Text size="xl" fw={700}>
                {inadimplente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Quick Links */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
        <Button
          component={Link}
          href="/wms/faturamento/contratos"
          variant="light"
          leftSection={<IconContract size={18} />}
          fullWidth
          size="md"
        >
          Contratos
        </Button>
        <Button
          component={Link}
          href="/wms/faturamento/faturas"
          variant="light"
          leftSection={<IconFileText size={18} />}
          fullWidth
          size="md"
        >
          Faturas
        </Button>
        <Button
          component={Link}
          href="/wms/faturamento/relatorios"
          variant="light"
          leftSection={<IconChartBar size={18} />}
          fullWidth
          size="md"
        >
          Relatórios
        </Button>
      </SimpleGrid>

      {/* Last 5 Faturas */}
      <Card withBorder pos="relative">
        <Text fw={600} mb="sm">Últimas Faturas</Text>
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Número</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Valor Total</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Emissão</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {faturas.map((f: any) => (
              <Table.Tr key={f.id}>
                <Table.Td className="font-mono">{f.numero}</Table.Td>
                <Table.Td>{f.clienteNome || f.clienteId}</Table.Td>
                <Table.Td>
                  {(f.valorTotal ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color={STATUS_COLORS[f.status] || 'gray'}>
                    {f.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {f.dataEmissao
                    ? new Date(f.dataEmissao).toLocaleDateString('pt-BR')
                    : '—'}
                </Table.Td>
              </Table.Tr>
            ))}
            {faturas.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={5} className="text-center py-8 text-zinc-500">
                  Nenhuma fatura encontrada
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
