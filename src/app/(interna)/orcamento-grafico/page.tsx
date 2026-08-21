'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center,
  TextInput, Select, Paper, ScrollArea, Pagination,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconPlus, IconSearch, IconFilter } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ============================================================================
// Tipos
// ============================================================================

interface OrcamentoGrafico {
  id: string
  numero: number
  versao: number
  clienteNome?: string | null
  clienteId?: string | null
  tipoEmbalagem?: { descricao: string } | null
  quantidade: number
  precoVenda?: number | string | null
  status: string
  criadoEm: string
}

interface PaginatedResponse {
  data: OrcamentoGrafico[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ============================================================================
// Status Badge (Task 8.2)
// ============================================================================

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  RASCUNHO: { color: 'gray', label: 'Rascunho' },
  ENVIADO: { color: 'blue', label: 'Enviado' },
  APROVADO: { color: 'green', label: 'Aprovado' },
  RECUSADO: { color: 'red', label: 'Recusado' },
  VENCIDO: { color: 'orange', label: 'Vencido' },
}

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { color: 'gray', label: status }
  return <Badge color={config.color}>{config.label}</Badge>
}

// ============================================================================
// Formatadores
// ============================================================================

function formatCurrency(val: number | string | null | undefined): string {
  if (val == null) return '—'
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return '—'
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

// ============================================================================
// Página Principal — Lista de Orçamentos
// ============================================================================

export default function OrcamentosGraficoPage() {
  const router = useRouter()

  useEffect(() => { document.title = 'Orçamentos Gráficos' }, [])

  // State
  const [data, setData] = useState<OrcamentoGrafico[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filtros
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<string | null>(null)
  const [dataInicio, setDataInicio] = useState<Date | null>(null)
  const [dataFim, setDataFim] = useState<Date | null>(null)

  const LIMIT = 20

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = {
        page,
        limit: LIMIT,
      }
      if (busca.trim()) params.busca = busca.trim()
      if (statusFiltro) params.status = statusFiltro
      if (dataInicio) params.dataInicio = dataInicio.toISOString()
      if (dataFim) params.dataFim = dataFim.toISOString()

      const res = await api.get('/orcamento-grafico', { params })
      const result: PaginatedResponse = res.data

      setData(result.data || [])
      setTotal(result.total || 0)
      setTotalPages(result.totalPages || 1)
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao carregar',
        message: err?.response?.data?.message || 'Falha ao buscar orçamentos',
        color: 'red',
      })
    } finally {
      setLoading(false)
    }
  }, [page, busca, statusFiltro, dataInicio, dataFim])

  useEffect(() => { carregar() }, [carregar])

  // Reset page ao mudar filtros
  useEffect(() => { setPage(1) }, [busca, statusFiltro, dataInicio, dataFim])

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <div>
          <Title order={3}>Orçamentos Gráficos</Title>
          <Text size="sm" c="dimmed">
            {total} orçamento{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => router.push('/orcamento-grafico/novo')}
        >
          Novo Orçamento
        </Button>
      </Group>

      {/* Filtros */}
      <Paper p="sm" withBorder>
        <Group gap="sm" align="flex-end" wrap="wrap">
          <TextInput
            placeholder="Buscar por número, cliente..."
            leftSection={<IconSearch size={16} />}
            value={busca}
            onChange={(e) => setBusca(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <Select
            placeholder="Status"
            leftSection={<IconFilter size={16} />}
            data={[
              { value: 'RASCUNHO', label: 'Rascunho' },
              { value: 'ENVIADO', label: 'Enviado' },
              { value: 'APROVADO', label: 'Aprovado' },
              { value: 'RECUSADO', label: 'Recusado' },
              { value: 'VENCIDO', label: 'Vencido' },
            ]}
            value={statusFiltro}
            onChange={setStatusFiltro}
            clearable
            w={160}
          />
          <DatePickerInput
            placeholder="Data início"
            value={dataInicio}
            onChange={setDataInicio}
            clearable
            w={150}
            valueFormat="DD/MM/YYYY"
          />
          <DatePickerInput
            placeholder="Data fim"
            value={dataFim}
            onChange={setDataFim}
            clearable
            w={150}
            valueFormat="DD/MM/YYYY"
          />
        </Group>
      </Paper>

      {/* Tabela */}
      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Número</Table.Th>
                <Table.Th>Versão</Table.Th>
                <Table.Th>Cliente</Table.Th>
                <Table.Th>Tipo Embalagem</Table.Th>
                <Table.Th ta="right">Quantidade</Table.Th>
                <Table.Th ta="right">Preço Venda</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Criado em</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((orc) => (
                <Table.Tr
                  key={orc.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/orcamento-grafico/${orc.id}`)}
                >
                  <Table.Td fw={600}>{orc.numero}</Table.Td>
                  <Table.Td>V{orc.versao}</Table.Td>
                  <Table.Td>{orc.clienteNome || '—'}</Table.Td>
                  <Table.Td>{orc.tipoEmbalagem?.descricao || '—'}</Table.Td>
                  <Table.Td ta="right">{orc.quantidade?.toLocaleString('pt-BR') || '—'}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(orc.precoVenda)}</Table.Td>
                  <Table.Td><StatusBadge status={orc.status} /></Table.Td>
                  <Table.Td>{formatDate(orc.criadoEm)}</Table.Td>
                </Table.Tr>
              ))}
              {data.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text ta="center" c="dimmed" py="md">
                      Nenhum orçamento encontrado
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <Group justify="center">
          <Pagination
            total={totalPages}
            value={page}
            onChange={setPage}
          />
        </Group>
      )}
    </Stack>
  )
}
