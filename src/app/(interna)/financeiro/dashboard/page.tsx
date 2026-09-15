'use client'

import { useEffect } from 'react'
import { Card, Group, Text, Title, Stack, SimpleGrid, LoadingOverlay, Table, Badge } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { financeiroApi, type DashboardFinanceiro } from '@/hooks/financeiro/useFinanceiroApi'
import { formatarBRL, formatarData } from '@/lib/financeiro/format'

function CardKpi({ titulo, valor, cor, sub }: { titulo: string; valor: string; cor?: string; sub?: string }) {
  return (
    <Card withBorder padding="md">
      <Text size="xs" c="dimmed">{titulo}</Text>
      <Text fw={700} size="xl" c={cor}>{valor}</Text>
      {sub && <Text size="xs" c="dimmed">{sub}</Text>}
    </Card>
  )
}

export default function DashboardFinanceiroPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - Dashboard' }, [])

  const { data, isLoading } = useQuery<DashboardFinanceiro>({ queryKey: ['fin-dashboard'], queryFn: financeiroApi.dashboard })

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Title order={3}>Dashboard Financeiro</Title>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <CardKpi titulo="Saldo em contas" valor={formatarBRL(data?.saldoTotal ?? 0)} cor="blue" />
        <CardKpi titulo="A receber (vencido)" valor={formatarBRL(data?.receber.vencido.valor ?? 0)} cor="red" sub={`${data?.receber.vencido.qtd ?? 0} título(s)`} />
        <CardKpi titulo="A pagar (vencido)" valor={formatarBRL(data?.pagar.vencido.valor ?? 0)} cor="orange" sub={`${data?.pagar.vencido.qtd ?? 0} título(s)`} />
        <CardKpi titulo="Resultado do mês" valor={formatarBRL(data?.resultadoMes.resultado ?? 0)} cor={(data?.resultadoMes.resultado ?? 0) >= 0 ? 'green' : 'red'} sub={`Rec ${formatarBRL(data?.resultadoMes.receitas ?? 0)} · Desp ${formatarBRL(data?.resultadoMes.despesas ?? 0)}`} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        <CardKpi titulo="A receber hoje" valor={formatarBRL(data?.receber.hoje.valor ?? 0)} sub={`${data?.receber.hoje.qtd ?? 0} título(s)`} />
        <CardKpi titulo="A receber a vencer" valor={formatarBRL(data?.receber.aVencer.valor ?? 0)} sub={`${data?.receber.aVencer.qtd ?? 0} título(s)`} />
        <CardKpi titulo="A pagar hoje" valor={formatarBRL(data?.pagar.hoje.valor ?? 0)} sub={`${data?.pagar.hoje.qtd ?? 0} título(s)`} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Card withBorder padding="sm">
          <Text fw={600} mb="sm">Fluxo de caixa projetado (3 meses)</Text>
          <Table>
            <Table.Thead><Table.Tr><Table.Th>Período</Table.Th><Table.Th ta="right">Entradas</Table.Th><Table.Th ta="right">Saídas</Table.Th><Table.Th ta="right">Saldo final</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {(data?.fluxoResumo ?? []).map((b, i) => (
                <Table.Tr key={i}>
                  <Table.Td>{formatarData(b.inicio)}</Table.Td>
                  <Table.Td ta="right" c="green">{formatarBRL(b.entradas)}</Table.Td>
                  <Table.Td ta="right" c="red">{formatarBRL(b.saidas)}</Table.Td>
                  <Table.Td ta="right" fw={600}>{formatarBRL(b.saldoFinal)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>

        <Card withBorder padding="sm">
          <Text fw={600} mb="sm">Maiores devedores</Text>
          <Table>
            <Table.Thead><Table.Tr><Table.Th>Cliente</Table.Th><Table.Th ta="right">Vencido</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {(data?.topDevedores ?? []).map((d, i) => (
                <Table.Tr key={i}><Table.Td>{d.nome}</Table.Td><Table.Td ta="right" c="red">{formatarBRL(d.total)}</Table.Td></Table.Tr>
              ))}
              {(data?.topDevedores?.length ?? 0) === 0 && <Table.Tr><Table.Td colSpan={2}><Text c="dimmed" ta="center" py="sm">Sem inadimplência</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        </Card>
      </SimpleGrid>
    </Stack>
  )
}
