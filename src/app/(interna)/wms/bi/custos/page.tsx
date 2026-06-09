'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, SimpleGrid, LoadingOverlay, Button,
} from '@mantine/core'
import { IconCalendar } from '@tabler/icons-react'
import { DatePickerInput } from '@mantine/dates'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

export default function BiCustosPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Custo por Operação' }, [])

  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(new Date().setDate(new Date().getDate() - 30)),
    new Date(),
  ])

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['bi-custos', dateRange[0]?.toISOString(), dateRange[1]?.toISOString()],
    queryFn: async () => {
      const params: any = {}
      if (dateRange[0]) params.dataInicio = dateRange[0].toISOString().split('T')[0]
      if (dateRange[1]) params.dataFim = dateRange[1].toISOString().split('T')[0]
      const { data } = await api.get('/bi/custos', { params })
      return data
    },
    enabled: !!dateRange[0] && !!dateRange[1],
  })

  const dados = resp?.data || resp || {}
  const operacoes = dados.operacoes || []
  const totais = dados.totais || {}

  function formatCurrency(value: number | undefined) {
    if (value == null) return '—'
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / BI Avançado / Custos</Text>
      <Text size="xl" fw={600} mb="lg">Custo por Operação</Text>

      <Card withBorder mb="md">
        <Group>
          <DatePickerInput
            type="range"
            label="Período"
            placeholder="Selecione o período"
            value={dateRange}
            onChange={setDateRange}
            leftSection={<IconCalendar size={16} />}
            w={320}
          />
        </Group>
      </Card>

      {/* Totalizadores */}
      <SimpleGrid cols={{ base: 2, sm: 5 }} mb="md">
        <Card withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Mão de Obra</Text>
          <Text size="lg" fw={700}>{formatCurrency(totais.maoDeObra)}</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Equipamento</Text>
          <Text size="lg" fw={700}>{formatCurrency(totais.equipamento)}</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Espaço</Text>
          <Text size="lg" fw={700}>{formatCurrency(totais.espaco)}</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total Geral</Text>
          <Text size="lg" fw={700} c="blue">{formatCurrency(totais.total)}</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Custo Unitário Médio</Text>
          <Text size="lg" fw={700} c="grape">{formatCurrency(totais.unitario)}</Text>
        </Card>
      </SimpleGrid>

      {/* Tabela breakdown */}
      <Card withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tipo Operação</Table.Th>
              <Table.Th>Mão de Obra</Table.Th>
              <Table.Th>Equipamento</Table.Th>
              <Table.Th>Espaço</Table.Th>
              <Table.Th>Total</Table.Th>
              <Table.Th>Unitário</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {operacoes.map((op: any) => (
              <Table.Tr key={op.tipoOperacao}>
                <Table.Td fw={500}>{op.tipoOperacao}</Table.Td>
                <Table.Td>{formatCurrency(op.maoDeObra)}</Table.Td>
                <Table.Td>{formatCurrency(op.equipamento)}</Table.Td>
                <Table.Td>{formatCurrency(op.espaco)}</Table.Td>
                <Table.Td fw={500}>{formatCurrency(op.total)}</Table.Td>
                <Table.Td>{formatCurrency(op.unitario)}</Table.Td>
              </Table.Tr>
            ))}
            {operacoes.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed" ta="center" py="sm">Nenhum dado de custo encontrado para o período</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
