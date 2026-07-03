'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, SimpleGrid, Tabs, Table, Badge, Select,
  LoadingOverlay, Paper,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconChartBar, IconUsers, IconShoppingCart, IconTrendingUp } from '@tabler/icons-react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import {
  useResumoVendas, useVendasPorPeriodo, useVendasPorVendedor,
  useVendasPorCliente, useCurvaABC,
} from '@/data/hooks/vendas/useRelatoriosVendas'

function formatCurrency(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function RelatoriosVendasPage() {
  useModuloGuard('VENDAS')
  useEffect(() => { document.title = 'Vizor - Vendas - Relatórios' }, [])

  const [dataInicio, setDataInicio] = useState<Date | null>(null)
  const [dataFim, setDataFim] = useState<Date | null>(null)
  const [agrupamento, setAgrupamento] = useState<string | null>('mes')

  const filtros = {
    dataInicio: dataInicio ? dataInicio.toISOString().split('T')[0] : undefined,
    dataFim: dataFim ? dataFim.toISOString().split('T')[0] : undefined,
  }

  const { data: resumo, isLoading: loadResumo } = useResumoVendas(filtros)
  const { data: porPeriodo, isLoading: loadPeriodo } = useVendasPorPeriodo({ ...filtros, agrupamento: agrupamento || 'mes' })
  const { data: porVendedor, isLoading: loadVendedor } = useVendasPorVendedor(filtros)
  const { data: porCliente, isLoading: loadCliente } = useVendasPorCliente({ ...filtros, top: 10 })
  const { data: curvaAbc, isLoading: loadAbc } = useCurvaABC(filtros)

  const abcColors = { A: 'green', B: 'yellow', C: 'red' }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / Relatórios</Text>
      <Text size="xl" fw={600} mb="lg">Relatórios de Vendas</Text>

      {/* Filtro de período */}
      <Card withBorder mb="md" p="sm">
        <Group>
          <DateInput label="De" placeholder="Data início" value={dataInicio} onChange={setDataInicio} clearable valueFormat="DD/MM/YYYY" />
          <DateInput label="Até" placeholder="Data fim" value={dataFim} onChange={setDataFim} clearable valueFormat="DD/MM/YYYY" />
        </Group>
      </Card>

      {/* KPIs */}
      <SimpleGrid cols={{ base: 2, sm: 5 }} mb="md">
        <Paper withBorder p="md" radius="md">
          <Text size="xs" c="dimmed">Total Pedidos</Text>
          <Text fw={700} size="xl">{resumo?.totalPedidos || 0}</Text>
        </Paper>
        <Paper withBorder p="md" radius="md">
          <Text size="xs" c="dimmed">Faturamento Total</Text>
          <Text fw={700} size="xl" c="blue">{formatCurrency(resumo?.faturamentoTotal || 0)}</Text>
        </Paper>
        <Paper withBorder p="md" radius="md">
          <Text size="xs" c="dimmed">Ticket Médio</Text>
          <Text fw={700} size="xl">{formatCurrency(resumo?.ticketMedio || 0)}</Text>
        </Paper>
        <Paper withBorder p="md" radius="md">
          <Text size="xs" c="dimmed">Cancelados</Text>
          <Text fw={700} size="xl" c="red">{resumo?.pedidosCancelados || 0}</Text>
        </Paper>
        <Paper withBorder p="md" radius="md">
          <Text size="xs" c="dimmed">Taxa Cancelamento</Text>
          <Text fw={700} size="xl">{resumo?.taxaCancelamento || 0}%</Text>
        </Paper>
      </SimpleGrid>

      {/* Tabs detalhados */}
      <Card withBorder p={0}>
        <Tabs defaultValue="periodo">
          <Tabs.List>
            <Tabs.Tab value="periodo" leftSection={<IconChartBar size={16} />}>Por Período</Tabs.Tab>
            <Tabs.Tab value="vendedor" leftSection={<IconUsers size={16} />}>Por Vendedor</Tabs.Tab>
            <Tabs.Tab value="cliente" leftSection={<IconShoppingCart size={16} />}>Top Clientes</Tabs.Tab>
            <Tabs.Tab value="curva-abc" leftSection={<IconTrendingUp size={16} />}>Curva ABC</Tabs.Tab>
          </Tabs.List>

          <div style={{ padding: 16 }}>
            {/* Por Período */}
            <Tabs.Panel value="periodo">
              <Group mb="sm">
                <Select data={[{ value: 'dia', label: 'Diário' }, { value: 'semana', label: 'Semanal' }, { value: 'mes', label: 'Mensal' }]} value={agrupamento} onChange={setAgrupamento} style={{ width: 140 }} />
              </Group>
              <LoadingOverlay visible={loadPeriodo} />
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Período</Table.Th>
                    <Table.Th>Qtd Vendas</Table.Th>
                    <Table.Th>Total</Table.Th>
                    <Table.Th>Ticket Médio</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(porPeriodo || []).map((row) => (
                    <Table.Tr key={row.periodo}>
                      <Table.Td>{row.periodo}</Table.Td>
                      <Table.Td>{row.quantidade}</Table.Td>
                      <Table.Td fw={500}>{formatCurrency(row.total)}</Table.Td>
                      <Table.Td>{formatCurrency(row.ticketMedio)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>

            {/* Por Vendedor */}
            <Tabs.Panel value="vendedor">
              <LoadingOverlay visible={loadVendedor} />
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>#</Table.Th>
                    <Table.Th>Vendedor</Table.Th>
                    <Table.Th>Qtd Pedidos</Table.Th>
                    <Table.Th>Total Vendas</Table.Th>
                    <Table.Th>Ticket Médio</Table.Th>
                    <Table.Th>Comissão Estimada</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(porVendedor || []).map((v, idx) => (
                    <Table.Tr key={v.vendedorId}>
                      <Table.Td>{idx + 1}</Table.Td>
                      <Table.Td fw={500}>{v.nome}</Table.Td>
                      <Table.Td>{v.quantidadePedidos}</Table.Td>
                      <Table.Td fw={500}>{formatCurrency(v.totalVendas)}</Table.Td>
                      <Table.Td>{formatCurrency(v.ticketMedio)}</Table.Td>
                      <Table.Td c="teal">{formatCurrency(v.comissaoEstimada)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>

            {/* Top Clientes */}
            <Tabs.Panel value="cliente">
              <LoadingOverlay visible={loadCliente} />
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>#</Table.Th>
                    <Table.Th>Cliente</Table.Th>
                    <Table.Th>Qtd Pedidos</Table.Th>
                    <Table.Th>Total Compras</Table.Th>
                    <Table.Th>Ticket Médio</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(porCliente || []).map((c, idx) => (
                    <Table.Tr key={c.clienteId}>
                      <Table.Td>{idx + 1}</Table.Td>
                      <Table.Td fw={500}>{c.nome}</Table.Td>
                      <Table.Td>{c.quantidadePedidos}</Table.Td>
                      <Table.Td fw={500}>{formatCurrency(c.totalCompras)}</Table.Td>
                      <Table.Td>{formatCurrency(c.ticketMedio)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>

            {/* Curva ABC */}
            <Tabs.Panel value="curva-abc">
              <LoadingOverlay visible={loadAbc} />
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Classe</Table.Th>
                    <Table.Th>Código</Table.Th>
                    <Table.Th>Produto</Table.Th>
                    <Table.Th>Faturamento</Table.Th>
                    <Table.Th>% Fat.</Table.Th>
                    <Table.Th>% Acumulado</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(curvaAbc || []).slice(0, 50).map((p) => (
                    <Table.Tr key={p.produtoId}>
                      <Table.Td>
                        <Badge color={abcColors[p.classificacao]} size="sm">{p.classificacao}</Badge>
                      </Table.Td>
                      <Table.Td>{p.codigo}</Table.Td>
                      <Table.Td fw={500}>{p.nome}</Table.Td>
                      <Table.Td>{formatCurrency(p.faturamento)}</Table.Td>
                      <Table.Td>{p.percentualFaturamento}%</Table.Td>
                      <Table.Td>{p.percentualAcumulado}%</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>
          </div>
        </Tabs>
      </Card>
    </div>
  )
}
