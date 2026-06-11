'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Select,
  LoadingOverlay, SimpleGrid, Pagination, ThemeIcon,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import {
  IconArrowsExchange, IconEye, IconClock, IconTruckDelivery,
  IconPackageExport, IconCheck, IconDownload,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import Link from 'next/link'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'APROVADA', label: 'Aprovada' },
  { value: 'EM_SEPARACAO', label: 'Em Separação' },
  { value: 'EXPEDIDA', label: 'Expedida' },
  { value: 'EM_TRANSITO', label: 'Em Trânsito' },
  { value: 'RECEBIDA', label: 'Recebida' },
  { value: 'CANCELADA', label: 'Cancelada' },
]

const PRIORIDADE_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
]

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: 'yellow',
  APROVADA: 'blue',
  EM_SEPARACAO: 'indigo',
  EXPEDIDA: 'violet',
  EM_TRANSITO: 'orange',
  RECEBIDA: 'green',
  CANCELADA: 'gray',
}

const STATUS_LABELS: Record<string, string> = {
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  EM_SEPARACAO: 'Em Separação',
  EXPEDIDA: 'Expedida',
  EM_TRANSITO: 'Em Trânsito',
  RECEBIDA: 'Recebida',
  CANCELADA: 'Cancelada',
}

export default function MultiCdPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Multi-CD' }, [])

  const [status, setStatus] = useState<string>('')
  const [cdId, setCdId] = useState<string>('')
  const [prioridade, setPrioridade] = useState<string>('')
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null])
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: cdsResp } = useQuery<any>({
    queryKey: ['centros-distribuicao'],
    queryFn: async () => {
      const { data } = await api.get('/centros-distribuicao')
      return data
    },
  })

  const cdOptions = [
    { value: '', label: 'Todos os CDs' },
    ...(cdsResp?.data || []).map((cd: any) => ({ value: cd.id, label: cd.nome })),
  ]

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['multi-cd-solicitacoes', status, cdId, prioridade, dateRange, page],
    queryFn: async () => {
      const params: any = { page, limit }
      if (status) params.status = status
      if (cdId) params.cdId = cdId
      if (prioridade) params.prioridade = prioridade
      if (dateRange[0]) params.dataInicio = dateRange[0].toISOString()
      if (dateRange[1]) params.dataFim = dateRange[1].toISOString()
      const { data } = await api.get('/multi-cd/solicitacoes', { params })
      return data
    },
  })

  const items = resp?.data || []
  const total = resp?.total || 0
  const totalPages = Math.ceil(total / limit)

  const resumo = resp?.resumo || {}
  const totalSolicitacoes = resumo.total ?? 0
  const pendentes = resumo.pendentes ?? 0
  const emTransito = resumo.emTransito ?? 0
  const recebidas = resumo.recebidas ?? 0

  const handleExportCsv = async () => {
    try {
      const params: any = {}
      if (status) params.status = status
      if (cdId) params.cdId = cdId
      if (prioridade) params.prioridade = prioridade
      if (dateRange[0]) params.dataInicio = dateRange[0].toISOString()
      if (dateRange[1]) params.dataFim = dateRange[1].toISOString()
      const { data } = await api.get('/multi-cd/exportar', { params, responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'transferencias.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erro ao exportar CSV:', err)
    }
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Multi-CD / Transferências</Text>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Transferências entre CDs</Text>
        <Group gap="sm">
          <Button
            variant="light"
            leftSection={<IconDownload size={16} />}
            onClick={handleExportCsv}
          >
            Exportar CSV
          </Button>
          <Button
            component={Link}
            href="/wms/multi-cd/nova-solicitacao"
            leftSection={<IconPackageExport size={16} />}
          >
            Nova Solicitação
          </Button>
        </Group>
      </Group>

      {/* Summary Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="md">
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="blue">
              <IconArrowsExchange size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Total</Text>
              <Text size="xl" fw={700}>{totalSolicitacoes}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="yellow">
              <IconClock size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Pendentes</Text>
              <Text size="xl" fw={700}>{pendentes}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="orange">
              <IconTruckDelivery size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Em Trânsito</Text>
              <Text size="xl" fw={700}>{emTransito}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="green">
              <IconCheck size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Recebidas</Text>
              <Text size="xl" fw={700}>{recebidas}</Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Filters */}
      <Card mb="md">
        <Group gap="md" align="end">
          <Select
            label="Status"
            placeholder="Filtrar por status"
            data={STATUS_OPTIONS}
            value={status}
            onChange={(val) => { setStatus(val || ''); setPage(1) }}
            clearable
          />
          <Select
            label="Centro de Distribuição"
            placeholder="Filtrar por CD"
            data={cdOptions}
            value={cdId}
            onChange={(val) => { setCdId(val || ''); setPage(1) }}
            clearable
          />
          <Select
            label="Prioridade"
            placeholder="Filtrar prioridade"
            data={PRIORIDADE_OPTIONS}
            value={prioridade}
            onChange={(val) => { setPrioridade(val || ''); setPage(1) }}
            clearable
          />
          <DatePickerInput
            type="range"
            label="Período"
            placeholder="Selecione o período"
            value={dateRange}
            onChange={(val) => { setDateRange(val); setPage(1) }}
            clearable
          />
        </Group>
      </Card>

      {/* Table */}
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Número</Table.Th>
              <Table.Th>CD Origem</Table.Th>
              <Table.Th>CD Destino</Table.Th>
              <Table.Th>Itens</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Data</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td className="font-mono">{item.numero}</Table.Td>
                <Table.Td>{item.cdOrigem?.nome || item.cdOrigemId}</Table.Td>
                <Table.Td>{item.cdDestino?.nome || item.cdDestinoId}</Table.Td>
                <Table.Td>{item.itens?.length ?? item.totalItens ?? 0}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={STATUS_COLORS[item.status] || 'gray'}>
                    {STATUS_LABELS[item.status] || item.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {item.criadoEm
                    ? new Date(item.criadoEm).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                      })
                    : '—'}
                </Table.Td>
                <Table.Td>
                  <Button
                    component={Link}
                    href={`/wms/multi-cd/${item.id}`}
                    variant="subtle"
                    size="xs"
                    leftSection={<IconEye size={14} />}
                  >
                    Ver
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
            {items.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={7} className="text-center py-8 text-zinc-500">
                  Nenhuma solicitação de transferência encontrada
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination value={page} onChange={setPage} total={totalPages} />
          </Group>
        )}
      </Card>
    </div>
  )
}
