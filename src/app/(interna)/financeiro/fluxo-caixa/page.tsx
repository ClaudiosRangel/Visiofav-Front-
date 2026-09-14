'use client'

import { useEffect, useState } from 'react'
import { Card, Group, Text, Select, Table, Title, Stack, LoadingOverlay, SimpleGrid, Badge } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useQuery } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { financeiroApi, type BucketFluxo, type ResumoAging } from '@/hooks/financeiro/useFinanceiroApi'
import { formatarBRL, formatarData, AGING_LABELS } from '@/lib/financeiro/format'

const GRANULARIDADES = [
  { value: 'DIA', label: 'Diário' },
  { value: 'SEMANA', label: 'Semanal' },
  { value: 'MES', label: 'Mensal' },
]

export default function FluxoCaixaPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - Fluxo de Caixa' }, [])

  const hoje = new Date()
  const [de, setDe] = useState<Date | null>(new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1))
  const [ate, setAte] = useState<Date | null>(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0))
  const [granularidade, setGranularidade] = useState<string | null>('MES')

  const params = { de: (de ?? new Date()).toISOString(), ate: (ate ?? new Date()).toISOString(), granularidade: granularidade ?? 'MES' }

  const { data: fluxo = [], isLoading } = useQuery<BucketFluxo[]>({
    queryKey: ['fin-fluxo', params],
    queryFn: () => financeiroApi.fluxoCaixa(params),
  })

  const { data: aging } = useQuery<ResumoAging>({ queryKey: ['fin-aging'], queryFn: financeiroApi.aging })

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Title order={3}>Fluxo de Caixa</Title>

      <Card withBorder padding="sm">
        <Group>
          <DateInput label="De" value={de} onChange={setDe} valueFormat="DD/MM/YYYY" />
          <DateInput label="Até" value={ate} onChange={setAte} valueFormat="DD/MM/YYYY" />
          <Select label="Granularidade" data={GRANULARIDADES} value={granularidade} onChange={setGranularidade} />
        </Group>
      </Card>

      <Card withBorder padding="sm">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Período</Table.Th>
              <Table.Th ta="right">Saldo inicial</Table.Th>
              <Table.Th ta="right">Entradas</Table.Th>
              <Table.Th ta="right">Saídas</Table.Th>
              <Table.Th ta="right">Saldo final</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {fluxo.map((b, i) => (
              <Table.Tr key={i}>
                <Table.Td>{formatarData(b.inicio)}</Table.Td>
                <Table.Td ta="right">{formatarBRL(b.saldoInicial)}</Table.Td>
                <Table.Td ta="right" c="green">{formatarBRL(b.entradas)}</Table.Td>
                <Table.Td ta="right" c="red">{formatarBRL(b.saidas)}</Table.Td>
                <Table.Td ta="right" fw={600}>{formatarBRL(b.saldoFinal)}</Table.Td>
              </Table.Tr>
            ))}
            {fluxo.length === 0 && !isLoading && (
              <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" ta="center" py="md">Sem movimento no período</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Title order={4}>Contas a Receber — Aging</Title>
      <SimpleGrid cols={{ base: 2, sm: 5 }}>
        {(['A_VENCER', 'D1_30', 'D31_60', 'D61_90', 'D90_MAIS'] as const).map((faixa) => (
          <Card key={faixa} withBorder padding="sm">
            <Text size="xs" c="dimmed">{AGING_LABELS[faixa]}</Text>
            <Text fw={600}>{formatarBRL(aging?.[faixa] ?? 0)}</Text>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  )
}
