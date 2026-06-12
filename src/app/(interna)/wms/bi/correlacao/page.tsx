'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, LoadingOverlay,
} from '@mantine/core'
import { IconCalendar } from '@tabler/icons-react'
import { DatePickerInput } from '@mantine/dates'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const FORCA_COLORS: Record<string, string> = {
  FORTE: 'green',
  MODERADA: 'yellow',
  FRACA: 'red',
}

function getForça(correlacao: number): string {
  const abs = Math.abs(correlacao)
  if (abs >= 0.7) return 'FORTE'
  if (abs >= 0.4) return 'MODERADA'
  return 'FRACA'
}

export default function BiCorrelacaoPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Análise Cruzada' }, [])

  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(new Date().setDate(new Date().getDate() - 30)),
    new Date(),
  ])

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['bi-correlacao', dateRange[0]?.toISOString(), dateRange[1]?.toISOString()],
    queryFn: async () => {
      const params: any = {}
      if (dateRange[0]) params.dataInicio = dateRange[0].toISOString().split('T')[0]
      if (dateRange[1]) params.dataFim = dateRange[1].toISOString().split('T')[0]
      const { data } = await api.get('/bi/correlacao', { params })
      return data
    },
    enabled: !!dateRange[0] && !!dateRange[1],
  })

  const pares = resp?.data || resp || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / BI Avançado / Análise Cruzada</Text>
      <Text size="xl" fw={600} mb="lg">Análise Cruzada de Indicadores</Text>

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

      <Card withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Text fw={500} mb="sm">Correlação de Pearson entre Indicadores</Text>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Indicador A</Table.Th>
              <Table.Th>Indicador B</Table.Th>
              <Table.Th>Correlação</Table.Th>
              <Table.Th>Força</Table.Th>
              <Table.Th>Direção</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(Array.isArray(pares) ? pares : []).map((par: any, idx: number) => {
              const forca = par.forca || getForça(par.correlacao)
              return (
                <Table.Tr key={idx}>
                  <Table.Td fw={500}>{par.indicadorA}</Table.Td>
                  <Table.Td fw={500}>{par.indicadorB}</Table.Td>
                  <Table.Td>
                    <Text fw={600}>{par.correlacao?.toFixed(4)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={FORCA_COLORS[forca] || 'gray'} variant="filled">
                      {forca}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text c={par.correlacao >= 0 ? 'green' : 'red'} fw={500}>
                      {par.correlacao >= 0 ? 'Positiva' : 'Negativa'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )
            })}
            {(!Array.isArray(pares) || pares.length === 0) && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="sm">Nenhuma correlação calculada para o período</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
