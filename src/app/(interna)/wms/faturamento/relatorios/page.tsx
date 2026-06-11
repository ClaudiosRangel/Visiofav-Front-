'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, SimpleGrid, ThemeIcon, Stack,
  LoadingOverlay,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import {
  IconCash, IconFileInvoice, IconAlertTriangle, IconDownload, IconFilter,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const STATUS_COLORS: Record<string, string> = {
  GERADA: 'gray',
  ENVIADA: 'blue',
  PAGA: 'green',
  CANCELADA: 'red',
  ATRASADA: 'orange',
}

export default function RelatoriosPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Relatórios Faturamento' }, [])

  const [dataInicio, setDataInicio] = useState<Date | null>(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [dataFim, setDataFim] = useState<Date | null>(new Date())

  const { data: resp, isLoading, refetch } = useQuery<any>({
    queryKey: ['faturamento', 'relatorios', dataInicio, dataFim],
    queryFn: async () => {
      const params: any = {}
      if (dataInicio) params.dataInicio = dataInicio.toISOString()
      if (dataFim) params.dataFim = dataFim.toISOString()
      const { data } = await api.get('/faturamento/relatorio', { params })
      return data
    },
  })

  // Also fetch faturas for the period to display in the table
  const { data: faturasResp } = useQuery<any>({
    queryKey: ['faturamento', 'relatorios', 'faturas', dataInicio, dataFim],
    queryFn: async () => {
      const params: any = { limit: 100 }
      if (dataInicio) params.periodoInicio = dataInicio.toISOString()
      if (dataFim) params.periodoFim = dataFim.toISOString()
      const { data } = await api.get('/faturamento/faturas', { params })
      return data
    },
  })

  // Build resumo from totaisPorStatus
  const totaisPorStatus = resp?.totaisPorStatus || []
  const resumo = {
    totalFaturado: Number(
      totaisPorStatus.find((t: any) => t.status === 'PAGA')?.valor || 0
    ),
    aReceber: Number(
      totaisPorStatus.find((t: any) => t.status === 'ENVIADA')?.valor || 0
    ),
    inadimplente: Number(
      totaisPorStatus.find((t: any) => t.status === 'GERADA')?.valor || 0
    ),
  }
  const faturas = faturasResp?.data || []

  function exportCSV() {
    if (!faturas.length) return

    const headers = ['Número', 'Cliente', 'Período', 'Valor Total', 'Status', 'Emissão']
    const rows = faturas.map((f: any) => [
      f.numero,
      f.clienteNome || f.clienteId,
      f.periodoInicio && f.periodoFim
        ? `${new Date(f.periodoInicio).toLocaleDateString('pt-BR')} a ${new Date(f.periodoFim).toLocaleDateString('pt-BR')}`
        : '',
      (f.valorTotal ?? 0).toFixed(2),
      f.status,
      f.criadoEm ? new Date(f.criadoEm).toLocaleDateString('pt-BR') : '',
    ])

    const csv = [headers.join(';'), ...rows.map((r: string[]) => r.join(';'))].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `relatorio-faturamento-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Faturamento / Relatórios</Text>
      <Text size="xl" fw={600} mb="lg">Relatórios de Faturamento</Text>

      {/* Filters */}
      <Card mb="md">
        <Group gap="md" align="flex-end">
          <DateInput
            label="Data Início"
            placeholder="De"
            value={dataInicio}
            onChange={setDataInicio}
            valueFormat="DD/MM/YYYY"
            clearable
          />
          <DateInput
            label="Data Fim"
            placeholder="Até"
            value={dataFim}
            onChange={setDataFim}
            valueFormat="DD/MM/YYYY"
            clearable
          />
          <Button leftSection={<IconFilter size={16} />} onClick={() => refetch()}>
            Filtrar
          </Button>
          <Button
            variant="light"
            leftSection={<IconDownload size={16} />}
            onClick={exportCSV}
            disabled={faturas.length === 0}
          >
            Exportar CSV
          </Button>
        </Group>
      </Card>

      {/* Summary Cards */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="green">
              <IconCash size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Total Faturado</Text>
              <Text size="xl" fw={700}>
                {(resumo.totalFaturado ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
              <Text size="xs" c="dimmed">A Receber</Text>
              <Text size="xl" fw={700}>
                {(resumo.aReceber ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                {(resumo.inadimplente ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Faturas Table */}
      <Card pos="relative" withBorder>
        <LoadingOverlay visible={isLoading} />
        <Text fw={600} mb="sm">Faturas no Período</Text>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Número</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Período</Table.Th>
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
                  {f.periodoInicio && f.periodoFim
                    ? `${new Date(f.periodoInicio).toLocaleDateString('pt-BR')} a ${new Date(f.periodoFim).toLocaleDateString('pt-BR')}`
                    : '—'}
                </Table.Td>
                <Table.Td>
                  {(f.valorTotal ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color={STATUS_COLORS[f.status] || 'gray'}>
                    {f.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {f.criadoEm
                    ? new Date(f.criadoEm).toLocaleDateString('pt-BR')
                    : '—'}
                </Table.Td>
              </Table.Tr>
            ))}
            {faturas.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={6} className="text-center py-8 text-zinc-500">
                  Nenhuma fatura no período selecionado
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
