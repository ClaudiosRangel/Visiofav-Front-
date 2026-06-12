'use client'

import { useEffect, useState } from 'react'
import {
  Card, Group, Text, SimpleGrid, Badge, Table, Button,
  LoadingOverlay, ThemeIcon,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import {
  IconUser, IconChartLine, IconCalendar,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useParams } from 'next/navigation'

const FAIXA_COLORS: Record<string, string> = {
  EXCELENTE: 'green',
  BOM: 'blue',
  REGULAR: 'yellow',
  ABAIXO: 'orange',
  CRITICO: 'red',
}

export default function LmsFuncionarioPage() {
  useModuloGuard('WMS')
  const params = useParams()
  const id = params.id as string

  useEffect(() => { document.title = 'Vizor - WMS - LMS - Funcionário' }, [])

  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    new Date(),
  ])

  const { data: relatorio, isLoading } = useQuery<any>({
    queryKey: ['lms-funcionario', id, dateRange],
    queryFn: async () => {
      const params: any = { operadorId: id }
      if (dateRange[0]) params.dataInicio = dateRange[0].toISOString().split('T')[0]
      if (dateRange[1]) params.dataFim = dateRange[1].toISOString().split('T')[0]
      const { data } = await api.get(`/lms/relatorio/funcionario/${id}`, { params })
      return data
    },
    enabled: !!id,
  })

  const resumo = relatorio?.resumo || {}
  const evolucao = relatorio?.evolucaoDiaria || []
  const distribuicaoFaixa = relatorio?.distribuicaoFaixa || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / LMS / Funcionário</Text>

      <Group justify="space-between" mb="lg">
        <Group gap="sm">
          <ThemeIcon variant="light" size="lg">
            <IconUser size={20} />
          </ThemeIcon>
          <div>
            <Text size="xl" fw={600}>{resumo.nomeOperador || `Operador #${id}`}</Text>
            <Text size="xs" c="dimmed">Relatório Individual</Text>
          </div>
        </Group>
        <DatePickerInput
          type="range"
          label="Período"
          value={dateRange}
          onChange={(v) => setDateRange(v)}
          leftSection={<IconCalendar size={14} />}
          w={280}
        />
      </Group>

      <Card pos="relative" mb="md">
        <LoadingOverlay visible={isLoading} />
        <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
          <Card withBorder>
            <Text size="xs" c="dimmed" fw={500} mb={4}>Total Tarefas</Text>
            <Text size="xl" fw={700}>{resumo.totalTarefas ?? '—'}</Text>
          </Card>
          <Card withBorder>
            <Text size="xs" c="dimmed" fw={500} mb={4}>Índice Médio</Text>
            <Text size="xl" fw={700}>{resumo.indiceMedio ?? '—'}%</Text>
          </Card>
          <Card withBorder>
            <Text size="xs" c="dimmed" fw={500} mb={4}>Distribuição por Faixa</Text>
            <Group gap="xs" mt={4}>
              {distribuicaoFaixa.map((d: any) => (
                <Badge
                  key={d.faixa}
                  color={FAIXA_COLORS[d.faixa] || 'gray'}
                  variant="light"
                  size="lg"
                >
                  {d.faixa}: {d.quantidade}
                </Badge>
              ))}
              {distribuicaoFaixa.length === 0 && (
                <Text size="sm" c="dimmed">Sem dados</Text>
              )}
            </Group>
          </Card>
        </SimpleGrid>
      </Card>

      {/* Evolução Diária */}
      <Card withBorder>
        <Group gap="xs" mb="sm">
          <IconChartLine size={18} />
          <Text fw={500}>Evolução Diária</Text>
        </Group>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Data</Table.Th>
              <Table.Th>Tarefas</Table.Th>
              <Table.Th>Tempo Médio (min)</Table.Th>
              <Table.Th>Índice (%)</Table.Th>
              <Table.Th>Faixa</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {evolucao.map((e: any, i: number) => (
              <Table.Tr key={i}>
                <Table.Td>
                  {e.data ? new Date(e.data).toLocaleDateString('pt-BR') : '—'}
                </Table.Td>
                <Table.Td>{e.totalTarefas}</Table.Td>
                <Table.Td>{e.tempoMedio}</Table.Td>
                <Table.Td>{e.indice}%</Table.Td>
                <Table.Td>
                  <Badge color={FAIXA_COLORS[e.faixa] || 'gray'} variant="light" size="sm">
                    {e.faixa}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
            {evolucao.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={5}>
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
