'use client'

import { useEffect } from 'react'
import {
  Card, Group, Text, SimpleGrid, ThemeIcon, Badge, Table,
  LoadingOverlay, Button, Stack,
} from '@mantine/core'
import {
  IconChartLine, IconCategory, IconTransfer, IconAlertTriangle,
  IconArrowRight,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import Link from 'next/link'

export default function DemandaDashboardPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Demanda / Slotting' }, [])

  const { data: dashboard, isLoading } = useQuery<any>({
    queryKey: ['demanda-dashboard'],
    queryFn: async () => { const { data } = await api.get('/demanda/dashboard'); return data },
    refetchInterval: 30000,
  })

  const stats = dashboard?.data || dashboard || {}

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Demanda / Slotting</Text>
      <Text size="xl" fw={600} mb="lg">Demanda & Slotting</Text>

      <LoadingOverlay visible={isLoading} />

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="xl">
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Previsões Ativas</Text>
              <Text size="xl" fw={700}>{stats.previsoesAtivas || 0}</Text>
            </div>
            <ThemeIcon color="blue" variant="light" size={48} radius="md">
              <IconChartLine size={24} />
            </ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Produtos A/B/C</Text>
              <Group gap={4}>
                <Badge color="green" size="sm">A: {stats.produtosA || 0}</Badge>
                <Badge color="yellow" size="sm">B: {stats.produtosB || 0}</Badge>
                <Badge color="red" size="sm">C: {stats.produtosC || 0}</Badge>
              </Group>
            </div>
            <ThemeIcon color="grape" variant="light" size={48} radius="md">
              <IconCategory size={24} />
            </ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Sugestões Pendentes</Text>
              <Text size="xl" fw={700} c="orange">{stats.sugestoesPendentes || 0}</Text>
            </div>
            <ThemeIcon color="orange" variant="light" size={48} radius="md">
              <IconTransfer size={24} />
            </ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Produtos Críticos</Text>
              <Text size="xl" fw={700} c="red">{stats.produtosCriticos || 0}</Text>
            </div>
            <ThemeIcon color="red" variant="light" size={48} radius="md">
              <IconAlertTriangle size={24} />
            </ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Links sub-páginas */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="xl">
        <Button component={Link} href="/wms/demanda/abc" variant="light" rightSection={<IconArrowRight size={16} />}>
          Classificação ABC
        </Button>
        <Button component={Link} href="/wms/demanda/slotting" variant="light" rightSection={<IconArrowRight size={16} />}>
          Sugestões Slotting
        </Button>
        <Button component={Link} href="/wms/demanda/previsoes" variant="light" rightSection={<IconArrowRight size={16} />}>
          Previsões
        </Button>
        <Button component={Link} href="/wms/demanda/simulacao" variant="light" rightSection={<IconArrowRight size={16} />}>
          Simulação What-If
        </Button>
      </SimpleGrid>

      {/* Mini tabela produtos críticos */}
      <Card withBorder>
        <Group justify="space-between" mb="sm">
          <Text fw={500}>Produtos Críticos</Text>
          <Button component={Link} href="/wms/demanda/previsoes" variant="subtle" size="xs">
            Ver todos
          </Button>
        </Group>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Classificação</Table.Th>
              <Table.Th>Estoque Atual</Table.Th>
              <Table.Th>Demanda Prevista</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(stats.produtosCriticosList || []).slice(0, 5).map((p: any) => (
              <Table.Tr key={p.produtoId || p.sku}>
                <Table.Td>{p.nome || p.sku}</Table.Td>
                <Table.Td>
                  <Badge color={p.classificacao === 'A' ? 'green' : p.classificacao === 'B' ? 'yellow' : 'red'}>
                    {p.classificacao}
                  </Badge>
                </Table.Td>
                <Table.Td>{p.estoqueAtual}</Table.Td>
                <Table.Td>{p.demandaPrevista}</Table.Td>
                <Table.Td>
                  <Badge color="red" variant="light">Crítico</Badge>
                </Table.Td>
              </Table.Tr>
            ))}
            {(!stats.produtosCriticosList || stats.produtosCriticosList.length === 0) && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="sm">Nenhum produto crítico no momento</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
