'use client'

import { useState, useEffect } from 'react'
import {
  Button,
  Card,
  Group,
  Text,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
  LoadingOverlay,
  Select,
  Pagination,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import {
  IconPlus,
  IconRefresh,
  IconEye,
  IconCheck,
  IconX,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter } from 'next/navigation'

interface PedidoCompra {
  id: string
  numero: number
  fornecedorId: string
  fornecedor: { razaoSocial: string; nomeFantasia?: string | null }
  vendedor?: { nome: string } | null
  dataEntrega?: string | null
  valorTotal: number | string
  status: string
  criadoEm: string
}

interface PedidosResponse {
  data: PedidoCompra[]
  total: number
}

const statusOptions = [
  { value: 'RASCUNHO', label: 'Rascunho' },
  { value: 'CONFIRMADO', label: 'Confirmado' },
  { value: 'RECEBIDO', label: 'Recebido' },
  { value: 'CANCELADO', label: 'Cancelado' },
]

const statusColors: Record<string, string> = {
  RASCUNHO: 'gray',
  CONFIRMADO: 'blue',
  RECEBIDO: 'green',
  CANCELADO: 'red',
}

export default function PedidosCompraPage() {
  useModuloGuard('COMPRAS')
  useEffect(() => { document.title = 'VisioFab - Compras - Pedidos' }, [])

  const router = useRouter()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [fornecedorFilter, setFornecedorFilter] = useState<string | null>(null)
  const [dataInicio, setDataInicio] = useState<Date | null>(null)
  const [dataFim, setDataFim] = useState<Date | null>(null)
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: response, isLoading, refetch } = useQuery<PedidosResponse>({
    queryKey: ['pedidos-compra', { status: statusFilter, fornecedorId: fornecedorFilter, dataInicio: dataInicio?.toISOString(), dataFim: dataFim?.toISOString(), page, limit }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit }
      if (statusFilter) params.status = statusFilter
      if (fornecedorFilter) params.fornecedorId = fornecedorFilter
      if (dataInicio) params.dataInicio = dataInicio.toISOString()
      if (dataFim) params.dataFim = dataFim.toISOString()
      const { data } = await api.get('/pedidos-compra', { params })
      return data
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  })

  // Fetch fornecedores for filter
  const { data: fornecedoresData } = useQuery<{ data: { id: string; razaoSocial: string }[]; total: number }>({
    queryKey: ['fornecedores-select'],
    queryFn: async () => {
      const { data } = await api.get('/fornecedores', { params: { limit: 100, status: 'true' } })
      return data
    },
    staleTime: 1000 * 60 * 10,
  })

  const confirmar = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/pedidos-compra/${id}/confirmar`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] })
      notifications.show({ title: 'Sucesso', message: 'Pedido confirmado', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao confirmar', color: 'red' })
    },
  })

  const cancelar = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data } = await api.patch(`/pedidos-compra/${id}/cancelar`, { motivo })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] })
      notifications.show({ title: 'Sucesso', message: 'Pedido cancelado', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao cancelar', color: 'red' })
    },
  })

  function handleConfirmar(id: string) {
    if (!confirm('Deseja confirmar este pedido?')) return
    confirmar.mutate(id)
  }

  function handleCancelar(id: string) {
    const motivo = prompt('Informe o motivo do cancelamento (mínimo 10 caracteres):')
    if (!motivo) return
    if (motivo.length < 10) {
      notifications.show({ title: 'Erro', message: 'Motivo deve ter no mínimo 10 caracteres', color: 'red' })
      return
    }
    cancelar.mutate({ id, motivo })
  }

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / limit)

  const fornecedorOptions = (fornecedoresData?.data || []).map((f) => ({
    value: f.id,
    label: f.razaoSocial,
  }))

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Compras / Pedidos</Text>
      <Text size="xl" fw={600} mb="lg">Pedidos de Compra</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Group justify="space-between" mb="md">
          <Group>
            <Select
              placeholder="Status"
              data={statusOptions}
              value={statusFilter}
              onChange={(val) => { setStatusFilter(val); setPage(1) }}
              clearable
              className="w-40"
            />
            <Select
              placeholder="Fornecedor"
              data={fornecedorOptions}
              value={fornecedorFilter}
              onChange={(val) => { setFornecedorFilter(val); setPage(1) }}
              clearable
              searchable
              className="w-56"
            />
            <DateInput
              placeholder="Data início"
              value={dataInicio}
              onChange={(val) => { setDataInicio(val); setPage(1) }}
              clearable
              className="w-40"
            />
            <DateInput
              placeholder="Data fim"
              value={dataFim}
              onChange={(val) => { setDataFim(val); setPage(1) }}
              clearable
              className="w-40"
            />
          </Group>
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>
              Atualizar
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={() => router.push('/compras/pedidos/novo')}>
              Novo Pedido
            </Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Número</Table.Th>
              <Table.Th>Fornecedor</Table.Th>
              <Table.Th>Data Entrega</Table.Th>
              <Table.Th>Valor Total</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th className="w-32">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.numero}</Table.Td>
                <Table.Td>{item.fornecedor?.nomeFantasia || item.fornecedor?.razaoSocial}</Table.Td>
                <Table.Td>
                  {item.dataEntrega
                    ? new Date(item.dataEntrega).toLocaleDateString('pt-BR')
                    : '—'}
                </Table.Td>
                <Table.Td>
                  {Number(item.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Table.Td>
                <Table.Td>
                  <Badge color={statusColors[item.status] || 'gray'}>
                    {item.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Ver detalhes">
                      <ActionIcon variant="subtle" color="gray" onClick={() => router.push(`/compras/pedidos/${item.id}`)}>
                        <IconEye size={18} />
                      </ActionIcon>
                    </Tooltip>
                    {item.status === 'RASCUNHO' && (
                      <Tooltip label="Confirmar">
                        <ActionIcon variant="subtle" color="blue" onClick={() => handleConfirmar(item.id)}>
                          <IconCheck size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {['RASCUNHO', 'CONFIRMADO'].includes(item.status) && (
                      <Tooltip label="Cancelar">
                        <ActionIcon variant="subtle" color="red" onClick={() => handleCancelar(item.id)}>
                          <IconX size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6} className="text-center py-8 text-zinc-500">
                  Nenhum pedido de compra encontrado
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination total={totalPages} value={page} onChange={setPage} />
          </Group>
        )}
      </Card>
    </div>
  )
}
