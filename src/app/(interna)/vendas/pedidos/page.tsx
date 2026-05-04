'use client'

import { useState, useEffect } from 'react'
import { Button, Card, Group, Text, Table, Badge, ActionIcon, Tooltip, LoadingOverlay, Select, Pagination } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconPlus, IconRefresh, IconEye, IconCheck, IconX } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter } from 'next/navigation'

const statusColors: Record<string, string> = { RASCUNHO: 'gray', CONFIRMADO: 'blue', EM_SEPARACAO: 'orange', FATURADO: 'green', CANCELADO: 'red' }

export default function PedidosVendaPage() {
  useModuloGuard('VENDAS')
  useEffect(() => { document.title = 'VisioFab - Vendas - Pedidos' }, [])
  const router = useRouter()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: response, isLoading, refetch } = useQuery<any>({
    queryKey: ['pedidos-venda', { status: statusFilter, page, limit }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit }
      if (statusFilter) params.status = statusFilter
      const { data } = await api.get('/pedidos-venda', { params })
      return data
    },
  })

  const confirmar = useMutation({
    mutationFn: async (id: string) => { const { data } = await api.patch(`/pedidos-venda/${id}/confirmar`); return data },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pedidos-venda'] }); notifications.show({ title: 'Sucesso', message: 'Pedido confirmado', color: 'green' }) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  const cancelar = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => { const { data } = await api.patch(`/pedidos-venda/${id}/cancelar`, { motivo }); return data },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pedidos-venda'] }); notifications.show({ title: 'Sucesso', message: 'Pedido cancelado', color: 'green' }) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / Pedidos</Text>
      <Text size="xl" fw={600} mb="lg">Pedidos de Venda</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <Select placeholder="Status" data={[{ value: 'RASCUNHO', label: 'Rascunho' }, { value: 'CONFIRMADO', label: 'Confirmado' }, { value: 'EM_SEPARACAO', label: 'Em Separação' }, { value: 'FATURADO', label: 'Faturado' }, { value: 'CANCELADO', label: 'Cancelado' }]} value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1) }} clearable className="w-40" />
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={() => router.push('/vendas/pedidos/novo')}>Novo Pedido</Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Número</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Vendedor</Table.Th>
              <Table.Th>Valor Total</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th className="w-32">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.numero}</Table.Td>
                <Table.Td>{item.cliente?.nomeFantasia || item.cliente?.razaoSocial}</Table.Td>
                <Table.Td>{item.vendedor?.nome || '—'}</Table.Td>
                <Table.Td>{Number(item.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                <Table.Td><Badge color={statusColors[item.status] || 'gray'}>{item.status}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Ver"><ActionIcon variant="subtle" color="gray" onClick={() => router.push(`/vendas/pedidos/${item.id}`)}><IconEye size={18} /></ActionIcon></Tooltip>
                    {item.status === 'RASCUNHO' && <Tooltip label="Confirmar"><ActionIcon variant="subtle" color="blue" onClick={() => { if (confirm('Confirmar?')) confirmar.mutate(item.id) }}><IconCheck size={18} /></ActionIcon></Tooltip>}
                    {['RASCUNHO', 'CONFIRMADO'].includes(item.status) && <Tooltip label="Cancelar"><ActionIcon variant="subtle" color="red" onClick={() => { const m = prompt('Motivo (min 10 chars):'); if (m && m.length >= 10) cancelar.mutate({ id: item.id, motivo: m }) }}><IconX size={18} /></ActionIcon></Tooltip>}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhum pedido</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && <Group justify="center" mt="md"><Pagination total={totalPages} value={page} onChange={setPage} /></Group>}
      </Card>
    </div>
  )
}
