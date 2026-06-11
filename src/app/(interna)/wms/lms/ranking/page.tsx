'use client'

import { useEffect, useState } from 'react'
import {
  Card, Group, Text, Table, Button, Select, Badge,
  LoadingOverlay,
} from '@mantine/core'
import { IconDownload, IconFilter } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import Link from 'next/link'

const FAIXA_COLORS: Record<string, string> = {
  EXCELENTE: 'green',
  BOM: 'blue',
  REGULAR: 'yellow',
  ABAIXO: 'orange',
  CRITICO: 'red',
}

const PERIODOS = [
  { value: 'DIA', label: 'Dia' },
  { value: 'SEMANA', label: 'Semana' },
  { value: 'MES', label: 'Mês' },
]

const TIPOS_OPERACAO = [
  { value: '', label: 'Todas' },
  { value: 'PICKING', label: 'Picking' },
  { value: 'PUTAWAY', label: 'Putaway' },
  { value: 'REABASTECIMENTO', label: 'Reabastecimento' },
  { value: 'INVENTARIO', label: 'Inventário' },
  { value: 'EXPEDICAO', label: 'Expedição' },
]

async function exportarCSV(periodo: string, tipoOperacao: string) {
  const params: any = { periodo }
  if (tipoOperacao) params.tipoOperacao = tipoOperacao
  const response = await api.get('/lms/relatorio/exportar', { params, responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `lms-ranking-${periodo.toLowerCase()}.csv`)
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export default function LmsRankingPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - LMS - Ranking' }, [])

  const [periodo, setPeriodo] = useState('SEMANA')
  const [tipoOperacao, setTipoOperacao] = useState('')

  const { data: rankingResp, isLoading } = useQuery<any>({
    queryKey: ['lms-ranking', periodo, tipoOperacao],
    queryFn: async () => {
      const params: any = { periodo }
      if (tipoOperacao) params.tipoOperacao = tipoOperacao
      const { data } = await api.get('/lms/ranking', { params })
      return data
    },
  })

  const ranking = rankingResp?.ranking || rankingResp?.data || (Array.isArray(rankingResp) ? rankingResp : [])

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / LMS / Ranking</Text>

      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Ranking de Produtividade</Text>
        <Button
          variant="light"
          leftSection={<IconDownload size={16} />}
          onClick={() => exportarCSV(periodo, tipoOperacao)}
        >
          Exportar CSV
        </Button>
      </Group>

      <Card withBorder mb="md">
        <Group gap="md">
          <Select
            label="Período"
            data={PERIODOS}
            value={periodo}
            onChange={(v) => setPeriodo(v || 'SEMANA')}
            w={150}
            leftSection={<IconFilter size={14} />}
          />
          <Select
            label="Tipo Operação"
            data={TIPOS_OPERACAO}
            value={tipoOperacao}
            onChange={(v) => setTipoOperacao(v || '')}
            w={200}
          />
        </Group>
      </Card>

      <Card withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>Operador</Table.Th>
              <Table.Th>Total Tarefas</Table.Th>
              <Table.Th>Tempo Médio (min)</Table.Th>
              <Table.Th>Índice Médio (%)</Table.Th>
              <Table.Th>Faixa</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ranking.map((r: any, i: number) => (
              <Table.Tr key={r.operadorId || i}>
                <Table.Td fw={i < 3 ? 700 : 400}>{i + 1}</Table.Td>
                <Table.Td>
                  <Text
                    component={Link}
                    href={`/wms/lms/funcionario/${r.operadorId}`}
                    size="sm"
                    c="blue"
                    td="underline"
                  >
                    {r.operador}
                  </Text>
                </Table.Td>
                <Table.Td>{r.totalTarefas}</Table.Td>
                <Table.Td>{r.tempoMedio}</Table.Td>
                <Table.Td>{r.indiceMedio}%</Table.Td>
                <Table.Td>
                  <Badge color={FAIXA_COLORS[r.faixa] || 'gray'} variant="filled">
                    {r.faixa}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
            {ranking.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text size="sm" c="dimmed" ta="center" py="sm">Nenhum dado para o período selecionado</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
