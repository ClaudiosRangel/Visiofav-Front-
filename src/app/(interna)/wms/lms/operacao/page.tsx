'use client'

import { useEffect, useState } from 'react'
import {
  Card, Group, Text, SimpleGrid, Table, Select, Badge,
  LoadingOverlay,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconCalendar, IconClock, IconChartBar } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const FAIXA_COLORS: Record<string, string> = {
  EXCELENTE: 'green',
  BOM: 'blue',
  REGULAR: 'yellow',
  ABAIXO: 'orange',
  CRITICO: 'red',
}

const TIPOS_OPERACAO = [
  { value: 'PICKING', label: 'Picking' },
  { value: 'PUTAWAY', label: 'Putaway' },
  { value: 'REABASTECIMENTO', label: 'Reabastecimento' },
  { value: 'INVENTARIO', label: 'Inventário' },
  { value: 'EXPEDICAO', label: 'Expedição' },
]

export default function LmsOperacaoPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - LMS - Por Operação' }, [])

  const [tipoOperacao, setTipoOperacao] = useState('PICKING')
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    new Date(),
  ])

  const { data: relatorio, isLoading } = useQuery<any>({
    queryKey: ['lms-operacao', tipoOperacao, dateRange],
    queryFn: async () => {
      const params: any = { tipoOperacao }
      if (dateRange[0]) params.dataInicio = dateRange[0].toISOString().split('T')[0]
      if (dateRange[1]) params.dataFim = dateRange[1].toISOString().split('T')[0]
      const { data } = await api.get('/lms/relatorio/operacao', { params })
      return data
    },
  })

  const resumo = relatorio?.resumo || {}
  const distribuicao = relatorio?.distribuicaoFaixa || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / LMS / Relatório por Operação</Text>

      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Relatório por Operação</Text>
      </Group>

      <Card withBorder mb="md">
        <Group gap="md">
          <Select
            label="Tipo de Operação"
            data={TIPOS_OPERACAO}
            value={tipoOperacao}
            onChange={(v) => setTipoOperacao(v || 'PICKING')}
            w={200}
          />
          <DatePickerInput
            type="range"
            label="Período"
            value={dateRange}
            onChange={(v) => setDateRange(v)}
            leftSection={<IconCalendar size={14} />}
            w={280}
          />
        </Group>
      </Card>

      <Card pos="relative" mb="md">
        <LoadingOverlay visible={isLoading} />
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <Card withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={500}>Tempo Médio</Text>
              <IconClock size={16} color="gray" />
            </Group>
            <Text size="xl" fw={700}>{resumo.tempoMedio ?? '—'} min</Text>
          </Card>
          <Card withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={500}>Tempo Mínimo</Text>
              <IconClock size={16} color="green" />
            </Group>
            <Text size="xl" fw={700}>{resumo.tempoMinimo ?? '—'} min</Text>
          </Card>
          <Card withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={500}>Tempo Máximo</Text>
              <IconClock size={16} color="red" />
            </Group>
            <Text size="xl" fw={700}>{resumo.tempoMaximo ?? '—'} min</Text>
          </Card>
          <Card withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={500}>Índice Médio</Text>
              <IconChartBar size={16} color="blue" />
            </Group>
            <Text size="xl" fw={700}>{resumo.indiceMedio ?? '—'}%</Text>
          </Card>
        </SimpleGrid>
      </Card>

      {/* Distribuição por Faixa */}
      <Card withBorder>
        <Text fw={500} mb="sm">Distribuição por Faixa</Text>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Faixa</Table.Th>
              <Table.Th>Quantidade</Table.Th>
              <Table.Th>Percentual</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {distribuicao.map((d: any) => (
              <Table.Tr key={d.faixa}>
                <Table.Td>
                  <Badge color={FAIXA_COLORS[d.faixa] || 'gray'} variant="filled">
                    {d.faixa}
                  </Badge>
                </Table.Td>
                <Table.Td>{d.quantidade}</Table.Td>
                <Table.Td>{d.percentual}%</Table.Td>
              </Table.Tr>
            ))}
            {distribuicao.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text size="sm" c="dimmed" ta="center" py="sm">Sem dados para o período</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
